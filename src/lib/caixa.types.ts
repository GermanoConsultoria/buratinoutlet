export type StatusCaixa = "ABERTO" | "FECHADO";

export type Caixa = {
  id: string;
  aberto_por: string | null;
  fechado_por: string | null;
  nome_operador: string | null; // <-- ADICIONAR ESTA LINHA
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