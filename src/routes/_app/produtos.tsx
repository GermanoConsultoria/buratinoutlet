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
import { Plus, Download, Pencil, Trash2, Package, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_app/produtos")({
  component: ProdutosPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost?: number;
  category?: string | null;
  subcategory?: string | null;
  lote?: string | null;
  data_entrada?: string | null;
  endereco?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  icms_origem?: string | null;
  icms_situacao_tributaria?: string | null;
};

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
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaSubcategoria, setNovaSubcategoria] = useState("");
  const [loteInput, setLoteInput] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [endereco, setEndereco] = useState("");
  const [ncm, setNcm] = useState("");
  const [cfop, setCfop] = useState("");
  const [icmsOrigem, setIcmsOrigem] = useState("0");
  const [icmsSituacao, setIcmsSituacao] = useState("");
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");
  const [loteFiltro, setLoteFiltro] = useState("TODOS");
  const [loteImport, setLoteImport] = useState("");
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

  const categoriaFinal = category === "__nova__" ? novaCategoria : category;
  const subcategoriaFinal = subcategory === "__nova__" ? novaSubcategoria : subcategory;

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          name,
          sku: sku || null,
          price: parseFloat(price.replace(",", ".")) || 0,
          cost: parseFloat(cost.replace(",", ".")) || 0,
          category: categoriaFinal || null,
          subcategory: subcategoriaFinal || null,
          lote: loteInput || null,
          data_entrada: dataEntrada || null,
          endereco: endereco || null,
          ncm: ncm || null,
          cfop: cfop || null,
          icms_origem: icmsOrigem || null,
          icms_situacao_tributaria: icmsSituacao || null,
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
    setName(""); setSku(""); setPrice(""); setCost("");
    setCategory(""); setSubcategory(""); setLoteInput("");
    setDataEntrada(""); setEndereco("");
    setNovaCategoria(""); setNovaSubcategoria("");
    setNcm(""); setCfop(""); setIcmsOrigem("0"); setIcmsSituacao("");
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setSku(p.sku ?? "");
    setPrice(String(p.price));
    setCost(String(p.cost ?? ""));
    setCategory(p.category ?? "");
    setSubcategory(p.subcategory ?? "");
    setLoteInput(p.lote ?? "");
    setDataEntrada(
      p.data_entrada
        ? new Date(p.data_entrada).toISOString().split("T")[0]
        : ""
    );
    setEndereco(p.endereco ?? "");
    setNovaCategoria(""); setNovaSubcategoria("");
    setNcm(p.ncm ?? "");
    setCfop(p.cfop ?? "");
    setIcmsOrigem(p.icms_origem ?? "0");
    setIcmsSituacao(p.icms_situacao_tributaria ?? "");
    setOpen(true);
  };

  const handleExportCsv = () => {
    if (products.length === 0) return toast.error("Nenhum produto para exportar.");
    const wsData = (products as Product[]).map((p) => {
      const row = new Array(23).fill(null);
      row[3]  = p.sku ?? "";
      row[8]  = p.name;
      row[12] = p.cost ?? 0;
      row[13] = p.price;
      row[14] = p.category ?? "";
      row[15] = p.subcategory ?? "";
      row[16] = p.lote ?? "";
      row[17] = p.endereco ?? "";
      row[18] = p.data_entrada ? new Date(p.data_entrada).toLocaleDateString("pt-BR") : "";
      row[19] = p.ncm ?? "";
      row[20] = p.cfop ?? "";
      row[21] = p.icms_origem ?? "";
      row[22] = p.icms_situacao_tributaria ?? "";
      return row;
    });
    const header = new Array(23).fill(null);
    header[3]  = "Código ML";
    header[8]  = "Descrição do item";
    header[12] = "Custo";
    header[13] = "Venda";
    header[14] = "Categoria";
    header[15] = "Subcategoria";
    header[16] = "Lote";
    header[17] = "Cidade/Endereço";
    header[18] = "Data de entrada";
    header[19] = "NCM";
    header[20] = "CFOP";
    header[21] = "Origem ICMS";
    header[22] = "Situação Tributária ICMS";
    const ws = XLSX.utils.aoa_to_sheet([header, ...wsData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    const data = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `produtos_backup_${data}.xlsx`);
    toast.success(`${products.length} produtos exportados!`);
  };

  const processXlsx = async (file: File, lote: string) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellFormula: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return toast.error("Planilha vazia");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1, defval: null, raw: true,
      }) as (string | number | null)[][];

      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const colD = String(rows[i]?.[3] ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const colI = String(rows[i]?.[8] ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (colD.includes("codigo") || colD.includes("cod") || colD.includes("sku") || colI.includes("descri") || colI.includes("item")) {
          headerIdx = i; break;
        }
      }

      const dataRows = rows.slice(headerIdx + 1);

      const items = dataRows
        .map((r) => {
          const sku               = r[3] != null ? String(r[3]).trim() : (r[4] != null ? String(r[4]).trim() : "");
          const name              = r[8]  != null ? String(r[8]).trim()  : "";
          const cost              = typeof r[12] === "number" ? r[12] : (typeof r[12] === "string" && r[12].startsWith("=") ? 0 : parseFloat(String(r[12] || "0")) || 0);
          const price             = typeof r[13] === "number" ? r[13] : (typeof r[13] === "string" && r[13].startsWith("=") ? 0 : parseFloat(String(r[13] || "0")) || 0);
          const category          = r[14] != null ? String(r[14]).trim() : null;
          const subcategory       = r[15] != null ? String(r[15]).trim() : null;
          const loteCol           = r[16] != null ? String(r[16]).trim() : null;
          const endereco          = r[17] != null ? String(r[17]).trim() : null;
          const dataEntrada       = r[18] != null ? String(r[18]).trim() : null;
          // Colunas fiscais (T–W) — ausentes em planilhas antigas: r[19..22] será null → campo fica null, sem quebrar importação
          const ncmCol            = r[19] != null ? String(r[19]).trim() : null;
          const cfopCol           = r[20] != null ? String(r[20]).trim() : null;
          const icmsOrigemCol     = r[21] != null ? String(r[21]).trim() : null;
          const icmsSituacaoCol   = r[22] != null ? String(r[22]).trim() : null;

          let dataEntradaISO: string | null = null;
          if (dataEntrada) {
            const num = Number(dataEntrada);
            if (!isNaN(num) && num > 10000) {
              const dt = (XLSX.SSF as any).parse_date_code(num);
              if (dt) {
                dataEntradaISO = `${dt.y}-${String(dt.m).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}T00:00:00.000Z`;
              }
            } else {
              const partes = dataEntrada.split("/");
              if (partes.length === 3) {
                dataEntradaISO = `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}T00:00:00.000Z`;
              } else {
                const d = new Date(dataEntrada);
                if (!isNaN(d.getTime())) dataEntradaISO = d.toISOString();
              }
            }
          }

          return {
            sku: sku || null,
            name,
            cost,
            price,
            category,
            subcategory,
            lote: loteCol || lote || null,
            endereco,
            data_entrada: dataEntradaISO,
            ncm: ncmCol || null,
            cfop: cfopCol || null,
            icms_origem: icmsOrigemCol || null,
            icms_situacao_tributaria: icmsSituacaoCol || null,
          };
        })
        .filter((i) => i.name && i.name.length > 0);

      if (!items.length) return toast.error("Nenhum produto válido na planilha");
      const res = await bulk({ data: { items, lote: lote || null } });
      toast.success(`${res.count} produtos importados da planilha`);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleXlsxClick = () => xlsxRef.current?.click();

  const categorias = [...new Set(products.map((p) => (p as any).category ?? "Sem Categoria"))].sort() as string[];
  const lotes = [...new Set(products.map((p) => (p as any).lote).filter(Boolean))].sort() as string[];

  const subcategoriasDaCategoria = [...new Set(
    (products as Product[])
      .filter((p) => p.category === categoriaFinal)
      .map((p) => p.subcategory)
      .filter(Boolean)
  )].sort() as string[];

  const filtered = products.filter((p: any) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCategoria = categoriaFiltro === "TODAS" ||
      (categoriaFiltro === "Sem Categoria" ? (!p.category || p.category === "Sem Categoria") : p.category === categoriaFiltro);
    const matchLote = loteFiltro === "TODOS" || p.lote === loteFiltro;
    return matchSearch && matchCategoria && matchLote;
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
                  : `${products.length} produto${products.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={products.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          <input ref={xlsxRef} type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setPendingFile(f); setLoteImport(""); setShowLoteModal(true); }
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={handleXlsxClick}>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço (R$) *</Label>
                    <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
                  </div>
                  <div>
                    <Label>Custo (R$)</Label>
                    <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <select
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); setSubcategory(""); setNovaCategoria(""); setNovaSubcategoria(""); }}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Selecione...</option>
                      {categorias.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__nova__">+ Nova categoria...</option>
                    </select>
                    {category === "__nova__" && (
                      <Input
                        className="mt-1"
                        placeholder="Digite a nova categoria"
                        value={novaCategoria}
                        onChange={(e) => setNovaCategoria(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>
                  <div>
                    <Label>Subcategoria</Label>
                    <select
                      value={subcategory}
                      onChange={(e) => { setSubcategory(e.target.value); setNovaSubcategoria(""); }}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Selecione...</option>
                      {subcategoriasDaCategoria.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__nova__">+ Nova subcategoria...</option>
                    </select>
                    {subcategory === "__nova__" && (
                      <Input
                        className="mt-1"
                        placeholder="Digite a nova subcategoria"
                        value={novaSubcategoria}
                        onChange={(e) => setNovaSubcategoria(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Lote</Label>
                    <Input value={loteInput} onChange={(e) => setLoteInput(e.target.value)} placeholder="Ex: 92" />
                  </div>
                  <div>
                    <Label>Data de Entrada</Label>
                    <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Endereço / Cidade</Label>
                  <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Ex: São Paulo" />
                </div>

                {/* Classificação Fiscal para NFC-e */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classificação Fiscal</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Necessário para emitir NFC-e</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>NCM</Label>
                      <Input value={ncm} onChange={(e) => setNcm(e.target.value)} placeholder="Ex: 62034200" maxLength={8} />
                    </div>
                    <div>
                      <Label>CFOP</Label>
                      <Input value={cfop} onChange={(e) => setCfop(e.target.value)} placeholder="Ex: 5102" maxLength={10} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label>Origem do ICMS</Label>
                      <select
                        value={icmsOrigem}
                        onChange={(e) => setIcmsOrigem(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      >
                        <option value="0">0 – Nacional</option>
                        <option value="1">1 – Estrangeira (importação direta)</option>
                        <option value="2">2 – Estrangeira (mercado interno)</option>
                        <option value="3">3 – Nacional com CI 40–70%</option>
                        <option value="4">4 – Nacional (processos produtivos)</option>
                        <option value="5">5 – Nacional com CI ≤ 40%</option>
                        <option value="6">6 – Estrangeira direta s/ similar (CAMEX)</option>
                        <option value="7">7 – Estrangeira interno s/ similar (CAMEX)</option>
                        <option value="8">8 – Nacional com CI &gt; 70%</option>
                      </select>
                    </div>
                    <div>
                      <Label>Sit. Tributária ICMS (CST/CSOSN)</Label>
                      <Input
                        value={icmsSituacao}
                        onChange={(e) => setIcmsSituacao(e.target.value)}
                        placeholder="Ex: 102 ou 500"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending}>Salvar</Button>
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
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background">
            <option value="TODAS">Todas as categorias ({categorias.length})</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={loteFiltro} onChange={(e) => setLoteFiltro(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background">
            <option value="TODOS">Todos os lotes ({lotes.length})</option>
            {lotes.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {(categoriaFiltro !== "TODAS" || loteFiltro !== "TODOS") && (
            <Button variant="ghost" size="sm"
              onClick={() => { setCategoriaFiltro("TODAS"); setLoteFiltro("TODOS"); }}
              className="text-muted-foreground">
              Limpar filtros ×
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
                <TableHead>Subcategoria</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum produto encontrado.</TableCell>
                </TableRow>
              )}
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {!(p.ncm && p.cfop && p.icms_situacao_tributaria) && (
                        <span
                          title="Sem classificação fiscal — NCM, CFOP ou Sit. Tributária ausentes. Necessário para emitir NFC-e."
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-medium select-none flex-shrink-0"
                        >
                          NF
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category ?? "Sem Categoria"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.subcategory ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.lote ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 font-medium">
                        {p.lote}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {p.data_entrada ? new Date(p.data_entrada).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">
                    {p.endereco ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.cost ? formatBRL(p.cost) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(p.price)}</TableCell>
                  <TableCell className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost"
                      onClick={() => confirm(`Excluir "${p.name}"?`) && deleteMut.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Planilha XLSX: <code>D</code> (Código ML), <code>I</code> (Descrição), <code>M</code> (Custo), <code>N</code> (Venda), <code>O</code> (Categoria), <code>P</code> (Subcategoria), <code>Q</code> (Lote), <code>R</code> (Cidade/Endereço), <code>S</code> (Data de entrada){" "}
          · Fiscal: <code>T</code> (NCM), <code>U</code> (CFOP), <code>V</code> (Origem ICMS), <code>W</code> (Situação Tributária ICMS).
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Coluna V — Origem ICMS</span> (código numérico):
          {" "}0 = Nacional · 1 = Estrangeira import. direta · 2 = Estrangeira mercado interno · 3 = Nacional CI 40–70% · 4 = Nacional proc. produtivos · 5 = Nacional CI ≤ 40% · 6 = Estrangeira direta s/ similar CAMEX · 7 = Estrangeira interno s/ similar CAMEX · 8 = Nacional CI &gt; 70%.
          {" "}Planilhas sem as colunas T–W são importadas normalmente (campos fiscais ficam em branco).
        </p>
      </Card>

      {showLoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Número do Lote</h2>
            <p className="text-sm text-muted-foreground">
              Informe o lote desta importação. Será aplicado aos produtos que não tiverem lote na planilha.
            </p>
            <div>
              <Label>Lote (opcional)</Label>
              <Input
                value={loteImport}
                onChange={(e) => setLoteImport(e.target.value)}
                placeholder="Ex: Lote 92, Lote 93..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1"
                onClick={() => { setShowLoteModal(false); setPendingFile(null); }}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={async () => {
                if (pendingFile) {
                  setShowLoteModal(false);
                  await processXlsx(pendingFile, loteImport);
                  setPendingFile(null);
                }
              }}>
                Importar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}