import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatBRL, formatDateTime, paymentLabel } from "@/lib/format";

export type Receipt = {
  receipt_number: number;
  created_at: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  payment_method: string;
  amount_paid: number | null;
  change_due: number;
};

export function ReceiptDialog({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  if (!receipt) return null;

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cupom #{receipt.receipt_number}</DialogTitle>
        </DialogHeader>

        {/* Preview on screen */}
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
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          body * { visibility: hidden !important; }
          #print-receipt, #print-receipt * { visibility: visible !important; }
          #print-receipt {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 72mm !important;
            padding: 3mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 10pt !important;
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
  const line = "================================";
  const halfLine = "--------------------------------";

  const titleStyle = print
    ? { fontWeight: 900, fontSize: "13pt", letterSpacing: "0.05em" }
    : {};
  const normalStyle = print
    ? { fontWeight: 600 }
    : {};

  return (
    <div style={normalStyle}>
      <div className="text-center" style={titleStyle}>
        <div className="font-black text-base tracking-wide">BURATIN OUTLET</div>
      </div>
      <div className="text-center font-bold text-sm mt-0.5">Cupom Não Fiscal</div>
      <div className="text-center">{formatDateTime(receipt.created_at)}</div>
      <div className="text-center font-bold">
        Cupom Nº {String(receipt.receipt_number).padStart(6, "0")}
      </div>

      <div className="my-1 font-bold">{line}</div>

      <div className="font-black text-xs mb-1">ITEM  DESCRIÇÃO</div>

      {receipt.items.map((it, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">
            {String(i + 1).padStart(3, "0")} {it.name}
          </div>
          <div className="flex justify-between font-semibold">
            <span>{it.quantity} x {formatBRL(it.price)}</span>
            <span className="font-black">{formatBRL(it.price * it.quantity)}</span>
          </div>
        </div>
      ))}

      <div className="font-bold">{line}</div>

      <div className="flex justify-between font-black text-sm mt-1">
        <span>TOTAL</span>
        <span>{formatBRL(receipt.total)}</span>
      </div>

      <div className="font-bold">{halfLine}</div>

      <div className="flex justify-between font-bold">
        <span>Pagamento</span>
        <span>{paymentLabel(receipt.payment_method)}</span>
      </div>

      {receipt.amount_paid != null && (
        <>
          <div className="flex justify-between font-semibold">
            <span>Recebido</span>
            <span>{formatBRL(receipt.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Troco</span>
            <span>{formatBRL(receipt.change_due)}</span>
          </div>
        </>
      )}

      <div className="font-bold mt-1">{line}</div>

      <div className="text-center font-black text-sm mt-2">
        Obrigado pela preferência!
      </div>
      <div className="text-center font-bold text-xs mt-1">
        DOCUMENTO SEM VALOR FISCAL
      </div>
    </div>
  );
}