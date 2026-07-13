import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSugestoesFinanceiras } from "@/lib/financeiro.functions";
import LancamentosView from "@/components/financeiro/lancamentos-view";

const getContasAReceber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hoje = new Date();
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;

    const [lancamentos, planoContas] = await Promise.all([
      context.supabase
        .from("lancamento_financeiro")
        .select("*, plano_contas(*), anexos:anexo_financeiro(*)")
        .eq("tipo", "RECEITA")
        .gte("dt_vencimento", `${inicio}T00:00:00.000Z`)
        .lte("dt_vencimento", `${fim}T23:59:59.999Z`)
        .order("dt_vencimento", { ascending: true }),
      context.supabase
        .from("plano_contas")
        .select("*")
        .eq("tipo", "RECEITA")
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

export const Route = createFileRoute("/_app/financeiro/receber")({
  loader: async () => {
    const [dados, sugestoes] = await Promise.all([
      getContasAReceber(),
      getSugestoesFinanceiras({ data: { tipo: "RECEITA" } }),
    ]);
    return { ...dados, ...sugestoes };
  },
  component: ContasAReceberPage,
});

function ContasAReceberPage() {
  const { lancamentos, planoContas, descricoes, beneficiarios } = Route.useLoaderData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Contas a Receber</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas receitas e valores a receber.</p>
      </div>
      <LancamentosView
        lancamentos={lancamentos as never}
        planoContas={planoContas}
        tipo="RECEITA"
        sugestoesDescricao={descricoes}
        sugestoesBeneficiario={beneficiarios}
      />
    </div>
  );
}