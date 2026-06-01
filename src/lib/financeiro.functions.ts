import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Balancete } from "@/lib/financeiro.types";

const saleItemInput = z.object({
  tipo: z.enum(["DESPESA", "RECEITA"]),
  descricao: z.string().min(1).max(500),
  beneficiario: z.string().max(200).nullable().optional(),
  valor: z.number().positive(),
  dt_vencimento: z.string(),
  numero_documento: z.string().max(100).nullable().optional(),
  plano_contas_id: z.string().uuid(),
  recorrencia: z.enum(["NAO", "DIARIAMENTE", "SEMANALMENTE", "MENSALMENTE"]).default("NAO"),
  numero_parcelas: z.number().int().min(1).max(120).default(1),
});

export const getLancamentosFinanceiros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      tipo: z.enum(["DESPESA", "RECEITA"]),
      status: z.enum(["TODOS", "PENDENTE", "PAGO", "CANCELADO"]).default("TODOS"),
      plano_contas_id: z.string().default("TODAS"),
      data_inicio: z.string().optional(),
      data_fim: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("lancamento_financeiro")
      .select("*, plano_contas(*), anexos:anexo_financeiro(*)")
      .eq("tipo", data.tipo)
      .order("dt_vencimento", { ascending: true });

    if (data.status !== "TODOS") query = query.eq("status", data.status);
    if (data.plano_contas_id !== "TODAS") query = query.eq("plano_contas_id", data.plano_contas_id);
    if (data.data_inicio) query = query.gte("dt_vencimento", `${data.data_inicio}T00:00:00.000Z`);
    if (data.data_fim) query = query.lte("dt_vencimento", `${data.data_fim}T23:59:59.999Z`);

    const { data: lancamentos, error } = await query;
    if (error) throw new Error(error.message);
    return lancamentos ?? [];
  });

export const criarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saleItemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { numero_parcelas, recorrencia, ...base } = data;

    if (numero_parcelas > 1) {
      const grupoParcela = crypto.randomUUID();
      const inserts = [];
      for (let i = 1; i <= numero_parcelas; i++) {
        const dt = new Date(base.dt_vencimento);
        dt.setMonth(dt.getMonth() + (i - 1));
        inserts.push({
          ...base,
          dt_vencimento: dt.toISOString(),
          recorrencia: "NAO" as const,
          numero_parcelas,
          parcela_atual: i,
          grupo_parcela_id: grupoParcela,
          created_by: context.userId,
        });
      }
      const { error } = await context.supabase.from("lancamento_financeiro").insert(inserts);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("lancamento_financeiro").insert({
        ...base,
        recorrencia,
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const editarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      descricao: z.string().min(1).max(500),
      beneficiario: z.string().max(200).nullable().optional(),
      valor: z.number().positive(),
      dt_vencimento: z.string(),
      numero_documento: z.string().max(100).nullable().optional(),
      plano_contas_id: z.string().uuid(),
      aplicar_a_todos: z.boolean().default(false),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, aplicar_a_todos, ...fields } = data;

    const { data: lancamento, error: fetchError } = await context.supabase
      .from("lancamento_financeiro")
      .select("grupo_parcela_id")
      .eq("id", id)
      .single();
    if (fetchError || !lancamento) throw new Error("Lançamento não encontrado.");

    const { error } = await context.supabase
      .from("lancamento_financeiro")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (aplicar_a_todos && lancamento.grupo_parcela_id) {
      const { error: groupError } = await context.supabase
        .from("lancamento_financeiro")
        .update({
          descricao: fields.descricao,
          beneficiario: fields.beneficiario,
          valor: fields.valor,
          numero_documento: fields.numero_documento,
          plano_contas_id: fields.plano_contas_id,
          updated_at: new Date().toISOString(),
        })
        .eq("grupo_parcela_id", lancamento.grupo_parcela_id)
        .neq("id", id);
      if (groupError) throw new Error(groupError.message);
    }
    return { ok: true };
  });

