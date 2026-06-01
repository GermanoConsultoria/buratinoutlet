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

      {/* Hidden printable area */}
      <div id="print-receipt" className="hidden print:block">
        <ReceiptBody receipt={receipt} />
      </div>
    </Dialog>
  );
}

function ReceiptBody({ receipt }: { receipt: Receipt }) {
  const line = "------------------------------";
  return (
    <div>
      <div className="text-center">
        <div className="font-bold text-sm">BURATIN OUTLET</div>
        <div>Cupom Não Fiscal</div>
        <div>{formatDateTime(receipt.created_at)}</div>
        <div>Cupom Nº {String(receipt.receipt_number).padStart(6, "0")}</div>
      </div>
      <div className="my-1">{line}</div>
      <div className="font-bold">ITEM  DESCRIÇÃO</div>
      {receipt.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div>{String(i + 1).padStart(3, "0")} {it.name}</div>
          <div className="flex justify-between">
            <span>{it.quantity} x {formatBRL(it.price)}</span>
            <span>{formatBRL(it.price * it.quantity)}</span>
          </div>
        </div>
      ))}
      <div>{line}</div>
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{formatBRL(receipt.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Pagamento</span>
        <span>{paymentLabel(receipt.payment_method)}</span>
      </div>
      {receipt.amount_paid != null && (
        <>
          <div className="flex justify-between">
            <span>Recebido</span>
            <span>{formatBRL(receipt.amount_paid)}</span>
          </div>
          <div className="flex justify-between">
            <span>Troco</span>
            <span>{formatBRL(receipt.change_due)}</span>
          </div>
        </>
      )}
      <div>{line}</div>
      <div className="text-center mt-2">Obrigado pela preferência!</div>
      <div className="text-center text-[10px] mt-1">DOCUMENTO SEM VALOR FISCAL</div>
    </div>
  );
}
