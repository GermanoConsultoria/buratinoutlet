import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { listProducts } from "@/lib/products.functions";
import { createSale } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Plus, Minus, X, Search, Barcode, ChevronLeft, Tag } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { ReceiptDialog, type Receipt } from "@/components/receipt-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/pdv")({
  component: PdvPage,
});

type CartItem = {
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
};

type Payment = "dinheiro" | "credito" | "debito" | "pix";

function PdvPage() {
  const list = useServerFn(listProducts);
  const sell = useServerFn(createSale);
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => list() });

  const [search, setSearch] = useState("");
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<Payment>("dinheiro");
  const [paid, setPaid] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [printPrompt, setPrintPrompt] = useState<Receipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [barcodeFlash, setBarcodeFlash] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Categorias únicas ordenadas (coluna O)
  const categorias = useMemo(() => {
    const set = new Set(
      products
        .map((p) => (p as any).category as string | null)
        .filter(Boolean)
    );
    return [...set].sort() as string[];
  }, [products]);

  // Grid: busca → filtra por busca; categoria selecionada → filtra por ela; senão → categorias
  const filtered = useMemo(() => {
    if (search) {
      const s = search.toLowerCase();
      return products
        .filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s))
        .slice(0, 100);
    }
    if (categoriaSel) {
      return products.filter((p) => (p as any).category === categoriaSel);
    }
    return [];
  }, [products, search, categoriaSel]);

  const modoAtual: "categorias" | "produtos" =
    !search && !categoriaSel ? "categorias" : "produtos";

  const addProduct = useCallback((p: { id: string; name: string; price: number }) => {
    setCart((c) => {
      const i = c.findIndex((it) => it.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const query = search.trim();
    if (!query) return;

    const match =
      products.find((p) => (p.sku ?? "").toLowerCase() === query.toLowerCase()) ??
      products.find((p) => p.name.toLowerCase() === query.toLowerCase());

    if (match) {
      addProduct(match);
      setBarcodeFlash(match.name);
      setTimeout(() => setBarcodeFlash(null), 1500);
      setSearch("");
      searchInputRef.current?.focus();
    } else {
      toast.error(`Nenhum produto encontrado para "${query}"`);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active === searchInputRef.current ||
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA"
      ) return;

      if (e.key === "Enter") {
        const code = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = "";
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        if (!code) return;

        const match = products.find(
          (p) => (p.sku ?? "").toLowerCase() === code.toLowerCase()
        );
        if (match) {
          addProduct(match);
          setBarcodeFlash(match.name);
          setTimeout(() => setBarcodeFlash(null), 1500);
        } else {
          setSearch(code);
          searchInputRef.current?.focus();
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = "";
        }, 100);
      }
    },
    [products, addProduct]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const changeQty = (idx: number, delta: number) => {
    setCart((c) => {
      const copy = [...c];
      const q = copy[idx].quantity + delta;
      if (q <= 0) return copy.filter((_, i) => i !== idx);
      copy[idx] = { ...copy[idx], quantity: q };
      return copy;
    });
  };

  const removeItem = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx));

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const paidNum = parseFloat(paid.replace(",", ".")) || 0;
  const change = payment === "dinheiro" ? Math.max(0, paidNum - total) : 0;
  const insufficient = payment === "dinheiro" && paid !== "" && paidNum < total;

  const finalize = async () => {
    if (!cart.length) return toast.error("Carrinho vazio");
    if (insufficient) return toast.error("Valor pago insuficiente");
    setSubmitting(true);
    try {
      const res = await sell({
        data: {
          items: cart.map((i) => ({
            product_id: i.product_id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          payment_method: payment,
          amount_paid: payment === "dinheiro" ? paidNum || total : null,
        },
      });
      const built: Receipt = {
        receipt_number: res.receipt_number,
        created_at: res.created_at,
        items: cart,
        total: res.total,
        payment_method: payment,
        amount_paid: payment === "dinheiro" ? paidNum || total : null,
        change_due: res.change,
      };
      setPrintPrompt(built);
      setCart([]);
      setPaid("");
      toast.success(`Venda #${res.receipt_number} registrada`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 h-[calc(100vh-7rem)]">
      {/* Flash de barcode */}
      {barcodeFlash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <Barcode className="h-4 w-4" />
          Adicionado: {barcodeFlash}
        </div>
      )}

      {/* Products / Categorias */}
      <Card className="p-4 flex flex-col min-h-0">
        {/* Barra de busca */}
        <div className="flex items-center gap-2 mb-3">
          {categoriaSel && !search && (
            <button
              onClick={() => setCategoriaSel(null)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
              title="Voltar para categorias"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            ref={searchInputRef}
            autoFocus
            placeholder="Buscar ou bipar código de barras..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) setCategoriaSel(null);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        {categoriaSel && !search && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <button
              onClick={() => setCategoriaSel(null)}
              className="hover:text-foreground transition-colors"
            >
              Categorias
            </button>
            <span>/</span>
            <span className="text-foreground font-medium">{categoriaSel}</span>
            <span className="ml-1">({filtered.length} produto{filtered.length !== 1 ? "s" : ""})</span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {products.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              Nenhum produto cadastrado. Vá em <strong>Produtos</strong> para começar.
            </div>
          ) : modoAtual === "categorias" ? (
            // Grid de categorias
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {categorias.map((cat) => {
                const count = products.filter((p) => (p as any).category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoriaSel(cat)}
                    className="text-left rounded-lg border bg-card hover:border-primary hover:shadow-md transition p-3 flex flex-col gap-1"
                  >
                    <Tag className="h-4 w-4 text-primary mb-1" />
                    <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{cat}</div>
                    <div className="text-xs text-muted-foreground">
                      {count} produto{count !== 1 ? "s" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // Grid de produtos
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filtered.length === 0 ? (
                <div className="col-span-4 text-center text-muted-foreground py-10 text-sm">
                  Nenhum produto encontrado.
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="text-left rounded-lg border bg-card hover:border-primary hover:shadow-md transition p-3"
                  >
                    <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                    {p.sku && <div className="text-xs text-muted-foreground mt-1">{p.sku}</div>}
                    <div className="mt-2 text-primary font-bold tabular-nums">{formatBRL(p.price)}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Cart */}
      <Card className="p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Carrinho</h2>
          <span className="text-xs text-muted-foreground ml-auto">{cart.length} item(s)</span>
        </div>

        <div className="flex-1 overflow-auto -mx-2 px-2 min-h-0">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              Adicione produtos ou bipe o código de barras
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((it, i) => (
                <li key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatBRL(it.price)} × {it.quantity} ={" "}
                      <span className="font-medium text-foreground">
                        {formatBRL(it.price * it.quantity)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{it.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t pt-3 mt-3 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary tabular-nums">{formatBRL(total)}</span>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Forma de pagamento</div>
            <div className="grid grid-cols-4 gap-1">
              {(["dinheiro", "credito", "debito", "pix"] as Payment[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayment(m)}
                  className={`text-xs font-medium py-2 rounded-md border transition capitalize ${
                    payment === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  {m === "credito" ? "Crédito" : m === "debito" ? "Débito" : m === "pix" ? "PIX" : "Dinheiro"}
                </button>
              ))}
            </div>
          </div>

          {payment === "dinheiro" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Valor recebido</div>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Troco</div>
                <div className={`h-9 rounded-md border bg-muted/40 flex items-center px-3 font-bold tabular-nums ${
                  insufficient ? "text-destructive" : "text-success"
                }`}>
                  {insufficient ? `Falta ${formatBRL(total - paidNum)}` : formatBRL(change)}
                </div>
              </div>
            </div>
          )}

          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={finalize}
            disabled={submitting || !cart.length || insufficient}
          >
            {submitting ? "Finalizando..." : "Finalizar venda"}
          </Button>
        </div>
      </Card>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <AlertDialog open={!!printPrompt} onOpenChange={(o) => !o && setPrintPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Imprimir cupom não fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              Venda #{printPrompt?.receipt_number} registrada. Deseja imprimir o cupom agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPrintPrompt(null)}>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReceipt(printPrompt);
                setPrintPrompt(null);
              }}
            >
              Sim, imprimir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}