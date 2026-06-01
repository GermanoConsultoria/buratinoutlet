import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import PlanoContasView from "@/components/financeiro/plano-contas-view";

const getPlanoContas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plano_contas")
      .select(`
        *,
        _count:lancamento_financeiro(count)
      `)
      .order("tipo")
      .order("nome");

    if (error) throw new Error(error.message);

    return (data ?? []).map((c) => ({
      ...c,
      _count: {
        lancamentos: Array.isArray(c._count) ? (c._count[0] as { count: number })?.count ?? 0 : 0,
      },
    }));
  });

export const Route = createFileRoute("/_app/config/plano-contas")({
  loader: () => getPlanoContas(),
  component: PlanoContasPage,
});

function PlanoContasPage() {
  const contas = Route.useLoaderData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plano de Contas</h1>
        <p className="text-sm text-muted-foreground">Categorias para classificar receitas e despesas.</p>
      </div>
      <PlanoContasView contas={contas as never} />
    </div>
  );
}