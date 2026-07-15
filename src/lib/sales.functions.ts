import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saleInput = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid().nullable(),
    name: z.string().min(1).max(200),
    price: z.number().nonnegative(),
    quantity: z.number().positive(),
    desconto: z.number().nonnegative().optional(),
  })).min(1),
  payment_method: z.enum(["dinheiro", "credito", "debito", "pix", "misto"]),
  amount_paid: z.number().nonnegative().nullable(),
  caixa_id: z.string().uuid().nullable().optional(),
  payment_methods: z.array(z.object({
    method: z.enum(["dinheiro", "credito", "debito", "pix"]),
    valor: z.number().nonnegative(),
  })).optional(),
  desconto_geral: z.number().nonnegative().optional(),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saleInput.parse(d))
  .handler(async ({ data, context }) => {
    const subtotal = +data.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
    const totalDescontoItens = +data.items.reduce((s, i) => s + (i.desconto ?? 0), 0).toFixed(2);
    const total = +Math.max(0, subtotal - totalDescontoItens - (data.desconto_geral ?? 0)).toFixed(2);

    const totalPago = data.payment_methods
      ? data.payment_methods.reduce((s, p) => s + p.valor, 0)
      : data.amount_paid ?? total;

    const change = data.payment_method === "dinheiro" && data.amount_paid != null
      ? Math.max(0, +(data.amount_paid - total).toFixed(2))
      : data.payment_method === "misto" && data.payment_methods
        ? Math.max(0, +(totalPago - total).toFixed(2))
        : 0;

    const { data: sale, error: saleErr } = await context.supabase
      .from("sales")
      .insert({
        total,
        desconto: (data.desconto_geral ?? 0) + totalDescontoItens,
        payment_method: data.payment_method,
        amount_paid: data.amount_paid ?? totalPago,
        change_due: change,
        payment_methods: data.payment_methods ?? null,
        created_by: context.userId,
      })
      .select("id, receipt_number, created_at")
      .single();

    if (saleErr || !sale) throw new Error(saleErr?.message ?? "Falha ao criar venda");

    const dataSaida = new Date().toISOString();
    const items = data.items.map((i) => ({
      sale_id: sale.id,
      product_id: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      subtotal: +(i.price * i.quantity - (i.desconto ?? 0)).toFixed(2),
      desconto: i.desconto ?? 0,
      data_saida: dataSaida,
    }));

    const { error: itErr } = await context.supabase.from("sale_items").insert(items);
    if (itErr) throw new Error(itErr.message);

    return { id: sale.id, receipt_number: sale.receipt_number, created_at: sale.created_at, total, change };
  });

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sales")
      .select("id, receipt_number, total, desconto, payment_method, payment_methods, amount_paid, change_due, created_at, canceled_at, cancel_reason")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sale, error } = await context.supabase
      .from("sales")
      .select("id, receipt_number, total, payment_method, payment_methods, amount_paid, change_due, created_at, canceled_at, cancel_reason, sale_items(name, price, quantity, subtotal, desconto, data_saida, product_id)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return sale;
  });

export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales")
      .update({
        canceled_at: new Date().toISOString(),
        canceled_by: context.userId,
        cancel_reason: data.reason ?? null,
      })
      .eq("id", data.id)
      .is("canceled_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// CAIXA
// ============================================================

export const getCaixaAberto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("caixa")
      .select("*") // Puxa tudo, incluindo a nova coluna nome_operador
      .eq("status", "ABERTO")
      .order("aberto_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const abrirCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nome_operador: z.string().min(1, "O nome é obrigatório"), // <-- RECEBER O NOME
      valor_abertura: z.number().nonnegative(),
      observacao: z.string().max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: aberto } = await context.supabase
      .from("caixa")
      .select("id")
      .eq("status", "ABERTO")
      .limit(1)
      .maybeSingle();
    if (aberto) throw new Error("Já existe um caixa aberto.");

    const { data: caixa, error } = await context.supabase
      .from("caixa")
      .insert({
        nome_operador: data.nome_operador, // <-- GUARDAR NA BASE DE DADOS
        valor_abertura: data.valor_abertura,
        observacao_abertura: data.observacao ?? null,
        aberto_por: context.userId,
        status: "ABERTO",
      }as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return caixa;
  });

export const fecharCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      valor_fechamento: z.number().nonnegative(),
      observacao: z.string().max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("caixa")
      .update({
        valor_fechamento: data.valor_fechamento,
        observacao_fechamento: data.observacao ?? null,
        fechado_por: context.userId,
        fechado_em: new Date().toISOString(),
        status: "FECHADO",
      })
      .eq("id", data.id)
      .eq("status", "ABERTO");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCaixa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("caixa")
      .select("*")
      .order("aberto_em", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================
// SANGRIA
// ============================================================

export const registrarSangria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      caixa_id: z.string().uuid(),
      valor: z.number().positive(),
      motivo: z.string().max(300).optional(),
      nome_responsavel: z.string().min(1).max(100),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: sangria, error } = await context.supabase
      .from("sangria")
      .insert({
        caixa_id: data.caixa_id,
        valor: data.valor,
        motivo: data.motivo ?? null,
        nome_responsavel: data.nome_responsavel,
        realizado_por: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return sangria;
  });

