import { supabase } from "@/integrations/supabase/client";

export type Modulo =
  | "pdv"
  | "historico_vendas"
  | "vendas"
  | "produtos"
  | "fornecedores"
  | "clientes"
  | "financeiro"
  | "configuracoes"
  | "templates";

export const MODULOS_LABELS: Record<Modulo, string> = {
  pdv: "PDV",
  historico_vendas: "Histórico de Vendas",
  vendas: "Vendas",
  produtos: "Produtos",
  fornecedores: "Fornecedores",
  clientes: "Clientes",
  financeiro: "Financeiro",
  configuracoes: "Configurações",
  templates: "Templates",
};

export type Role = "USER" | "MANAGER" | "OWNER";

export type UserProfile = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  role: Role;
  ativo: boolean;
  modulos: Modulo[];
};

// Busca o perfil do usuário logado
export async function getMyProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, cargo, role, ativo, modulos")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    cargo: data.cargo,
    role: data.role as Role,
    ativo: data.ativo,
    modulos: (data.modulos ?? []) as Modulo[],
  };
}

// Verifica se o usuário tem acesso a um módulo
export function temAcesso(profile: UserProfile | null, modulo: Modulo): boolean {
  if (!profile) return false;
  if (!profile.ativo) return false;
  // OWNER sempre tem acesso a tudo
  if (profile.role === "OWNER") return true;
  return profile.modulos.includes(modulo);
}

// Verifica se é admin
export function isOwner(profile: UserProfile | null): boolean {
  return profile?.role === "OWNER";
}

// Verifica se é gerente ou admin
export function isManagerOrOwner(profile: UserProfile | null): boolean {
  return profile?.role === "MANAGER" || profile?.role === "OWNER";
}

// Módulos padrão por role ao criar usuário
export const MODULOS_PADRAO: Record<Role, Modulo[]> = {
  USER: ["pdv", "historico_vendas", "templates"],
  MANAGER: ["pdv", "vendas", "produtos", "fornecedores", "clientes", "templates"],
  OWNER: ["pdv", "historico_vendas", "vendas", "produtos", "fornecedores", "clientes", "financeiro", "configuracoes", "templates"],
};