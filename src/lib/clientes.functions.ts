import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clienteInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(300),
  cpf: z.string().max(14).nullable().optional(),
  email: z.string().email().nullable().optional(),
  telefone: z.string().max(20).nullable().optional(),
  endereco: z.string().max(400).nullable().optional(),
  cidade: z.string().max(100).nullable().optional(),
  estado: z.string().max(2).nullable().optional(),
  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const listClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clientes")
      .select("id, nome, cpf, email, telefone, endereco, cidade, estado, observacoes, ativo, created_at")
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => clienteInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      nome: data.nome.trim(),
      cpf: data.cpf?.trim() || null,
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
      endereco: data.endereco?.trim() || null,
      cidade: data.cidade?.trim() || null,
      estado: data.estado?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      ativo: data.ativo ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("clientes").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("clientes").insert(row);
      if (error) throw new Error(error.message);
    }
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });
