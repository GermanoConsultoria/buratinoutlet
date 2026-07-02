import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  sku: z.string().max(60).nullable().optional(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().optional(),
  category: z.string().max(120).nullable().optional(),
  subcategory: z.string().max(120).nullable().optional(),
  lote: z.string().max(60).nullable().optional(),
  data_entrada: z.string().nullable().optional(),
  endereco: z.string().max(300).nullable().optional(),
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pageSize = 1000;
    let all: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await context.supabase
        .from("products")
        .select("id, name, sku, price, cost, category, subcategory, lote, data_entrada, endereco, created_at")
        .order("name")
        .range(from, from + pageSize - 1);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;

      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return all;
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      price: data.price,
      cost: data.cost ?? 0,
      category: data.category?.trim() || null,
      subcategory: data.subcategory?.trim() || null,
      lote: data.lote?.trim() || null,
      data_entrada: data.data_entrada ?? null,
      endereco: data.endereco?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await context.supabase.from("products").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("products")
        .insert({ ...row, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkImportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      items: z.array(productInput.omit({ id: true })).min(1).max(10000),
      lote: z.string().max(60).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.items.map((i) => ({
      name: i.name.trim(),
      sku: i.sku?.trim() || null,
      price: i.price,
      cost: i.cost ?? 0,
      category: i.category?.trim() || null,
      subcategory: i.subcategory?.trim() || null,
      lote: data.lote?.trim() || i.lote?.trim() || null,
      data_entrada: i.data_entrada ?? new Date().toISOString(),
      endereco: i.endereco?.trim() || null,
      created_by: context.userId,
    }));

    const { data: existing, error: fetchError } = await context.supabase
      .from("products")
      .select("sku, name");
    if (fetchError) throw new Error(fetchError.message);

    const existingSet = new Set(
      (existing ?? []).map((p: any) =>
        `${(p.sku ?? "").trim().toLowerCase()}||${p.name.trim().toLowerCase()}`
      )
    );

    const newRows = rows.filter((r) => {
      const key = `${(r.sku ?? "").trim().toLowerCase()}||${r.name.trim().toLowerCase()}`;
      return !existingSet.has(key);
    });

    if (newRows.length === 0) return { ok: true, count: 0, skipped: rows.length };

    const chunk = 500;
    let count = 0;
    for (let i = 0; i < newRows.length; i += chunk) {
      const slice = newRows.slice(i, i + chunk);
      const { error } = await context.supabase.from("products").insert(slice);
      if (error) throw new Error(error.message);
      count += slice.length;
    }
    return { ok: true, count, skipped: rows.length - count };
  });