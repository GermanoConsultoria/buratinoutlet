import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSales, getSale, cancelSale } from "@/lib/sales.functions";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Receipt as ReceiptIcon, Eye, Ban } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDateTime, paymentLabel } from "@/lib/format";
import { ReceiptDialog, type Receipt } from "@/components/receipt-dialog";

export const Route = createFileRoute("/_app/vendas")({
  component: VendasPage,
});

function VendasPage() {
  const list = useServerFn(listSales);
  const get = useServerFn(getSale);
  const cancel = useServerFn(cancelSale);
  const qc = useQueryClient();
  const { data: sales = [], isLoading } = useQuery({ queryKey: ["sales"], queryFn: () => list() });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; n: number } | null>(null);
  const [reason, setReason] = useState("");

  const openReceipt = async (id: string) => {
    const s = await get({ data: { id } });
    setReceipt({
      receipt_number: s.receipt_number,
      created_at: s.created_at,
      total: Number(s.total),
      payment_method: s.payment_method,
      amount_paid: s.amount_paid != null ? Number(s.amount_paid) : null,
      change_due: Number(s.change_due),
      items: (s.sale_items ?? []).map((i: { name: string; price: number; quantity: number }) => ({
        name: i.name, price: Number(i.price), quantity: Number(i.quantity),
      })),
    });
  };

  const cancelMut = useMutation({
    mutationFn: () => cancel({ data: { id: cancelTarget!.id, reason: reason.trim() || undefined } }),
    onSuccess: () => {
      toast.success(`Venda #${cancelTarget!.n} cancelada`);
      setCancelTarget(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ReceiptIcon className="h-6 w-6 text-primary" /> Vendas
        </h1>
        <p className="text-sm text-muted-foreground">Histórico dos últimos cupons emitidos.</p>
      </div>

      <Card className="p-4">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cupom</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && sales.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma venda registrada.</TableCell></TableRow>
              )}
              {sales.map((s) => {
                const canceled = !!s.canceled_at;
                return (
                  <TableRow key={s.id} className={canceled ? "opacity-60" : ""}>
                    <TableCell className="font-mono">#{String(s.receipt_number).padStart(6, "0")}</TableCell>
                    <TableCell>{formatDateTime(s.created_at)}</TableCell>
                    <TableCell>{paymentLabel(s.payment_method)}</TableCell>
                    <TableCell>
                      {canceled ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">Cancelada</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-success/10 text-success">Concluída</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${canceled ? "line-through" : ""}`}>{formatBRL(Number(s.total))}</TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openReceipt(s.id)} title="Ver cupom">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!canceled && (
                        <Button size="icon" variant="ghost" onClick={() => setCancelTarget({ id: s.id, n: s.receipt_number })} title="Cancelar venda">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && (setCancelTarget(null), setReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda #{cancelTarget?.n}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A venda será marcada como cancelada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
