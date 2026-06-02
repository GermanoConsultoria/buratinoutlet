import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { listProducts } from "@/lib/products.functions";
import { createSale, getCaixaAberto, listSales } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  ShoppingCart, Plus, Minus, X, Search, Barcode,
  ChevronLeft, Tag, Lock, Unlock, Percent,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { ReceiptDialog, type Receipt } from "@/components/receipt-dialog";
import { ModalAbrirCaixa, ModalFecharCaixa } from "@/components/caixa-dialog";
import type { Caixa, ResumoCaixa } from "@/lib/caixa.types";
import { useAuth } from "@/hooks/use-auth";
import { isManagerOrOwner } from "@/lib/auth";
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
  desconto: number; // desconto por item em R$
};

type Payment = "dinheiro" | "credito" | "debito" | "pix";

function PdvPage() {
  const list = useServerFn(listProducts);
  const sell = useServerFn(createSale);
  const getCaixa = useServerFn(getCaixaAberto);
  const getSales = useServerFn(listSales);
  const { profile } = useAuth();

  const podeDesconto = isManagerOrOwner(profile);
  const isUser = profile?.role === "USER";

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
  const [descontoGeral, setDescontoGeral] = useState("");
  const [editandoDescontoIdx, setEditandoDescontoIdx] = useState<number | null>(null);
  const [descontoItemInput, setDescontoItemInput] = useState("");

  // Caixa
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null);
  const [caixaLoading, setCaixaLoading] = useState(true);
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [resumoCaixa, setResumoCaixa] = useState<ResumoCaixa | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getCaixa().then((c) => {
      setCaixaAberto(c as Caixa | null);
      setCaixaLoading(false);
    }).catch(() => setCaixaLoading(false));
  }, []);

  async function handleFecharCaixaClick() {
    if (!caixaAberto) return;
    try {
      const vendas = await getSales();
      const abertoEm = new Date(caixaAberto.aberto_em).getTime();
      const vendasDoCaixa = vendas.filter(
        (v) => !v.canceled_at && new Date(v.created_at).getTime() >= abertoEm
      );
      const total_vendas = vendasDoCaixa.reduce((s, v) => s + Number(v.total), 0);
      const total_dinheiro = vendasDoCaixa.filter((v) => v.payment_method === "dinheiro").reduce((s, v) => s + Number(v.total), 0);
      const total_credito = vendasDoCaixa.filter((v) => v.payment_method === "credito").reduce((s, v) => s + Number(v.total), 0);
      const total_debito = vendasDoCaixa.filter((v) => v.payment_method === "debito").reduce((s, v) => s + Number(v.total), 0);
      const total_pix = vendasDoCaixa.filter((v) => v.payment_method === "pix").reduce((s, v) => s + Number(v.total), 0);
      setResumoCaixa({
        caixa: caixaAberto,
        total_vendas,
        total_dinheiro,
        total_credito,
        total_debito,
        total_pix,
        qtd_vendas: vendasDoCaixa.length,
        saldo_esperado: caixaAberto.valor_abertura + total_dinheiro,
      });
      setShowFecharCaixa(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const categorias = useMemo(() => {
    const set = new Set(products.map((p) => (p as any).category as string | null).filter(Boolean));
    return [...set].sort() as string[];
  }, [products]);

  const filtered = useMemo(() => {
    if (search) {
      const s = search.toLowerCase();
      return products.filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s)).slice(0, 100);
    }
    if (categoriaSel) return products.filter((p) => (p as any).category === categoriaSel);
    return [];
  }, [products, search, categoriaSel]);

  const modoAtual: "categorias" | "produtos" = !search && !categoriaSel ? "categorias" : "produtos";

  const addProduct = useCallback((p: { id: string; name: string; price: number }) => {
    setCart((c) => {
      const i = c.findIndex((it) => it.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: 1, desconto: 0 }];
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const active = document.activeElement;
    if (active === searchInputRef.current || active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") return;
    if (e.key === "Enter") {
      const code = barcodeBufferRef.current.trim();
      barcodeBufferRef.current = "";
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
      if (!code) return;
      const match = products.find((p) => (p.sku ?? "").toLowerCase() === code.toLowerCase());
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
      barcodeTimerRef.current = setTimeout(() => { barcodeBufferRef.current = ""; }, 100);
    }
  }, [products, addProduct]);

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

  const setDescontoItem = (idx: number, valor: number) => {
    setCart((c) => {
      const copy = [...c];
      const maxDesconto = copy[idx].price * copy[idx].quantity;
      copy[idx] = { ...copy[idx], desconto: Math.min(Math.max(0, valor), maxDesconto) };
      return copy;
    });
  };

  const removeItem = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx));

  const subtotalItens = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDescontoItens = cart.reduce((s, i) => s + i.desconto, 0);
  const descontoGeralNum = parseFloat(descontoGeral.replace(",", ".")) || 0;
  const totalDesconto = totalDescontoItens + descontoGeralNum;
  const total = Math.max(0, subtotalItens - totalDesconto);
  const paidNum = parseFloat(paid.replace(",", ".")) || 0;
  const change = payment === "dinheiro" ? Math.max(0, paidNum - total) : 0;
  const insufficient = payment === "dinheiro" && paid !== "" && paidNum < total;

  const finalize = async () => {
    if (!cart.length) return toast.error("Carrinho vazio");
    if (insufficient) return toast.error("Valor pago insuficiente");
    if (!caixaAberto) return toast.error("Abra o caixa antes de realizar vendas.");
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
          caixa_id: caixaAberto.id,
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
      setDescontoGeral("");
      toast.success(`Venda #${res.receipt_number} registrada`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Barra do caixa */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {!caixaLoading && (
            <>
              <div className={`w-2 h-2 rounded-full ${caixaAberto ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <span className={`text-xs font-medium ${caixaAberto ? "text-emerald-600" : "text-red-600"}`}>
                {caixaAberto
                  ? `Caixa aberto desde ${new Date(caixaAberto.aberto_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  : "Caixa fechado"}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!caixaLoading && !caixaAberto && (
            <Button size="sm" onClick={() => setShowAbrirCaixa(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs gap-1">
              <Unlock size={13} /> Abrir Caixa
            </Button>
          )}
          {!caixaLoading && caixaAberto && (
            <Button size="sm" variant="outline" onClick={handleFecharCaixaClick} className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs gap-1">
              <Lock size={13} /> Fechar Caixa
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 h-[calc(100vh-8rem)]">
        {barcodeFlash && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium">
            <Barcode className="h-4 w-4" />
            Adicionado: {barcodeFlash}
          </div>
        )}

        {/* Área de produtos — simplificada para USER */}
        <Card className="p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            {!isUser && categoriaSel && !search && (
              <button onClick={() => setCategoriaSel(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              ref={searchInputRef}
              autoFocus
              placeholder="Buscar ou bipar código de barras..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (e.target.value) setCategoriaSel(null); }}
              onKeyDown={handleSearchKeyDown}
            />
            {search && (
              <button onClick={() => setSearch("")} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isUser && categoriaSel && !search && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
              <button onClick={() => setCategoriaSel(null)} className="hover:text-foreground transition-colors">Categorias</button>
              <span>/</span>
              <span className="text-foreground font-medium">{categoriaSel}</span>
              <span className="ml-1">({filtered.length} produto{filtered.length !== 1 ? "s" : ""})</span>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {products.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm">
                Nenhum produto cadastrado.
              </div>
            ) : isUser ? (
              // Tela simplificada para USER — só busca, sem categorias
              <div>
                {search ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filtered.length === 0 ? (
                      <div className="col-span-3 text-center text-muted-foreground py-10 text-sm">Nenhum produto encontrado.</div>
                    ) : (
                      filtered.map((p) => (
                        <button key={p.id} onClick={() => addProduct(p)}
                          className="text-left rounded-lg border bg-card hover:border-primary hover:shadow-md transition p-3">
                          <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                          {p.sku && <div className="text-xs text-muted-foreground mt-1">{p.sku}</div>}
                          <div className="mt-2 text-primary font-bold tabular-nums">{formatBRL(p.price)}</div>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10 space-y-2">
                    <Search className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Digite o nome ou bipe o código do produto</p>
                  </div>
                )}
              </div>
            ) : modoAtual === "categorias" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {categorias.map((cat) => {
                  const count = products.filter((p) => (p as any).category === cat).length;
                  return (
                    <button key={cat} onClick={() => setCategoriaSel(cat)}
                      className="text-left rounded-lg border bg-card hover:border-primary hover:shadow-md transition p-3 flex flex-col gap-1">
                      <Tag className="h-4 w-4 text-primary mb-1" />
                      <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{cat}</div>
                      <div className="text-xs text-muted-foreground">{count} produto{count !== 1 ? "s" : ""}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filtered.length === 0 ? (
                  <div className="col-span-4 text-center text-muted-foreground py-10 text-sm">Nenhum produto encontrado.</div>
                ) : (
                  filtered.map((p) => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="text-left rounded-lg border bg-card hover:border-primary hover:shadow-md transition p-3">
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
                  <li key={i} className="p-2 rounded-md bg-muted/40 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatBRL(it.price)} × {it.quantity}
                          {it.desconto > 0 && (
                            <span className="ml-1 text-orange-600">− {formatBRL(it.desconto)}</span>
                          )}
                          {" = "}
                          <span className="font-medium text-foreground">
                            {formatBRL(it.price * it.quantity - it.desconto)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center text-sm tabular-nums">{it.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                        {podeDesconto && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                            setEditandoDescontoIdx(editandoDescontoIdx === i ? null : i);
                            setDescontoItemInput(it.desconto > 0 ? String(it.desconto) : "");
                          }}>
                            <Percent className="h-3 w-3 text-orange-500" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(i)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    {podeDesconto && editandoDescontoIdx === i && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">Desconto item (R$):</span>
                        <Input
                          className="h-6 text-xs w-24"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={descontoItemInput}
                          onChange={(e) => setDescontoItemInput(e.target.value)}
                          onBlur={() => {
                            const v = parseFloat(descontoItemInput.replace(",", ".")) || 0;
                            setDescontoItem(i, v);
                            setEditandoDescontoIdx(null);
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t pt-3 mt-3 space-y-3">
            {podeDesconto && cart.length > 0 && (
              <div className="flex items-center gap-2">
                <Percent className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground flex-shrink-0">Desconto geral (R$):</span>
                <Input
                  className="h-7 text-xs"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={descontoGeral}
                  onChange={(e) => setDescontoGeral(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              {totalDesconto > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatBRL(subtotalItens)}</span>
                </div>
              )}
              {totalDesconto > 0 && (
                <div className="flex justify-between text-xs text-orange-600">
                  <span>Desconto total</span>
                  <span className="tabular-nums">− {formatBRL(totalDesconto)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold text-primary tabular-nums">{formatBRL(total)}</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Forma de pagamento</div>
              <div className="grid grid-cols-4 gap-1">
                {(["dinheiro", "credito", "debito", "pix"] as Payment[]).map((m) => (
                  <button key={m} onClick={() => setPayment(m)}
                    className={`text-xs font-medium py-2 rounded-md border transition capitalize ${payment === m ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>
                    {m === "credito" ? "Crédito" : m === "debito" ? "Débito" : m === "pix" ? "PIX" : "Dinheiro"}
                  </button>
                ))}
              </div>
            </div>

            {payment === "dinheiro" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Valor recebido</div>
                  <Input inputMode="decimal" placeholder="0,00" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Troco</div>
                  <div className={`h-9 rounded-md border bg-muted/40 flex items-center px-3 font-bold tabular-nums ${insufficient ? "text-destructive" : "text-success"}`}>
                    {insufficient ? `Falta ${formatBRL(total - paidNum)}` : formatBRL(change)}
                  </div>
                </div>
              </div>
            )}

            {!caixaAberto && !caixaLoading && (
              <div className="text-xs text-center text-red-600 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
                Abra o caixa para realizar vendas
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={finalize}
              disabled={submitting || !cart.length || insufficient || !caixaAberto}
            >
              {submitting ? "Finalizando..." : "Finalizar venda"}
            </Button>
          </div>
        </Card>
      </div>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <AlertDialog open={!!printPrompt} onOpenChange={(o) => !o && setPrintPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Imprimir cupom não fiscal?</AlertDialogTitle>
            <AlertDialogDescription>Venda #{printPrompt?.receipt_number} registrada. Deseja imprimir o cupom agora?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPrintPrompt(null)}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setReceipt(printPrompt); setPrintPrompt(null); }}>Sim, imprimir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showAbrirCaixa && (
        <ModalAbrirCaixa
          onSuccess={(caixa) => { setCaixaAberto(caixa); setShowAbrirCaixa(false); }}
          onClose={() => setShowAbrirCaixa(false)}
        />
      )}

      {showFecharCaixa && resumoCaixa && (
        <ModalFecharCaixa
          resumo={resumoCaixa}
          onSuccess={() => { setCaixaAberto(null); setShowFecharCaixa(false); setResumoCaixa(null); }}
          onClose={() => setShowFecharCaixa(false)}
        />
      )}
    </div>
  );
}