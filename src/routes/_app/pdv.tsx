import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { listProducts } from "@/lib/products.functions";
import { createSale, getCaixaAberto, listSales, listSangrias, getFocusNfeStatus, emitirNfceVenda } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  ShoppingCart, Plus, Minus, X, Search, Barcode,
  ChevronLeft, Tag, Lock, Unlock, Percent, ArrowDownCircle, FileText, SplitSquareHorizontal,
  CheckCircle2, AlertCircle, ExternalLink, Loader2, MessageCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { ReceiptDialog, type Receipt } from "@/components/receipt-dialog";
import { ModalAbrirCaixa, ModalFecharCaixa } from "@/components/caixa-dialog";
import { ModalSangria, ComprovanteSangria } from "@/components/sangria-dialog";
import { FechamentoDiarioDialog, FechamentoMensalDialog } from "@/components/fechamento-dialog";
import { WhatsappSendDialog } from "@/components/whatsapp-send-dialog";
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
  desconto: number;
};

type Payment = "dinheiro" | "credito" | "debito" | "pix";

// Tipo utilizado para o estado do formulário no pagamento misto (aceita string com vírgula)
type PaymentMistoState = {
  method: Payment;
  amount: string;
};

// Tipo esperado pelo banco de dados e pelo resumo
type PaymentMisto = {
  method: Payment;
  valor: number;
};

type SangriaRecibo = {
  id: string;
  valor: number;
  motivo: string | null;
  nome_responsavel: string;
  created_at: string;
  caixa_id: string | null;
};

type NfceState =
  | null
  | { fase: "emitindo" }
  | { fase: "autorizado"; chave: string; numero: string; serie: string; danfe_url: string | null; qrcode_url: string | null; receiptNumber: number; saleId: string }
  | { fase: "erro"; mensagem_sefaz: string; cupomReceipt: Receipt; receiptNumber: number };

