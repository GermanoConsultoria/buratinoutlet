import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import BalanceteView from "@/components/financeiro/balancete-view";
import { getBalancete } from "@/lib/financeiro.functions";

const getBalanceteInicial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hoje = new Date();
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
    return { inicio, fim };
  });

export const Route = createFileRoute("/_app/financeiro/balancete")({
  loader: () => getBalanceteInicial(),
  component: BalancetePage,
});

function BalancetePage() {
  const { inicio, fim } = Route.useLoaderData();
  const getBal = getBalancete;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Balancete</h1>
        <p className="text-sm text-muted-foreground">Resumo financeiro do período selecionado.</p>
      </div>
      <BalanceteViewWrapper inicio={inicio} fim={fim} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Balancete } from "@/lib/financeiro.types";

function BalanceteViewWrapper({ inicio, fim }: { inicio: string; fim: string }) {
  const getBal = useServerFn(getBalancete);
  const [balancete, setBalancete] = useState<Balancete | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBal({ data: { data_inicio: inicio, data_fim: fim } })
      .then(setBalancete)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Carregando balancete...
      </div>
    );
  }

  return (
    <BalanceteView
      balancete={balancete}
      dataInicio={inicio}
      dataFim={fim}
    />
  );
}