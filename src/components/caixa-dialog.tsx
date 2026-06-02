import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, DollarSign, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abrirCaixa, fecharCaixa } from "@/lib/sales.functions";
import { formatBRL } from "@/lib/format";
import type { Caixa, ResumoCaixa } from "@/lib/caixa.types";

interface AbrirProps {
  onSuccess: (caixa: Caixa) => void;
  onClose: () => void;
}

interface FecharProps {
  resumo: ResumoCaixa;
  onSuccess: () => void;
  onClose: () => void;
}

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ModalAbrirCaixa({ onSuccess, onClose }: AbrirProps) {
  const abrir = useServerFn(abrirCaixa);
  const [valorCentavos, setValorCentavos] = useState(0);
  const [valorDisplay, setValorDisplay] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const centavos = parseInt(digits || "0", 10);
    setValorCentavos(centavos);
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const caixa = await abrir({
        data: {
          valor_abertura: valorCentavos / 100,
          observacao: observacao.trim() || undefined,
        },
      });
      toast.success("Caixa aberto com sucesso!");
      onSuccess(caixa as Caixa);
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
            <Unlock className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold">Abrir Caixa</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label>Valor de Abertura (troco inicial)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={valorDisplay}
              onChange={handleValor}
              placeholder="R$ 0,00"
              autoFocus
            />
          </div>
          <div>
            <Label>Observação</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">
              {loading ? "Abrindo..." : "Abrir Caixa"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ModalFecharCaixa({ resumo, onSuccess, onClose }: FecharProps) {
  const fechar = useServerFn(fecharCaixa);
  const [valorCentavos, setValorCentavos] = useState(
    Math.round(resumo.saldo_esperado * 100)
  );
  const [valorDisplay, setValorDisplay] = useState(
    valorCentavos > 0 ? formatarMoeda(valorCentavos) : ""
  );
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const centavos = parseInt(digits || "0", 10);
    setValorCentavos(centavos);
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : "");
  }

  const diferenca = valorCentavos / 100 - resumo.saldo_esperado;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fechar({
        data: {
          id: resumo.caixa.id,
          valor_fechamento: valorCentavos / 100,
          observacao: observacao.trim() || undefined,
        },
      });
      toast.success("Caixa fechado com sucesso!");
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-bold">Fechar Caixa</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumo do caixa */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold mb-3">Resumo do Caixa</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Abertura:</span>
                <span className="font-medium">{formatBRL(resumo.caixa.valor_abertura)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendas:</span>
                <span className="font-medium text-emerald-600">{formatBRL(resumo.total_vendas)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dinheiro:</span>
                <span>{formatBRL(resumo.total_dinheiro)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Crédito:</span>
                <span>{formatBRL(resumo.total_credito)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Débito:</span>
                <span>{formatBRL(resumo.total_debito)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PIX:</span>
                <span>{formatBRL(resumo.total_pix)}</span>
              </div>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>Saldo esperado:</span>
              <span className="text-primary">{formatBRL(resumo.saldo_esperado)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{resumo.qtd_vendas} venda{resumo.qtd_vendas !== 1 ? "s" : ""} realizadas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Valor em Caixa (contagem física)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={valorDisplay}
                onChange={handleValor}
                placeholder="R$ 0,00"
                autoFocus
              />
              {diferenca !== 0 && (
                <p className={`text-xs mt-1 font-medium ${diferenca > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {diferenca > 0 ? `Sobra: +${formatBRL(diferenca)}` : `Falta: ${formatBRL(Math.abs(diferenca))}`}
                </p>
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 text-white">
                {loading ? "Fechando..." : "Fechar Caixa"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function BotaoCaixa({
  caixaAberto,
  onAbrirCaixa,
  onFecharCaixa,
}: {
  caixaAberto: Caixa | null;
  onAbrirCaixa: () => void;
  onFecharCaixa: () => void;
}) {
  return (
    <button
      onClick={caixaAberto ? onFecharCaixa : onAbrirCaixa}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        caixaAberto
          ? "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
          : "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
      }`}
    >
      <DollarSign size={14} />
      {caixaAberto ? "Caixa Aberto" : "Caixa Fechado"}
    </button>
  );
}