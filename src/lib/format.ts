export const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

export const paymentLabel = (m: string) => ({
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "PIX",
}[m] ?? m);
