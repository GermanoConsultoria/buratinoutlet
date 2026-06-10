import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFechamentoDiario, salvarFechamentoDiario, listFechamentosMensais } from "@/lib/sales.functions";
import { formatBRL } from "@/lib/format";
import type { Caixa } from "@/lib/caixa.types";

type DadosFechamento = Awaited<ReturnType<typeof getFechamentoDiario>>;

interface Props {
  caixa: Caixa;
  onClose: () => void;
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function parseMoeda(v: string) {
  return parseFloat(v.replace(",", ".")) || 0;
}

export function FechamentoDiarioDialog({ caixa, onClose }: Props) {
  const getDoc = useServerFn(getFechamentoDiario);
  const salvar = useServerFn(salvarFechamentoDiario);

  const [dados, setDados] = useState<DadosFechamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Contagem por forma de pagamento
  const [contDinheiro, setContDinheiro] = useState("");
  const [contCredito, setContCredito] = useState("");
  const [contDebito, setContDebito] = useState("");
  const [contPix, setContPix] = useState("");

  useEffect(() => {
    getDoc({ data: { caixa_id: caixa.id } })
      .then(setDados)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const totalContado = parseMoeda(contDinheiro) + parseMoeda(contCredito) + parseMoeda(contDebito) + parseMoeda(contPix);
  const diferenca = dados ? totalContado - (dados.total_vendas - dados.total_cancelamentos) : 0;
  const diferencaDinheiro = dados ? parseMoeda(contDinheiro) - dados.saldo_esperado : 0;

  async function handleSalvar() {
    if (!dados) return;
    setSalvando(true);

    const nomeOperador = dados.caixa.observacao_abertura
      ?.replace("Operador: ", "")
      ?.split(" | ")[0] ?? undefined;

    try {
      await salvar({
        data: {
          caixa_id: caixa.id,
          valor_fechamento: totalContado,
          total_vendas: dados.total_vendas,
          total_cancelamentos: dados.total_cancelamentos,
          total_sangrias: dados.total_sangrias,
          total_descontos: dados.total_descontos,
          qtd_vendas: dados.qtd_vendas,
          qtd_cancelamentos: dados.qtd_cancelamentos,
          qtd_sangrias: dados.qtd_sangrias,
          total_dinheiro: dados.total_dinheiro,
          total_credito: dados.total_credito,
          total_debito: dados.total_debito,
          total_pix: dados.total_pix,
          valor_abertura: Number(dados.caixa.valor_abertura),
          saldo_esperado: dados.saldo_esperado,
          nome_operador: nomeOperador,
        },
      });
      setSalvo(true);
      toast.success("Fechamento salvo com sucesso!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = !salvo && (
    parseMoeda(contDinheiro) > 0 ||
    parseMoeda(contCredito) > 0 ||
    parseMoeda(contDebito) > 0 ||
    parseMoeda(contPix) > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Fechamento de Caixa</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-5">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : !dados ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Erro ao carregar dados.</div>
          ) : (
            <div id="print-fechamento" className="space-y-4">
              {/* Cabeçalho */}
              <div className="text-center border-b pb-3">
                <div className="font-black text-lg">BURATIN OUTLET</div>
                <div className="font-bold text-sm">FECHAMENTO DE CAIXA</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Emissão: {formatarData(new Date().toISOString())} {formatarHora(new Date().toISOString())}
                </div>
              </div>

              {/* Período */}
              <div className="text-xs space-y-1 border-b pb-3">
                {(dados.caixa.nome_operador || dados.caixa.observacao_abertura?.startsWith("Operador:")) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operador:</span>
                    <span className="font-medium">
                      {dados.caixa.nome_operador ?? dados.caixa.observacao_abertura?.replace("Operador: ", "").split(" | ")[0]}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abertura:</span>
                  <span className="font-medium">{formatarData(dados.caixa.aberto_em)} {formatarHora(dados.caixa.aberto_em)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fechamento:</span>
                  <span className="font-medium">{formatarData(new Date().toISOString())} {formatarHora(new Date().toISOString())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor de abertura:</span>
                  <span className="font-medium">{formatBRL(Number(dados.caixa.valor_abertura))}</span>
                </div>
              </div>

              {/* Movimento */}
              <div className="text-xs space-y-1 border-b pb-3">
                <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Movimento do Caixa</div>
                <div className="flex justify-between">
                  <span>Vendas ({dados.qtd_vendas})</span>
                  <span className="font-bold text-emerald-600">{formatBRL(dados.total_vendas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cancelamentos ({dados.qtd_cancelamentos})</span>
                  <span className="font-bold text-red-600">{formatBRL(dados.total_cancelamentos)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Descontos</span>
                  <span className="font-bold text-orange-600">{formatBRL(dados.total_descontos)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Venda Líquida</span>
                  <span>{formatBRL(dados.total_vendas - dados.total_cancelamentos)}</span>
                </div>
              </div>

              {/* Por forma de pagamento — Sistema */}
              <div className="text-xs space-y-1 border-b pb-3">
                <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Registrado no Sistema</div>
                <div className="flex justify-between">
                  <span>Dinheiro</span>
                  <span className="font-medium">{formatBRL(dados.total_dinheiro)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Crédito</span>
                  <span className="font-medium">{formatBRL(dados.total_credito)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Débito</span>
                  <span className="font-medium">{formatBRL(dados.total_debito)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PIX</span>
                  <span className="font-medium">{formatBRL(dados.total_pix)}</span>
                </div>
              </div>

              {/* Sangrias */}
              {dados.sangrias.length > 0 && (
                <div className="text-xs space-y-1 border-b pb-3">
                  <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Sangrias ({dados.qtd_sangrias})
                  </div>
                  {dados.sangrias.map((sg: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span>{formatarHora(sg.created_at)} {sg.nome_responsavel ? `- ${sg.nome_responsavel}` : ""} {sg.motivo ? `— ${sg.motivo}` : ""}</span>
                      <span className="font-medium text-orange-600">{formatBRL(Number(sg.valor))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total Sangrias</span>
                    <span className="text-orange-600">{formatBRL(dados.total_sangrias)}</span>
                  </div>
                </div>
              )}

              {/* Saldo esperado dinheiro */}
              <div className="text-xs space-y-1 border-b pb-3">
                <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Conferência Dinheiro</div>
                <div className="flex justify-between font-bold">
                  <span>Saldo Esperado</span>
                  <span className="text-primary">{formatBRL(dados.saldo_esperado)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  (Abertura {formatBRL(Number(dados.caixa.valor_abertura))} + Dinheiro {formatBRL(dados.total_dinheiro)} − Sangrias {formatBRL(dados.total_sangrias)})
                </div>
              </div>

              {/* Contagem física por forma de pagamento */}
              {!salvo && (
                <div className="space-y-3">
                  <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Contagem Física por Forma de Pagamento
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Dinheiro </Label>
                      <Input inputMode="decimal" placeholder="0,00"
                        value={contDinheiro} onChange={(e) => setContDinheiro(e.target.value)} autoFocus />
                      {contDinheiro && (
                        <p className={`text-xs mt-0.5 font-medium ${diferencaDinheiro > 0 ? "text-emerald-600" : diferencaDinheiro < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {diferencaDinheiro > 0 ? `Sobra: +${formatBRL(diferencaDinheiro)}` : diferencaDinheiro < 0 ? `Falta: ${formatBRL(Math.abs(diferencaDinheiro))}` : "Conferido ✓"}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Crédito </Label>
                      <Input inputMode="decimal" placeholder="0,00"
                        value={contCredito} onChange={(e) => setContCredito(e.target.value)} />
                      {contCredito && (
                        <p className={`text-xs mt-0.5 font-medium ${parseMoeda(contCredito) === dados.total_credito ? "text-muted-foreground" : parseMoeda(contCredito) > dados.total_credito ? "text-emerald-600" : "text-red-600"}`}>
                          {parseMoeda(contCredito) === dados.total_credito ? "Conferido ✓" : parseMoeda(contCredito) > dados.total_credito ? `Sobra: +${formatBRL(parseMoeda(contCredito) - dados.total_credito)}` : `Falta: ${formatBRL(dados.total_credito - parseMoeda(contCredito))}`}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Débito </Label>
                      <Input inputMode="decimal" placeholder="0,00"
                        value={contDebito} onChange={(e) => setContDebito(e.target.value)} />
                      {contDebito && (
                        <p className={`text-xs mt-0.5 font-medium ${parseMoeda(contDebito) === dados.total_debito ? "text-muted-foreground" : parseMoeda(contDebito) > dados.total_debito ? "text-emerald-600" : "text-red-600"}`}>
                          {parseMoeda(contDebito) === dados.total_debito ? "Conferido ✓" : parseMoeda(contDebito) > dados.total_debito ? `Sobra: +${formatBRL(parseMoeda(contDebito) - dados.total_debito)}` : `Falta: ${formatBRL(dados.total_debito - parseMoeda(contDebito))}`}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">PIX </Label>
                      <Input inputMode="decimal" placeholder="0,00"
                        value={contPix} onChange={(e) => setContPix(e.target.value)} />
                      {contPix && (
                        <p className={`text-xs mt-0.5 font-medium ${parseMoeda(contPix) === dados.total_pix ? "text-muted-foreground" : parseMoeda(contPix) > dados.total_pix ? "text-emerald-600" : "text-red-600"}`}>
                          {parseMoeda(contPix) === dados.total_pix ? "Conferido ✓" : parseMoeda(contPix) > dados.total_pix ? `Sobra: +${formatBRL(parseMoeda(contPix) - dados.total_pix)}` : `Falta: ${formatBRL(dados.total_pix - parseMoeda(contPix))}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total geral contado */}
                  {totalContado > 0 && (
                    <div className={`rounded-lg p-3 text-sm border ${diferenca === 0 ? "bg-emerald-50 border-emerald-200" : diferenca > 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
                      <div className="flex justify-between font-bold">
                        <span>Total Contado</span>
                        <span>{formatBRL(totalContado)}</span>
                      </div>
                      <div className={`flex justify-between text-xs mt-1 font-medium ${diferenca === 0 ? "text-emerald-600" : diferenca > 0 ? "text-blue-600" : "text-red-600"}`}>
                        <span>Diferença geral</span>
                        <span>{diferenca >= 0 ? "+" : ""}{formatBRL(diferenca)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado salvo */}
              {salvo && (
                <div className="text-xs space-y-1 border-t pt-3">
                  <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Contagem Registrada</div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="flex justify-between"><span>Dinheiro</span><span>{formatBRL(parseMoeda(contDinheiro))}</span></div>
                    <div className="flex justify-between"><span>Crédito</span><span>{formatBRL(parseMoeda(contCredito))}</span></div>
                    <div className="flex justify-between"><span>Débito</span><span>{formatBRL(parseMoeda(contDebito))}</span></div>
                    <div className="flex justify-between"><span>PIX</span><span>{formatBRL(parseMoeda(contPix))}</span></div>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span>Total Contado</span>
                    <span>{formatBRL(totalContado)}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${diferenca >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    <span>Diferença</span>
                    <span>{diferenca >= 0 ? "+" : ""}{formatBRL(diferenca)}</span>
                  </div>
                </div>
              )}

              {/* Assinatura */}
              <div className="mt-6 pt-4 text-xs text-center space-y-4">
                <div style={{ borderTop: "1px solid #000", marginTop: "32px", paddingTop: "4px" }}>
                  OPERADOR ASS.: ____________________________
                </div>
                <div style={{ borderTop: "1px solid #000", marginTop: "16px", paddingTop: "4px" }}>
                  SUPERVISOR ASS.: ____________________________
                </div>
                <div className="font-bold mt-2">NÃO É DOCUMENTO FISCAL</div>
              </div>
            </div>
          )}
        </div>

        {!loading && dados && (
          <div className="flex gap-3 p-5 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
            {!salvo && (
              <Button onClick={handleSalvar} disabled={salvando || !podeSalvar} className="flex-1">
                {salvando ? "Salvando..." : "Salvar Fechamento"}
              </Button>
            )}
            <Button onClick={() => window.print()} className="flex-1 gap-1">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: 72mm auto; margin: 0mm; }
          html, body { margin: 0 !important; padding: 0 !important; width: 72mm !important; }
          body * { visibility: hidden !important; }
          #print-fechamento, #print-fechamento * { visibility: visible !important; }
          #print-fechamento {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 70mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 8pt !important;
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

export function FechamentoMensalDialog({ onClose }: { onClose: () => void }) {
  const listar = useServerFn(listFechamentosMensais);
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    setLoading(true);
    try {
      const res = await listar({ data: { ano, mes } });
      setDados(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { buscar(); }, []);

  const totalVendas = dados.reduce((s, d) => s + Number(d.total_vendas), 0);
  const totalCancelamentos = dados.reduce((s, d) => s + Number(d.total_cancelamentos), 0);
  const totalSangrias = dados.reduce((s, d) => s + Number(d.total_sangrias), 0);
  const totalDinheiro = dados.reduce((s, d) => s + Number(d.total_dinheiro), 0);
  const totalCredito = dados.reduce((s, d) => s + Number(d.total_credito), 0);
  const totalDebito = dados.reduce((s, d) => s + Number(d.total_debito), 0);
  const totalPix = dados.reduce((s, d) => s + Number(d.total_pix), 0);

  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Fechamento Mensal</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b flex items-center gap-3">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm bg-background">
            {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm bg-background w-24" />
          <Button onClick={buscar} disabled={loading} size="sm">
            {loading ? "Buscando..." : "Buscar"}
          </Button>
          <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1 ml-auto">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>

        <div id="print-mensal" className="overflow-auto flex-1 p-5">
          <div className="text-center mb-4">
            <div className="font-black text-lg">BURATIN OUTLET</div>
            <div className="font-bold">RELATÓRIO MENSAL — {meses[mes - 1]}/{ano}</div>
          </div>

          {dados.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum fechamento encontrado para este período.</div>
          )}

          {dados.length > 0 && (
            <>
              <table className="w-full text-xs border-collapse mb-4">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-right py-2 px-2">Vendas</th>
                    <th className="text-right py-2 px-2">Cancel.</th>
                    <th className="text-right py-2 px-2">Sangrias</th>
                    <th className="text-right py-2 px-2">Dinheiro</th>
                    <th className="text-right py-2 px-2">PIX</th>
                    <th className="text-right py-2 px-2">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dados.map((d, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-1.5 px-2">{new Date(d.data_fechamento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-emerald-600">{formatBRL(Number(d.total_vendas))}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-red-600">{formatBRL(Number(d.total_cancelamentos))}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-orange-600">{formatBRL(Number(d.total_sangrias))}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatBRL(Number(d.total_dinheiro))}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatBRL(Number(d.total_pix))}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-bold">{formatBRL(Number(d.total_vendas) - Number(d.total_cancelamentos))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 font-bold">
                  <tr>
                    <td className="py-2 px-2">TOTAL</td>
                    <td className="py-2 px-2 text-right tabular-nums text-emerald-600">{formatBRL(totalVendas)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-red-600">{formatBRL(totalCancelamentos)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-orange-600">{formatBRL(totalSangrias)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(totalDinheiro)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(totalPix)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(totalVendas - totalCancelamentos)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border rounded-lg p-3 space-y-1">
                  <div className="font-bold mb-2">Totais por Pagamento</div>
                  <div className="flex justify-between"><span>Dinheiro</span><span>{formatBRL(totalDinheiro)}</span></div>
                  <div className="flex justify-between"><span>Crédito</span><span>{formatBRL(totalCredito)}</span></div>
                  <div className="flex justify-between"><span>Débito</span><span>{formatBRL(totalDebito)}</span></div>
                  <div className="flex justify-between"><span>PIX</span><span>{formatBRL(totalPix)}</span></div>
                </div>
                <div className="border rounded-lg p-3 space-y-1">
                  <div className="font-bold mb-2">Resumo</div>
                  <div className="flex justify-between"><span>Dias trabalhados</span><span>{dados.length}</span></div>
                  <div className="flex justify-between"><span>Total vendas</span><span className="text-emerald-600">{formatBRL(totalVendas)}</span></div>
                  <div className="flex justify-between"><span>Total cancelamentos</span><span className="text-red-600">{formatBRL(totalCancelamentos)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Líquido</span><span>{formatBRL(totalVendas - totalCancelamentos)}</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #print-mensal, #print-mensal * { visibility: visible !important; }
          #print-mensal {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            font-family: Arial, sans-serif !important;
            font-size: 9pt !important;
            color: #000 !important;
          }
          [role="dialog"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}