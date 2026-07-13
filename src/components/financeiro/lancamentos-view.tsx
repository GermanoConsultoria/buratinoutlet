import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Plus,
  CheckCircle,
  XCircle,
  Trash2,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  getLancamentosFinanceiros,
  pagarLancamento,
  cancelarLancamento,
  excluirLancamento,
  excluirEAvancarRecorrencia,
  excluirGrupoParcelas,
} from "@/lib/financeiro.functions";
import ModalLancamento from "@/components/financeiro/modal-lancamento";
import { formatBRL } from "@/lib/format";
import type {
  LancamentoComRelacoes,
  PlanoContas,
  TipoLancamento,
  StatusLancamento,
} from "@/lib/financeiro.types";

interface Props {
  lancamentos: LancamentoComRelacoes[];
  planoContas: PlanoContas[];
  tipo: TipoLancamento;
  sugestoesDescricao: string[];
  sugestoesBeneficiario: string[];
}

const STATUS_LABEL: Record<StatusLancamento, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const STATUS_COR: Record<StatusLancamento, string> = {
  PENDENTE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PAGO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADO: "bg-gray-100 text-gray-600 border-gray-200",
};

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function SeletorMes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(() =>
    value === "TODOS" ? new Date().getFullYear() : Number(value.split("-")[0])
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== "TODOS") setAno(Number(value.split("-")[0]));
  }, [value]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const label =
    value === "TODOS"
      ? "Todos os meses"
      : new Date(Number(value.split("-")[0]), Number(value.split("-")[1]) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="bg-background border rounded-lg px-3 py-2 text-sm flex items-center gap-2 whitespace-nowrap"
      >
        <span className="capitalize">{label}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {aberto && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-card border rounded-xl shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAno((a) => a - 1)} className="p-1 text-muted-foreground hover:text-foreground rounded">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold">{ano}</span>
            <button onClick={() => setAno((a) => a + 1)} className="p-1 text-muted-foreground hover:text-foreground rounded">
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESES_ABREV.map((m, i) => {
              const val = `${ano}-${String(i + 1).padStart(2, "0")}`;
              const ativo = value === val;
              return (
                <button
                  key={m}
                  onClick={() => { onChange(val); setAberto(false); }}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { onChange("TODOS"); setAberto(false); }}
            className={`mt-2 w-full py-1.5 rounded-lg text-xs transition-colors ${value === "TODOS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Todos os meses
          </button>
        </div>
      )}
    </div>
  );
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function LancamentosView({ lancamentos: inicial, planoContas, tipo, sugestoesDescricao, sugestoesBeneficiario }: Props) {
  const getList = useServerFn(getLancamentosFinanceiros);
  const pagar = useServerFn(pagarLancamento);
  const cancelar = useServerFn(cancelarLancamento);
  const excluir = useServerFn(excluirLancamento);
  const excluirAvancar = useServerFn(excluirEAvancarRecorrencia);
  const excluirGrupo = useServerFn(excluirGrupoParcelas);

  const [lancamentos, setLancamentos] = useState(inicial);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<LancamentoComRelacoes | null>(null);
  const [modalPagar, setModalPagar] = useState<string | null>(null);
  const [dtPagamento, setDtPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [modalExcluirRecorrente, setModalExcluirRecorrente] = useState<string | null>(null);
  const [modalExcluirGrupo, setModalExcluirGrupo] = useState<LancamentoComRelacoes | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusLancamento | "TODOS">("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroMes, setFiltroMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const montado = useRef(false);

  const recarregar = useCallback(async () => {
    try {
      let data_inicio: string | undefined;
      let data_fim: string | undefined;
      if (filtroMes !== "TODOS") {
        const [ano, mes] = filtroMes.split("-");
        data_inicio = `${ano}-${mes}-01`;
        const ultimo = new Date(Number(ano), Number(mes), 0);
        data_fim = `${ano}-${mes}-${String(ultimo.getDate()).padStart(2, "0")}`;
      }
      const atualizados = await getList({
        data: { tipo, status: filtroStatus, plano_contas_id: filtroCategoria, data_inicio, data_fim },
      });
      setLancamentos(atualizados as LancamentoComRelacoes[]);
    } catch {
      toast.error("Erro ao carregar lançamentos.");
    }
  }, [tipo, filtroMes, filtroStatus, filtroCategoria, getList]);

  useEffect(() => {
    if (!montado.current) { montado.current = true; return; }
    recarregar();
  }, [recarregar]);

  const lancamentosFiltrados = useMemo(() => {
    if (!busca) return lancamentos;
    const q = busca.toLowerCase();
    return lancamentos.filter(
      (l) => l.descricao.toLowerCase().includes(q) || (l.beneficiario ?? "").toLowerCase().includes(q)
    );
  }, [lancamentos, busca]);

  const totalPendente = lancamentos.filter((l) => l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = lancamentos.filter((l) => l.status === "PAGO").reduce((s, l) => s + Number(l.valor), 0);

  const hoje = new Date().toISOString().split("T")[0];
  function isVencido(l: LancamentoComRelacoes) {
    return l.status === "PENDENTE" && new Date(l.dt_vencimento) < new Date(hoje);
  }

  const pagarMut = useMutation({
    mutationFn: async () => {
      if (!modalPagar) return;
      await pagar({ data: { id: modalPagar, dt_pagamento: dtPagamento } });
      const isRecorrente = lancamentos.find((l) => l.id === modalPagar)?.recorrencia !== "NAO";
      if (isRecorrente) {
        await recarregar();
      } else {
        setLancamentos((prev) =>
          prev.map((l) => l.id === modalPagar ? { ...l, status: "PAGO" as StatusLancamento, dt_pagamento: dtPagamento } : l)
        );
      }
      toast.success("Lançamento marcado como pago.");
      setModalPagar(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarMut = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Cancelar este lançamento?")) return;
      await cancelar({ data: { id } });
      setLancamentos((prev) => prev.map((l) => l.id === id ? { ...l, status: "CANCELADO" as StatusLancamento } : l));
      toast.success("Lançamento cancelado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleExcluir(l: LancamentoComRelacoes) {
    if (l.grupo_parcela_id) { setModalExcluirGrupo(l); return; }
    if (l.recorrencia !== "NAO") { setModalExcluirRecorrente(l.id); return; }
    if (!confirm("Excluir este lançamento permanentemente?")) return;
    try {
      await excluir({ data: { id: l.id } });
      setLancamentos((prev) => prev.filter((x) => x.id !== l.id));
      toast.success("Lançamento excluído.");
    } catch (e) { toast.error((e as Error).message); }
  }

  const corPrincipal = tipo === "DESPESA" ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendente</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{formatBRL(totalPendente)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{tipo === "DESPESA" ? "Pago" : "Recebido"}</p>
          <p className={`text-2xl font-bold mt-1 ${tipo === "DESPESA" ? "text-red-600" : "text-emerald-600"}`}>{formatBRL(totalPago)}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição ou beneficiário..." className="pl-9" />
        </div>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="TODAS">Todas as categorias</option>
          {planoContas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <SeletorMes value={filtroMes} onChange={setFiltroMes} />
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusLancamento | "TODOS")} className="border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="TODOS">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">{tipo === "DESPESA" ? "Pago" : "Recebido"}</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <Button className={`${corPrincipal} text-white flex-shrink-0`} onClick={() => { setEditando(null); setShowModal(true); }}>
          <Plus size={16} className="mr-1" /> {tipo === "DESPESA" ? "Nova Despesa" : "Nova Receita"}
        </Button>
      </div>

      {lancamentosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
          Nenhum lançamento encontrado.
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  {tipo === "DESPESA" && <TableHead>Beneficiário</TableHead>}
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Vencimento</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-center">Nº Doc.</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentosFiltrados.map((l) => (
                  <TableRow
                    key={l.id}
                    onClick={() => { setEditando(l); setShowModal(true); }}
                    className={`cursor-pointer ${isVencido(l) ? "bg-red-50" : ""}`}
                  >
                    <TableCell>
                      <div className="font-medium">{l.descricao}</div>
                      {l.numero_parcelas && l.numero_parcelas > 1 && (
                        <div className="text-xs text-muted-foreground">{l.parcela_atual}/{l.numero_parcelas}x</div>
                      )}
                      {isVencido(l) && <div className="text-xs text-red-600">Vencido</div>}
                    </TableCell>
                    {tipo === "DESPESA" && <TableCell className="text-muted-foreground">{l.beneficiario ?? "—"}</TableCell>}
                    <TableCell className="text-muted-foreground">{l.plano_contas.nome}</TableCell>
                    <TableCell className={`text-right font-semibold ${tipo === "DESPESA" ? "text-red-600" : "text-emerald-600"}`}>
                      {formatBRL(Number(l.valor))}
                    </TableCell>
                    <TableCell className="text-center">{formatarData(l.dt_vencimento)}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{l.dt_pagamento ? formatarData(l.dt_pagamento) : "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{l.numero_documento ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_COR[l.status as StatusLancamento]}`}>
                        {STATUS_LABEL[l.status as StatusLancamento]}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {l.status === "PENDENTE" && (
                          <>
                            <button onClick={() => { setModalPagar(l.id); setDtPagamento(new Date().toISOString().split("T")[0]); }} className="p-1.5 text-muted-foreground hover:text-emerald-600 transition-colors" title="Registrar pagamento">
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => cancelarMut.mutate(l.id)} className="p-1.5 text-muted-foreground hover:text-yellow-600 transition-colors" title="Cancelar">
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleExcluir(l)} className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {showModal && (
        <ModalLancamento
          tipo={tipo}
          planoContas={planoContas}
          lancamento={editando ?? undefined}
          sugestoesDescricao={sugestoesDescricao}
          sugestoesBeneficiario={sugestoesBeneficiario}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onSuccess={recarregar}
        />
      )}

      {modalExcluirGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold">Excluir Parcela</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Este lançamento faz parte de um grupo de <strong>{modalExcluirGrupo.numero_parcelas}x parcelas</strong>. O que deseja excluir?
              </p>
            </div>
            <div className="space-y-2">
              <button onClick={async () => { await excluir({ data: { id: modalExcluirGrupo.id } }); setLancamentos((prev) => prev.filter((l) => l.id !== modalExcluirGrupo.id)); toast.success("Parcela excluída."); setModalExcluirGrupo(null); }} className="w-full py-2.5 rounded-lg border text-sm font-medium text-left px-4 hover:bg-muted transition-colors">
                <div className="font-medium">Só esta parcela</div>
                <div className="text-xs text-muted-foreground mt-0.5">Parcela {modalExcluirGrupo.parcela_atual} de {modalExcluirGrupo.numero_parcelas}</div>
              </button>
              <button onClick={async () => { await excluirGrupo({ data: { grupo_parcela_id: modalExcluirGrupo.grupo_parcela_id! } }); setLancamentos((prev) => prev.filter((l) => l.grupo_parcela_id !== modalExcluirGrupo.grupo_parcela_id)); toast.success("Todas as parcelas excluídas."); setModalExcluirGrupo(null); }} className="w-full py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-medium text-left px-4 hover:bg-red-100 transition-colors">
                <div className="font-medium">Todas as parcelas do grupo</div>
                <div className="text-xs text-red-400 mt-0.5">Remove as {modalExcluirGrupo.numero_parcelas}x parcelas permanentemente</div>
              </button>
            </div>
            <button onClick={() => setModalExcluirGrupo(null)} className="w-full py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {modalExcluirRecorrente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold">Lançamento Recorrente</h2>
              <p className="text-sm text-muted-foreground mt-1">O que deseja fazer com este lançamento?</p>
            </div>
            <div className="space-y-2">
              <button onClick={async () => { await excluirAvancar({ data: { id: modalExcluirRecorrente } }); await recarregar(); toast.success("Excluído. Próximo gerado."); setModalExcluirRecorrente(null); }} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium text-left px-4 hover:opacity-90 transition-colors">
                <div className="font-medium">Excluir só este</div>
                <div className="text-xs opacity-80 mt-0.5">Remove este e gera o próximo automaticamente</div>
              </button>
              <button onClick={async () => { await excluir({ data: { id: modalExcluirRecorrente } }); setLancamentos((prev) => prev.filter((l) => l.id !== modalExcluirRecorrente)); toast.success("Recorrência encerrada."); setModalExcluirRecorrente(null); }} className="w-full py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-medium text-left px-4 hover:bg-red-100 transition-colors">
                <div className="font-medium">Cancelar a recorrência</div>
                <div className="text-xs text-red-400 mt-0.5">Remove este e não cria mais nenhum</div>
              </button>
            </div>
            <button onClick={() => setModalExcluirRecorrente(null)} className="w-full py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors">Voltar</button>
          </div>
        </div>
      )}

      {modalPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">{tipo === "DESPESA" ? "Registrar Pagamento" : "Registrar Recebimento"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data do {tipo === "DESPESA" ? "Pagamento" : "Recebimento"}</label>
                <Input type="date" value={dtPagamento} onChange={(e) => setDtPagamento(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setModalPagar(null)}>Cancelar</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => pagarMut.mutate()} disabled={pagarMut.isPending}>Confirmar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}