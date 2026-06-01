import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarUsuario } from "@/lib/usuarios.functions";

interface Props {
  onSuccess: () => void;
}

export default function ModalCriarUsuario({ onSuccess }: Props) {
  const criar = useServerFn(criarUsuario);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState("USER");
  const [senha, setSenha] = useState("");

  function resetar() {
    setFullName("");
    setEmail("");
    setCargo("");
    setRole("USER");
    setSenha("");
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
          role: role as "USER" | "MANAGER" | "OWNER",
          senha,
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
          <div className="bg-card border rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
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
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="USER">Usuário</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="OWNER">Administrador</option>
                </select>
              </div>
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