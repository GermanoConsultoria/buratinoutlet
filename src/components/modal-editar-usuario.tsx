import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editarUsuario } from "@/lib/usuarios.functions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuario: {
    id: string;
    full_name: string | null;
    cargo: string | null;
    role: string;
  };
  onSuccess: (atualizado: { id: string; full_name: string; cargo: string | null; role: string }) => void;
}

export default function ModalEditarUsuario({ isOpen, onClose, usuario, onSuccess }: Props) {
  const editar = useServerFn(editarUsuario);
  const [fullName, setFullName] = useState(usuario.full_name ?? "");
  const [cargo, setCargo] = useState(usuario.cargo ?? "");
  const [role, setRole] = useState(usuario.role);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setLoading(true);
    try {
      await editar({
        data: {
          id: usuario.id,
          full_name: fullName.trim(),
          cargo: cargo.trim() || null,
          role: role as "USER" | "MANAGER" | "OWNER",
        },
      });
      toast.success("Usuário atualizado.");
      onSuccess({ id: usuario.id, full_name: fullName.trim(), cargo: cargo.trim() || null, role });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
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
              onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="USER">Usuário</option>
              <option value="MANAGER">Gerente</option>
              <option value="OWNER">Administrador</option>
            </select>
          </div>
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