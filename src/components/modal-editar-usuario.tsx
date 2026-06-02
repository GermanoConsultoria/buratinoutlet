import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editarUsuario } from "@/lib/usuarios.functions";
import { MODULOS_LABELS, MODULOS_PADRAO, type Modulo, type Role } from "@/lib/auth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuario: {
    id: string;
    full_name: string | null;
    cargo: string | null;
    role: string;
    modulos: string[];
  };
  onSuccess: (atualizado: {
    id: string;
    full_name: string;
    cargo: string | null;
    role: string;
    modulos: string[];
  }) => void;
}

const TODOS_MODULOS = Object.entries(MODULOS_LABELS) as [Modulo, string][];

export default function ModalEditarUsuario({ isOpen, onClose, usuario, onSuccess }: Props) {
  const editar = useServerFn(editarUsuario);
  const [fullName, setFullName] = useState(usuario.full_name ?? "");
  const [cargo, setCargo] = useState(usuario.cargo ?? "");
  const [role, setRole] = useState<Role>(usuario.role as Role);
  const [modulos, setModulos] = useState<Modulo[]>((usuario.modulos ?? []) as Modulo[]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function handleRoleChange(novoRole: Role) {
    setRole(novoRole);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setLoading(true);
    try {
      const modulosFinais = role === "OWNER"
        ? Object.keys(MODULOS_LABELS) as Modulo[]
        : modulos;

      await editar({
        data: {
          id: usuario.id,
          full_name: fullName.trim(),
          cargo: cargo.trim() || null,
          role,
          modulos: modulosFinais,
        },
      });
      toast.success("Usuário atualizado.");
      onSuccess({
        id: usuario.id,
        full_name: fullName.trim(),
        cargo: cargo.trim() || null,
        role,
        modulos: modulosFinais,
      });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card">
          <h2 className="text-lg font-bold">Editar Usuário</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
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

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}