function PdvPage() {
  const list = useServerFn(listProducts);
  const sell = useServerFn(createSale);
  const getCaixa = useServerFn(getCaixaAberto);
  const getSales = useServerFn(listSales);
  const getSangrias = useServerFn(listSangrias);
  const getNfceStatus = useServerFn(getFocusNfeStatus);
  const emitirNfceServer = useServerFn(emitirNfceVenda);
  const { profile } = useAuth();

  const podeDesconto = isManagerOrOwner(profile);
  const isUser = profile?.role === "USER";

  const { data: productsResult } = useQuery({ queryKey: ["products"], queryFn: () => list({ data: { pageSize: 10000 } }) });
  const products = productsResult?.data ?? [];

  const [search, setSearch] = useState("");
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<Payment>("dinheiro");
  const [paid, setPaid] = useState("");
  const [misto, setMisto] = useState(false);
  const [paymentsMisto, setPaymentsMisto] = useState<PaymentMistoState[]>([
    { method: "dinheiro", amount: "" },
    { method: "credito", amount: "" },
  ]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [printPrompt, setPrintPrompt] = useState<Receipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState<"cupom" | "nfce">("cupom");
  const [focusNfeConfigurado, setFocusNfeConfigurado] = useState(false);
  const [nfceState, setNfceState] = useState<NfceState>(null);
  const [whatsappSend, setWhatsappSend] = useState<{
    tipo: "cupom" | "nfce";
    receiptNumber: number;
    danfe_url?: string | null;
    receipt?: Receipt;
  } | null>(null);
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

  // Sangria e Fechamentos
  const [showSangria, setShowSangria] = useState(false);
  const [comprovanteSangria, setComprovanteSangria] = useState<SangriaRecibo | null>(null);
  const [showFechamentoDiario, setShowFechamentoDiario] = useState(false);
  const [showFechamentoMensal, setShowFechamentoMensal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getCaixa().then((c) => {
      setCaixaAberto(c as Caixa | null);
      setCaixaLoading(false);
    }).catch(() => setCaixaLoading(false));
  }, []);

  useEffect(() => {
    getNfceStatus().then((s) => setFocusNfeConfigurado(s.configurado)).catch(() => {});
  }, []);

  async function handleFecharCaixaClick() {
    if (!caixaAberto) return;
    try {
      const [vendas, sangrias] = await Promise.all([
        getSales(),
        getSangrias({ data: { caixa_id: caixaAberto.id } })
      ]);
      const abertoEm = new Date(caixaAberto.aberto_em).getTime();
      const vendasDoCaixa = vendas.filter(
        (v) => !v.canceled_at && new Date(v.created_at).getTime() >= abertoEm
      );
      const vendasCanceladasDoCaixa = vendas.filter(
        (v) => v.canceled_at && new Date(v.created_at).getTime() >= abertoEm
      );
      const sangriasDoCaixa = sangrias.filter(
        (s) => new Date(s.created_at).getTime() >= abertoEm
      );
      const total_sangrias = sangriasDoCaixa.reduce((acc, s) => acc + Number(s.valor), 0);
      const total_vendas = vendasDoCaixa.reduce((s, v) => s + Number(v.total), 0);
      const total_cancelamentos = vendasCanceladasDoCaixa.reduce((s, v) => s + Number(v.total), 0);
      const total_descontos = vendasDoCaixa.reduce((s, v) => s + Number((v as any).desconto ?? 0), 0);

      // Calcula dinheiro incluindo misto
      let total_dinheiro = 0;
      let total_credito = 0;
      let total_debito = 0;
      let total_pix = 0;
      for (const v of vendasDoCaixa) {
        if (v.payment_method === "misto" && (v as any).payment_methods) {
          for (const m of (v as any).payment_methods as PaymentMisto[]) {
            if (m.method === "dinheiro") total_dinheiro += m.valor;
            else if (m.method === "credito") total_credito += m.valor;
            else if (m.method === "debito") total_debito += m.valor;
            else if (m.method === "pix") total_pix += m.valor;
          }
        } else {
          if (v.payment_method === "dinheiro") total_dinheiro += Number(v.total);
          else if (v.payment_method === "credito") total_credito += Number(v.total);
          else if (v.payment_method === "debito") total_debito += Number(v.total);
          else if (v.payment_method === "pix") total_pix += Number(v.total);
        }
      }

      const saldo_esperado = caixaAberto.valor_abertura + total_dinheiro - total_sangrias;
      setResumoCaixa({
        caixa: caixaAberto,
        total_vendas,
        total_cancelamentos,
        total_descontos,
        total_dinheiro,
        total_credito,
        total_debito,
        total_pix,
        total_sangrias,
        qtd_vendas: vendasDoCaixa.length,
        qtd_cancelamentos: vendasCanceladasDoCaixa.length,
        qtd_sangrias: sangriasDoCaixa.length,
        saldo_esperado,
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
      return products.filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
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

  // Cálculos Gerais do Carrinho
  const subtotalItens = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDescontoItens = cart.reduce((s, i) => s + i.desconto, 0);
  const descontoGeralNum = parseFloat(descontoGeral.replace(",", ".")) || 0;
  const totalDesconto = totalDescontoItens + descontoGeralNum;
  const total = Math.max(0, subtotalItens - totalDesconto);
  const paidNum = parseFloat(paid.replace(",", ".")) || 0;

  // Cálculos para misto
  const totalMisto = paymentsMisto.reduce((s, p) => s + (parseFloat(p.amount.replace(",", ".")) || 0), 0);
  const faltaMisto = Math.max(0, total - totalMisto);
  const trocoMisto = Math.max(0, totalMisto - total);

  const change = !misto && payment === "dinheiro" ? Math.max(0, paidNum - total) : 0;
  const insufficient = !misto && payment === "dinheiro" && paid !== "" && paidNum < total;
  const mistoInsuficiente = misto && (totalMisto + 0.001) < total;

  const updatePaymentMistoMethod = (idx: number, method: Payment) => {
    setPaymentsMisto((prev) => {
      const copy = [...prev];
      copy[idx].method = method;
      return copy;
    });
  };

  const handleMistoValueChange = (idx: number, value: string) => {
    // Permite apenas números e vírgulas
    let safeValue = value.replace(/[^0-9,]/g, "");
    
    // Evita mais de uma vírgula
    const parts = safeValue.split(",");
    if (parts.length > 2) {
      safeValue = parts[0] + "," + parts.slice(1).join("");
    }

    setPaymentsMisto((prev) => {
      const copy = [...prev];
      copy[idx].amount = safeValue;

      // Puxa o restante automaticamente se estiver digitando no 1º input e houver um 2º
      if (idx === 0 && copy.length >= 2) {
        const valorDigitado = parseFloat(safeValue.replace(",", ".")) || 0;
        const restante = Math.max(0, total - valorDigitado);
        
        if (restante > 0) {
          copy[1].amount = restante.toFixed(2).replace(".", ",");
        } else {
          copy[1].amount = "";
        }
      }
      return copy;
    });
  };

  const addPaymentMisto = () => {
    setPaymentsMisto((prev) => [...prev, { method: "pix", amount: "" }]);
  };

  const removePaymentMisto = (idx: number) => {
    setPaymentsMisto((prev) => prev.filter((_, i) => i !== idx));
  };

  const PAYMENT_LABELS: Record<Payment, string> = {
    dinheiro: "Dinheiro",
    credito: "Crédito",
    debito: "Débito",
    pix: "PIX",
  };

  const finalize = async () => {
    if (!cart.length) return toast.error("Carrinho vazio");
    if (!caixaAberto) return toast.error("Abra o caixa antes de realizar vendas.");
    if (!misto && insufficient) return toast.error("Valor pago insuficiente");
    if (misto && mistoInsuficiente) return toast.error(`Falta ${formatBRL(faltaMisto)} para completar o pagamento`);

    setSubmitting(true);

    // Converte os dados do misto para o formato esperado pelo backend
    const processadosMisto = paymentsMisto
      .map(p => ({
        method: p.method,
        valor: parseFloat(p.amount.replace(",", ".")) || 0
      }))
      .filter(p => p.valor > 0);

    try {
      const res = await sell({
        data: {
          items: cart.map((i) => ({
            product_id: i.product_id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            desconto: i.desconto > 0 ? i.desconto : undefined,
          })),
          payment_method: misto ? "misto" : payment,
          amount_paid: misto ? totalMisto : (payment === "dinheiro" ? paidNum || total : null),
          caixa_id: caixaAberto.id,
          payment_methods: misto ? processadosMisto : undefined,
          desconto_geral: descontoGeralNum > 0 ? descontoGeralNum : undefined,
        },
      });

      // Captura o receipt ANTES de resetar o cart (usado como fallback no erro de NFC-e)
      const built: Receipt = {
        receipt_number: res.receipt_number,
        created_at: res.created_at,
        items: cart.map((i) => ({ ...i, desconto: i.desconto })),
        total: res.total,
        payment_method: misto ? "misto" : payment,
        amount_paid: misto ? totalMisto : (payment === "dinheiro" ? paidNum || total : null),
        change_due: res.change,
        payment_methods: misto ? processadosMisto.map((p) => ({ method: p.method as string, valor: p.valor })) : undefined,
        desconto_geral: descontoGeralNum > 0 ? descontoGeralNum : undefined,
      };

      setCart([]);
      setPaid("");
      setDescontoGeral("");
      setMisto(false);
      setPaymentsMisto([{ method: "dinheiro", amount: "" }, { method: "credito", amount: "" }]);

      if (tipoDocumento === "nfce") {
        toast.success(`Venda #${res.receipt_number} registrada`);
        setNfceState({ fase: "emitindo" });
        try {
          const resultado = await emitirNfceServer({ data: { saleId: res.id } });
          if (resultado.ok) {
            setNfceState({
              fase: "autorizado",
              chave: resultado.chave,
              numero: resultado.numero,
              serie: resultado.serie,
              danfe_url: resultado.danfe_url,
              qrcode_url: resultado.qrcode_url,
              receiptNumber: res.receipt_number,
              saleId: res.id,
            });
          } else {
            setNfceState({
              fase: "erro",
              mensagem_sefaz: resultado.mensagem_sefaz,
              cupomReceipt: built,
              receiptNumber: res.receipt_number,
            });
          }
        } catch (e) {
          setNfceState({
            fase: "erro",
            mensagem_sefaz: (e as Error).message,
            cupomReceipt: built,
            receiptNumber: res.receipt_number,
          });
        }
      } else {
        setPrintPrompt(built);
        toast.success(`Venda #${res.receipt_number} registrada`);
      }
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
        <div className="flex gap-2 flex-wrap">
          {!caixaLoading && caixaAberto && (
            <Button size="sm" variant="outline" onClick={() => setShowSangria(true)}
              className="border-orange-300 text-orange-600 hover:bg-orange-50 h-7 text-xs gap-1">
              <ArrowDownCircle size={13} /> Sangria
            </Button>
          )}
         {!caixaLoading && caixaAberto && (
            <Button size="sm" variant="outline" onClick={() => setShowFechamentoDiario(true)}
              className="border-blue-300 text-blue-600 hover:bg-blue-50 h-7 text-xs gap-1">
              <FileText size={13} /> Fechamento
            </Button>
          )}
          {!caixaLoading && profile?.role === "OWNER" && (
            <Button size="sm" variant="outline" onClick={() => setShowFechamentoMensal(true)}
              className="border-purple-300 text-purple-600 hover:bg-purple-50 h-7 text-xs gap-1">
              <FileText size={13} /> Fechamento Mensal
            </Button>
          )}
          {!caixaLoading && !caixaAberto && (
            <Button size="sm" onClick={() => setShowAbrirCaixa(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs gap-1">
              <Unlock size={13} /> Abrir Caixa
            </Button>
          )}
          {!caixaLoading && caixaAberto && (
            <Button size="sm" variant="outline" onClick={handleFecharCaixaClick}
              className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs gap-1">
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

        {/* Área de produtos */}
        <Card className="p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            {!isUser && categoriaSel && !search && (
              <button onClick={() => setCategoriaSel(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input ref={searchInputRef} autoFocus placeholder="Buscar ou bipar código de barras..."
              value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value) setCategoriaSel(null); }}
              onKeyDown={handleSearchKeyDown} />
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
              <div className="text-center text-muted-foreground py-10 text-sm">Nenhum produto cadastrado.</div>
            ) : isUser ? (
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
                          {it.desconto > 0 && <span className="ml-1 text-orange-600">− {formatBRL(it.desconto)}</span>}
                          {" = "}
                          <span className="font-medium text-foreground">{formatBRL(it.price * it.quantity - it.desconto)}</span>
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
                        <Input className="h-6 text-xs w-24" inputMode="decimal" placeholder="0,00"
                          value={descontoItemInput} onChange={(e) => setDescontoItemInput(e.target.value)}
                          onBlur={() => { const v = parseFloat(descontoItemInput.replace(",", ".")) || 0; setDescontoItem(i, v); setEditandoDescontoIdx(null); }}
                          autoFocus />
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
                <Input className="h-7 text-xs" inputMode="decimal" placeholder="0,00"
                  value={descontoGeral} onChange={(e) => setDescontoGeral(e.target.value)} />
              </div>
            )}

            <div className="space-y-1">
              {totalDesconto > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span><span className="tabular-nums">{formatBRL(subtotalItens)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-orange-600">
                    <span>Desconto total</span><span className="tabular-nums">− {formatBRL(totalDesconto)}</span>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold text-primary tabular-nums">{formatBRL(total)}</span>
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-muted-foreground">Forma de pagamento</div>
                <button
                  onClick={() => { setMisto(!misto); }}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${misto ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <SplitSquareHorizontal size={12} /> Misto
                </button>
              </div>

              {!misto ? (
                <div className="grid grid-cols-4 gap-1">
                  {(["dinheiro", "credito", "debito", "pix"] as Payment[]).map((m) => (
                    <button key={m} onClick={() => setPayment(m)}
                      className={`text-xs font-medium py-2 rounded-md border transition capitalize ${payment === m ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>
                      {PAYMENT_LABELS[m]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 border rounded-lg p-2 bg-muted/20">
                  {paymentsMisto.map((pm, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={pm.method}
                        onChange={(e) => updatePaymentMistoMethod(idx, e.target.value as Payment)}
                        className="border rounded-md px-2 py-1 text-xs bg-background flex-1"
                      >
                        {(["dinheiro", "credito", "debito", "pix"] as Payment[]).map((m) => (
                          <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
                        ))}
                      </select>
                      <Input
                        className="h-7 text-xs w-24"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={pm.amount}
                        onChange={(e) => handleMistoValueChange(idx, e.target.value)}
                      />
                      {paymentsMisto.length > 2 && (
                        <button onClick={() => removePaymentMisto(idx)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addPaymentMisto} className="text-xs text-primary hover:underline">
                    + Adicionar forma
                  </button>
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">Total pago:</span>
                    <span className={`font-bold ${mistoInsuficiente ? "text-destructive" : "text-emerald-600"}`}>
                      {formatBRL(totalMisto)}
                      {mistoInsuficiente && ` (falta ${formatBRL(faltaMisto)})`}
                      {trocoMisto > 0 && ` (troco ${formatBRL(trocoMisto)})`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!misto && payment === "dinheiro" && (
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

            {/* Tipo de Documento */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Tipo de documento</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setTipoDocumento("cupom")}
                  className={`text-xs font-medium py-2 rounded-md border transition ${tipoDocumento === "cupom" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                >
                  Cupom Não Fiscal
                </button>
                {focusNfeConfigurado ? (
                  <button
                    onClick={() => setTipoDocumento("nfce")}
                    className={`text-xs font-medium py-2 rounded-md border transition ${tipoDocumento === "nfce" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                  >
                    Nota Fiscal
                  </button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <button
                            disabled
                            className="w-full text-xs font-medium py-2 rounded-md border bg-muted text-muted-foreground cursor-not-allowed"
                          >
                            Nota Fiscal
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Integração ainda não configurada</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {!caixaAberto && !caixaLoading && (
              <div className="text-xs text-center text-red-600 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
                Abra o caixa para realizar vendas
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={finalize}
              disabled={submitting || !cart.length || (!misto && insufficient) || (misto && totalMisto < total - 0.01) || !caixaAberto}
            >
              {submitting ? "Finalizando..." : tipoDocumento === "nfce" ? "Emitir Nota Fiscal" : "Finalizar venda"}
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
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setWhatsappSend({
                tipo: "cupom",
                receiptNumber: printPrompt!.receipt_number,
                receipt: printPrompt!,
              })}
            >
              <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
              Enviar por WhatsApp
            </Button>
            <AlertDialogCancel onClick={() => setPrintPrompt(null)}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setReceipt(printPrompt); setPrintPrompt(null); }}>Sim, imprimir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showAbrirCaixa && (
        <ModalAbrirCaixa onSuccess={(caixa) => { setCaixaAberto(caixa); setShowAbrirCaixa(false); }} onClose={() => setShowAbrirCaixa(false)} />
      )}

      {showFecharCaixa && resumoCaixa && (
        <ModalFecharCaixa resumo={resumoCaixa}
          onSuccess={() => { setCaixaAberto(null); setShowFecharCaixa(false); setResumoCaixa(null); }}
          onClose={() => setShowFecharCaixa(false)} />
      )}

      {showSangria && caixaAberto && (
        <ModalSangria 
          caixaId={caixaAberto.id}
          // Puxamos diretamente a coluna que guardámos ao abrir o caixa
          nomeOperador={caixaAberto.nome_operador || "Operador não identificado"} 
          onSuccess={(sangria) => { setShowSangria(false); setComprovanteSangria(sangria as SangriaRecibo); }}
          onClose={() => setShowSangria(false)} 
        />
      )}

      {comprovanteSangria && (
        <ComprovanteSangria sangria={comprovanteSangria} onClose={() => setComprovanteSangria(null)} />
      )}

      {showFechamentoDiario && caixaAberto && (
        <FechamentoDiarioDialog caixa={caixaAberto} onClose={() => setShowFechamentoDiario(false)} />
      )}

      {showFechamentoMensal && (
        <FechamentoMensalDialog onClose={() => setShowFechamentoMensal(false)} />
      )}

      {/* Diálogo de emissão / resultado da NFC-e */}
      <AlertDialog
        open={nfceState !== null}
        onOpenChange={(open) => {
          // Não fecha enquanto estiver emitindo
          if (!open && nfceState?.fase !== "emitindo") setNfceState(null);
        }}
      >
        <AlertDialogContent>
          {nfceState?.fase === "emitindo" && (
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Emitindo nota fiscal...
              </AlertDialogTitle>
              <AlertDialogDescription>
                Comunicando com a SEFAZ via Focus NFe. Aguarde — isso pode levar alguns segundos.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}

          {nfceState?.fase === "autorizado" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  NFC-e emitida com sucesso!
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-1.5 text-sm">
                    <p>
                      <span className="font-medium">Venda #{nfceState.receiptNumber}</span>
                      {" · "}NF nº {nfceState.numero}
                      {nfceState.numero && nfceState.serie ? ` · Série ${nfceState.serie}` : ""}
                    </p>
                    {nfceState.chave && (
                      <p className="text-xs text-muted-foreground break-all font-mono">
                        Chave: {nfceState.chave}
                      </p>
                    )}
                    {nfceState.qrcode_url && (
                      <p className="text-xs text-muted-foreground">
                        QR Code disponível no DANFCe.
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setWhatsappSend({
                      tipo: "nfce",
                      receiptNumber: nfceState.receiptNumber,
                      danfe_url: nfceState.danfe_url,
                    });
                    setNfceState(null);
                  }}
                >
                  <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
                  Enviar por WhatsApp
                </Button>
                {nfceState.saleId && (
                  <AlertDialogAction asChild>
                    <a href={`/api/danfe/${nfceState.saleId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                      <ExternalLink className="h-4 w-4" />
                      Ver DANFCe / Imprimir
                    </a>
                  </AlertDialogAction>
                )}
                <AlertDialogAction onClick={() => setNfceState(null)}>Fechar</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {nfceState?.fase === "erro" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Erro na emissão da NFC-e
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-destructive">{nfceState.mensagem_sefaz}</p>
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      A <span className="font-semibold">Venda #{nfceState.receiptNumber} já foi registrada</span> e não será perdida.
                      Você pode imprimir o cupom não fiscal enquanto o problema é resolvido.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setNfceState(null)}>Fechar</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  setReceipt(nfceState.cupomReceipt);
                  setNfceState(null);
                }}>
                  Imprimir Cupom Não Fiscal
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <WhatsappSendDialog
        open={!!whatsappSend}
        onClose={() => setWhatsappSend(null)}
        tipo={whatsappSend?.tipo ?? "cupom"}
        receiptNumber={whatsappSend?.receiptNumber ?? 0}
        danfe_url={whatsappSend?.danfe_url}
        receipt={whatsappSend?.receipt}
      />
    </div>
  );
}