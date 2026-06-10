import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSales, getSale } from "@/lib/sales.functions";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Receipt as ReceiptIcon } from "lucide-react";
import { formatBRL, formatDateTime, paymentLabel } from "@/lib/format";
import { ReceiptDialog, type Receipt } from "@/components/receipt-dialog";

export const Route = createFileRoute("/_app/historico-vendas")({
  component: HistoricoVendasPage,
});

function HistoricoVendasPage() {
  const list = useServerFn(listSales);
  const get = useServerFn(getSale);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => list(),
  });

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [search, setSearch] = useState("");

  const openReceipt = async (id: string) => {
    const s = await get({ data: { id } });
    setReceipt({
      receipt_number: s.receipt_number,
      created_at: s.created_at,
      total: Number(s.total),
      payment_method: s.payment_method as any,
      payment_methods: s.payment_methods ?? undefined, // <-- ADICIONE ESTA LINHA
      amount_paid: s.amount_paid != null ? Number(s.amount_paid) : null,
      change_due: Number(s.change_due),
      items: (s.sale_items ?? []).map((i: any) => ({
        name: i.name, price: Number(i.price), quantity: Number(i.quantity),
      })),
    });
  };

  // Mostra apenas vendas não canceladas
  const vendasAtivas = sales.filter((s) => !s.canceled_at);

  const filtered = vendasAtivas.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(s.receipt_number).includes(q) ||
      formatDateTime(s.created_at).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptIcon className="h-6 w-6 text-primary" /> Histórico de Vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            {vendasAtivas.length} venda{vendasAtivas.length !== 1 ? "s" : ""} realizadas
          </p>
        </div>
        <Input
          placeholder="Buscar por cupom ou data..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card className="p-4">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cupom</TableHead>
                <TableHead>Data da Venda</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">
                    #{String(s.receipt_number).padStart(6, "0")}
                  </TableCell>
                  <TableCell>{formatDateTime(s.created_at)}</TableCell>
                  <TableCell>{paymentLabel(s.payment_method)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatBRL(Number(s.total))}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openReceipt(s.id)}
                      title="Ver e imprimir cupom"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}