import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatBRL, formatDateTime, paymentLabel } from "@/lib/format";

export type Receipt = {
  receipt_number: number;
  created_at: string;
  items: { name: string; price: number; quantity: number; desconto?: number }[];
  total: number;
  payment_method: string;
  amount_paid: number | null;
  change_due: number;
  payment_methods?: { method: string; valor: number }[];
  desconto_geral?: number;
};

export function ReceiptDialog({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  if (!receipt) return null;

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cupom #{receipt.receipt_number}</DialogTitle>
        </DialogHeader>

        <div className="font-mono text-xs bg-white text-black border rounded p-3 max-h-[60vh] overflow-auto">
          <ReceiptBody receipt={receipt} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>

      <style>{`
        @media print {
          @page { size: 72mm auto; margin: 0mm; }
          html, body { margin: 0 !important; padding: 0 !important; width: 72mm !important; }
          body * { visibility: hidden !important; }
          #print-receipt, #print-receipt * { visibility: visible !important; }
          #print-receipt {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 70mm !important;
            margin: 0 !important;
            padding: 1mm 2mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 9pt !important;
            font-weight: 600 !important;
            color: #000 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          [role="dialog"] { display: none !important; }
          [data-radix-popper-content-wrapper] { display: none !important; }
        }
      `}</style>
      <div id="print-receipt" className="hidden print:block">
        <ReceiptBody receipt={receipt} print />
      </div>
    </Dialog>
  );
}

function ReceiptBody({ receipt, print = false }: { receipt: Receipt; print?: boolean }) {
  const titleStyle = print ? { fontWeight: 900, fontSize: "11pt", letterSpacing: "0.03em" } : {};
  const normalStyle = print ? { fontWeight: 600 } : {};

  const Linha = () => <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />;
  const LinhaDupla = () => <div style={{ borderTop: "2px solid #000", margin: "3px 0" }} />;

  const subtotal = receipt.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const totalDescontoItens = receipt.items.reduce((s, it) => s + (it.desconto ?? 0), 0);
  const descontoGeral = receipt.desconto_geral ?? 0;
  const totalDesconto = totalDescontoItens + descontoGeral;
  const temDesconto = totalDesconto > 0;

  const isMisto = receipt.payment_method === "misto" && receipt.payment_methods && receipt.payment_methods.length > 0;
  const totalMisto = isMisto ? receipt.payment_methods!.reduce((s, p) => s + p.valor, 0) : 0;
  const trocoMisto = isMisto ? Math.max(0, totalMisto - receipt.total) : 0;

  return (
    <div style={normalStyle}>
      <div className="text-center" style={titleStyle}>
        <div className="font-black tracking-wide">BURATIN OUTLET</div>
      </div>
      <div className="text-center font-bold text-xs mt-0.5">Cupom Não Fiscal</div>
      <div className="text-center text-xs">{formatDateTime(receipt.created_at)}</div>
      <div className="text-center font-bold text-xs">
        Cupom Nº {String(receipt.receipt_number).padStart(6, "0")}
      </div>

      <LinhaDupla />

      <div className="font-black text-xs mb-1">ITEM  DESCRIÇÃO</div>

      {receipt.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div className="font-bold text-xs">
            {String(i + 1).padStart(3, "0")} {it.name}
          </div>
          <div className="flex justify-between font-semibold text-xs">
            <span>{it.quantity} x {formatBRL(it.price)}</span>
            <span className="font-black">{formatBRL(it.price * it.quantity)}</span>
          </div>
          {(it.desconto ?? 0) > 0 && (
            <div className="flex justify-between text-xs font-semibold">
              <span>Desconto item</span>
              <span>- {formatBRL(it.desconto!)}</span>
            </div>
          )}
        </div>
      ))}

      <LinhaDupla />

      {temDesconto && (
        <>
          <div className="flex justify-between text-xs font-semibold mt-1">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          {totalDescontoItens > 0 && (
            <div className="flex justify-between text-xs font-semibold">
              <span>Desc. itens</span>
              <span>- {formatBRL(totalDescontoItens)}</span>
            </div>
          )}
          {descontoGeral > 0 && (
            <div className="flex justify-between text-xs font-semibold">
              <span>Desc. geral</span>
              <span>- {formatBRL(descontoGeral)}</span>
            </div>
          )}
          <Linha />
        </>
      )}

      <div className="flex justify-between font-black text-xs mt-1">
        <span>TOTAL</span>
        <span>{formatBRL(receipt.total)}</span>
      </div>

      <Linha />

      {isMisto ? (
        <>
          <div className="font-bold text-xs mb-1">Pagamento Misto</div>
          {receipt.payment_methods!.map((pm, i) => (
            <div key={i} className="flex justify-between font-semibold text-xs">
              <span>{paymentLabel(pm.method)}</span>
              <span>{formatBRL(pm.valor)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-xs mt-1">
            <span>Total Pago</span>
            <span>{formatBRL(totalMisto)}</span>
          </div>
          {trocoMisto > 0 && (
            <div className="flex justify-between font-bold text-xs">
              <span>Troco</span>
              <span>{formatBRL(trocoMisto)}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-between font-bold text-xs">
            <span>Pagamento</span>
            <span>{paymentLabel(receipt.payment_method)}</span>
          </div>
          {receipt.amount_paid != null && (
            <>
              <div className="flex justify-between font-semibold text-xs">
                <span>Recebido</span>
                <span>{formatBRL(receipt.amount_paid)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs">
                <span>Troco</span>
                <span>{formatBRL(receipt.change_due)}</span>
              </div>
            </>
          )}
        </>
      )}

      <LinhaDupla />

      <div className="text-center font-black text-xs mt-1">Obrigado pela preferência!</div>
      <div className="text-center font-bold text-xs mt-0.5">DOCUMENTO SEM VALOR FISCAL</div>
    </div>
  );
}