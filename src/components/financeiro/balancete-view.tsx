import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBalancete } from "@/lib/financeiro.functions";
import { formatBRL } from "@/lib/format";
import type { Balancete, ContratoEncerrando, ItemBalanceteConta } from "@/lib/financeiro.types";

interface Props {
  balancete: Balancete | null;
  dataInicio: string;
  dataFim: string;
}

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function CardResumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${cor}`}>{formatBRL(valor)}</p>
    </Card>
  );
}

const TooltipCustom = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatBRL(p.value)}</p>
      ))}
    </div>
  );
};

function SeletorMesBalancete({ onAplicar }: { onAplicar: (ini: string, fim: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const label = `${MESES_ABREV[mesSel]} / ${ano}`;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 text-sm hover:border-muted-foreground transition-colors">
        {label} <ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {aberto && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-card border rounded-xl shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAno((a) => a - 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold">{ano}</span>
            <button onClick={() => setAno((a) => a + 1)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={15} /></button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESES_ABREV.map((m, i) => (
              <button key={m} onClick={() => {
                setMesSel(i);
                const ini = `${ano}-${String(i + 1).padStart(2, "0")}-01`;
                const fim = `${ano}-${String(i + 1).padStart(2, "0")}-${new Date(ano, i + 1, 0).getDate()}`;
                onAplicar(ini, fim);
                setAberto(false);
              }} className={`py-2 rounded-lg text-xs font-medium transition-colors ${mesSel === i ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabelaConta({ titulo, itens, total, cor, lancamentosPorConta }: {
  titulo: string;
  itens: ItemBalanceteConta[];
  total: number;
  cor: string;
  lancamentosPorConta: Balancete["lancamentos_por_conta"];
}) {
  const [contaAberta, setContaAberta] = useState<string | null>(null);

  const statusLabel: Record<string, { label: string; cor: string }> = {
    PAGO:      { label: "Pago",      cor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    PENDENTE:  { label: "Pendente",  cor: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    CANCELADO: { label: "Cancelado", cor: "bg-gray-100 text-gray-600 border-gray-200" },
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">{titulo}</h2>
      </div>
      {itens.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">Nenhum lançamento no período.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Conta</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2">%</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...itens].sort((a, b) => b.total - a.total).map((item) => (
              <>
                <tr key={item.plano_contas_id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setContaAberta(contaAberta === item.plano_contas_id ? null : item.plano_contas_id)}>
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className={`text-muted-foreground text-xs transition-transform ${contaAberta === item.plano_contas_id ? "rotate-90" : ""}`}>▶</span>
                    {item.nome}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${cor}`}>{formatBRL(item.total)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{total > 0 ? `${((item.total / total) * 100).toFixed(1)}%` : "—"}</td>
                </tr>
                {contaAberta === item.plano_contas_id && (
                  <tr key={`${item.plano_contas_id}-detalhe`}>
                    <td colSpan={3} className="px-0 py-0 bg-muted/30">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground uppercase border-b">
                            <th className="text-left px-8 py-2">Descrição</th>
                            <th className="text-center px-4 py-2">Status</th>
                            <th className="text-right px-4 py-2">Vencimento</th>
                            <th className="text-right px-4 py-2">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(lancamentosPorConta[item.plano_contas_id] ?? []).map((l, i) => {
                            const s = statusLabel[l.status] ?? { label: l.status, cor: "bg-gray-100 text-gray-600 border-gray-200" };
                            const dt = new Date(l.dt_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" });
                            return (
                              <tr key={i} className="hover:bg-muted/20">
                                <td className="px-8 py-2 text-muted-foreground">{l.descricao}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.cor}`}>{s.label}</span>
                                </td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{dt}</td>
                                <td className={`px-4 py-2 text-right font-medium ${cor}`}>{formatBRL(l.valor)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
            <tr className="border-t-2 font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td className={`px-4 py-2.5 text-right ${cor}`}>{formatBRL(total)}</td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
            </tr>
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ContratosEncerrando({ contratos }: { contratos: ContratoEncerrando[] }) {
  function faixa(dias: number) {
    if (dias <= 30) return { bg: "bg-red-50", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
    if (dias <= 60) return { bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" };
    return { bg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" };
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <h2 className="text-sm font-semibold">Contratos Encerrando em até 90 dias</h2>
        <span className="ml-auto text-xs bg-muted border rounded-full px-2 py-0.5 text-muted-foreground">{contratos.length}</span>
      </div>
      <div className="divide-y">
        {contratos.map((c) => {
          const f = faixa(c.dias_restantes);
          const dtFormatada = new Date(c.dt_ultima_parcela + "T12:00:00").toLocaleDateString("pt-BR");
          return (
            <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${f.bg}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${f.dot}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.descricao || "(sem descrição)"}</p>
                  <p className="text-xs text-muted-foreground">Última parcela: {dtFormatada} · {c.parcelas_restantes}/{c.total_parcelas} parcelas restantes</p>
                </div>
              </div>
              <div className="shrink-0 ml-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${f.badge}`}>
                  {c.dias_restantes === 0 ? "Vence hoje" : `${c.dias_restantes} dias`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function BalanceteView({ balancete: inicial, dataInicio, dataFim }: Props) {
  const navigate = useNavigate();
  const getBal = useServerFn(getBalancete);
  const [balancete, setBalancete] = useState(inicial);
  const [modo, setModo] = useState<"mes" | "ano" | "periodo">("mes");
  const [anoSel, setAnoSel] = useState(new Date().getFullYear());
  const [periodoIni, setPeriodoIni] = useState(dataInicio);
  const [periodoFim, setPeriodoFim] = useState(dataFim);
  const [tipoGrafico, setTipoGrafico] = useState<"barra" | "linha" | "pizza">("barra");

  async function navegar(ini: string, fim: string) {
    const novo = await getBal({ data: { data_inicio: ini, data_fim: fim } });
    setBalancete(novo);
  }

  function aplicarAno(ano: number) {
    setAnoSel(ano);
    navegar(`${ano}-01-01`, `${ano}-12-31`);
  }

  if (!balancete) {
    return <p className="text-center text-muted-foreground py-12">Erro ao carregar balancete.</p>;
  }

  const b = balancete;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          {(["mes", "ano", "periodo"] as const).map((m) => (
            <button key={m} onClick={() => { setModo(m); if (m === "ano") aplicarAno(anoSel); }}
              className={`px-4 py-2 text-xs font-medium transition-colors ${modo === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
              {m === "mes" ? "Mês" : m === "ano" ? "Ano" : "Período"}
            </button>
          ))}
        </div>

        {modo === "mes" && <SeletorMesBalancete onAplicar={navegar} />}

        {modo === "ano" && (
          <div className="flex items-center gap-1 bg-background border rounded-lg overflow-hidden">
            <button onClick={() => aplicarAno(anoSel - 1)} className="px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold px-2 min-w-[3rem] text-center">{anoSel}</span>
            <button onClick={() => aplicarAno(anoSel + 1)} className="px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ChevronRight size={15} /></button>
          </div>
        )}

        {modo === "periodo" && (
          <div className="flex items-center gap-2">
            <input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} className="bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <span className="text-muted-foreground text-sm">até</span>
            <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <Button onClick={() => navegar(periodoIni, periodoFim)}>Aplicar</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <CardResumo label="Receitas previstas" valor={b.receitas} cor="text-emerald-600" />
        <CardResumo label="Despesas previstas" valor={b.despesas} cor="text-red-600" />
        <CardResumo label={b.lucro >= 0 ? "Lucro previsto" : "Prejuízo previsto"} valor={Math.abs(b.lucro)} cor={b.lucro >= 0 ? "text-emerald-600" : "text-red-600"} />
        <CardResumo label={b.saldo >= 0 ? "Saldo realizado" : "Déficit realizado"} valor={Math.abs(b.saldo)} cor={b.saldo >= 0 ? "text-primary" : "text-red-600"} />
        <CardResumo label="A Receber no período" valor={b.a_receber} cor="text-yellow-600" />
        <CardResumo label="A Pagar no período" valor={b.a_pagar} cor="text-orange-600" />
      </div>

      {b.dados_mensais.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">
              {tipoGrafico === "pizza" ? "Distribuição do Período" : "Receitas × Despesas × Lucro por Mês"}
            </h2>
            <div className="flex gap-1">
              {(["barra", "linha", "pizza"] as const).map((t) => (
                <button key={t} onClick={() => setTipoGrafico(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${tipoGrafico === t ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                  {t === "barra" ? "Barra" : t === "linha" ? "Linha" : "Pizza"}
                </button>
              ))}
            </div>
          </div>

          {tipoGrafico === "barra" && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={b.dados_mensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={<TooltipCustom />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {tipoGrafico === "linha" && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={b.dados_mensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={<TooltipCustom />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {tipoGrafico === "pizza" && (() => {
            const dadosPizza = [
              { name: "Receitas", value: b.receitas, color: "#10b981" },
              { name: "Despesas", value: b.despesas, color: "#ef4444" },
              ...(b.lucro > 0 ? [{ name: "Lucro", value: b.lucro, color: "#6366f1" }] : []),
            ].filter((d) => d.value > 0);
            const total = dadosPizza.reduce((s, d) => s + d.value, 0);
            return (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={260}>
                  <PieChart>
                    <Pie data={dadosPizza} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
                      {dadosPizza.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatBRL(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {dadosPizza.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-sm">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium" style={{ color: d.color }}>{formatBRL(d.value)}</div>
                        <div className="text-xs text-muted-foreground">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {b.contratos_encerrando.length > 0 && (
        <ContratosEncerrando contratos={b.contratos_encerrando} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TabelaConta titulo="Receitas por Conta" itens={b.receitas_por_conta} total={b.receitas} cor="text-emerald-600" lancamentosPorConta={b.lancamentos_por_conta} />
        <TabelaConta titulo="Despesas por Conta" itens={b.despesas_por_conta} total={b.despesas} cor="text-red-600" lancamentosPorConta={b.lancamentos_por_conta} />
      </div>
    </div>
  );
}