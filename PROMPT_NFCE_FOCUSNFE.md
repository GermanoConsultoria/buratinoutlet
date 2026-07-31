# Prompt de Implementação — NFC-e Focus NFe
# Migração de `buratinoutlet` → `buratinoutletestiva`

## Projetos

| Papel | Caminho |
|-------|---------|
| **Fonte** (referência, mais atualizado) | `/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutlet` |
| **Destino** (recebe as mudanças) | `/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva` |

---

## ANÁLISE COMPLETA — O QUE CADA PROJETO TEM

### Migrations SQL

| Arquivo | buratinoutlet (fonte) | buratinoutletestiva (destino) |
|---------|----------------------|-------------------------------|
| `20260528*` (base) | ✅ | ✅ (idêntico) |
| `20260529*` (base) | ✅ | ✅ (idêntico) |
| `20260710120000_focus_nfe_campos.sql` | ✅ | ✅ (idêntico) |
| `20260715120000_fechamento_caixa_rls.sql` | ✅ RLS + unique constraint em `fechamento_caixa` | ❌ **FALTA** |
| `20260715120001_fix_sem_categoria.sql` | ✅ `UPDATE category = 'Sem Categoria'` | ✅ (equivalente: `fix_null_categories.sql`) |
| `20260720120000_nfce_erro_bruto.sql` | ✅ coluna `nfce_erro_bruto jsonb` em `sales` | ❌ **FALTA** |

---

## O QUE PRECISA SER APLICADO NO DESTINO

### MUDANÇA 1 — Nova migration: `nfce_erro_bruto`

**Arquivo a criar:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/supabase/migrations/20260720120000_nfce_erro_bruto.sql`

**Conteúdo:**
```sql
-- Salva corpo bruto da resposta de erro da Focus NFe para debug em produção
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_erro_bruto jsonb;
```

---

### MUDANÇA 2 — Nova migration: `fechamento_caixa_rls`

> **Por quê:** A tabela `fechamento_caixa` foi criada manualmente sem RLS nem constraint de unicidade. No destino, o `salvarFechamentoDiario` usa `insert` simples; no fonte ele usa `upsert` com `onConflict: "caixa_id"` — o que requer o `UNIQUE (caixa_id)`. Aplicar esta migration permite sincronizar o comportamento.

**Arquivo a criar:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/supabase/migrations/20260715120001_fechamento_caixa_rls.sql`

