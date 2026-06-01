import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarLancamento, editarLancamento } from "@/lib/financeiro.functions";
import type {
  LancamentoComRelacoes,
  PlanoContas,
  TipoLancamento,
  RecorrenciaTipo,
} from "@/lib/financeiro.types";

interface Props {
  tipo: TipoLancamento;
  planoContas: PlanoContas[];
  lancamento?: LancamentoComRelacoes;
  onClose: () => void;
  onSuccess: () => void;
}

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ModalLancamento({
  tipo,
  planoContas,
  lancamento,
  onClose,
  onSuccess,
}: Props) {
  const criar = useServerFn(criarLancamento);
  const editar = useServerFn(editarLancamento);

  const [loading, setLoading] = useState(false);
  const [aplicarATodos, setAplicarATodos] = useState(false);
  const [parcelas, setParcelas] = useState(lancamento?.numero_parcelas ?? 1);
  const [parcelasInput, setParcelasInput] = useState(
    String(lancamento?.numero_parcelas ?? 1)
  );
  const [recorrencia, setRecorrencia] = useState<RecorrenciaTipo>(
    (lancamento?.recorrencia as RecorrenciaTipo) ?? "NAO"
  );
  const [valorCentavos, setValorCentavos] = useState(
    lancamento ? Math.round(Number(lancamento.valor) * 100) : 0
  );
  const [valorDisplay, setValorDisplay] = useState(
    lancamento ? formatarMoeda(Math.round(Number(lancamento.valor) * 100)) : ""
  );
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [beneficiario, setBeneficiario] = useState(
    lancamento?.beneficiario ?? ""
  );
  const [dtVencimento, setDtVencimento] = useState(
    lancamento
      ? new Date(lancamento.dt_vencimento).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [numeroDocumento, setNumeroDocumento] = useState(
    lancamento?.numero_documento ?? ""
  );
  const [planoContasId, setPlanoContasId] = useState(
    lancamento?.plano_contas_id ?? ""
  );

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, "");
    const centavos = parseInt(apenasDigitos || "0", 10);
    setValorCentavos(centavos);
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return toast.error("Descrição é obrigatória.");
    if (valorCentavos <= 0) return toast.error("Valor inválido.");
    if (!planoContasId) return toast.error("Categoria é obrigatória.");

    setLoading(true);
    try {
      if (lancamento) {
        await editar({
          data: {
            id: lancamento.id,
            descricao: descricao.trim(),
            beneficiario: beneficiario.trim() || null,
            valor: valorCentavos / 100,
            dt_vencimento: dtVencimento,
            numero_documento: numeroDocumento.trim() || null,
            plano_contas_id: planoContasId,
            aplicar_a_todos: aplicarATodos,
          },
        });
        toast.success("Lançamento atualizado.");
      } else {
        await criar({
          data: {
            tipo,
            descricao: descricao.trim(),
            beneficiario: beneficiario.trim() || null,
            valor: valorCentavos / 100,
            dt_vencimento: dtVencimento,
            numero_documento: numeroDocumento.trim() || null,
            plano_contas_id: planoContasId,
            recorrencia,
            numero_parcelas: parcelas,
          },
        });
        toast.success("Lançamento criado.");
      }
      onClose();
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const labelTipo = tipo === "DESPESA" ? "Despesa" : "Receita";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card">
          <h2 className="text-lg font-bold">
            {lancamento ? "Editar" : "Nova"} {labelTipo}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={
                tipo === "DESPESA"
                  ? "Ex: Aluguel do escritório"
                  : "Ex: Pagamento de consultoria"
              }
              autoFocus
            />
          </div>

          {tipo === "DESPESA" && (
            <div>
              <Label>Beneficiário</Label>
              <Input
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
                placeholder="Ex: Fornecedor XYZ"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={valorDisplay}
                onChange={handleValorChange}
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={dtVencimento}
                onChange={(e) => setDtVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº do Documento</Label>
              <Input
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Ex: NF-001"
              />
            </div>
            <div>
              <Label>Categoria *</Label>
              <select
                value={planoContasId}
                onChange={(e) => setPlanoContasId(e.target.value)}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                {planoContas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!lancamento && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Recorrência</Label>
                  <select
                    value={recorrencia}
                    onChange={(e) => {
                      setRecorrencia(e.target.value as RecorrenciaTipo);
                      if (e.target.value !== "NAO") setParcelas(1);
                    }}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="NAO">Sem recorrência</option>
                    <option value="DIARIAMENTE">Diária</option>
                    <option value="SEMANALMENTE">Semanal</option>
                    <option value="MENSALMENTE">Mensal</option>
                  </select>
                </div>
                <div>
                  <Label>
                    Nº de Parcelas
                    {parcelas > 1 && (
                      <span className="ml-1 text-primary text-xs">
                        (gera {parcelas}x)
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={parcelasInput}
                    disabled={recorrencia !== "NAO"}
                    onChange={(e) => {
                      setParcelasInput(e.target.value);
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v > 0) {
                        setParcelas(v);
                        if (v > 1) setRecorrencia("NAO");
                      }
                    }}
                    onBlur={() => {
                      const v = parseInt(parcelasInput);
                      const final = isNaN(v) || v < 1 ? 1 : Math.min(v, 120);
                      setParcelas(final);
                      setParcelasInput(String(final));
                    }}
                  />
                </div>
              </div>

              {recorrencia !== "NAO" && (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  A cada pagamento, o próximo lançamento será criado automaticamente.
                </p>
              )}
              {recorrencia === "NAO" && parcelas > 1 && (
                <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                  Serão criados {parcelas} lançamentos com vencimentos mensais.
                </p>
              )}
            </div>
          )}

          {lancamento?.grupo_parcela_id && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aplicarATodos}
                onChange={(e) => setAplicarATodos(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-muted-foreground">
                Aplicar alterações a todas as {lancamento.numero_parcelas}x
                parcelas do grupo
              </span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`flex-1 ${
                tipo === "DESPESA"
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {loading
                ? "Salvando..."
                : lancamento
                ? "Salvar Alterações"
                : `Criar ${labelTipo}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}