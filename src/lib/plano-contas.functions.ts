import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPlanoContas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plano_contas")
      .select("*, _count:lancamento_financeiro(count)")
      .order("tipo")
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPlanoContasByTipo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tipo: z.enum(["DESPESA", "RECEITA"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: contas, error } = await context.supabase
      .from("plano_contas")
      .select("*")
      .eq("tipo", data.tipo)
      .eq("ativo", true)
      .order("nome");
    if (error) throw new Error(error.message);
    return contas ?? [];
  });

export const criarPlanoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      tipo: z.enum(["DESPESA", "RECEITA"]),
      nome: z.string().min(1).max(200),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("plano_contas")
      .insert({
        tipo: data.tipo,
        nome: data.nome.trim(),
        created_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarPlanoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      tipo: z.enum(["DESPESA", "RECEITA"]),
      nome: z.string().min(1).max(200),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("plano_contas")
      .update({
        tipo: data.tipo,
        nome: data.nome.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAtivoPlanoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: conta, error: fetchError } = await context.supabase
      .from("plano_contas")
      .select("ativo")
      .eq("id", data.id)
      .single();
    if (fetchError || !conta) throw new Error("Conta não encontrada.");

    const { error } = await context.supabase
      .from("plano_contas")
      .update({
        ativo: !conta.ativo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirPlanoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { count, error: countError } = await context.supabase
      .from("lancamento_financeiro")
      .select("*", { count: "exact", head: true })
      .eq("plano_contas_id", data.id);
    if (countError) throw new Error(countError.message);
    if (count && count > 0)
      throw new Error("Esta conta possui lançamentos e não pode ser excluída.");

    const { error } = await context.supabase
      .from("plano_contas")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });