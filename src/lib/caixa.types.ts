export type StatusCaixa = "ABERTO" | "FECHADO";

export type Caixa = {
  id: string;
  aberto_por: string | null;
  fechado_por: string | null;
  valor_abertura: number;
  valor_fechamento: number | null;
  observacao_abertura: string | null;
  observacao_fechamento: string | null;
  aberto_em: string;
  fechado_em: string | null;
  status: string;
};

export type ResumoCaixa = {
  caixa: Caixa;
  total_vendas: number;
  total_dinheiro: number;
  total_credito: number;
  total_debito: number;
  total_pix: number;
  qtd_vendas: number;
  saldo_esperado: number;
};