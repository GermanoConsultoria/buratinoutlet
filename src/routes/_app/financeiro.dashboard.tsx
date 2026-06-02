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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import {
  ShoppingCart, XCircle, TrendingUp, TrendingDown,
  DollarSign, Percent, Package, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_PT: Record<string, string> = {
  "01":"Jan","02":"Fev","03":"Mar","04":"Abr","05":"Mai","06":"Jun",
  "07":"Jul","08":"Ago","09":"Set","10":"Out","11":"Nov","12":"Dez",
};

const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      data_inicio: z.string().optional(),
      data_fim: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    let vendasQuery = context.supabase
      .from("sales")
      .select("id, total, canceled_at, cancel_reason, payment_method, created_at");

    if (data.data_inicio) vendasQuery = vendasQuery.gte("created_at", `${data.data_inicio}T00:00:00.000Z`);
    if (data.data_fim) vendasQuery = vendasQuery.lte("created_at", `${data.data_fim}T23:59:59.999Z`);

    const [vendasRes, itensRes] = await Promise.all([
      vendasQuery,
      context.supabase
        .from("sale_items")
        .select("sale_id, price, quantity, subtotal, product_id, name")
        .order("sale_id"),
    ]);

    const vendas = vendasRes.data ?? [];
    const todosItens = itensRes.data ?? [];

    const saleIdsFiltrados = new Set(vendas.map((v) => v.id));
    const itens = todosItens.filter((i) => saleIdsFiltrados.has(i.sale_id));

    const productIds = [...new Set(itens.map((i) => i.product_id).filter(Boolean))];
    const { data: produtos } = productIds.length > 0
      ? await context.supabase.from("products").select("id, cost, category").in("id", productIds as string[])
      : { data: [] };

    const custoPorProduto = new Map((produtos ?? []).map((p) => [p.id, Number(p.cost)]));
    const categoriaPorProduto = new Map((produtos ?? []).map((p) => [p.id, p.category ?? "Sem categoria"]));

    const vendasAtivas = vendas.filter((v) => !v.canceled_at);
    const vendasCanceladas = vendas.filter((v) => !!v.canceled_at);

    const totalVendido = vendasAtivas.reduce((s, v) => s + Number(v.total), 0);
    const totalCancelado = vendasCanceladas.reduce((s, v) => s + Number(v.total), 0);
    const qtdVendas = vendasAtivas.length;
    const qtdDocs = vendas.length;
    const qtdCancelamentos = vendasCanceladas.length;

    const saleIdsAtivos = new Set(vendasAtivas.map((v) => v.id));
    const itensAtivos = itens.filter((i) => saleIdsAtivos.has(i.sale_id));

    const totalCustoReposicao = itensAtivos.reduce((s, i) => {
      const custo = custoPorProduto.get(i.product_id ?? "") ?? 0;
      return s + custo * Number(i.quantity);
    }, 0);

    const margem = totalVendido > 0
      ? ((totalVendido - totalCustoReposicao) / totalVendido) * 100
      : 0;

    // Dados mensais
    const mesesMap = new Map<string, { vendas: number; cancelamentos: number; qtd: number }>();
    for (const v of vendas) {
      const dt = new Date(v.created_at);
      const chave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      const atual = mesesMap.get(chave) ?? { vendas: 0, cancelamentos: 0, qtd: 0 };
      if (!v.canceled_at) { atual.vendas += Number(v.total); atual.qtd += 1; }
      else { atual.cancelamentos += Number(v.total); }
      mesesMap.set(chave, atual);
    }
    const dadosMensais = Array.from(mesesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, v]) => {
        const [ano, mes] = chave.split("-");
        return { mes: `${MESES_PT[mes]}/${ano.slice(2)}`, vendas: v.vendas, cancelamentos: v.cancelamentos, qtd: v.qtd };
      });

    // Top 10 produtos
    const produtosMap = new Map<string, { nome: string; qtd: number; total: number }>();
    for (const i of itensAtivos) {
      const key = i.product_id ?? i.name;
      const atual = produtosMap.get(key) ?? { nome: i.name, qtd: 0, total: 0 };
      atual.qtd += Number(i.quantity);
      atual.total += Number(i.subtotal);
      produtosMap.set(key, atual);
    }
    const topProdutos = Array.from(produtosMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);

    // Top 10 categorias
    const categoriasMap = new Map<string, { nome: string; qtd: number; total: number }>();
    for (const i of itensAtivos) {
      const cat = categoriaPorProduto.get(i.product_id ?? "") ?? "Sem categoria";
      const atual = categoriasMap.get(cat) ?? { nome: cat, qtd: 0, total: 0 };
      atual.qtd += Number(i.quantity);
      atual.total += Number(i.subtotal);
      categoriasMap.set(cat, atual);
    }
    const topCategorias = Array.from(categoriasMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);

    return {
      totalVendido, totalCancelado, qtdVendas, qtdDocs, qtdCancelamentos,
      totalCustoReposicao, margem, dadosMensais, topProdutos, topCategorias,
    };
  });

export const Route = createFileRoute("/_app/financeiro/dashboard")({
  component: DashboardPage,
});

