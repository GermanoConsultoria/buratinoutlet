import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import LancamentosView from "@/components/financeiro/lancamentos-view";

const getContasAPagar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hoje = new Date();
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;

    const [lancamentos, planoContas] = await Promise.all([
      context.supabase
        .from("lancamento_financeiro")
        .select("*, plano_contas(*), anexos:anexo_financeiro(*)")
        .eq("tipo", "DESPESA")
        .gte("dt_vencimento", `${inicio}T00:00:00.000Z`)
        .lte("dt_vencimento", `${fim}T23:59:59.999Z`)
        .order("dt_vencimento", { ascending: true }),
      context.supabase
        .from("plano_contas")
        .select("*")
        .eq("tipo", "DESPESA")
        .eq("ativo", true)
        .order("nome"),
    ]);

    if (lancamentos.error) throw new Error(lancamentos.error.message);
    if (planoContas.error) throw new Error(planoContas.error.message);

    return {
      lancamentos: lancamentos.data ?? [],
      planoContas: planoContas.data ?? [],
    };
  });

export const Route = createFileRoute("/_app/financeiro/pagar")({
  loader: () => getContasAPagar(),
  component: ContasAPagarPage,
});

function ContasAPagarPage() {
  const { lancamentos, planoContas } = Route.useLoaderData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Contas a Pagar</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas despesas e obrigações financeiras.</p>
      </div>
      <LancamentosView
        lancamentos={lancamentos as never}
        planoContas={planoContas}
        tipo="DESPESA"
      />
    </div>
  );
}