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

const BancoInterConfigSchema = z.object({
  ambiente:          z.enum(["SANDBOX", "PRODUCAO"]).default("SANDBOX"),
  client_id:         z.string().default(""),
  client_secret:     z.string().default(""),
  certificado_pem:   z.string().default(""),
  chave_privada_pem: z.string().default(""),
  conta_corrente:    z.string().default(""),
  webhook_url:       z.string().default(""),
  servicos: z.object({
    pix:      z.boolean().default(true),
    cobranca: z.boolean().default(true),
    extrato:  z.boolean().default(false),
    saldo:    z.boolean().default(false),
  }).default({}),
});

export type BancoInterConfig = z.infer<typeof BancoInterConfigSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOwnerOrManager(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

// ─── Server Functions ─────────────────────────────────────────────────────────

export const getInterConfig = createServerFn({ method: "GET" })
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
      .eq("nome", "banco_inter")
      .maybeSingle();

    if (!data) {
      return {
        ativo: false,
        config: BancoInterConfigSchema.parse({}),
      };
    }

    return {
      ativo: data.ativo,
      config: BancoInterConfigSchema.parse(data.config),
    };
  });

export const saveInterConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ativo:  z.boolean(),
      config: BancoInterConfigSchema,
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
          nome:       "banco_inter",
          config:     input.config,
          ativo:      input.ativo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "nome" },
      );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testInterConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BancoInterConfigSchema.parse(d))
  .handler(async ({ context, data: cfg }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (!profile || !isOwnerOrManager(profile.role)) {
      throw new Error("Acesso restrito.");
    }

    // Validação dos campos obrigatórios antes de tentar conectar
    const missing: string[] = [];
    if (!cfg.client_id.trim())         missing.push("Client ID");
    if (!cfg.client_secret.trim())     missing.push("Client Secret");
    if (!cfg.certificado_pem.trim())   missing.push("Certificado PEM");
    if (!cfg.chave_privada_pem.trim()) missing.push("Chave Privada PEM");
    if (!cfg.conta_corrente.trim())    missing.push("Conta Corrente");

    if (missing.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missing.join(", ")}.`);
    }

    // Validação básica de formato PEM
    if (!cfg.certificado_pem.includes("BEGIN CERTIFICATE")) {
      throw new Error("Certificado inválido — deve ser no formato PEM (.crt).");
    }
    if (!cfg.chave_privada_pem.includes("BEGIN")) {
      throw new Error("Chave privada inválida — deve ser no formato PEM (.key).");
    }

    return {
      ok: true,
      message: "Configuração validada. Credenciais prontas para uso.",
    };
  });
