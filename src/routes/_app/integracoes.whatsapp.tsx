import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  AlertCircle, CheckCircle2, ChevronRight, Eye, EyeOff,
  KeyRound, MessageCircle, Plug2, RefreshCw, Save, Settings2,
  Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  getWhatsappConfig,
  saveWhatsappConfig,
  testWhatsappConnection,
  type WhatsappConfig,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_app/integracoes/whatsapp")({
  component: WhatsappPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SecretInput({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({
  icon: Icon, title, description, children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-start gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_CONFIG: WhatsappConfig = {
  provedor:        "cloud_api",
  phone_number_id: "",
  access_token:    "",
  numero_whatsapp: "",
  servicos: { comprovante_cupom: true, comprovante_nfce: true, alertas_internos: false },
};

function WhatsappPage() {
  const loadFn = useServerFn(getWhatsappConfig);
  const saveFn = useServerFn(saveWhatsappConfig);
  const testFn = useServerFn(testWhatsappConnection);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integracoes", "whatsapp"],
    queryFn:  () => loadFn(),
  });

  const [ativo,  setAtivo]  = useState(false);
  const [cfg,    setCfg]    = useState<WhatsappConfig>(EMPTY_CONFIG);
  const [dirty,  setDirty]  = useState(false);
  const [tested, setTested] = useState<"none" | "ok" | "fail">("none");

  useEffect(() => {
    if (data) {
      setAtivo(data.ativo);
      setCfg(data.config);
    }
  }, [data]);

  function patch<K extends keyof WhatsappConfig>(key: K, value: WhatsappConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setTested("none");
  }

  function patchServico(key: keyof WhatsappConfig["servicos"], value: boolean) {
    setCfg((prev) => ({ ...prev, servicos: { ...prev.servicos, [key]: value } }));
    setDirty(true);
  }

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { ativo, config: cfg } }),
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
      setDirty(false);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => testFn({ data: cfg }),
    onSuccess: (res) => {
      setTested("ok");
      toast.success(res.message);
    },
    onError: (e: Error) => {
      setTested("fail");
      toast.error(e.message);
    },
  });

  const isConfigured =
    cfg.phone_number_id.trim() &&
    cfg.access_token.trim() &&
    cfg.numero_whatsapp.trim();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Integrações</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">WhatsApp Business</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md text-2xl"
            style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
          >
            💬
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">WhatsApp Business</h1>
              {isConfigured ? (
                <Badge variant="default" className="gap-1 bg-emerald-500 hover:bg-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> Configurado
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Não configurado
                </Badge>
              )}
              {tested === "ok" && (
                <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500">
                  <Wifi className="h-3 w-3" /> Validado
                </Badge>
              )}
              {tested === "fail" && (
                <Badge variant="destructive" className="gap-1">
                  <WifiOff className="h-3 w-3" /> Falhou
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Meta Cloud API · WhatsApp Business Platform
            </p>
          </div>
        </div>

        {/* Ativar integração */}
        <div className="flex items-center gap-2.5 rounded-xl border bg-card px-4 py-3">
          <Label htmlFor="sw-ativo" className="text-sm font-medium cursor-pointer">
            {ativo ? "Integração ativa" : "Integração inativa"}
          </Label>
          <Switch
            id="sw-ativo"
            checked={ativo}
            onCheckedChange={(v) => { setAtivo(v); setDirty(true); }}
          />
        </div>
      </div>

      {/* ── Seção 1: Provedor ─────────────────────────────────────────────── */}
      <SectionCard
        icon={Settings2}
        title="Provedor"
        description="Protocolo de envio utilizado para disparar mensagens."
      >
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 px-3 text-sm font-semibold border-primary bg-primary/5 text-primary select-none">
            <MessageCircle className="h-5 w-5" />
            Cloud API (Meta)
            <span className="text-xs font-normal">WhatsApp Business Platform</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 px-3 text-sm font-semibold border-border bg-background text-muted-foreground opacity-50 cursor-not-allowed">
            <Plug2 className="h-5 w-5" />
            Outros
            <span className="text-xs font-normal">Em breve</span>
          </div>
        </div>
      </SectionCard>

      {/* ── Seção 2: Credenciais ──────────────────────────────────────────── */}
      <SectionCard
        icon={KeyRound}
        title="Credenciais da API"
        description="Dados obtidos no painel de desenvolvedores da Meta."
      >
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/50 dark:bg-blue-950/30">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Acesse <strong>developers.facebook.com</strong> → Meus Aplicativos → Selecione ou crie um app do tipo "Business" → WhatsApp → Configuração da API para obter as credenciais abaixo.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Phone Number ID *</Label>
          <Input
            value={cfg.phone_number_id}
            onChange={(e) => patch("phone_number_id", e.target.value)}
            placeholder="1234567890"
            className="font-mono text-sm"
          />
        </div>

        <SecretInput
          label="Access Token *"
          value={cfg.access_token}
          onChange={(v) => patch("access_token", v)}
          placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          hint="Token de acesso permanente ou temporário da API do WhatsApp Business."
        />

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Número do WhatsApp (com DDI) *</Label>
          <Input
            value={cfg.numero_whatsapp}
            onChange={(e) => patch("numero_whatsapp", e.target.value.replace(/\D/g, ""))}
            placeholder="5511999998888"
            className="font-mono text-sm"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground">
            Somente dígitos, com DDI (55 para Brasil). Ex: 5511999998888
          </p>
        </div>
      </SectionCard>

      {/* ── Seção 3: Serviços ─────────────────────────────────────────────── */}
      <SectionCard
        icon={Plug2}
        title="Serviços Habilitados"
        description="Selecione quais funcionalidades de envio via WhatsApp serão utilizadas."
      >
        <TooltipProvider>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Comprovante Cupom */}
            <label
              className={`
                flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all duration-150
                ${cfg.servicos.comprovante_cupom
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background hover:border-primary/20"}
              `}
            >
              <Switch
                checked={cfg.servicos.comprovante_cupom}
                onCheckedChange={(v) => patchServico("comprovante_cupom", v)}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">💬 Comprovante (Cupom)</p>
                <p className="text-xs text-muted-foreground">Enviar cupom não fiscal por WhatsApp ao finalizar venda</p>
              </div>
            </label>

            {/* Comprovante NFC-e */}
            <label
              className={`
                flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all duration-150
                ${cfg.servicos.comprovante_nfce
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background hover:border-primary/20"}
              `}
            >
              <Switch
                checked={cfg.servicos.comprovante_nfce}
                onCheckedChange={(v) => patchServico("comprovante_nfce", v)}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">📄 Comprovante (NFC-e)</p>
                <p className="text-xs text-muted-foreground">Enviar link do DANFCe ao emitir nota fiscal</p>
              </div>
            </label>

            {/* Alertas internos — em breve */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-start gap-3 rounded-xl border-2 p-4 border-border bg-background opacity-60 cursor-not-allowed">
                  <Switch checked={false} disabled className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">🔔 Alertas internos</p>
                    <p className="text-xs text-muted-foreground">Notificações de fechamento de caixa e contas vencendo</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Em breve</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </SectionCard>

      {/* ── Footer: ações ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Há alterações não salvas." : "Tudo salvo."}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !cfg.phone_number_id || !cfg.access_token || !cfg.numero_whatsapp}
            className="gap-2"
          >
            {testMut.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            Testar Conexão
          </Button>

          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !dirty}
            className="gap-2"
          >
            {saveMut.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configuração
          </Button>
        </div>
      </div>
    </div>
  );
}
