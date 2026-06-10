import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listOperadores, criarOperador, atualizarOperador, deletarOperador } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Users, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/config/operadores")({
  component: OperadoresPage,
});

type Operador = { id: string; nome: string; numero: number; ativo: boolean };

function OperadoresPage() {
  const listar = useServerFn(listOperadores);
  const criar = useServerFn(criarOperador);
  const atualizar = useServerFn(atualizarOperador);
  const deletar = useServerFn(deletarOperador);

  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editNumero, setEditNumero] = useState("");

  async function buscar() {
    setLoading(true);
    try {
      const res = await listar();
      setOperadores(res as Operador[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { buscar(); }, []);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return toast.error("Informe o nome do operador.");
    if (!novoNumero || isNaN(Number(novoNumero))) return toast.error("Informe um número válido.");
    setSalvando(true);
    try {
      await criar({ data: { nome: novoNome.trim(), numero: Number(novoNumero) } });
      toast.success("Operador criado!");
      setNovoNome("");
      setNovoNumero("");
      buscar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao(op: Operador) {
    if (!editNome.trim()) return toast.error("Informe o nome.");
    if (!editNumero || isNaN(Number(editNumero))) return toast.error("Informe um número válido.");
    try {
      await atualizar({ data: { id: op.id, nome: editNome.trim(), numero: Number(editNumero), ativo: op.ativo } });
      toast.success("Operador atualizado!");
      setEditandoId(null);
      buscar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDeletar(id: string) {
    if (!confirm("Desativar este operador?")) return;
    try {
      await deletar({ data: { id } });
      toast.success("Operador desativado!");
      buscar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Operadores de Caixa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre os operadores que poderão ser selecionados na abertura do caixa.
        </p>
      </div>

      {/* Formulário novo operador */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Novo Operador
        </h2>
        <form onSubmit={handleCriar} className="flex gap-3 items-end">
          <div className="w-24">
            <Label className="text-xs">Número</Label>
            <Input
              type="number"
              min={1}
              value={novoNumero}
              onChange={(e) => setNovoNumero(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Nome</Label>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Matheus, João, Marcos..."
            />
          </div>
          <Button type="submit" disabled={salvando} className="gap-1">
            <Plus size={14} /> {salvando ? "Salvando..." : "Adicionar"}
          </Button>
        </form>
      </Card>

      {/* Lista de operadores */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">Operadores Cadastrados</h2>
          <span className="text-xs text-muted-foreground">{operadores.length} operador{operadores.length !== 1 ? "es" : ""}</span>
        </div>

        {loading && <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>}
        {!loading && operadores.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum operador cadastrado ainda.
          </div>
        )}

        <div className="divide-y">
          {operadores.map((op) => (
            <div key={op.id} className="flex items-center gap-3 px-4 py-3">
              {editandoId === op.id ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    value={editNumero}
                    onChange={(e) => setEditNumero(e.target.value)}
                    className="w-20 h-8 text-sm"
                  />
                  <Input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600"
                    onClick={() => handleSalvarEdicao(op)}>
                    <Check size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                    onClick={() => setEditandoId(null)}>
                    <X size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {op.numero}
                  </div>
                  <span className="flex-1 text-sm font-medium">{op.nome}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => { setEditandoId(op.id); setEditNome(op.nome); setEditNumero(String(op.numero)); }}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeletar(op.id)}>
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}