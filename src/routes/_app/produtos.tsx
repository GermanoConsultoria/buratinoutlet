import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { listProducts, upsertProduct, deleteProduct, bulkImportProducts } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Upload, Pencil, Trash2, Package, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_app/produtos")({
  component: ProdutosPage,
});

type Product = { id: string; name: string; sku: string | null; price: number };

function ProdutosPage() {
  const list = useServerFn(listProducts);
  const upsert = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const bulk = useServerFn(bulkImportProducts);
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");
  const fileRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          name,
          sku: sku || null,
          price: parseFloat(price.replace(",", ".")) || 0,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Produto atualizado" : "Produto cadastrado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Produto excluído");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setName(""); setSku(""); setPrice("");
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setSku(p.sku ?? "");
    setPrice(String(p.price));
    setOpen(true);
  };

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return toast.error("CSV vazio");

    const delim = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].toLowerCase().split(delim).map((h) => h.trim());
    const iName = header.findIndex((h) => /nome|name/.test(h));
    const iPrice = header.findIndex((h) => /preco|preço|price|valor/.test(h));
    const iSku = header.findIndex((h) => /sku|codigo|código|cod/.test(h));

    const hasHeader = iName !== -1 && iPrice !== -1;
    const rows = (hasHeader ? lines.slice(1) : lines).map((l) => l.split(delim));

    const items = rows
      .map((r) => ({
        name: (hasHeader ? r[iName] : r[0])?.trim(),
        price: parseFloat(((hasHeader ? r[iPrice] : r[1]) ?? "0").replace(",", ".").trim()) || 0,
        sku: (hasHeader && iSku !== -1 ? r[iSku] : r[2])?.trim() || null,
      }))
      .filter((i) => i.name);

    if (!items.length) return toast.error("Nenhum produto válido encontrado");
    try {
      const res = await bulk({ data: { items } });
      toast.success(`${res.count} produtos importados`);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleXlsx = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellFormula: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return toast.error("Planilha vazia");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: null,
        raw: true,
      }) as (string | number | null)[][];

      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const colD = String(rows[i]?.[3] ?? "").toLowerCase();
        const colI = String(rows[i]?.[8] ?? "").toLowerCase();
        if (
          colD.includes("código") ||
          colD.includes("codigo") ||
          colD.includes("cod") ||
          colI.includes("descri")
        ) {
          headerIdx = i;
          break;
        }
      }

      const dataRows = rows.slice(headerIdx + 1);

      const items = dataRows
        .map((r) => {
          const sku         = r[3]  != null ? String(r[3]).trim()  : "";
          const name        = r[8]  != null ? String(r[8]).trim()  : "";
          const cost        = typeof r[12] === "number" ? r[12] : 0;
          const price       = typeof r[13] === "number" ? r[13] : 0;
          const category    = r[14] != null ? String(r[14]).trim() : null;
          const subcategory = r[15] != null ? String(r[15]).trim() : null;
          return { sku: sku || null, name, cost, price, category, subcategory };
        })
        .filter((i) => i.name && i.price > 0);

      if (!items.length) return toast.error("Nenhum produto válido na planilha");

      const res = await bulk({ data: { items } });
      toast.success(`${res.count} produtos importados da planilha`);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const categorias = [...new Set(
    products.map((p) => (p as any).category).filter(Boolean)
  )].sort() as string[];

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCategoria =
      categoriaFiltro === "TODAS" || (p as any).category === categoriaFiltro;
    return matchSearch && matchCategoria;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Produtos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro simples para uso no PDV.{" "}
            {!isLoading && (
              <span className="font-medium text-foreground">
                {filtered.length !== products.length
                  ? `${filtered.length} de ${products.length} produtos`
                  : `${products.length} produto${products.length !== 1 ? "s" : ""} cadastrado${products.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCsv(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importar CSV
          </Button>
          <input
            ref={xlsxRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleXlsx(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => xlsxRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar Planilha
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Novo produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label>Código / SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div>
                  <Label>Preço (R$) *</Label>
                  <Input
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-3">
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="TODAS">Todas as categorias ({categorias.length})</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {categoriaFiltro !== "TODAS" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCategoriaFiltro("TODAS")}
              className="text-muted-foreground"
            >
              Limpar filtro ×
            </Button>
          )}
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum produto encontrado.</TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{(p as any).category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {(p as any).cost ? formatBRL((p as any).cost) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(p.price)}</TableCell>
                  <TableCell className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => confirm(`Excluir "${p.name}"?`) && deleteMut.mutate(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          CSV: <code>nome,preco,sku</code> (ou separador <code>;</code>). Planilha XLSX: colunas <code>D</code> (SKU), <code>I</code> (descrição), <code>M</code> (custo), <code>N</code> (preço), <code>O</code> (categoria), <code>P</code> (subcategoria).
        </p>
      </Card>
    </div>
  );
}