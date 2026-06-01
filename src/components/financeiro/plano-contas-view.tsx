"use client";

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  criarPlanoContas,
  editarPlanoContas,
  excluirPlanoContas,
  toggleAtivoPlanoContas,
} from "@/lib/plano-contas.functions";
import type { PlanoContas, TipoLancamento } from "@/lib/financeiro.types";

type ContaComContagem = PlanoContas & { _count?: { lancamentos: number } };

interface Props {
  contas: ContaComContagem[];
}

export default function PlanoContasView({ contas: contasIniciais }: Props) {
  const qc = useQueryClient();
  const criar = useServerFn(criarPlanoContas);
  const editar = useServerFn(editarPlanoContas);
  const excluir = useServerFn(excluirPlanoContas);
  const toggle = useServerFn(toggleAtivoPlanoContas);

  const [contas, setContas] = useState(contasIniciais);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<ContaComContagem | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoLancamento>("DESPESA");

  const receitas = contas.filter((c) => c.tipo === "RECEITA");
  const despesas = contas.filter((c) => c.tipo === "DESPESA");

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editando) {
        await editar({ data: { id: editando.id, tipo, nome } });
        setContas((prev) =>
          prev.map((c) => (c.id === editando.id ? { ...c, nome, tipo } : c))
        );
        toast.success("Conta atualizada.");
      } else {
        await criar({ data: { tipo, nome } });
        toast.success("Conta criada.");
        qc.invalidateQueries({ queryKey: ["plano-contas"] });
      }
      setOpen(false);
      setEditando(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (id: string) => {
      await toggle({ data: { id } });
      setContas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ativo: !c.ativo } : c))
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: async (conta: ContaComContagem) => {
      if ((conta._count?.lancamentos ?? 0) > 0) {
        throw new Error("Esta conta possui lançamentos e não pode ser excluída.");
      }
      if (!confirm(`Excluir a conta "${conta.nome}"?`)) return;
      await excluir({ data: { id: conta.id } });
      setContas((prev) => prev.filter((c) => c.id !== conta.id));
      toast.success("Conta excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirNova() {
    setEditando(null);
    setNome("");
    setTipo("DESPESA");
    setOpen(true);
  }

  function abrirEditar(conta: ContaComContagem) {
    setEditando(conta);
    setNome(conta.nome);
    setTipo(conta.tipo as TipoLancamento);
    setOpen(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button onClick={abrirNova}>
          <Plus className="h-4 w-4 mr-1" /> Nova Conta
        </Button>
      </div>

      {(["RECEITA", "DESPESA"] as TipoLancamento[]).map((t) => {
        const lista = t === "RECEITA" ? receitas : despesas;
        return (
          <section key={t}>
            <h2
              className={`text-sm font-semibold uppercase tracking-wider mb-3 ${
                t === "RECEITA" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {t === "RECEITA" ? "📈 Receitas" : "📉 Despesas"} ({lista.length})
            </h2>
            {lista.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                Nenhuma conta cadastrada.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-center">Lançamentos</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.map((conta) => (
                      <TableRow key={conta.id}>
                        <TableCell
                          className={`font-medium ${!conta.ativo ? "opacity-40 line-through" : ""}`}
                        >
                          {conta.nome}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {conta._count?.lancamentos ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => toggleMut.mutate(conta.id)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title={conta.ativo ? "Desativar" : "Ativar"}
                          >
                            {conta.ativo ? (
                              <ToggleRight className="h-5 w-5 text-primary" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => abrirEditar(conta)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => excluirMut.mutate(conta)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Conta" : "Nova Conta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoLancamento)}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="RECEITA">Receita</option>
                <option value="DESPESA">Despesa</option>
              </select>
            </div>
            <div>
              <Label>Nome da Conta</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Prestação de Serviços"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!nome || saveMut.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}