import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarUsuario } from "@/lib/usuarios.functions";
import { MODULOS_LABELS, MODULOS_PADRAO, type Modulo, type Role } from "@/lib/auth";

interface Props {
  onSuccess: () => void;
}

const TODOS_MODULOS = Object.entries(MODULOS_LABELS) as [Modulo, string][];

export default function ModalCriarUsuario({ onSuccess }: Props) {
  const criar = useServerFn(criarUsuario);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [senha, setSenha] = useState("");
  const [modulos, setModulos] = useState<Modulo[]>(MODULOS_PADRAO["USER"]);

  function handleRoleChange(novoRole: Role) {
    setRole(novoRole);
    // OWNER sempre tem tudo, não precisa selecionar
    if (novoRole !== "OWNER") {
      setModulos(MODULOS_PADRAO[novoRole]);
    }
  }

  function toggleModulo(modulo: Modulo) {
    setModulos((prev) =>
      prev.includes(modulo)
        ? prev.filter((m) => m !== modulo)
        : [...prev, modulo]
    );
  }

  function resetar() {
    setFullName("");
    setEmail("");
    setCargo("");
    setRole("USER");
    setSenha("");
    setModulos(MODULOS_PADRAO["USER"]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Nome é obrigatório.");
    if (!email.trim()) return toast.error("E-mail é obrigatório.");
    if (senha.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres.");

    setLoading(true);
    try {
      await criar({
        data: {
          full_name: fullName.trim(),
          email: email.trim(),
          cargo: cargo.trim() || undefined,
          role,
          senha,
          modulos: role === "OWNER" ? Object.keys(MODULOS_LABELS) as Modulo[] : modulos,
        },
      });
      toast.success("Usuário criado com sucesso.");
      resetar();
      setOpen(false);
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Novo Usuário
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card">
              <h2 className="text-lg font-bold">Novo Usuário</h2>
              <button
                onClick={() => { setOpen(false); resetar(); }}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: João Silva"
                  autoFocus
                />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@empresa.com"
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Vendedor, Caixa..."
                />
              </div>
              <div>
                <Label>Perfil de Acesso</Label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as Role)}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="USER">Usuário</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="OWNER">Administrador</option>
                </select>
              </div>

              {role !== "OWNER" && (
                <div>
                  <Label>Módulos com acesso</Label>
                  <div className="mt-2 space-y-2 border rounded-lg p-3 bg-muted/30">
                    {TODOS_MODULOS.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={modulos.includes(key)}
                          onChange={() => toggleModulo(key)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {role === "OWNER" && (
                <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Administradores têm acesso a todos os módulos automaticamente.
                </div>
              )}

              <div>
                <Label>Senha inicial *</Label>
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <p className="text-xs text-muted-foreground mt-1">O usuário poderá alterar depois.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); resetar(); }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Criando..." : "Criar Usuário"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}