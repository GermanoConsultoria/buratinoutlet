import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, DollarSign, Lock, Unlock, User, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abrirCaixa, fecharCaixa, listOperadores, salvarFechamentoDiario } from "@/lib/sales.functions";
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

type Operador = { id: string; nome: string; numero: number; ativo: boolean };

export function ModalAbrirCaixa({ onSuccess, onClose }: AbrirProps) {
  const abrir = useServerFn(abrirCaixa);
  const listarOps = useServerFn(listOperadores);

  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorSel, setOperadorSel] = useState("");
  const [valorCentavos, setValorCentavos] = useState(0);
  const [valorDisplay, setValorDisplay] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingOps, setLoadingOps] = useState(true);

  useEffect(() => {
    listarOps()
      .then(setOperadores)
      .catch(() => toast.error("Erro ao carregar operadores"))
      .finally(() => setLoadingOps(false));
  }, []);

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const centavos = parseInt(digits || "0", 10);
    setValorCentavos(centavos);
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!operadorSel) return toast.error("Selecione o operador responsável.");
    setLoading(true);
    const op = operadores.find((o) => o.id === operadorSel);
    const nomeOp = op ? `${op.numero} - ${op.nome}` : "";
    try {
      const caixa = await abrir({
        data: {
          nome_operador: nomeOp,
          valor_abertura: valorCentavos / 100,
          observacao: observacao.trim() || undefined,
        },
      });
      toast.success(`Caixa aberto — Operador: ${nomeOp}!`);
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
            <Label className="flex items-center gap-1 mb-1">
              <User size={13} /> Operador Responsável *
            </Label>
            {loadingOps ? (
              <div className="text-xs text-muted-foreground py-2">Carregando operadores...</div>
            ) : operadores.length === 0 ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                Nenhum operador cadastrado. Acesse <strong>Configurações → Operadores</strong> para cadastrar.
              </div>
            ) : (
              <select
                value={operadorSel}
                onChange={(e) => setOperadorSel(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                autoFocus
              >
                <option value="">Selecione o operador...</option>
                {operadores.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.numero} — {op.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label>Valor de Abertura (troco inicial)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={valorDisplay}
              onChange={handleValor}
              placeholder="R$ 0,00"
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
            <Button
              type="submit"
              disabled={loading || !operadorSel || operadores.length === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
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
  const salvarFech = useServerFn(salvarFechamentoDiario);
  const [valorCentavos, setValorCentavos] = useState(
    Math.round(resumo.saldo_esperado * 100)
  );
  const [valorDisplay, setValorDisplay] = useState(
    valorCentavos > 0 ? formatarMoeda(valorCentavos) : ""
  );
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);

  const nomeOperador =
    resumo.caixa.nome_operador ??
    (resumo.caixa.observacao_abertura?.replace("Operador: ", "")?.split(" | ")[0]) ??
    "—";

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
      // Grava o fechamento no relatório de caixa
      try {
        await salvarFech({
          data: {
            caixa_id: resumo.caixa.id,
            valor_fechamento: valorCentavos / 100,
            total_vendas: resumo.total_vendas,
            total_cancelamentos: resumo.total_cancelamentos,
            total_sangrias: resumo.total_sangrias,
            total_descontos: resumo.total_descontos,
            qtd_vendas: resumo.qtd_vendas,
            qtd_cancelamentos: resumo.qtd_cancelamentos,
            qtd_sangrias: resumo.qtd_sangrias,
            total_dinheiro: resumo.total_dinheiro,
            total_credito: resumo.total_credito,
            total_debito: resumo.total_debito,
            total_pix: resumo.total_pix,
            valor_abertura: Number(resumo.caixa.valor_abertura),
            saldo_esperado: resumo.saldo_esperado,
            nome_operador: resumo.caixa.nome_operador ?? undefined,
          },
        });
      } catch (fechErr) {
        console.error("Erro ao salvar fechamento no relatório:", fechErr);
      }
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
          <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
            <User size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Operador:</span>
            <span className="text-sm font-semibold">{nomeOperador}</span>
          </div>

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
              {resumo.total_sangrias > 0 && (
                <div className="flex justify-between col-span-2 pt-1">
                  <span className="text-muted-foreground font-medium">Sangrias:</span>
                  <span className="font-medium text-orange-600">- {formatBRL(resumo.total_sangrias)}</span>
                </div>
              )}
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>Saldo esperado (Gaveta):</span>
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