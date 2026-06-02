import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saleInput = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid().nullable(),
    name: z.string().min(1).max(200),
    price: z.number().nonnegative(),
    quantity: z.number().positive(),
  })).min(1),
  payment_method: z.enum(["dinheiro", "credito", "debito", "pix"]),
  amount_paid: z.number().nonnegative().nullable(),
  caixa_id: z.string().uuid().nullable().optional(),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saleInput.parse(d))
  .handler(async ({ data, context }) => {
    const total = +data.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
    const change =
      data.payment_method === "dinheiro" && data.amount_paid != null
        ? Math.max(0, +(data.amount_paid - total).toFixed(2))
        : 0;

    const { data: sale, error: saleErr } = await context.supabase
      .from("sales")
      .insert({
        total,
        payment_method: data.payment_method,
        amount_paid: data.amount_paid,
        change_due: change,
        created_by: context.userId,
      })
      .select("id, receipt_number, created_at")
      .single();
    if (saleErr || !sale) throw new Error(saleErr?.message ?? "Falha ao criar venda");

    const dataSaida = new Date().toISOString();

    const items = data.items.map((i) => ({
      sale_id: sale.id,
      product_id: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      subtotal: +(i.price * i.quantity).toFixed(2),
      data_saida: dataSaida,
    }));
    const { error: itErr } = await context.supabase.from("sale_items").insert(items);
    if (itErr) throw new Error(itErr.message);

    return { id: sale.id, receipt_number: sale.receipt_number, created_at: sale.created_at, total, change };
  });

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sales")
      .select("id, receipt_number, total, payment_method, amount_paid, change_due, created_at, canceled_at, cancel_reason")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sale, error } = await context.supabase
      .from("sales")
      .select("id, receipt_number, total, payment_method, amount_paid, change_due, created_at, canceled_at, cancel_reason, sale_items(name, price, quantity, subtotal, data_saida, product_id)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return sale;
  });

export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales")
      .update({
        canceled_at: new Date().toISOString(),
        canceled_by: context.userId,
        cancel_reason: data.reason ?? null,
      })
      .eq("id", data.id)
      .is("canceled_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// CAIXA
// ============================================================

export const getCaixaAberto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("caixa")
      .select("*")
      .eq("status", "ABERTO")
      .order("aberto_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const abrirCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      valor_abertura: z.number().nonnegative(),
      observacao: z.string().max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Verifica se já tem caixa aberto
    const { data: aberto } = await context.supabase
      .from("caixa")
      .select("id")
      .eq("status", "ABERTO")
      .limit(1)
      .maybeSingle();
    if (aberto) throw new Error("Já existe um caixa aberto.");

    const { data: caixa, error } = await context.supabase
      .from("caixa")
      .insert({
        valor_abertura: data.valor_abertura,
        observacao_abertura: data.observacao ?? null,
        aberto_por: context.userId,
        status: "ABERTO",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return caixa;
  });

export const fecharCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      valor_fechamento: z.number().nonnegative(),
      observacao: z.string().max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("caixa")
      .update({
        valor_fechamento: data.valor_fechamento,
        observacao_fechamento: data.observacao ?? null,
        fechado_por: context.userId,
        fechado_em: new Date().toISOString(),
        status: "FECHADO",
      })
      .eq("id", data.id)
      .eq("status", "ABERTO");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCaixa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("caixa")
      .select("*")
      .order("aberto_em", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });