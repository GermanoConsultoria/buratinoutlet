import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const WhatsappConfigSchema = z.object({
  provedor:        z.enum(["cloud_api"]).default("cloud_api"),
  phone_number_id: z.string().default(""),
  access_token:    z.string().default(""),
  numero_whatsapp: z.string().default(""),
  servicos: z.object({
    comprovante_cupom: z.boolean().default(true),
    comprovante_nfce:  z.boolean().default(true),
    alertas_internos:  z.boolean().default(false),
  }).default({}),
});

export type WhatsappConfig = z.infer<typeof WhatsappConfigSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOwnerOrManager(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

// ─── Server Functions ─────────────────────────────────────────────────────────

export const getWhatsappConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (!profile || !isOwnerOrManager(profile.role)) {
      throw new Error("Acesso restrito a administradores.");
    }

    const db = getServiceClient();
    const { data } = await db
      .from("integracoes_config")
      .select("config, ativo")
      .eq("nome", "whatsapp")
      .maybeSingle();

    if (!data) {
      return { ativo: false, config: WhatsappConfigSchema.parse({}) };
    }

    return {
      ativo: data.ativo,
      config: WhatsappConfigSchema.parse(data.config),
    };
  });

export const saveWhatsappConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ativo:  z.boolean(),
      config: WhatsappConfigSchema,
    }).parse(d),
  )
  .handler(async ({ context, data: input }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (!profile || !isOwnerOrManager(profile.role)) {
      throw new Error("Acesso restrito a administradores.");
    }

    const db = getServiceClient();
    const { error } = await db
      .from("integracoes_config")
      .upsert(
        {
          nome:       "whatsapp",
          config:     input.config,
          ativo:      input.ativo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "nome" },
      );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => WhatsappConfigSchema.parse(d))
  .handler(async ({ context, data: cfg }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (!profile || !isOwnerOrManager(profile.role)) {
      throw new Error("Acesso restrito.");
    }

    const missing: string[] = [];
    if (!cfg.phone_number_id.trim()) missing.push("Phone Number ID");
    if (!cfg.access_token.trim())    missing.push("Access Token");
    if (!cfg.numero_whatsapp.trim()) missing.push("Número do WhatsApp");

    if (missing.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missing.join(", ")}.`);
    }

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${cfg.phone_number_id}`,
      { headers: { Authorization: `Bearer ${cfg.access_token}` } },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Falha ao verificar número na API do WhatsApp: ${msg}`);
    }

    return {
      ok: true,
      message: "Conexão validada com sucesso! Número verificado na API do WhatsApp.",
    };
  });

export const getWhatsappStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = getServiceClient();
    const { data } = await db
      .from("integracoes_config")
      .select("ativo, config")
      .eq("nome", "whatsapp")
      .maybeSingle();

    if (!data) {
      return { ativo: false, servicos: WhatsappConfigSchema.shape.servicos.parse({}) };
    }

    const cfg = WhatsappConfigSchema.parse(data.config);
    return { ativo: data.ativo, servicos: cfg.servicos };
  });

export const searchClientesByNome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().min(1) }).parse(d))
  .handler(async ({ context, data: { q } }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (context.supabase as any)
      .from("clientes")
      .select("id, nome, telefone")
      .ilike("nome", `%${q}%`)
      .eq("ativo", true)
      .limit(5);

    return (data ?? []) as { id: string; nome: string; telefone: string | null }[];
  });

export const enviarComprovanteWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      telefone:      z.string().min(10),
      tipo:          z.enum(["cupom", "nfce"]),
      receiptNumber: z.number(),
      danfe_url:     z.string().url().optional(),
      texto_cupom:   z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data: input }) => {
    const db = getServiceClient();
    const { data: row } = await db
      .from("integracoes_config")
      .select("config, ativo")
      .eq("nome", "whatsapp")
      .maybeSingle();

    if (!row || !row.ativo) {
      throw new Error(
        "Integração WhatsApp não está ativa. Acesse Integrações → WhatsApp para configurar.",
      );
    }

    const cfg = WhatsappConfigSchema.parse(row.config);

    if (input.tipo === "nfce" && !cfg.servicos.comprovante_nfce) {
      throw new Error("Envio de comprovante NFC-e via WhatsApp está desabilitado nas configurações.");
    }
    if (input.tipo === "cupom" && !cfg.servicos.comprovante_cupom) {
      throw new Error("Envio de cupom via WhatsApp está desabilitado nas configurações.");
    }

    let mensagem: string;
    if (input.tipo === "nfce" && input.danfe_url) {
      mensagem = `✅ *NFC-e emitida!* Sua nota fiscal da Venda #${input.receiptNumber} está disponível: ${input.danfe_url}`;
    } else if (input.texto_cupom) {
      mensagem = input.texto_cupom;
    } else {
      mensagem = `✅ Comprovante da Venda #${input.receiptNumber} registrada com sucesso!`;
    }

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${cfg.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type:    "individual",
          to:                input.telefone,
          type:              "text",
          text:              { body: mensagem },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Falha ao enviar mensagem via WhatsApp: ${msg}`);
    }

    return { ok: true };
  });
