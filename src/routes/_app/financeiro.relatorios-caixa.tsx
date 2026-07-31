import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import {
  FileText, ChevronDown, ChevronUp, Printer,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Banknote, ArrowDownCircle, Tag, Calendar, User,
} from "lucide-react";

export const Route = createFileRoute("/_app/financeiro/relatorios-caixa")({
  component: RelatoriosCaixaPage,
});

const MESES = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const listFechamentosDiarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ano: z.number(), mes: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const inicio = `${data.ano}-${String(data.mes).padStart(2, "0")}-01`;
    const fim = new Date(data.ano, data.mes, 0).toISOString().split("T")[0];
    const { data: fechamentos, error } = await context.supabase
      .from("fechamento_caixa").select("*")
      .gte("data_fechamento", inicio).lte("data_fechamento", fim)
      .order("data_fechamento", { ascending: false });
    if (error) throw new Error(error.message);

    // Busca sangrias para cada fechamento
    const result = await Promise.all((fechamentos ?? []).map(async (f) => {
      if (!f.caixa_id) return { ...f, sangrias_detalhadas: [] };
      const { data: sangrias } = await context.supabase
        .from("sangria")
        .select("id, valor, motivo, nome_responsavel, created_at")
        .eq("caixa_id", f.caixa_id)
        .order("created_at", { ascending: true });
      return { ...f, sangrias_detalhadas: sangrias ?? [] };
    }));

    return result;
  });

function RelatoriosCaixaPage() {
  const listar = useServerFn(listFechamentosDiarios);
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"diario" | "mensal">("diario");
  const [dataSel, setDataSel] = useState(() => now.toISOString().split("T")[0]);

  async function buscar() {
    setLoading(true);
    try { const res = await listar({ data: { ano, mes } }); setDados(res); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { buscar(); }, [ano, mes]);

  useEffect(() => {
    if (viewMode === "diario" && dataSel) {
      const d = new Date(dataSel + "T12:00:00");
      setAno(d.getFullYear()); setMes(d.getMonth() + 1);
    }
  }, [dataSel, viewMode]);

  function navMes(delta: number) {
    let novoMes = mes + delta; let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes); setAno(novoAno);
  }

  function formatarHora(iso: string) {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const totalVendas = dados.reduce((s, d) => s + Number(d.total_vendas), 0);
  const totalCancelamentos = dados.reduce((s, d) => s + Number(d.total_cancelamentos), 0);
  const totalSangrias = dados.reduce((s, d) => s + Number(d.total_sangrias), 0);
  const totalDescontos = dados.reduce((s, d) => s + Number(d.total_descontos), 0);
  const totalDinheiro = dados.reduce((s, d) => s + Number(d.total_dinheiro), 0);
  const totalCredito = dados.reduce((s, d) => s + Number(d.total_credito), 0);
  const totalDebito = dados.reduce((s, d) => s + Number(d.total_debito), 0);
  const totalPix = dados.reduce((s, d) => s + Number(d.total_pix), 0);
  const totalQtdVendas = dados.reduce((s, d) => s + Number(d.qtd_vendas), 0);
  const totalQtdCancelamentos = dados.reduce((s, d) => s + Number(d.qtd_cancelamentos), 0);
  const totalQtdSangrias = dados.reduce((s, d) => s + Number(d.qtd_sangrias), 0);
  const liquidoMes = totalVendas - totalCancelamentos - totalDescontos;
  const ticketMedio = totalQtdVendas > 0 ? totalVendas / totalQtdVendas : 0;

  const dadosFiltrados = viewMode === "diario" && dataSel
    ? dados.filter((d) => d.data_fechamento === dataSel)
    : dados;

  const DetalhamentoExpandido = ({ d }: { d: any }) => {
    const liquido = Number(d.total_vendas) - Number(d.total_cancelamentos);
    const diferenca = d.valor_fechamento != null ? Number(d.valor_fechamento) - Number(d.saldo_esperado) : null;
    return (
      <div className="bg-muted/20 px-6 py-4 border-t text-xs space-y-3">
        {/* Operador */}
        {d.nome_operador && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
            <User size={12} className="text-muted-foreground" />
            <span className="text-muted-foreground">Operador:</span>
            <span className="font-semibold">{d.nome_operador}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="font-bold uppercase text-muted-foreground mb-1">Movimento</p>
            <div className="flex justify-between"><span>Abertura</span><span>{formatBRL(Number(d.valor_abertura))}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Vendas ({d.qtd_vendas})</span><span>{formatBRL(Number(d.total_vendas))}</span></div>
            <div className="flex justify-between text-red-600"><span>Cancelamentos ({d.qtd_cancelamentos})</span><span>- {formatBRL(Number(d.total_cancelamentos))}</span></div>
            <div className="flex justify-between text-orange-600"><span>Descontos</span><span>- {formatBRL(Number(d.total_descontos))}</span></div>
            <div className="flex justify-between text-red-500"><span>Sangrias ({d.qtd_sangrias})</span><span>- {formatBRL(Number(d.total_sangrias))}</span></div>
            <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Liquido</span><span>{formatBRL(liquido)}</span></div>
          </div>

          <div className="space-y-1">
            <p className="font-bold uppercase text-muted-foreground mb-1">Por Pagamento</p>
            <div className="flex justify-between"><span>Dinheiro</span><span>{formatBRL(Number(d.total_dinheiro))}</span></div>
            <div className="flex justify-between"><span>Credito</span><span>{formatBRL(Number(d.total_credito))}</span></div>
            <div className="flex justify-between"><span>Debito</span><span>{formatBRL(Number(d.total_debito))}</span></div>
            <div className="flex justify-between"><span>PIX</span><span>{formatBRL(Number(d.total_pix))}</span></div>
            <div className="border-t pt-1 mt-1">
              <p className="font-bold uppercase text-muted-foreground mb-1">Conferencia</p>
              <div className="flex justify-between"><span>Saldo esperado</span><span className="font-medium text-primary">{formatBRL(Number(d.saldo_esperado))}</span></div>
              {d.valor_fechamento != null && (
                <>
                  <div className="flex justify-between"><span>Valor contado</span><span>{formatBRL(Number(d.valor_fechamento))}</span></div>
                  <div className={`flex justify-between font-bold ${diferenca === 0 ? "text-emerald-600" : diferenca! > 0 ? "text-blue-600" : "text-red-600"}`}>
                    <span>Diferenca</span><span>{diferenca! >= 0 ? "+" : ""}{formatBRL(diferenca!)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sangrias detalhadas */}
        {d.sangrias_detalhadas && d.sangrias_detalhadas.length > 0 && (
          <div className="border-t pt-2 mt-1">
            <p className="font-bold uppercase text-muted-foreground mb-2">Detalhamento de Sangrias</p>
            <div className="space-y-1">
              {d.sangrias_detalhadas.map((sg: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-orange-50/50 rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle size={10} className="text-orange-500 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-orange-700">{sg.nome_responsavel ?? null}</span>
                      <span className="text-muted-foreground ml-2">{formatarHora(sg.created_at)}</span>
                      {sg.motivo && <span className="text-muted-foreground ml-1">— {sg.motivo}</span>}
                    </div>
                  </div>
                  <span className="font-bold text-orange-600">{formatBRL(Number(sg.valor))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Relatorios de Caixa
          </h1>
          <p className="text-sm text-muted-foreground">Historico de fechamentos diarios e mensais.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border overflow-hidden">
            {(["diario", "mensal"] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {m === "diario" ? "Diario" : "Mensal"}
              </button>
            ))}
          </div>
          {viewMode === "diario" ? (
            <Input type="date" value={dataSel} onChange={(e) => setDataSel(e.target.value)}
              className="h-9 text-sm w-40" max={now.toISOString().split("T")[0]} />
          ) : (
            <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
              <button onClick={() => navMes(-1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /></button>
              <span className="text-sm font-medium min-w-[130px] text-center">{MESES[mes - 1]} / {ano}</span>
              <button onClick={() => navMes(1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronRight size={16} /></button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div id="print-relatorio">
        {viewMode === "mensal" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground">Vendas Brutas</span></div>
                <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatBRL(totalVendas)}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalQtdVendas} transacoes</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Venda Liquida</span></div>
                <p className="text-xl font-bold text-primary tabular-nums">{formatBRL(liquidoMes)}</p>
                <p className="text-xs text-muted-foreground mt-1">Ticket medio: {formatBRL(ticketMedio)}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1"><Tag className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Descontos + Cancel.</span></div>
                <p className="text-xl font-bold text-orange-500 tabular-nums">{formatBRL(totalDescontos + totalCancelamentos)}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalQtdCancelamentos} cancelamentos</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Sangrias</span></div>
                <p className="text-xl font-bold text-red-500 tabular-nums">{formatBRL(totalSangrias)}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalQtdSangrias} retiradas</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /> Por Forma de Pagamento</h3>
                <div className="space-y-3">
                  {[
                    { label: "Dinheiro", value: totalDinheiro, pct: totalVendas > 0 ? (totalDinheiro / totalVendas) * 100 : 0 },
                    { label: "Credito", value: totalCredito, pct: totalVendas > 0 ? (totalCredito / totalVendas) * 100 : 0 },
                    { label: "Debito", value: totalDebito, pct: totalVendas > 0 ? (totalDebito / totalVendas) * 100 : 0 },
                    { label: "PIX", value: totalPix, pct: totalVendas > 0 ? (totalPix / totalVendas) * 100 : 0 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{item.pct.toFixed(1)}%</span>
                          <span className="text-sm font-bold tabular-nums">{formatBRL(item.value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(item.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between text-sm font-bold">
                    <span>Total</span><span>{formatBRL(totalDinheiro + totalCredito + totalDebito + totalPix)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Resumo — {MESES[mes - 1]} {ano}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Dias trabalhados</span><span className="font-bold">{dados.length}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Total de vendas</span><span className="font-bold text-emerald-600">{formatBRL(totalVendas)}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Cancelamentos ({totalQtdCancelamentos})</span><span className="font-bold text-red-600">- {formatBRL(totalCancelamentos)}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Descontos</span><span className="font-bold text-orange-500">- {formatBRL(totalDescontos)}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Sangrias ({totalQtdSangrias})</span><span className="font-bold text-red-500">- {formatBRL(totalSangrias)}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Ticket medio</span><span className="font-bold">{formatBRL(ticketMedio)}</span></div>
                  <div className="flex justify-between py-2 bg-primary/5 rounded-lg px-2 font-bold text-base">
                    <span>Venda Liquida</span><span className="text-primary">{formatBRL(liquidoMes)}</span>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="text-sm font-semibold">Detalhamento por Dia</h3>
                <span className="text-xs text-muted-foreground">{dados.length} fechamento{dados.length !== 1 ? "s" : ""}</span>
              </div>
              {loading && <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>}
              {!loading && dados.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Nenhum fechamento em {MESES[mes - 1]}/{ano}.</div>}
              <div className="divide-y">
                {[...dados].reverse().map((d) => {
                  const isExpanded = expandedId === d.id;
                  const liquido = Number(d.total_vendas) - Number(d.total_cancelamentos) - Number(d.total_descontos);
                  const diferenca = d.valor_fechamento != null ? Number(d.valor_fechamento) - Number(d.saldo_esperado) : null;
                  const dataFmt = new Date(d.data_fechamento + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
                  return (
                    <div key={d.id}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">{dataFmt}</span>
                            {d.nome_operador && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User size={10} />{d.nome_operador}
                              </span>
                            )}
                            {diferenca !== null && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${diferenca === 0 ? "bg-emerald-100 text-emerald-700" : diferenca > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                                {diferenca === 0 ? "OK" : `${diferenca > 0 ? "+" : ""}${formatBRL(diferenca)}`}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                            <span>{d.qtd_vendas} vendas</span>
                            {Number(d.qtd_cancelamentos) > 0 && <span className="text-red-600">{d.qtd_cancelamentos} cancel.</span>}
                            {Number(d.qtd_sangrias) > 0 && <span className="text-orange-600">{d.qtd_sangrias} sangrias</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-600">{formatBRL(Number(d.total_vendas))}</div>
                          <div className="text-xs text-muted-foreground">liquido: {formatBRL(liquido)}</div>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </div>
                      {isExpanded && <DetalhamentoExpandido d={d} />}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {viewMode === "diario" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Vendas", value: dadosFiltrados.reduce((s, d) => s + Number(d.total_vendas), 0), cor: "text-emerald-600" },
                { label: "Cancelamentos", value: dadosFiltrados.reduce((s, d) => s + Number(d.total_cancelamentos), 0), cor: "text-red-600" },
                { label: "Sangrias", value: dadosFiltrados.reduce((s, d) => s + Number(d.total_sangrias), 0), cor: "text-orange-600" },
                { label: "Descontos", value: dadosFiltrados.reduce((s, d) => s + Number(d.total_descontos), 0), cor: "text-yellow-600" },
              ].map((item) => (
                <Card key={item.label} className="p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={`text-lg font-bold tabular-nums ${item.cor}`}>{formatBRL(item.value)}</p>
                </Card>
              ))}
            </div>
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {dataSel ? `Fechamento de ${new Date(dataSel + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}` : "Selecione uma data"}
                </h2>
                <span className="text-xs text-muted-foreground">{dadosFiltrados.length} fechamento{dadosFiltrados.length !== 1 ? "s" : ""}</span>
              </div>
              {loading && <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>}
              {!loading && dadosFiltrados.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Nenhum fechamento nesta data.</div>}
              <div className="divide-y">
                {dadosFiltrados.map((d) => {
                  const isExpanded = expandedId === d.id;
                  const liquido = Number(d.total_vendas) - Number(d.total_cancelamentos);
                  const diferenca = d.valor_fechamento != null ? Number(d.valor_fechamento) - Number(d.saldo_esperado) : null;
                  const dataFormatada = new Date(d.data_fechamento + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
                  return (
                    <div key={d.id}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium capitalize">{dataFormatada}</span>
                            {d.nome_operador && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User size={10} />{d.nome_operador}
                              </span>
                            )}
                            {diferenca !== null && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${diferenca === 0 ? "bg-emerald-100 text-emerald-700" : diferenca > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                                {diferenca === 0 ? "Conferido" : diferenca > 0 ? `+${formatBRL(diferenca)}` : formatBRL(diferenca)}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                            <span>{d.qtd_vendas} vendas</span>
                            {Number(d.qtd_cancelamentos) > 0 && <span className="text-red-600">{d.qtd_cancelamentos} cancelamentos</span>}
                            {Number(d.qtd_sangrias) > 0 && <span className="text-orange-600">{d.qtd_sangrias} sangrias</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-600">{formatBRL(Number(d.total_vendas))}</div>
                          <div className="text-xs text-muted-foreground">liquido: {formatBRL(liquido)}</div>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </div>
                      {isExpanded && <DetalhamentoExpandido d={d} />}
                    </div>
                  );
                })}
              </div>
              {dadosFiltrados.length > 0 && (
                <div className="border-t bg-muted/30 px-4 py-3 flex justify-between items-center text-sm">
                  <span className="font-semibold">Total do dia</span>
                  <div className="flex gap-6 text-xs">
                    <span className="text-emerald-600 font-bold">Vendas: {formatBRL(dadosFiltrados.reduce((s, d) => s + Number(d.total_vendas), 0))}</span>
                    <span className="text-red-600">Cancel.: {formatBRL(dadosFiltrados.reduce((s, d) => s + Number(d.total_cancelamentos), 0))}</span>
                    <span className="font-bold">Liquido: {formatBRL(dadosFiltrados.reduce((s, d) => s + Number(d.total_vendas) - Number(d.total_cancelamentos), 0))}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #print-relatorio, #print-relatorio * { visibility: visible !important; }
          #print-relatorio { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; font-family: Arial, sans-serif !important; font-size: 8pt !important; color: #000 !important; }
        }
      `}</style>
    </div>
  );
}
