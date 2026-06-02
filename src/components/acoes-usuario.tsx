import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Key, Power, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { toggleAtivoUsuario } from "@/lib/usuarios.functions";
import ModalAlterarSenha from "@/components/modal-alterar-senha";
import ModalEditarUsuario from "@/components/modal-editar-usuario";

type Profile = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  role: string;
  ativo: boolean;
  modulos: string[];
};

interface Props {
  usuario: Profile;
  onUpdate: (atualizado: Profile) => void;
}

export default function AcoesUsuario({ usuario, onUpdate }: Props) {
  const toggle = useServerFn(toggleAtivoUsuario);
  const [modalSenha, setModalSenha] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);

  const toggleMut = useMutation({
    mutationFn: async () => {
      await toggle({ data: { id: usuario.id } });
      onUpdate({ ...usuario, ativo: !usuario.ativo });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setModalEditar(true)}
          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          title="Editar usuário"
        >
          <Pencil size={18} />
        </button>

        <button
          onClick={() => setModalSenha(true)}
          className="p-2 text-yellow-600 hover:bg-yellow-500/10 rounded-lg transition-colors"
          title="Alterar senha"
        >
          <Key size={18} />
        </button>

        <button
          onClick={() => toggleMut.mutate()}
          disabled={toggleMut.isPending}
          className={`p-2 rounded-lg transition-colors flex items-center justify-center w-9 h-9 ${
            usuario.ativo
              ? "text-red-600 hover:bg-red-500/10"
              : "text-emerald-600 hover:bg-emerald-500/10"
          }`}
          title={usuario.ativo ? "Inativar usuário" : "Ativar usuário"}
        >
          {toggleMut.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Power size={18} />
          )}
        </button>
      </div>

      <ModalAlterarSenha
        isOpen={modalSenha}
        onClose={() => setModalSenha(false)}
        usuario={usuario}
      />

      <ModalEditarUsuario
        isOpen={modalEditar}
        onClose={() => setModalEditar(false)}
        usuario={usuario}
        onSuccess={(atualizado) =>
          onUpdate({ ...usuario, ...atualizado })
        }
      />
    </>
  );
}