export const pagarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      dt_pagamento: z.string(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: lancamento, error: fetchError } = await context.supabase
      .from("lancamento_financeiro")
      .select("*")
      .eq("id", data.id)
      .single();
    if (fetchError || !lancamento) throw new Error("Lançamento não encontrado.");

    const { error } = await context.supabase
      .from("lancamento_financeiro")
      .update({ status: "PAGO", dt_pagamento: data.dt_pagamento, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (lancamento.recorrencia !== "NAO") {
      const base = new Date(lancamento.dt_vencimento);
      let proxData = new Date(base);
      if (lancamento.recorrencia === "DIARIAMENTE") proxData.setDate(proxData.getDate() + 1);
      else if (lancamento.recorrencia === "SEMANALMENTE") proxData.setDate(proxData.getDate() + 7);
      else proxData.setMonth(proxData.getMonth() + 1);

      const { error: createError } = await context.supabase.from("lancamento_financeiro").insert({
        tipo: lancamento.tipo,
        descricao: lancamento.descricao,
        beneficiario: lancamento.beneficiario,
        valor: lancamento.valor,
        dt_vencimento: proxData.toISOString(),
        numero_documento: lancamento.numero_documento,
        plano_contas_id: lancamento.plano_contas_id,
        recorrencia: lancamento.recorrencia,
        status: "PENDENTE",
        lancamento_pai_id: data.id,
        created_by: context.userId,
      });
      if (createError) throw new Error(createError.message);
    }
    return { ok: true };
  });

export const cancelarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lancamento_financeiro")
      .update({ status: "CANCELADO", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error: anexoError } = await context.supabase
      .from("anexo_financeiro")
      .delete()
      .eq("lancamento_id", data.id);
    if (anexoError) throw new Error(anexoError.message);

    const { error } = await context.supabase
      .from("lancamento_financeiro")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirGrupoParcelas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ grupo_parcela_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ids, error: fetchError } = await context.supabase
      .from("lancamento_financeiro")
      .select("id")
      .eq("grupo_parcela_id", data.grupo_parcela_id);
    if (fetchError) throw new Error(fetchError.message);

    const idsArr = (ids ?? []).map((l) => l.id);
    if (idsArr.length > 0) {
      await context.supabase.from("anexo_financeiro").delete().in("lancamento_id", idsArr);
      const { error } = await context.supabase
        .from("lancamento_financeiro")
        .delete()
        .in("id", idsArr);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const excluirEAvancarRecorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lancamento, error: fetchError } = await context.supabase
      .from("lancamento_financeiro")
      .select("*")
      .eq("id", data.id)
      .single();
    if (fetchError || !lancamento) throw new Error("Lançamento não encontrado.");

    const base = new Date(lancamento.dt_vencimento);
    let proxData = new Date(base);
    if (lancamento.recorrencia === "DIARIAMENTE") proxData.setDate(proxData.getDate() + 1);
    else if (lancamento.recorrencia === "SEMANALMENTE") proxData.setDate(proxData.getDate() + 7);
    else proxData.setMonth(proxData.getMonth() + 1);

    await context.supabase.from("anexo_financeiro").delete().eq("lancamento_id", data.id);
    await context.supabase.from("lancamento_financeiro").delete().eq("id", data.id);

    const { error } = await context.supabase.from("lancamento_financeiro").insert({
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      beneficiario: lancamento.beneficiario,
      valor: lancamento.valor,
      dt_vencimento: proxData.toISOString(),
      numero_documento: lancamento.numero_documento,
      plano_contas_id: lancamento.plano_contas_id,
      recorrencia: lancamento.recorrencia,
      status: "PENDENTE",
      lancamento_pai_id: data.id,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBalancete = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      data_inicio: z.string(),
      data_fim: z.string(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<Balancete> => {
    const inicio = `${data.data_inicio}T00:00:00.000Z`;
    const fim = `${data.data_fim}T23:59:59.999Z`;

    const { data: noPeriodo, error } = await context.supabase
      .from("lancamento_financeiro")
      .select("*, plano_contas(id, nome)")
      .neq("status", "CANCELADO")
      .gte("dt_vencimento", inicio)
      .lte("dt_vencimento", fim);
    if (error) throw new Error(error.message);

    const { data: todosPagos } = await context.supabase
      .from("lancamento_financeiro")
      .select("tipo, valor")
      .eq("status", "PAGO");

    const lancamentos = noPeriodo ?? [];
    const pagos = todosPagos ?? [];

    const receitas = lancamentos.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + Number(l.valor), 0);
    const despesas = lancamentos.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + Number(l.valor), 0);
    const lucro = receitas - despesas;

    const saldoReceitas = pagos.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + Number(l.valor), 0);
    const saldoDespesas = pagos.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + Number(l.valor), 0);
    const saldo = saldoReceitas - saldoDespesas;

    const a_receber = lancamentos.filter((l) => l.tipo === "RECEITA" && l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);
    const a_pagar = lancamentos.filter((l) => l.tipo === "DESPESA" && l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);

    const receitasPorConta = new Map<string, { nome: string; total: number }>();
    const despesasPorConta = new Map<string, { nome: string; total: number }>();
    const lancamentosPorConta: Record<string, { descricao: string; valor: number; status: string; dt_vencimento: string }[]> = {};

    for (const l of lancamentos) {
      const mapa = l.tipo === "RECEITA" ? receitasPorConta : despesasPorConta;
      const pc = l.plano_contas as { id: string; nome: string } | null;
      if (!pc) continue;
      const atual = mapa.get(l.plano_contas_id) ?? { nome: pc.nome, total: 0 };
      mapa.set(l.plano_contas_id, { nome: pc.nome, total: atual.total + Number(l.valor) });

      if (!lancamentosPorConta[l.plano_contas_id]) lancamentosPorConta[l.plano_contas_id] = [];
      lancamentosPorConta[l.plano_contas_id].push({
        descricao: l.descricao,
        valor: Number(l.valor),
        status: l.status,
        dt_vencimento: l.dt_vencimento,
      });
    }

    const mesesPtBR: Record<string, string> = {
      "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
      "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
      "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    };
    const mesesMap = new Map<string, { receitas: number; despesas: number }>();
    for (const l of lancamentos) {
      const dt = new Date(l.dt_vencimento);
      const chave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      const atual = mesesMap.get(chave) ?? { receitas: 0, despesas: 0 };
      if (l.tipo === "RECEITA") atual.receitas += Number(l.valor);
      else atual.despesas += Number(l.valor);
      mesesMap.set(chave, atual);
    }
    const dados_mensais = Array.from(mesesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, v]) => {
        const [ano, mes] = chave.split("-");
        return { mes: `${mesesPtBR[mes]}/${ano.slice(2)}`, receitas: v.receitas, despesas: v.despesas, lucro: Math.max(0, v.receitas - v.despesas) };
      });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em90dias = new Date(hoje);
    em90dias.setDate(hoje.getDate() + 90);

    const { data: parcelasReceita } = await context.supabase
      .from("lancamento_financeiro")
      .select("id, descricao, valor, dt_vencimento, numero_parcelas, parcela_atual, grupo_parcela_id, status")
      .eq("tipo", "RECEITA")
      .not("grupo_parcela_id", "is", null)
      .in("status", ["PENDENTE", "PAGO"]);

    const gruposMap = new Map<string, typeof parcelasReceita>();
    for (const p of parcelasReceita ?? []) {
      if (!p.grupo_parcela_id) continue;
      const arr = gruposMap.get(p.grupo_parcela_id) ?? [];
      arr.push(p);
      gruposMap.set(p.grupo_parcela_id, arr);
    }

    const contratos_encerrando = [];
    for (const [, parcelas] of gruposMap) {
      if (!parcelas || parcelas.length === 0) continue;
      const pendentes = parcelas.filter((p) => p.status === "PENDENTE");
      if (pendentes.length === 0) continue;
      const ultima = pendentes.sort((a, b) => new Date(b.dt_vencimento).getTime() - new Date(a.dt_vencimento).getTime())[0];
      const dtUltima = new Date(ultima.dt_vencimento);
      const diasRestantes = Math.ceil((dtUltima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (diasRestantes >= 0 && diasRestantes <= 90) {
        contratos_encerrando.push({
          id: ultima.id,
          descricao: ultima.descricao,
          valor: Number(ultima.valor),
          dt_ultima_parcela: ultima.dt_vencimento,
          dias_restantes: diasRestantes,
          parcelas_restantes: pendentes.length,
          total_parcelas: ultima.numero_parcelas ?? parcelas.length,
        });
      }
    }

    return {
      receitas,
      despesas,
      lucro,
      saldo,
      a_receber,
      a_pagar,
      receitas_por_conta: Array.from(receitasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, ...v })),
      despesas_por_conta: Array.from(despesasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, ...v })),
      lancamentos_por_conta: lancamentosPorConta,
      dados_mensais,
      contratos_encerrando,
    };
  });