**Conteúdo — copiar exatamente de:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutlet/supabase/migrations/20260715120000_fechamento_caixa_rls.sql`

```sql
-- Garante que RLS existe e adiciona policies para fechamento_caixa
ALTER TABLE public.fechamento_caixa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fechamento_caixa' AND policyname = 'fechamento_caixa read'
  ) THEN
    EXECUTE 'CREATE POLICY "fechamento_caixa read" ON public.fechamento_caixa FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fechamento_caixa' AND policyname = 'fechamento_caixa insert'
  ) THEN
    EXECUTE 'CREATE POLICY "fechamento_caixa insert" ON public.fechamento_caixa FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fechamento_caixa' AND policyname = 'fechamento_caixa update'
  ) THEN
    EXECUTE 'CREATE POLICY "fechamento_caixa update" ON public.fechamento_caixa FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Garante unicidade: cada sessão de caixa tem no máximo um fechamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fechamento_caixa_caixa_id_unique'
  ) THEN
    ALTER TABLE public.fechamento_caixa
      ADD CONSTRAINT fechamento_caixa_caixa_id_unique UNIQUE (caixa_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.fechamento_caixa TO authenticated;
GRANT ALL ON public.fechamento_caixa TO service_role;
```

---

### MUDANÇA 3 — `focus-nfe.server.ts` — atualizar bloco de tratamento de resposta

**Arquivo no destino:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/src/lib/focus-nfe.server.ts`

O arquivo existe no destino mas está na versão antiga — falta:
- Logs de debug (`console.error`)
- Extração de mensagem de erro em cascata
- Gravação de `nfce_erro_bruto` no banco
- Limpeza de `nfce_erro_bruto` no sucesso

**Substituir TODO o conteúdo do arquivo pelo conteúdo de:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutlet/src/lib/focus-nfe.server.ts`

Ou aplicar apenas o bloco alterado — substituir de `const json = ...` até o final da função:

**ANTES (versão antiga no destino):**
```typescript
  const json = (await resp.json()) as Record<string, unknown>;

  if (json.status === "autorizado") {
    await supabase
      .from("sales")
      .update({
        nfce_status: "autorizado",
        nfce_chave: json.chave_nfe ?? null,
        nfce_numero: json.numero != null ? String(json.numero) : null,
        nfce_serie: json.serie != null ? String(json.serie) : null,
        nfce_status_sefaz: json.status_sefaz ?? null,
        nfce_mensagem_sefaz: json.mensagem_sefaz ?? null,
        nfce_danfe_url: json.caminho_danfe ?? null,
        nfce_qrcode_url: json.qrcode_url ?? null,
        nfce_xml_url: json.caminho_xml_nota_fiscal ?? null,
      })
      .eq("id", saleId);

    return {
      ok: true,
      status: "autorizado",
      chave: (json.chave_nfe as string) ?? "",
      numero: json.numero != null ? String(json.numero) : "",
      serie: json.serie != null ? String(json.serie) : "",
      status_sefaz: (json.status_sefaz as string) ?? "",
      mensagem_sefaz: (json.mensagem_sefaz as string) ?? "",
      danfe_url: (json.caminho_danfe as string | null) ?? null,
      qrcode_url: (json.qrcode_url as string | null) ?? null,
      xml_url: (json.caminho_xml_nota_fiscal as string | null) ?? null,
    };
  }

  // Salva status de erro sem reverter a venda — ela já existe independente do resultado fiscal.
  await supabase
    .from("sales")
    .update({
      nfce_status: (json.status as string) ?? "erro_autorizacao",
      nfce_status_sefaz: (json.status_sefaz as string | null) ?? null,
      nfce_mensagem_sefaz: (json.mensagem_sefaz as string | null) ?? null,
    })
    .eq("id", saleId);

  return {
    ok: false,
    status: "erro_autorizacao",
    status_sefaz: (json.status_sefaz as string) ?? "",
    mensagem_sefaz: (json.mensagem_sefaz as string) ?? "Erro desconhecido na SEFAZ.",
  };
```

**DEPOIS (versão atualizada da fonte):**
```typescript
  const json = (await resp.json()) as Record<string, unknown>;

  // DEBUG TEMPORÁRIO — remover após confirmar o formato exato dos erros da Focus NFe
  console.error("[Focus NFe] HTTP status:", resp.status);
  console.error("[Focus NFe] Resposta bruta:", JSON.stringify(json, null, 2));

  if (json.status === "autorizado") {
    await supabase
      .from("sales")
      .update({
        nfce_status: "autorizado",
        nfce_chave: json.chave_nfe ?? null,
        nfce_numero: json.numero != null ? String(json.numero) : null,
        nfce_serie: json.serie != null ? String(json.serie) : null,
        nfce_status_sefaz: json.status_sefaz ?? null,
        nfce_mensagem_sefaz: json.mensagem_sefaz ?? null,
        nfce_danfe_url: json.caminho_danfe ?? null,
        nfce_qrcode_url: json.qrcode_url ?? null,
        nfce_xml_url: json.caminho_xml_nota_fiscal ?? null,
        nfce_erro_bruto: null,
      })
      .eq("id", saleId);

    return {
      ok: true,
      status: "autorizado",
      chave: (json.chave_nfe as string) ?? "",
      numero: json.numero != null ? String(json.numero) : "",
      serie: json.serie != null ? String(json.serie) : "",
      status_sefaz: (json.status_sefaz as string) ?? "",
      mensagem_sefaz: (json.mensagem_sefaz as string) ?? "",
      danfe_url: (json.caminho_danfe as string | null) ?? null,
      qrcode_url: (json.qrcode_url as string | null) ?? null,
      xml_url: (json.caminho_xml_nota_fiscal as string | null) ?? null,
    };
  }

  // Extrai a mensagem de erro mais específica disponível, em ordem de prioridade
  let mensagemErro: string;
  if (json.mensagem_sefaz && typeof json.mensagem_sefaz === "string") {
    mensagemErro = json.mensagem_sefaz;
  } else if (json.mensagem && typeof json.mensagem === "string") {
    mensagemErro = json.mensagem;
  } else if (Array.isArray(json.erros) && json.erros.length > 0) {
    mensagemErro = (json.erros as { mensagem?: string; campo?: string }[])
      .map((e) => (e.campo ? `${e.campo}: ${e.mensagem ?? ""}` : (e.mensagem ?? JSON.stringify(e))))
      .join(" | ");
  } else {
    mensagemErro = "Erro desconhecido na Focus NFe.";
  }

  // Inclui o código de status da Focus no início para facilitar diagnóstico
  const codigoStatus = typeof json.status === "string" ? json.status : null;
  const mensagemFinal = codigoStatus
    ? `[${codigoStatus}] ${mensagemErro}`
    : mensagemErro;

  // Salva status de erro sem reverter a venda — ela já existe independente do resultado fiscal.
  await supabase
    .from("sales")
    .update({
      nfce_status: codigoStatus ?? "erro_autorizacao",
      nfce_status_sefaz: (json.status_sefaz as string | null) ?? null,
      nfce_mensagem_sefaz: mensagemFinal,
      nfce_erro_bruto: json,
    })
    .eq("id", saleId);

  return {
    ok: false,
    status: "erro_autorizacao",
    status_sefaz: (json.status_sefaz as string) ?? "",
    mensagem_sefaz: mensagemFinal,
  };
```

---

### MUDANÇA 4 — `sales.functions.ts` — caixa por usuário + fechamento com upsert

**Arquivo no destino:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/src/lib/sales.functions.ts`

#### 4a. `abrirCaixa` — verificação por usuário (não global)

> **Por quê:** Na fonte, o fix `caixa aberto passa a ser por usuário, não mais global` adicionou `.eq("aberto_por", context.userId)` para que cada usuário possa ter seu próprio caixa aberto simultaneamente. No destino a verificação ainda é global — impede que dois operadores abram caixa ao mesmo tempo.

**ANTES (destino):**
```typescript
    const { data: aberto } = await context.supabase
      .from("caixa")
      .select("id")
      .eq("status", "ABERTO")
      .limit(1)
      .maybeSingle();
    if (aberto) throw new Error("Já existe um caixa aberto.");
```

**DEPOIS (fonte):**
```typescript
    const { data: aberto } = await context.supabase
      .from("caixa")
      .select("id")
      .eq("status", "ABERTO")
      .eq("aberto_por", context.userId)
      .limit(1)
      .maybeSingle();
    if (aberto) throw new Error("Você já tem um caixa aberto.");
```

#### 4b. `salvarFechamentoDiario` — upsert em vez de insert

> **Por quê:** Usa `UNIQUE (caixa_id)` criado pela migration da Mudança 2. Permite reabrir o modal de fechamento sem duplicar registros.

**ANTES (destino):**
```typescript
    const { error } = await context.supabase
      .from("fechamento_caixa")
      .insert({
        caixa_id: data.caixa_id,
        // ... demais campos ...
      });
```

**DEPOIS (fonte):**
```typescript
    const payload = {
      caixa_id: data.caixa_id,
      data_fechamento: new Date().toISOString().split("T")[0],
      total_vendas: data.total_vendas,
      total_cancelamentos: data.total_cancelamentos,
      total_sangrias: data.total_sangrias,
      total_descontos: data.total_descontos,
      qtd_vendas: data.qtd_vendas,
      qtd_cancelamentos: data.qtd_cancelamentos,
      qtd_sangrias: data.qtd_sangrias,
      total_dinheiro: data.total_dinheiro,
      total_credito: data.total_credito,
      total_debito: data.total_debito,
      total_pix: data.total_pix,
      valor_abertura: data.valor_abertura,
      valor_fechamento: data.valor_fechamento,
      saldo_esperado: data.saldo_esperado,
      nome_operador: data.nome_operador ?? null,
      fechado_por: context.userId,
    };
    const { error } = await context.supabase
      .from("fechamento_caixa")
      .upsert(payload, { onConflict: "caixa_id" });
```

Atenção: o inputValidator de `salvarFechamentoDiario` no destino não inclui `total_cancelamentos`, `total_descontos`, `qtd_cancelamentos`, `qtd_sangrias`. Precisa adicionar ao schema Zod — copie a versão completa da fonte:

```typescript
export const salvarFechamentoDiario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      caixa_id: z.string().uuid(),
      valor_fechamento: z.number().nonnegative(),
      total_vendas: z.number(),
      total_cancelamentos: z.number(),
      total_sangrias: z.number(),
      total_descontos: z.number(),
      qtd_vendas: z.number(),
      qtd_cancelamentos: z.number(),
      qtd_sangrias: z.number(),
      total_dinheiro: z.number(),
      total_credito: z.number(),
      total_debito: z.number(),
      total_pix: z.number(),
      valor_abertura: z.number(),
      saldo_esperado: z.number(),
      nome_operador: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const payload = {
      caixa_id: data.caixa_id,
      data_fechamento: new Date().toISOString().split("T")[0],
      total_vendas: data.total_vendas,
      total_cancelamentos: data.total_cancelamentos,
      total_sangrias: data.total_sangrias,
      total_descontos: data.total_descontos,
      qtd_vendas: data.qtd_vendas,
      qtd_cancelamentos: data.qtd_cancelamentos,
      qtd_sangrias: data.qtd_sangrias,
      total_dinheiro: data.total_dinheiro,
      total_credito: data.total_credito,
      total_debito: data.total_debito,
      total_pix: data.total_pix,
      valor_abertura: data.valor_abertura,
      valor_fechamento: data.valor_fechamento,
      saldo_esperado: data.saldo_esperado,
      nome_operador: data.nome_operador ?? null,
      fechado_por: context.userId,
    };
    const { error } = await context.supabase
      .from("fechamento_caixa")
      .upsert(payload, { onConflict: "caixa_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

---

### MUDANÇA 5 — `caixa.types.ts` — adicionar campos ausentes em `ResumoCaixa`

**Arquivo no destino:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/src/lib/caixa.types.ts`

**ANTES (destino):**
```typescript
export type ResumoCaixa = {
  caixa: Caixa;
  total_vendas: number;
  total_dinheiro: number;
  total_credito: number;
  total_debito: number;
  total_pix: number;
  qtd_vendas: number;
  total_sangrias: number;
  saldo_esperado: number;
};
```

**DEPOIS (fonte):**
```typescript
export type ResumoCaixa = {
  caixa: Caixa;
  total_vendas: number;
  total_cancelamentos: number;
  total_dinheiro: number;
  total_credito: number;
  total_debito: number;
  total_pix: number;
  total_descontos: number;
  total_sangrias: number;
  qtd_vendas: number;
  qtd_cancelamentos: number;
  qtd_sangrias: number;
  saldo_esperado: number;
};
```

---

### MUDANÇA 6 — `pdv.tsx` — cálculo de fechamento mais completo

**Arquivo no destino:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/src/routes/_app/pdv.tsx`

A função `handleFecharCaixaClick` no destino não calcula `vendasCanceladas`, `total_cancelamentos`, `total_descontos`, `qtd_cancelamentos` nem `qtd_sangrias`. Isso é necessário porque:
- `ModalFecharCaixa` agora recebe esses campos via `ResumoCaixa`
- `salvarFechamentoDiario` agora exige esses campos no payload

**ANTES (destino) — dentro de `handleFecharCaixaClick`:**
```typescript
      const vendasDoCaixa = vendas.filter(
        (v) => !v.canceled_at && new Date(v.created_at).getTime() >= abertoEm
      );
      const sangriasDoCaixa = sangrias.filter(
        (s) => new Date(s.created_at).getTime() >= abertoEm
      );
      const total_sangrias = sangriasDoCaixa.reduce((acc, s) => acc + Number(s.valor), 0);
      const total_vendas = vendasDoCaixa.reduce((s, v) => s + Number(v.total), 0);

      // ... cálculo de totais por forma de pagamento ...

      const saldo_esperado = caixaAberto.valor_abertura + total_dinheiro - total_sangrias;
      setResumoCaixa({
        caixa: caixaAberto,
        total_vendas,
        total_dinheiro,
        total_credito,
        total_debito,
        total_pix,
        total_sangrias,
        qtd_vendas: vendasDoCaixa.length,
        saldo_esperado,
      });
```

**DEPOIS (fonte) — substituir bloco completo:**
```typescript
      const vendasDoCaixa = vendas.filter(
        (v) => !v.canceled_at && new Date(v.created_at).getTime() >= abertoEm
      );
      const vendasCanceladasDoCaixa = vendas.filter(
        (v) => v.canceled_at && new Date(v.created_at).getTime() >= abertoEm
      );
      const sangriasDoCaixa = sangrias.filter(
        (s) => new Date(s.created_at).getTime() >= abertoEm
      );
      const total_sangrias = sangriasDoCaixa.reduce((acc, s) => acc + Number(s.valor), 0);
      const total_vendas = vendasDoCaixa.reduce((s, v) => s + Number(v.total), 0);
      const total_cancelamentos = vendasCanceladasDoCaixa.reduce((s, v) => s + Number(v.total), 0);
      const total_descontos = vendasDoCaixa.reduce((s, v) => s + Number((v as any).desconto ?? 0), 0);

      // ... cálculo de totais por forma de pagamento (idêntico) ...

      const saldo_esperado = caixaAberto.valor_abertura + total_dinheiro - total_sangrias;
      setResumoCaixa({
        caixa: caixaAberto,
        total_vendas,
        total_cancelamentos,
        total_descontos,
        total_dinheiro,
        total_credito,
        total_debito,
        total_pix,
        total_sangrias,
        qtd_vendas: vendasDoCaixa.length,
        qtd_cancelamentos: vendasCanceladasDoCaixa.length,
        qtd_sangrias: sangriasDoCaixa.length,
        saldo_esperado,
      });
```

---

### MUDANÇA 7 — `products.functions.ts` — `bulkImportProducts` com atualização fiscal e NCM

**Arquivo no destino:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/src/lib/products.functions.ts`

O destino não atualiza dados fiscais de produtos já existentes na importação em massa. A fonte faz isso.

#### 7a. Strip de não-dígitos do NCM na leitura da planilha

No destino, em `processXlsx` (dentro de `produtos.tsx`), o NCM é lido assim:
```typescript
const ncmCol = r[19] != null ? String(r[19]).trim() : null;
```

Na fonte:
```typescript
const ncmRaw = r[19] != null ? String(r[19]).replace(/\D/g, "").trim() : null;
const ncmCol = ncmRaw || null;
```

#### 7b. Lógica de upsert no `bulkImportProducts`

**ANTES (destino) — usa Set, só insere:**
```typescript
    const { data: existing, error: fetchError } = await context.supabase
      .from("products")
      .select("sku, name");
    if (fetchError) throw new Error(fetchError.message);

    const existingSet = new Set(
      (existing ?? []).map((p: any) =>
        `${(p.sku ?? "").trim().toLowerCase()}||${p.name.trim().toLowerCase()}`
      )
    );

    const newRows = rows.filter((r) => {
      const key = `${(r.sku ?? "").trim().toLowerCase()}||${r.name.trim().toLowerCase()}`;
      return !existingSet.has(key);
    });

    if (newRows.length === 0) return { ok: true, count: 0, skipped: rows.length };

    const chunk = 500;
    let count = 0;
    for (let i = 0; i < newRows.length; i += chunk) {
      const slice = newRows.slice(i, i + chunk);
      const { error } = await context.supabase.from("products").insert(slice as any);
      if (error) throw new Error(error.message);
      count += slice.length;
    }
    return { ok: true, count, skipped: rows.length - count };
```

**DEPOIS (fonte) — usa Map, insere novos E atualiza campos fiscais dos existentes:**
```typescript
    const { data: existing, error: fetchError } = await context.supabase
      .from("products")
      .select("id, sku, name");
    if (fetchError) throw new Error(fetchError.message);

    const existingMap = new Map(
      (existing ?? []).map((p: any) => [
        `${(p.sku ?? "").trim().toLowerCase()}||${p.name.trim().toLowerCase()}`,
        p.id as string,
      ])
    );

    const newRows = rows.filter((r) => {
      const key = `${(r.sku ?? "").trim().toLowerCase()}||${r.name.trim().toLowerCase()}`;
      return !existingMap.has(key);
    });

    const chunk = 500;
    let count = 0;
    for (let i = 0; i < newRows.length; i += chunk) {
      const slice = newRows.slice(i, i + chunk);
      const { error } = await context.supabase.from("products").insert(slice as any);
      if (error) throw new Error(error.message);
      count += slice.length;
    }

    const existingRows = rows
      .map((r) => {
        const key = `${(r.sku ?? "").trim().toLowerCase()}||${r.name.trim().toLowerCase()}`;
        const id = existingMap.get(key);
        if (!id) return null;
        const fiscais: Record<string, string> = {};
        if (r.ncm) fiscais.ncm = r.ncm;
        if (r.cfop) fiscais.cfop = r.cfop;
        if (r.icms_origem != null) fiscais.icms_origem = String(r.icms_origem);
        if (r.icms_situacao_tributaria) fiscais.icms_situacao_tributaria = r.icms_situacao_tributaria;
        if (Object.keys(fiscais).length === 0) return null;
        return { id, fiscais };
      })
      .filter((x): x is { id: string; fiscais: Record<string, string> } => x !== null);

    let updated = 0;
    for (let i = 0; i < existingRows.length; i += chunk) {
      const slice = existingRows.slice(i, i + chunk);
      for (const { id, fiscais } of slice) {
        const { error } = await context.supabase.from("products").update(fiscais as any).eq("id", id);
        if (error) throw new Error(error.message);
        updated++;
      }
    }

    return { ok: true, count, updated, skipped: rows.length - count - updated };
```

---

### MUDANÇA 8 — `produtos.tsx` — validação de NCM e toast com detalhes

**Arquivo no destino:**
`/Users/matheusfelis/Projects/Germano_Consultoria/buratinoutletestiva/src/routes/_app/produtos.tsx`

#### 8a. Strip de não-dígitos do NCM ao ler planilha

Dentro de `processXlsx`, alterar:
```typescript
// ANTES (destino):
const ncmCol = r[19] != null ? String(r[19]).trim() : null;

// DEPOIS (fonte):
const ncmRaw = r[19] != null ? String(r[19]).replace(/\D/g, "").trim() : null;
const ncmCol = ncmRaw || null;
```

#### 8b. Aviso de NCM fora do padrão de 8 dígitos

Após o `filter` de itens válidos e antes de chamar `bulk`, adicionar:
```typescript
      const ncmForaDoPadrao = items.filter((i) => i.ncm && i.ncm.length !== 8);
      if (ncmForaDoPadrao.length > 0) {
        toast.warning(`${ncmForaDoPadrao.length} produto(s) com NCM fora de 8 dígitos — revise com a contadora: ${ncmForaDoPadrao.map((i) => `${i.name} (${i.ncm})`).slice(0, 5).join(", ")}${ncmForaDoPadrao.length > 5 ? "…" : ""}`);
      }
```

#### 8c. Toast de sucesso com detalhes

**ANTES (destino):**
```typescript
      const res = await bulk({ data: { items, lote: lote || null } });
      toast.success(`${res.count} produtos importados da planilha`);
```

**DEPOIS (fonte):**
```typescript
      const res = await bulk({ data: { items, lote: lote || null } });
      const partes = [];
      if (res.count > 0) partes.push(`${res.count} inserido(s)`);
      if (res.updated > 0) partes.push(`${res.updated} atualizado(s) com dados fiscais`);
      if (res.skipped > 0) partes.push(`${res.skipped} sem alteração`);
      toast.success(`Importação concluída — ${partes.join(", ")}`);
```

#### 8d. Filtro de categoria para "Sem Categoria"

**ANTES (destino):**
```typescript
const matchCategoria = categoriaFiltro === "TODAS" || p.category === categoriaFiltro;
```

**DEPOIS (fonte):**
```typescript
const matchCategoria = categoriaFiltro === "TODAS" ||
  (categoriaFiltro === "Sem Categoria"
    ? (!p.category || p.category === "Sem Categoria")
    : p.category === categoriaFiltro);
```

E na listagem de categorias, a fonte inclui "Sem Categoria" como fallback:
```typescript
// ANTES (destino):
const categorias = [...new Set(products.map((p) => (p as any).category).filter(Boolean))].sort() as string[];

// DEPOIS (fonte):
const categorias = [...new Set(products.map((p) => (p as any).category ?? "Sem Categoria"))].sort() as string[];
```

---

## CHECKLIST DE APLICAÇÃO — em ordem obrigatória

```
BANCO (rodar antes de qualquer código):
[ ] 1. Criar migration 20260720120000_nfce_erro_bruto.sql no destino (Mudança 1)
[ ] 2. Criar migration 20260715120001_fechamento_caixa_rls.sql no destino (Mudança 2)
[ ] 3. Rodar: supabase db push (no projeto buratinoutletestiva)

CÓDIGO:
[ ] 4. Substituir bloco de resposta em focus-nfe.server.ts (Mudança 3)
[ ] 5. Atualizar abrirCaixa para verificação por usuário (Mudança 4a)
[ ] 6. Atualizar salvarFechamentoDiario para upsert + campos completos (Mudança 4b)
[ ] 7. Atualizar ResumoCaixa em caixa.types.ts (Mudança 5)
[ ] 8. Atualizar handleFecharCaixaClick em pdv.tsx (Mudança 6)
[ ] 9. Atualizar bulkImportProducts em products.functions.ts (Mudança 7)
[ ] 10. Atualizar processXlsx e toast em produtos.tsx (Mudança 8)
```

---

## O QUE É IDÊNTICO NOS DOIS PROJETOS (não precisa alterar)

- `src/lib/focus-nfe.server.ts` — a parte de configuração, tipos, `mapPayment`, montagem de itens e payload ✅
- `src/lib/sales.functions.ts` — `getFocusNfeStatus` e `emitirNfceVenda` ✅
- `src/lib/products.functions.ts` — schema Zod, `listProducts`, `upsertProduct`, `deleteProduct` ✅
- `src/routes/_app/pdv.tsx` — toda a UI de NFC-e (estados, diálogos, seletor de documento) ✅
- `src/routes/_app/produtos.tsx` — formulário de classificação fiscal, badge "NF", exportação XLSX ✅
- `src/lib/caixa.types.ts` — tipo `Caixa` ✅

---

## VARIÁVEIS DE AMBIENTE

Configure no Cloudflare Workers (via `wrangler.jsonc` ou dashboard do Cloudflare):

```env
FOCUS_NFE_TOKEN=seu_token_aqui
FOCUS_NFE_AMBIENTE=homologacao   # ou: producao
FOCUS_NFE_CNPJ_EMITENTE=00000000000000  # CNPJ sem pontuação (14 dígitos)
```

---

## TODOs ABERTOS (em ambos os projetos)

1. **PIX na NFC-e**: código `forma_pagamento` não confirmado com suporte Focus NFe. Bloqueado em `mapPayment`. Possíveis: `17` ou `99`.
2. **Unidade comercial**: fixada como `"UN"`. Adicionar campo no cadastro de produto para venda por kg/m²/litro.
3. **Reemissão / cancelamento de NFC-e**: não implementado. Fallback atual: cupom não fiscal.
4. **Logs de debug**: `console.error` em `focus-nfe.server.ts` são temporários — remover após confirmar o formato dos erros da Focus NFe.
5. **Tipos gerados do Supabase**: campos fiscais foram adicionados via migration manual, o tipo gerado não inclui essas colunas — inserts/updates usam cast `as any`. Regenerar com `supabase gen types typescript` após rodar as migrations.
