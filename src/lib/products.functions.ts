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
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name, sku, price, cost, category, subcategory, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
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
      created_by: context.userId,
    }));
    // chunk insert to avoid payload limits
    const chunk = 500;
    let count = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error } = await context.supabase.from("products").insert(slice);
      if (error) throw new Error(error.message);
      count += slice.length;
    }
    return { ok: true, count };
  });
