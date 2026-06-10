import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, ArrowDownCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarSangria } from "@/lib/sales.functions";
import { formatBRL, formatDateTime } from "@/lib/format";

type SangriaRecibo = {
  id: string;
  valor: number;
  motivo: string | null;
  created_at: string;
  caixa_id: string | null;
  nome_responsavel?: string | null;
};

interface Props {
  caixaId: string;
  nomeOperador: string; // <-- Prop adicionada
  onSuccess: (sangria: SangriaRecibo) => void;
  onClose: () => void;
}

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ModalSangria({ caixaId, nomeOperador, onSuccess, onClose }: Props) {
  const registrar = useServerFn(registrarSangria);
  const [valorCentavos, setValorCentavos] = useState(0);
  const [valorDisplay, setValorDisplay] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const centavos = parseInt(digits || "0", 10);
    setValorCentavos(centavos);
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (valorCentavos <= 0) return toast.error("Informe o valor da sangria.");
    
    setLoading(true);
    try {
      const result = await registrar({
        data: {
          caixa_id: caixaId,
          valor: valorCentavos / 100,
          motivo: motivo.trim() || undefined,
          nome_responsavel: nomeOperador, // <-- Utilizando o nome vindo da prop
        },
      });
      toast.success("Sangria registrada!");
      onSuccess({
        ...(result as SangriaRecibo),
        nome_responsavel: nomeOperador,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold">Sangria de Caixa</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Exibe o operador em vez de pedir para digitar */}
          <div className="bg-muted p-3 rounded-md border text-sm">
            <span className="text-muted-foreground block mb-1">Operador Responsável:</span>
            <span className="font-semibold">{nomeOperador}</span>
          </div>

          <div>
            <Label>Valor da Retirada *</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={valorDisplay}
              onChange={handleValor}
              placeholder="R$ 0,00"
              autoFocus // AutoFocus movido para cá
            />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Depósito bancário, tesouraria..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || valorCentavos <= 0}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white"
            >
              {loading ? "Registrando..." : "Registrar Sangria"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ComprovanteSangria({
  sangria,
  onClose,
}: {
  sangria: SangriaRecibo;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">Comprovante de Sangria</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div id="print-sangria" className="font-mono text-xs bg-white text-black border rounded p-3">
            <SangriaBody sangria={sangria} />
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
          <Button onClick={() => window.print()} className="flex-1">
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: 72mm auto; margin: 0mm; }
          html, body { margin: 0 !important; padding: 0 !important; width: 72mm !important; }
          body * { visibility: hidden !important; }
          #print-sangria, #print-sangria * { visibility: visible !important; }
          #print-sangria {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 70mm !important;
            margin: 0 !important;
            padding: 1mm 2mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 9pt !important;
            font-weight: 600 !important;
            color: #000 !important;
            background: #fff !important;
          }
          [role="dialog"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function SangriaBody({ sangria }: { sangria: SangriaRecibo }) {
  const Linha = () => <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />;
  const LinhaDupla = () => <div style={{ borderTop: "2px solid #000", margin: "3px 0" }} />;

  return (
    <div>
      <div className="text-center font-black tracking-wide">BURATIN OUTLET</div>
      <div className="text-center font-bold text-xs">Comprovante Não Fiscal</div>
      <div className="text-center text-xs">{formatDateTime(sangria.created_at)}</div>

      <LinhaDupla />

      <div className="text-center font-black text-sm my-1">SANGRIA DE CAIXA</div>

      <Linha />

      <div className="flex justify-between font-bold text-xs">
        <span>Valor retirado:</span>
        <span className="font-black">{formatBRL(sangria.valor)}</span>
      </div>
      <div className="flex justify-between font-bold text-xs mt-1">
        <span>TOTAL:</span>
        <span className="font-black">{formatBRL(sangria.valor)}</span>
      </div>

      {sangria.motivo && (
        <div className="text-xs mt-1">
          <span className="font-bold">Motivo: </span>{sangria.motivo}
        </div>
      )}

      <LinhaDupla />

      {/* Responsável */}
      <div className="text-xs mt-2">
        <div className="font-bold">Responsável pela retirada:</div>
        <div className="mt-0.5">{sangria.nome_responsavel ?? "—"}</div>
      </div>

      <Linha />

      {/* Assinatura */}
      <div className="text-xs mt-4">
        <div className="font-bold mb-1">Assinatura do Responsável:</div>
        <div style={{ borderTop: "1px solid #000", marginTop: "28px", paddingTop: "2px" }} className="text-center text-xs">
          {sangria.nome_responsavel ?? ""}
        </div>
      </div>

      <Linha />

      <div className="text-xs mt-2">
        <div className="font-bold mb-1">Assinatura do Supervisor:</div>
        <div style={{ borderTop: "1px solid #000", marginTop: "28px", paddingTop: "2px" }} className="text-center text-xs">
          SUPERVISOR
        </div>
      </div>

      <LinhaDupla />

      <div className="text-center text-xs font-bold mt-1">DOCUMENTO SEM VALOR FISCAL</div>
    </div>
  );
}