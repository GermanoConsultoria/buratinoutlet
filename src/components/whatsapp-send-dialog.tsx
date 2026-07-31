import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, MessageCircle, RefreshCw, Search, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getWhatsappStatus,
  enviarComprovanteWhatsapp,
  searchClientesByNome,
} from "@/lib/whatsapp.functions";
import type { Receipt } from "@/components/receipt-dialog";
import { formatBRL, paymentLabel } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  tipo: "cupom" | "nfce";
  receiptNumber: number;
  danfe_url?: string | null;
  receipt?: Receipt;
};

function receiptToText(r: Receipt, receiptNumber: number): string {
  const lines: string[] = [
    "*PDVGtech — Cupom Não Fiscal*",
    `Venda #${String(receiptNumber).padStart(6, "0")}`,
    "---",
  ];

  r.items.forEach((it, i) => {
    lines.push(`${String(i + 1).padStart(3, "0")} ${it.name}`);
    lines.push(`   ${it.quantity} x ${formatBRL(it.price)} = ${formatBRL(it.price * it.quantity)}`);
    if ((it.desconto ?? 0) > 0) {
      lines.push(`   Desc: -${formatBRL(it.desconto!)}`);
    }
  });

  lines.push("---");
  lines.push(`*TOTAL: ${formatBRL(r.total)}*`);

  if (r.payment_method === "misto" && r.payment_methods?.length) {
    lines.push("Pagamento Misto:");
    r.payment_methods.forEach((pm) => {
      lines.push(`  ${paymentLabel(pm.method)}: ${formatBRL(pm.valor)}`);
    });
  } else {
    lines.push(`Pagamento: ${paymentLabel(r.payment_method)}`);
    if (r.amount_paid != null && r.change_due > 0) {
      lines.push(`Troco: ${formatBRL(r.change_due)}`);
    }
  }

  lines.push("---");
  lines.push("Obrigado pela preferência!");
  return lines.join("\n");
}

export function WhatsappSendDialog({ open, onClose, tipo, receiptNumber, danfe_url, receipt }: Props) {
  const [telefone,   setTelefone]   = useState("");
  const [busca,      setBusca]      = useState("");
  const [resultados, setResultados] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [buscando,   setBuscando]   = useState(false);

  const getStatusFn = useServerFn(getWhatsappStatus);
  const searchFn    = useServerFn(searchClientesByNome);
  const enviarFn    = useServerFn(enviarComprovanteWhatsapp);

  const { data: status } = useQuery({
    queryKey: ["whatsapp", "status"],
    queryFn:  () => getStatusFn(),
    enabled:  open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      setTelefone("");
      setBusca("");
      setResultados([]);
    }
  }, [open]);

  useEffect(() => {
    if (busca.length < 2) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await searchFn({ data: { q: busca } });
        setResultados(res);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, searchFn]);

  const texto_cupom: string | undefined =
    tipo === "cupom" && receipt
      ? receiptToText(receipt, receiptNumber)
      : undefined;

  const preview =
    tipo === "nfce" && danfe_url
      ? `✅ *NFC-e emitida!* Sua nota fiscal da Venda #${receiptNumber} está disponível:\n${danfe_url}`
      : texto_cupom
        ? texto_cupom.split("\n").slice(0, 6).join("\n") + "\n..."
        : `✅ Comprovante da Venda #${receiptNumber}`;

  const enviarMut = useMutation({
    mutationFn: () =>
      enviarFn({
        data: {
          telefone,
          tipo,
          receiptNumber,
          danfe_url:   danfe_url ?? undefined,
          texto_cupom,
        },
      }),
    onSuccess: () => {
      toast.success("Comprovante enviado por WhatsApp!");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const integracaoInativa = status?.ativo === false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
            Enviar por WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {integracaoInativa && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                A integração WhatsApp não está ativa.{" "}
                <a href="/integracoes/whatsapp" className="underline font-medium">
                  Clique aqui para configurar.
                </a>
              </p>
            </div>
          )}

          {/* Busca de cliente */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Buscar cliente (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome do cliente..."
                className="pl-9"
              />
            </div>
            {buscando && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Buscando...
              </p>
            )}
            {resultados.length > 0 && (
              <div className="rounded-lg border bg-popover shadow-md overflow-hidden">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setTelefone((c.telefone ?? "").replace(/\D/g, ""));
                      setBusca(c.nome);
                      setResultados([]);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <span className="font-medium">{c.nome}</span>
                    <span className="text-muted-foreground text-xs">
                      {c.telefone ?? "Sem telefone"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Número do WhatsApp *</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ""))}
              placeholder="5511999998888"
              className="font-mono"
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">
              Somente dígitos, com DDI (55 para Brasil). Ex: 5511999998888
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Prévia da mensagem</Label>
            <div
              className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap text-foreground border max-h-32 overflow-auto"
              style={{ background: "oklch(0.95 0.05 145)" }}
            >
              {preview}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviarMut.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => enviarMut.mutate()}
            disabled={enviarMut.isPending || !telefone.trim() || integracaoInativa}
            className="gap-2 text-white"
            style={{ background: "#25D366" }}
          >
            {enviarMut.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
