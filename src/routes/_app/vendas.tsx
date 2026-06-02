import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSales, getSale, cancelSale } from "@/lib/sales.functions";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Receipt as ReceiptIcon, Eye, Ban, ChevronDown, ChevronUp, Package, FileX } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDateTime, paymentLabel } from "@/lib/format";
import { ReceiptDialog, type Receipt } from "@/components/receipt-dialog";
import { useAuth } from "@/hooks/use-auth";
import { isManagerOrOwner, isOwner } from "@/lib/auth";

export const Route = createFileRoute("/_app/vendas")({
  component: VendasPage,
});

function VendasPage() {
  const list = useServerFn(listSales);
  const get = useServerFn(getSale);
  const cancel = useServerFn(cancelSale);
  const qc = useQueryClient();
  const { profile } = useAuth();

  const { data: sales = [], isLoading } = useQuery({ queryKey: ["sales"], queryFn: () => list() });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; n: number } | null>(null);
  const [reason, setReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, any[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showRelatorio, setShowRelatorio] = useState(false);

  const podeVerRelatorio = isManagerOrOwner(profile);
  const motivoObrigatorio = isManagerOrOwner(profile);

  const openReceipt = async (id: string) => {
    const s = await get({ data: { id } });
    setReceipt({
      receipt_number: s.receipt_number,
      created_at: s.created_at,
      total: Number(s.total),
      payment_method: s.payment_method,
      amount_paid: s.amount_paid != null ? Number(s.amount_paid) : null,
      change_due: Number(s.change_due),
      items: (s.sale_items ?? []).map((i: any) => ({
        name: i.name, price: Number(i.price), quantity: Number(i.quantity),
      })),
    });
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    if (expandedItems[id]) { setExpandedId(id); return; }
    setLoadingItems(id);
    try {
      const s = await get({ data: { id } });
      setExpandedItems((prev) => ({ ...prev, [id]: s.sale_items ?? [] }));
      setExpandedId(id);
    } catch {
      toast.error("Erro ao carregar itens.");
    } finally {
      setLoadingItems(null);
    }
  };

  const cancelMut = useMutation({
    mutationFn: () => {
      if (motivoObrigatorio && !reason.trim()) {
        throw new Error("O motivo do cancelamento é obrigatório.");
      }
      return cancel({ data: { id: cancelTarget!.id, reason: reason.trim() || undefined } });
    },
    onSuccess: () => {
      toast.success(`Venda #${cancelTarget!.n} cancelada`);
      setCancelTarget(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vendasAtivas = sales.filter((s) => !s.canceled_at);
  const vendasCanceladas = sales.filter((s) => !!s.canceled_at);
  const totalGeral = vendasAtivas.reduce((s, v) => s + Number(v.total), 0);
  const totalDinheiro = vendasAtivas.filter((v) => v.payment_method === "dinheiro").reduce((s, v) => s + Number(v.total), 0);
  const totalCredito = vendasAtivas.filter((v) => v.payment_method === "credito").reduce((s, v) => s + Number(v.total), 0);
  const totalDebito = vendasAtivas.filter((v) => v.payment_method === "debito").reduce((s, v) => s + Number(v.total), 0);
  const totalPix = vendasAtivas.filter((v) => v.payment_method === "pix").reduce((s, v) => s + Number(v.total), 0);

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(s.receipt_number).includes(q) ||
      paymentLabel(s.payment_method).toLowerCase().includes(q) ||
      formatDateTime(s.created_at).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptIcon className="h-6 w-6 text-primary" /> Vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            {vendasAtivas.length} venda{vendasAtivas.length !== 1 ? "s" : ""} — total {formatBRL(totalGeral)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {podeVerRelatorio && vendasCanceladas.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowRelatorio(true)}
              className="text-destructive border-destructive hover:bg-destructive hover:text-white gap-1"
            >
              <FileX className="h-4 w-4" />
              Relatório de Cancelamentos ({vendasCanceladas.length})
            </Button>
          )}
          <Input
            placeholder="Buscar por cupom, data, pagamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Dinheiro", value: totalDinheiro, cor: "text-emerald-600" },
          { label: "Crédito", value: totalCredito, cor: "text-blue-600" },
          { label: "Débito", value: totalDebito, cor: "text-purple-600" },
          { label: "PIX", value: totalPix, cor: "text-orange-600" },
        ].map((item) => (
          <Card key={item.label} className="p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-bold tabular-nums ${item.cor}`}>{formatBRL(item.value)}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Cupom</TableHead>
                <TableHead>Data da Venda</TableHead>
                <TableHead>Data do Cancelamento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada.</TableCell></TableRow>
              )}
              {filtered.map((s) => {
                const canceled = !!s.canceled_at;
                const isExpanded = expandedId === s.id;
                const items = expandedItems[s.id] ?? [];

                return (
                  <>
                    <TableRow key={s.id} className={canceled ? "opacity-60" : ""}>
                      <TableCell>
                        <button onClick={() => toggleExpand(s.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          {loadingItems === s.id ? <span className="text-xs">...</span> : isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono">#{String(s.receipt_number).padStart(6, "0")}</TableCell>
                      <TableCell>{formatDateTime(s.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.canceled_at ? (
                          <span className="text-destructive">{formatDateTime(s.canceled_at)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{paymentLabel(s.payment_method)}</TableCell>
                      <TableCell>
                        {canceled ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">Cancelada</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Concluída</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${canceled ? "line-through" : ""}`}>
                        {formatBRL(Number(s.total))}
                      </TableCell>
                      <TableCell className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openReceipt(s.id)} title="Ver cupom">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!canceled && (
                          <Button size="icon" variant="ghost" onClick={() => { setCancelTarget({ id: s.id, n: s.receipt_number }); setReason(""); }} title="Cancelar venda">
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${s.id}-items`} className="bg-muted/20">
                        <TableCell colSpan={8} className="py-0 px-0">
                          <div className="px-8 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Package className="h-3 w-3" /> Itens da venda
                            </p>
                            {s.cancel_reason && (
                              <div className="mb-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-1.5">
                                <span className="font-semibold">Motivo do cancelamento:</span> {s.cancel_reason}
                              </div>
                            )}
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-left py-1 font-medium">Produto</th>
                                  <th className="text-center py-1 font-medium">Qtd</th>
                                  <th className="text-right py-1 font-medium">Preço unit.</th>
                                  <th className="text-right py-1 font-medium">Subtotal</th>
                                  <th className="text-right py-1 font-medium">Saída</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {items.map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-muted/30">
                                    <td className="py-1.5 font-medium">{item.name}</td>
                                    <td className="py-1.5 text-center text-muted-foreground">{item.quantity}</td>
                                    <td className="py-1.5 text-right tabular-nums">{formatBRL(Number(item.price))}</td>
                                    <td className="py-1.5 text-right tabular-nums font-semibold">{formatBRL(Number(item.subtotal))}</td>
                                    <td className="py-1.5 text-right text-muted-foreground">
                                      {item.data_saida ? new Date(item.data_saida).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      {/* Modal cancelamento */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && (setCancelTarget(null), setReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda #{cancelTarget?.n}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A venda será marcada como cancelada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Textarea
              placeholder={motivoObrigatorio ? "Motivo do cancelamento (obrigatório)" : "Motivo (opcional)"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={motivoObrigatorio && !reason.trim() ? "border-destructive" : ""}
            />
            {motivoObrigatorio && !reason.trim() && (
              <p className="text-xs text-destructive">O motivo é obrigatório para cancelamentos.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelMut.mutate(); }}
              disabled={cancelMut.isPending || (motivoObrigatorio && !reason.trim())}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Relatório de cancelamentos */}
      {showRelatorio && podeVerRelatorio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border rounded-xl w-full max-w-4xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <FileX className="h-5 w-5 text-destructive" /> Relatório de Cancelamentos
                </h2>
                <p className="text-sm text-muted-foreground">{vendasCanceladas.length} venda{vendasCanceladas.length !== 1 ? "s" : ""} cancelada{vendasCanceladas.length !== 1 ? "s" : ""} — {formatBRL(vendasCanceladas.reduce((s, v) => s + Number(v.total), 0))}</p>
              </div>
              <Button variant="outline" onClick={() => setShowRelatorio(false)}>Fechar</Button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cupom</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data da Venda</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data do Cancelamento</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pagamento</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vendasCanceladas.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono">#{String(s.receipt_number).padStart(6, "0")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(s.created_at)}</td>
                      <td className="px-4 py-3 text-destructive">{s.canceled_at ? formatDateTime(s.canceled_at) : "—"}</td>
                      <td className="px-4 py-3">{paymentLabel(s.payment_method)}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {s.cancel_reason ?? <span className="italic text-muted-foreground/60">Sem motivo informado</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold line-through text-muted-foreground">
                        {formatBRL(Number(s.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}