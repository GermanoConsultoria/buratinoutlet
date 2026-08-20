import process from "node:process";

// Lê SEMPRE dentro de função — leitura em escopo de módulo retorna undefined em Workers.
export function isFocusNfeConfigurado(): boolean {
  return !!(
    process.env.FOCUS_NFE_TOKEN &&
    process.env.FOCUS_NFE_AMBIENTE &&
    process.env.FOCUS_NFE_CNPJ_EMITENTE
  );
}

export type NfceResultado =
  | {
      ok: true;
      status: "autorizado";
      chave: string;
      numero: string;
      serie: string;
      status_sefaz: string;
      mensagem_sefaz: string;
      danfe_url: string | null;
      qrcode_url: string | null;
      xml_url: string | null;
    }
  | {
      ok: false;
      status: "erro_autorizacao";
      status_sefaz: string;
      mensagem_sefaz: string;
    };

function mapPayment(method: string): string {
  switch (method) {
    case "dinheiro":
      return "01";
    case "credito":
      return "03";
    case "debito":
      return "04";
    // TODO: confirmar código de forma_pagamento para PIX com suporte da Focus NFe antes de usar.
    // A documentação consultada não confirma o código correto (possíveis: 17, 99, etc.).
    // Emissão de NFC-e com PIX está BLOQUEADA até confirmação explícita.
    case "pix":
      throw new Error(
        "PIX: código de forma de pagamento não confirmado com a Focus NFe. " +
          "Confirme o código correto com o suporte antes de emitir NFC-e com PIX.",
      );
    default:
      throw new Error(
        `Forma de pagamento não mapeada para NFC-e: "${method}". ` +
          "Verifique o mapeamento em focus-nfe.server.ts.",
      );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function emitirNfce(saleId: string, supabase: any): Promise<NfceResultado> {
  if (!isFocusNfeConfigurado()) {
    throw new Error("Integração com Focus NFe não configurada.");
  }

  const token = process.env.FOCUS_NFE_TOKEN!;
  const ambiente = process.env.FOCUS_NFE_AMBIENTE!;
  const cnpjEmitente = process.env.FOCUS_NFE_CNPJ_EMITENTE!;

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, total, payment_method, payment_methods, amount_paid")
    .eq("id", saleId)
    .single();

  if (saleErr || !sale) throw new Error("Venda não encontrada para emissão de NFC-e.");

  const { data: saleItems, error: itemsErr } = await supabase
    .from("sale_items")
    .select(
      "name, price, quantity, subtotal, desconto, product_id, products(ncm, cfop, icms_origem, icms_situacao_tributaria, sku, ibs_cbs_situacao_tributaria, ibs_cbs_classificacao_tributaria, cbs_aliquota, ibs_aliquota_total)",
    )
    .eq("sale_id", saleId);

  if (itemsErr || !saleItems || saleItems.length === 0) {
    throw new Error("Itens da venda não encontrados.");
  }

  // Valida ANTES de chamar a API: todos os itens devem ter classificação fiscal completa.
  const semClassificacao: string[] = [];
  for (const item of saleItems) {
    const prod = item.products;
    if (
      !prod?.ncm ||
      !prod?.cfop ||
      !prod?.icms_situacao_tributaria ||
      !prod?.ibs_cbs_situacao_tributaria ||
      !prod?.ibs_cbs_classificacao_tributaria
    ) {
      semClassificacao.push(item.name as string);
    }
  }
  if (semClassificacao.length > 0) {
    throw new Error(
      "Produtos sem classificação fiscal — NFC-e não emitida:\n" +
        semClassificacao.map((n: string) => `• ${n}`).join("\n") +
        "\n\nPreencha NCM, CFOP e Situação Tributária do ICMS antes de emitir NFC-e.",
    );
  }

  // Monta array de itens conforme schema Focus NFe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = saleItems.map((item: any, idx: number) => {
    const prod = item.products;
    const desconto = Number(item.desconto ?? 0);
    const valorBruto = +(Number(item.price) * Number(item.quantity)).toFixed(2);
    const entry: Record<string, unknown> = {
      numero_item: idx + 1,
      codigo_ncm: prod.ncm,
      // Usa SKU como codigo_produto; fallback para product_id truncado
      codigo_produto: prod.sku ?? String(item.product_id ?? idx + 1).slice(0, 60),
      descricao: item.name,
      quantidade_comercial: Number(item.quantity),
      quantidade_tributavel: Number(item.quantity),
      cfop: prod.cfop,
      valor_unitario_comercial: Number(item.price),
      valor_unitario_tributavel: Number(item.price),
      valor_bruto: valorBruto,
      // TODO: unidade_comercial deve vir do cadastro do produto quando o campo for adicionado.
      // Usando "UN" (unidade) como padrão para varejo enquanto o campo não existe.
      unidade_comercial: "UN",
      unidade_tributavel: "UN",
      icms_origem: prod.icms_origem ?? "0",
      icms_situacao_tributaria: prod.icms_situacao_tributaria,
      // Reforma Tributária — IBS/CBS
      ibs_cbs_situacao_tributaria: prod.ibs_cbs_situacao_tributaria,
      ibs_cbs_classificacao_tributaria: prod.ibs_cbs_classificacao_tributaria,
    };
    if (prod.cbs_aliquota != null) entry.cbs_aliquota = Number(prod.cbs_aliquota);
    if (prod.ibs_aliquota_total != null) {
      // TEMPORÁRIO: aguardando confirmação da contadora sobre divisão UF/Município do IBS.
      // Por enquanto, todo o valor vai para ibs_uf_aliquota e ibs_mun_aliquota = 0.
      entry.ibs_uf_aliquota = Number(prod.ibs_aliquota_total);
      entry.ibs_mun_aliquota = 0;
    }
    if (desconto > 0) entry.desconto = desconto;
    return entry;
  });

  // Monta formas de pagamento
  // TODO (misto com PIX): se a venda for misto e contiver PIX, mapPayment lançará erro.
  // Confirme o código PIX com o suporte da Focus NFe antes de habilitar esse cenário.
  const formasPagamento: { forma_pagamento: string; valor_pagamento: number }[] = [];
  if (sale.payment_method === "misto" && Array.isArray(sale.payment_methods)) {
    for (const pm of sale.payment_methods as { method: string; valor: number }[]) {
      formasPagamento.push({
        forma_pagamento: mapPayment(pm.method),
        valor_pagamento: Number(pm.valor),
      });
    }
  } else {
    formasPagamento.push({
      forma_pagamento: mapPayment(sale.payment_method as string),
      valor_pagamento: Number(sale.total),
    });
  }

  const payload = {
    cnpj_emitente: cnpjEmitente,
    data_emissao: new Date().toISOString(),
    // 1 = Operação presencial — padrão para PDV físico (SEFAZ Tab. 5.4)
    presenca_comprador: 1,
    // 9 = Sem ocorrência de transporte — varejo sem frete (SEFAZ Tab. 5.14)
    modalidade_frete: 9,
    // 1 = Operação interna (consumidor no mesmo estado) (SEFAZ Tab. 5.48)
    local_destino: 1,
    natureza_operacao: "VENDA AO CONSUMIDOR",
    items,
    formas_pagamento: formasPagamento,
  };

  const baseUrl =
    ambiente === "producao"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";

  const ref = `venda-${saleId}`;
  const resp = await fetch(`${baseUrl}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${token}:`)}`,
    },
    body: JSON.stringify(payload),
  });

  const json = (await resp.json()) as Record<string, unknown>;
  console.error("[FOCUS-DEBUG]", resp.status, resp.url, JSON.stringify(json));

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
        nfce_danfe_url: json.caminho_danfe
          ? String(json.caminho_danfe).startsWith("http")
            ? String(json.caminho_danfe)
            : `${baseUrl}${json.caminho_danfe}`
          : null,
        nfce_qrcode_url: (json.qrcode_url as string | null) ?? null,
        nfce_xml_url: json.caminho_xml_nota_fiscal
          ? String(json.caminho_xml_nota_fiscal).startsWith("http")
            ? String(json.caminho_xml_nota_fiscal)
            : `${baseUrl}${json.caminho_xml_nota_fiscal}`
          : null,
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
      danfe_url: json.caminho_danfe
        ? String(json.caminho_danfe).startsWith("http")
          ? String(json.caminho_danfe)
          : `${baseUrl}${json.caminho_danfe}`
        : null,
      qrcode_url: (json.qrcode_url as string | null) ?? null,
      xml_url: json.caminho_xml_nota_fiscal
        ? String(json.caminho_xml_nota_fiscal).startsWith("http")
          ? String(json.caminho_xml_nota_fiscal)
          : `${baseUrl}${json.caminho_xml_nota_fiscal}`
        : null,
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
}
