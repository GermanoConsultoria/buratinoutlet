import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import { BarChart3, ChevronRight, Package, RefreshCw, TrendingUp } from "lucide-react";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_app/financeiro/curva-abc")({
  component: CurvaABCPage,
});

// ─── Server Function ──────────────────────────────────────────────────────────

type ProdutoRaw = {
  name: string;
  product_id: string | null;
  qty: number;
  revenue: number;
};

const getCurvaABC = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inicio: z.string(), fim: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sales } = await context.supabase
      .from("sales")
      .select("id")
      .is("canceled_at", null)
      .gte("created_at", `${data.inicio}T00:00:00`)
      .lte("created_at", `${data.fim}T23:59:59`)
      .limit(2000);

    if (!sales || sales.length === 0) return [] as ProdutoRaw[];

    const saleIds = sales.map((s) => s.id);

    // Batch in chunks of 500 para evitar limitações de URL
    const chunks: string[][] = [];
    for (let i = 0; i < saleIds.length; i += 500) {
      chunks.push(saleIds.slice(i, i + 500));
    }

    const itemsChunks = await Promise.all(
      chunks.map((chunk) =>
        context.supabase
          .from("sale_items")
          .select("name, product_id, quantity, subtotal")
          .in("sale_id", chunk),
      ),
    );

    const allItems = itemsChunks.flatMap((r) => r.data ?? []);

    const map = new Map<string, ProdutoRaw>();
    for (const item of allItems) {
      const key = item.product_id ?? `__${item.name}`;
      const existing = map.get(key) ?? {
        name: item.name,
        product_id: item.product_id,
        qty: 0,
        revenue: 0,
      };
      existing.qty    += Number(item.quantity);
      existing.revenue += Number(item.subtotal);
      map.set(key, existing);
    }

    return Array.from(map.values());
  });

// ─── ABC Computation ──────────────────────────────────────────────────────────

type ClasseABC = "A" | "B" | "C";

type ProdutoABC = ProdutoRaw & {
  rank: number;
  value: number;
  pct: number;
  cumulative: number;
  classe: ClasseABC;
};