type Dados = Awaited<ReturnType<typeof getDashboard>>;

const TooltipCustom = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.value > 100 ? formatBRL(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

function CardKpi({ label, valor, sub, icon: Icon, cor }: {
  label: string; valor: string; sub?: string; icon: React.ElementType; cor: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold mt-1 ${cor}`}>{valor}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-muted">
          <Icon className={`h-5 w-5 ${cor}`} />
        </div>
      </div>
    </Card>
  );
}

function SeletorMes({ onAplicar }: { onAplicar: (ini: string, fim: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSel, setMesSel] = useState(new Date().getMonth());

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 text-sm hover:border-muted-foreground transition-colors"
      >
        {MESES_ABREV[mesSel]} / {ano}
      </button>
      {aberto && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-card border rounded-xl shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAno((a) => a - 1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold">{ano}</span>
            <button onClick={() => setAno((a) => a + 1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronRight size={15} /></button>
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

function DashboardPage() {
  const load = useServerFn(getDashboard);
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<"mes" | "periodo" | "tudo">("mes");
  const [periodoIni, setPeriodoIni] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [periodoFim, setPeriodoFim] = useState(() => {
    const now = new Date();
    const ultimo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
  });

  async function carregar(ini?: string, fim?: string) {
    setLoading(true);
    try {
      const resultado = await load({ data: { data_inicio: ini, data_fim: fim } });
      setDados(resultado);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(periodoIni, periodoFim);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão geral de vendas e indicadores.</p>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {(["mes", "periodo", "tudo"] as const).map((m) => (
              <button key={m} onClick={() => {
                setModo(m);
                if (m === "tudo") carregar(undefined, undefined);
              }} className={`px-3 py-2 text-xs font-medium transition-colors ${modo === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {m === "mes" ? "Mês" : m === "periodo" ? "Período" : "Tudo"}
              </button>
            ))}
          </div>

          {modo === "mes" && (
            <SeletorMes onAplicar={(ini, fim) => { setPeriodoIni(ini); setPeriodoFim(fim); carregar(ini, fim); }} />
          )}

          {modo === "periodo" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} className="h-9 text-sm w-36" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="h-9 text-sm w-36" />
              <Button size="sm" onClick={() => carregar(periodoIni, periodoFim)}>Aplicar</Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando dashboard...</div>
      ) : !dados ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Erro ao carregar dados.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CardKpi label="Total Vendido (bruto)" valor={formatBRL(dados.totalVendido)} sub={`${dados.qtdVendas} venda${dados.qtdVendas !== 1 ? "s" : ""}`} icon={DollarSign} cor="text-emerald-600" />
            <CardKpi label="Total Cancelado" valor={formatBRL(dados.totalCancelado)} sub={`${dados.qtdCancelamentos} cancelamento${dados.qtdCancelamentos !== 1 ? "s" : ""}`} icon={XCircle} cor="text-red-600" />
            <CardKpi label="Qtd. Vendas" valor={String(dados.qtdVendas)} sub={`${dados.qtdDocs} doc${dados.qtdDocs !== 1 ? "s" : ""} emitidos`} icon={ShoppingCart} cor="text-blue-600" />
            <CardKpi label="Docs. Emitidos" valor={String(dados.qtdDocs)} sub={`${dados.qtdCancelamentos} cancelados`} icon={FileText} cor="text-purple-600" />
            <CardKpi label="Custo de Reposição" valor={formatBRL(dados.totalCustoReposicao)} sub="soma dos custos dos itens" icon={Package} cor="text-orange-600" />
            <CardKpi label="Margem de Contribuição" valor={`${dados.margem.toFixed(1)}%`} sub={formatBRL(dados.totalVendido - dados.totalCustoReposicao)} icon={Percent} cor={dados.margem >= 0 ? "text-emerald-600" : "text-red-600"} />
            <CardKpi label="Resultado Líquido" valor={formatBRL(dados.totalVendido - dados.totalCancelado)} sub="vendas − cancelamentos" icon={TrendingUp} cor={dados.totalVendido - dados.totalCancelado >= 0 ? "text-emerald-600" : "text-red-600"} />
            <CardKpi label="Ticket Médio" valor={dados.qtdVendas > 0 ? formatBRL(dados.totalVendido / dados.qtdVendas) : "R$ 0,00"} sub="por venda ativa" icon={TrendingDown} cor="text-primary" />
          </div>

          {/* Gráfico mensal */}
          {dados.dadosMensais.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold mb-4">Vendas × Cancelamentos por Mês</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dados.dadosMensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<TooltipCustom />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="vendas" name="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelamentos" name="Cancelamentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Top produtos e categorias lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dados.topProdutos.length > 0 && (
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <h2 className="text-sm font-semibold">Top 10 Produtos Mais Vendidos</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dados.topProdutos.map((p, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{p.nome}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{p.qtd}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600">{formatBRL(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {dados.topCategorias.length > 0 && (
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <h2 className="text-sm font-semibold">Top 10 Categorias Mais Vendidas</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Categoria</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dados.topCategorias.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c.qtd}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-blue-600">{formatBRL(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}