export const listSangrias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ caixa_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: sangrias, error } = await context.supabase
      .from("sangria")
      .select("*")
      .eq("caixa_id", data.caixa_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return sangrias ?? [];
  });

// ============================================================
// FECHAMENTO DIÁRIO E MENSAL
// ============================================================

export const getFechamentoDiario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ caixa_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: caixa, error: caixaErr } = await context.supabase
      .from("caixa")
      .select("*")
      .eq("id", data.caixa_id)
      .single();
    if (caixaErr || !caixa) throw new Error("Caixa não encontrado.");

    const abertoEm = new Date(caixa.aberto_em).toISOString();

    const { data: vendas } = await context.supabase
      .from("sales")
      .select("id, total, payment_method, payment_methods, canceled_at, desconto, created_at")
      .gte("created_at", abertoEm);

    const { data: sangrias } = await context.supabase
      .from("sangria")
      .select("*")
      .eq("caixa_id", data.caixa_id)
      .order("created_at", { ascending: true });

    const todasVendas = vendas ?? [];
    const todasSangrias = sangrias ?? [];

    const vendasAtivas = todasVendas.filter((v) => !v.canceled_at);
    const vendasCanceladas = todasVendas.filter((v) => !!v.canceled_at);

    const total_vendas = vendasAtivas.reduce((s, v) => s + Number(v.total), 0);
    const total_cancelamentos = vendasCanceladas.reduce((s, v) => s + Number(v.total), 0);

    let total_dinheiro = 0;
    let total_credito = 0;
    let total_debito = 0;
    let total_pix = 0;

    for (const v of vendasAtivas) {
      if (v.payment_method === "misto" && v.payment_methods) {
        const methods = v.payment_methods as { method: string; valor: number }[];
        for (const m of methods) {
          if (m.method === "dinheiro") total_dinheiro += m.valor;
          else if (m.method === "credito") total_credito += m.valor;
          else if (m.method === "debito") total_debito += m.valor;
          else if (m.method === "pix") total_pix += m.valor;
        }
      } else {
        if (v.payment_method === "dinheiro") total_dinheiro += Number(v.total);
        else if (v.payment_method === "credito") total_credito += Number(v.total);
        else if (v.payment_method === "debito") total_debito += Number(v.total);
        else if (v.payment_method === "pix") total_pix += Number(v.total);
      }
    }

    const total_descontos = vendasAtivas.reduce((s, v) => s + Number(v.desconto ?? 0), 0);
    const total_sangrias = todasSangrias.reduce((s, sg) => s + Number(sg.valor), 0);
    const saldo_esperado = Number(caixa.valor_abertura) + total_dinheiro - total_sangrias;

    return {
      caixa,
      vendas: todasVendas,
      sangrias: todasSangrias,
      total_vendas,
      total_cancelamentos,
      total_dinheiro,
      total_credito,
      total_debito,
      total_pix,
      total_descontos,
      total_sangrias,
      qtd_vendas: vendasAtivas.length,
      qtd_cancelamentos: vendasCanceladas.length,
      qtd_sangrias: todasSangrias.length,
      saldo_esperado,
    };
  });

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

export const listFechamentosMensais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ano: z.number(), mes: z.number() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const inicio = `${data.ano}-${String(data.mes).padStart(2, "0")}-01`;
    const fim = new Date(data.ano, data.mes, 0).toISOString().split("T")[0];
    const { data: fechamentos, error } = await context.supabase
      .from("fechamento_caixa")
      .select("*")
      .gte("data_fechamento", inicio)
      .lte("data_fechamento", fim)
      .order("data_fechamento", { ascending: true });
    if (error) throw new Error(error.message);
    return fechamentos ?? [];
  });

  // ============================================================
// OPERADORES
// ============================================================

export const listOperadores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("operadores")
      .select("*")
      .eq("ativo", true)
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarOperador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nome: z.string().min(1).max(100),
      numero: z.number().int().positive(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: op, error } = await context.supabase
      .from("operadores")
      .insert({ nome: data.nome, numero: data.numero })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return op;
  });

export const atualizarOperador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      nome: z.string().min(1).max(100),
      numero: z.number().int().positive(),
      ativo: z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("operadores")
      .update({ nome: data.nome, numero: data.numero, ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletarOperador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("operadores")
      .update({ ativo: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// FOCUS NFe
// ============================================================

export const getFocusNfeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Importação dinâmica garante que focus-nfe.server.ts nunca chegue ao bundle do cliente
    const { isFocusNfeConfigurado } = await import("@/lib/focus-nfe.server");
    return { configurado: isFocusNfeConfigurado() };
  });

export const emitirNfceVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ saleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { emitirNfce } = await import("@/lib/focus-nfe.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return emitirNfce(data.saleId, context.supabase as any);
  });