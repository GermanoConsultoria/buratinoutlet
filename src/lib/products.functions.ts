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
  // Classificação fiscal para emissão de NFC-e
  ncm: z.string().max(8).nullable().optional(),
  cfop: z.string().max(10).nullable().optional(),
  icms_origem: z.string().max(1).nullable().optional(),
  icms_situacao_tributaria: z.string().max(10).nullable().optional(),
  // Reforma Tributária — IBS/CBS
  ibs_cbs_situacao_tributaria: z.string().max(20).nullable().optional(),
  ibs_cbs_classificacao_tributaria: z.string().max(20).nullable().optional(),
  cbs_aliquota: z.number().nonnegative().nullable().optional(),
  ibs_aliquota_total: z.number().nonnegative().nullable().optional(),
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
        .select("id, name, sku, price, cost, category, subcategory, lote, data_entrada, endereco, ncm, cfop, icms_origem, icms_situacao_tributaria, ibs_cbs_situacao_tributaria, ibs_cbs_classificacao_tributaria, cbs_aliquota, ibs_aliquota_total, created_at")
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
      category: data.category?.trim() || "Sem Categoria",
      subcategory: data.subcategory?.trim() || null,
      lote: data.lote?.trim() || null,
      data_entrada: data.data_entrada ?? null,
      endereco: data.endereco?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    // Campos fiscais para NFC-e
    const fiscalRow = {
      ncm: data.ncm?.trim() || null,
      cfop: data.cfop?.trim() || null,
      icms_origem: data.icms_origem ?? null,
      icms_situacao_tributaria: data.icms_situacao_tributaria?.trim() || null,
      // Reforma Tributária — IBS/CBS
      ibs_cbs_situacao_tributaria: data.ibs_cbs_situacao_tributaria?.trim() || null,
      ibs_cbs_classificacao_tributaria: data.ibs_cbs_classificacao_tributaria?.trim() || null,
      cbs_aliquota: data.cbs_aliquota ?? null,
      ibs_aliquota_total: data.ibs_aliquota_total ?? null,
    };
    if (data.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await context.supabase.from("products").update({ ...row, ...fiscalRow } as any).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("products")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ ...row, ...fiscalRow, created_by: context.userId } as any);
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
      category: i.category?.trim() || "Sem Categoria",
      subcategory: i.subcategory?.trim() || null,
      lote: data.lote?.trim() || i.lote?.trim() || null,
      data_entrada: i.data_entrada ?? new Date().toISOString(),
      endereco: i.endereco?.trim() || null,
      ncm: i.ncm?.trim() || null,
      cfop: i.cfop?.trim() || null,
      icms_origem: i.icms_origem ?? null,
      icms_situacao_tributaria: i.icms_situacao_tributaria?.trim() || null,
      ibs_cbs_situacao_tributaria: i.ibs_cbs_situacao_tributaria?.trim() || null,
      ibs_cbs_classificacao_tributaria: i.ibs_cbs_classificacao_tributaria?.trim() || null,
      cbs_aliquota: i.cbs_aliquota ?? null,
      ibs_aliquota_total: i.ibs_aliquota_total ?? null,
      created_by: context.userId,
    }));

    const { data: existing, error: fetchError } = await context.supabase
      .from("products")
      .select("id, sku, name");
    if (fetchError) throw new Error(fetchError.message);

    const existingMap = new Map(
      (existing ?? []).map((p: any) => [
        `${(p.sku ?? "").trim().toLowerCase()}||${p.name.trim().toLowerCase()}`,
        p.id as string,
      ])
    );

    const newRows = rows.filter((r) => {
      const key = `${(r.sku ?? "").trim().toLowerCase()}||${r.name.trim().toLowerCase()}`;
      return !existingMap.has(key);
    });

    const chunk = 500;
    let count = 0;
    for (let i = 0; i < newRows.length; i += chunk) {
      const slice = newRows.slice(i, i + chunk);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await context.supabase.from("products").insert(slice as any);
      if (error) throw new Error(error.message);
      count += slice.length;
    }

    const existingRows = rows
      .map((r) => {
        const key = `${(r.sku ?? "").trim().toLowerCase()}||${r.name.trim().toLowerCase()}`;
        const id = existingMap.get(key);
        if (!id) return null;
        const fiscais: Record<string, unknown> = {};
        if (r.ncm) fiscais.ncm = r.ncm;
        if (r.cfop) fiscais.cfop = r.cfop;
        if (r.icms_origem != null) fiscais.icms_origem = String(r.icms_origem);
        if (r.icms_situacao_tributaria) fiscais.icms_situacao_tributaria = r.icms_situacao_tributaria;
        if (r.ibs_cbs_situacao_tributaria) fiscais.ibs_cbs_situacao_tributaria = r.ibs_cbs_situacao_tributaria;
        if (r.ibs_cbs_classificacao_tributaria) fiscais.ibs_cbs_classificacao_tributaria = r.ibs_cbs_classificacao_tributaria;
        if (r.cbs_aliquota != null) fiscais.cbs_aliquota = r.cbs_aliquota;
        if (r.ibs_aliquota_total != null) fiscais.ibs_aliquota_total = r.ibs_aliquota_total;
        if (Object.keys(fiscais).length === 0) return null;
        return { id, fiscais };
      })
      .filter((x): x is { id: string; fiscais: Record<string, unknown> } => x !== null);

    let updated = 0;
    for (let i = 0; i < existingRows.length; i += chunk) {
      const slice = existingRows.slice(i, i + chunk);
      for (const { id, fiscais } of slice) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await context.supabase.from("products").update(fiscais as any).eq("id", id);
        if (error) throw new Error(error.message);
        updated++;
      }
    }

    return { ok: true, count, updated, skipped: rows.length - count - updated };
  });

export const updateAllProductsIbsCbs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ibs_cbs_situacao_tributaria: z.string().max(20),
      ibs_cbs_classificacao_tributaria: z.string().max(20),
      cbs_aliquota: z.number().nonnegative(),
      ibs_aliquota_total: z.number().nonnegative(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({
        ibs_cbs_situacao_tributaria: data.ibs_cbs_situacao_tributaria,
        ibs_cbs_classificacao_tributaria: data.ibs_cbs_classificacao_tributaria,
        cbs_aliquota: data.cbs_aliquota,
        ibs_aliquota_total: data.ibs_aliquota_total,
      })
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });