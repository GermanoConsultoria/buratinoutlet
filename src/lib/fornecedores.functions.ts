import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const fornecedorInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(300),
  cnpj: z.string().max(18).nullable().optional(),
  email: z.string().email().nullable().optional(),
  telefone: z.string().max(20).nullable().optional(),
  endereco: z.string().max(400).nullable().optional(),
  cidade: z.string().max(100).nullable().optional(),
  estado: z.string().max(2).nullable().optional(),
  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const listFornecedores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fornecedores")
      .select("id, nome, cnpj, email, telefone, endereco, cidade, estado, observacoes, ativo, created_at")
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fornecedorInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      nome: data.nome.trim(),
      cnpj: data.cnpj?.trim() || null,
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
      endereco: data.endereco?.trim() || null,
      cidade: data.cidade?.trim() || null,
      estado: data.estado?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      ativo: data.ativo ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("fornecedores").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("fornecedores").insert(row);
      if (error) throw new Error(error.message);
    }
  });

export const deleteFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fornecedores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });
