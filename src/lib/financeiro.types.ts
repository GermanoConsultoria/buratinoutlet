import type { Database } from "@/integrations/supabase/types";

// Tipos base derivados do schema
export type PlanoContas =
  Database["public"]["Tables"]["plano_contas"]["Row"];

export type LancamentoFinanceiro =
  Database["public"]["Tables"]["lancamento_financeiro"]["Row"];

export type AnexoFinanceiro =
  Database["public"]["Tables"]["anexo_financeiro"]["Row"];

// Tipos de domínio
export type TipoLancamento = "DESPESA" | "RECEITA";
export type StatusLancamento = "PENDENTE" | "PAGO" | "CANCELADO";
export type RecorrenciaTipo = "NAO" | "DIARIAMENTE" | "SEMANALMENTE" | "MENSALMENTE";

export type LancamentoComRelacoes = LancamentoFinanceiro & {
  plano_contas: PlanoContas;
  anexos: AnexoFinanceiro[];
};

export type ItemBalanceteConta = {
  plano_contas_id: string;
  nome: string;
  total: number;
};

export type DadosMensaisBalancete = {
  mes: string;
  receitas: number;
  despesas: number;
  lucro: number;
};

export type ContratoEncerrando = {
  id: string;
  descricao: string;
  valor: number;
  dt_ultima_parcela: string;
  dias_restantes: number;
  parcelas_restantes: number;
  total_parcelas: number;
};

export type Balancete = {
  receitas: number;
  despesas: number;
  lucro: number;
  saldo: number;
  a_receber: number;
  a_pagar: number;
  receitas_por_conta: ItemBalanceteConta[];
  despesas_por_conta: ItemBalanceteConta[];
  lancamentos_por_conta: Record<string, { descricao: string; valor: number; status: string; dt_vencimento: string }[]>;
  dados_mensais: DadosMensaisBalancete[];
  contratos_encerrando: ContratoEncerrando[];
};