function computeABC(items: ProdutoRaw[], mode: "valor" | "quantidade"): ProdutoABC[] {
  const sorted = [...items].sort((a, b) =>
    mode === "valor" ? b.revenue - a.revenue : b.qty - a.qty,
  );
  const total = sorted.reduce(
    (s, i) => s + (mode === "valor" ? i.revenue : i.qty), 0,
  );
  let cumulative = 0;
  return sorted.map((item, index) => {
    const value = mode === "valor" ? item.revenue : item.qty;
    const pct   = total > 0 ? value / total : 0;
    cumulative += pct;
    const classe: ClasseABC = cumulative <= 0.80 ? "A" : cumulative <= 0.95 ? "B" : "C";
    return { ...item, rank: index + 1, value, pct, cumulative, classe };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClasseBadge({ classe }: { classe: ClasseABC }) {
  const styles: Record<ClasseABC, string> = {
    A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    B: "bg-amber-100   text-amber-700   dark:bg-amber-900/40   dark:text-amber-400",
    C: "bg-slate-100   text-slate-600   dark:bg-slate-800      dark:text-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black ${styles[classe]}`}
    >
      {classe}
    </span>
  );
}

const CLASSE_COLOR: Record<ClasseABC, string> = {
  A: "#10b981",
  B: "#f59e0b",
  C: "#94a3b8",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function CurvaABCPage() {
  const buscarFn = useServerFn(getCurvaABC);

  const today = new Date();
  const defaultInicio = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultFim    = today.toISOString().split("T")[0];

  const [inicio,  setInicio]  = useState(defaultInicio);
  const [fim,     setFim]     = useState(defaultFim);
  const [mode,    setMode]    = useState<"valor" | "quantidade">("valor");
  const [raw,     setRaw]     = useState<ProdutoRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);

  async function buscar() {
    setLoading(true);
    try {
      const res = await buscarFn({ data: { inicio, fim } });
      setRaw(res);
      setBuscado(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const produtos = computeABC(raw, mode);

  const classeCounts: Record<ClasseABC, number> = { A: 0, B: 0, C: 0 };
  const classeValues: Record<ClasseABC, number> = { A: 0, B: 0, C: 0 };
  const classeQtys:   Record<ClasseABC, number> = { A: 0, B: 0, C: 0 };
  for (const p of produtos) {
    classeCounts[p.classe]++;
    classeValues[p.classe] += p.revenue;
    classeQtys[p.classe]   += p.qty;
  }
  const totalValue = produtos.reduce((s, p) => s + p.revenue, 0);
  const totalQty   = produtos.reduce((s, p) => s + p.qty, 0);

  const topN      = Math.min(20, produtos.length);
  const chartData = produtos.slice(0, topN).map((p) => ({
    name:       p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
    value:      mode === "valor" ? +p.revenue.toFixed(2) : p.qty,
    cumulative: +(p.cumulative * 100).toFixed(1),
    classe:     p.classe,
  }));

  const CLASSE_INFO: { cls: ClasseABC; border: string; bar: string; label: string; desc: string }[] = [
    { cls: "A", border: "border-l-emerald-500", bar: "bg-emerald-500", label: "Classe A", desc: "Alta prioridade — 80% do resultado" },
    { cls: "B", border: "border-l-amber-500",   bar: "bg-amber-500",   label: "Classe B", desc: "Média prioridade — próximos 15%" },
    { cls: "C", border: "border-l-slate-400",   bar: "bg-slate-400",   label: "Classe C", desc: "Baixa prioridade — últimos 5%" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Financeiro</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Curva ABC de Produtos</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Curva ABC de Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Classifica os produtos por representatividade no faturamento e no volume vendido
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Início</Label>
            <Input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Fim</Label>
            <Input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="w-40 text-sm"
            />
          </div>

          <Button onClick={buscar} disabled={loading} className="gap-2">
            {loading
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <TrendingUp className="h-4 w-4" />}
            {loading ? "Calculando..." : "Gerar Relatório"}
          </Button>

          {buscado && (
            <div className="ml-auto flex rounded-lg border overflow-hidden text-sm">
              <button
                onClick={() => setMode("valor")}
                className={`px-4 py-2 font-medium transition-colors ${
                  mode === "valor"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Por Valor (R$)
              </button>
              <button
                onClick={() => setMode("quantidade")}
                className={`px-4 py-2 font-medium transition-colors ${
                  mode === "quantidade"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Por Quantidade
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Estado vazio */}
      {buscado && produtos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
          <Package className="h-12 w-12 opacity-25" />
          <p className="font-semibold">Nenhuma venda encontrada neste período.</p>
          <p className="text-sm">Verifique o intervalo de datas selecionado.</p>
        </div>
      )}

      {buscado && produtos.length > 0 && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4">
            {CLASSE_INFO.map(({ cls, border, bar, label, desc }) => {
              const pctValor = totalValue > 0 ? (classeValues[cls] / totalValue) * 100 : 0;
              const pctQty   = totalQty   > 0 ? (classeQtys[cls]   / totalQty)   * 100 : 0;
              return (
                <Card key={cls} className={`p-4 border-l-4 ${border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {label}
                      </p>
                      <p className="text-3xl font-black leading-none mt-1.5">
                        {classeCounts[cls]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {classeCounts[cls] === 1 ? "produto" : "produtos"}
                      </p>
                    </div>
                    <ClasseBadge classe={cls} />
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 mb-1">{desc}</p>

                  <div className="space-y-0.5 mb-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Faturamento</span>
                      <span className="font-semibold tabular-nums">
                        {formatBRL(classeValues[cls])}
                        <span className="text-muted-foreground ml-1">({pctValor.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Qtd. vendida</span>
                      <span className="font-semibold tabular-nums">
                        {classeQtys[cls].toFixed(0)} un
                        <span className="text-muted-foreground ml-1">({pctQty.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${bar}`}
                      style={{ width: `${pctValor.toFixed(1)}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Gráfico de Pareto */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">
                Curva de Pareto —{" "}
                {mode === "valor" ? "Faturamento" : "Quantidade"}{" "}
                (Top {topN})
              </h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Classe A
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" /> Classe B
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-slate-400" /> Classe C
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={75}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    mode === "valor"
                      ? v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : formatBRL(v)
                      : String(v)
                  }
                  width={mode === "valor" ? 72 : 40}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  width={36}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "% Acumulado") return [`${value}%`, name];
                    return [
                      mode === "valor" ? formatBRL(Number(value)) : `${value} un`,
                      mode === "valor" ? "Faturamento" : "Quantidade",
                    ];
                  }}
                />
                <ReferenceLine
                  yAxisId="right"
                  y={80}
                  stroke="#10b981"
                  strokeDasharray="5 3"
                  label={{ value: "80%", position: "insideTopRight", fontSize: 9, fill: "#10b981" }}
                />
                <ReferenceLine
                  yAxisId="right"
                  y={95}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                  label={{ value: "95%", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="value"
                  name={mode === "valor" ? "Faturamento" : "Quantidade"}
                  maxBarSize={36}
                  radius={[3, 3, 0, 0]}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={CLASSE_COLOR[entry.classe]} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  name="% Acumulado"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  legendType="line"
                />
                <Legend verticalAlign="top" height={24} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* Tabela completa */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">
                Classificação completa
                <span className="ml-2 text-muted-foreground font-normal">
                  {produtos.length} {produtos.length === 1 ? "produto" : "produtos"} ·{" "}
                  ordenado por {mode === "valor" ? "faturamento" : "quantidade"} decrescente
                </span>
              </h2>
              <div className="text-xs text-muted-foreground tabular-nums">
                Total: {formatBRL(totalValue)} · {totalQty.toFixed(0)} un
              </div>
            </div>

            <div className="overflow-auto" style={{ maxHeight: 520 }}>
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">% Individual</TableHead>
                    <TableHead className="text-right">% Acumulado</TableHead>
                    <TableHead className="text-center w-16">Classe</TableHead>
                    <TableHead className="w-28">Peso relativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.map((p) => (
                    <TableRow
                      key={p.rank}
                      className={
                        p.classe === "A"
                          ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                          : p.classe === "B"
                            ? "bg-amber-50/50 dark:bg-amber-950/10"
                            : undefined
                      }
                    >
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {p.rank}
                      </TableCell>
                      <TableCell
                        className="font-medium text-sm max-w-[220px] truncate"
                        title={p.name}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatBRL(p.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {p.qty % 1 === 0 ? p.qty.toFixed(0) : p.qty.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {(p.pct * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm font-semibold tabular-nums ${
                          p.classe === "A"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : p.classe === "B"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {(p.cumulative * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <ClasseBadge classe={p.classe} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.classe === "A"
                                ? "bg-emerald-500"
                                : p.classe === "B"
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                            }`}
                            style={{ width: `${Math.max(0.5, p.pct * 100).toFixed(2)}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
