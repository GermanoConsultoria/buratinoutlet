import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import ModalCriarUsuario from "@/components/modal-criar-usuario";
import AcoesUsuario from "@/components/acoes-usuario";

const getUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const Route = createFileRoute("/_app/config/usuarios")({
  loader: () => getUsuarios(),
  component: UsuariosPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  role: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Administrador",
  MANAGER: "Gerente",
  USER: "Usuário",
};

function UsuariosPage() {
  const inicial = Route.useLoaderData();
  const [usuarios, setUsuarios] = useState<Profile[]>(inicial as Profile[]);

  function handleUpdate(atualizado: Profile) {
    setUsuarios((prev) =>
      prev.map((u) => (u.id === atualizado.id ? atualizado : u))
    );
  }

  function handleNovoCriado() {
    getUsuarios().then((data) => setUsuarios(data as Profile[]));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários e Permissões</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao sistema.</p>
        </div>
        <ModalCriarUsuario onSuccess={handleNovoCriado} />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">Cargo</th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">Perfil</th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-6 py-3 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {(u.full_name ?? "?").substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium">{u.full_name ?? "—"}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{u.cargo ?? "—"}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                    u.role === "OWNER"
                      ? "bg-purple-100 text-purple-700 border-purple-200"
                      : u.role === "MANAGER"
                      ? "bg-blue-100 text-blue-700 border-blue-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                    u.ativo
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-red-100 text-red-700 border-red-200"
                  }`}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <AcoesUsuario usuario={u} onUpdate={handleUpdate} />
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}