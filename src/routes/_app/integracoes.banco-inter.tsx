import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  AlertCircle, CheckCircle2, ChevronRight, Copy, Eye, EyeOff,
  FileKey2, KeyRound, Link2, Plug2, RefreshCw, Save, Settings2,
  ShieldCheck, Wallet, Wifi, WifiOff, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getInterConfig,
  saveInterConfig,
  testInterConnection,
  type BancoInterConfig,
} from "@/lib/integracoes.functions";

export const Route = createFileRoute("/_app/integracoes/banco-inter")({
  component: BancoInterPage,
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

const EMPTY_CONFIG: BancoInterConfig = {
  ambiente:          "SANDBOX",
  client_id:         "",
  client_secret:     "",
  certificado_pem:   "",
  chave_privada_pem: "",
  conta_corrente:    "",
  webhook_url:       "",
  servicos: { pix: true, cobranca: true, extrato: false, saldo: false },
};

function BancoInterPage() {
  const loadFn  = useServerFn(getInterConfig);
  const saveFn  = useServerFn(saveInterConfig);
  const testFn  = useServerFn(testInterConnection);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integracoes", "banco_inter"],
    queryFn:  () => loadFn(),
  });

  const [ativo,  setAtivo]  = useState(false);
  const [cfg,    setCfg]    = useState<BancoInterConfig>(EMPTY_CONFIG);
  const [dirty,  setDirty]  = useState(false);
  const [tested, setTested] = useState<"none" | "ok" | "fail">("none");

  useEffect(() => {
    if (data) {
      setAtivo(data.ativo);
      setCfg(data.config);
    }
  }, [data]);

  function patch<K extends keyof BancoInterConfig>(key: K, value: BancoInterConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setTested("none");
  }

  function patchServico(key: keyof BancoInterConfig["servicos"], value: boolean) {
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
    cfg.client_id.trim() &&
    cfg.client_secret.trim() &&
    cfg.certificado_pem.trim() &&
    cfg.chave_privada_pem.trim() &&
    cfg.conta_corrente.trim();

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
        <span className="font-medium text-foreground">Banco Inter</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Logo Inter — laranja */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md text-2xl"
            style={{ background: "linear-gradient(135deg, #e87722 0%, #ff6b00 100%)" }}>
            🏦
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">Banco Inter</h1>
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
              API Banco Inter v2 · OAuth 2.0 com mTLS
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

      {/* Alerta de ambiente */}
      {cfg.ambiente === "PRODUCAO" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Ambiente de Produção.</strong> As operações realizadas geram cobranças e transações reais. Certifique-se de que todas as configurações estão corretas.
          </p>
        </div>
      )}

      {/* ── Seção 1: Ambiente ─────────────────────────────────────────────── */}
      <SectionCard
        icon={Settings2}
        title="Ambiente"
        description="Escolha entre Sandbox (testes) e Produção (operações reais)."
      >
        <div className="flex gap-3">
          {(["SANDBOX", "PRODUCAO"] as const).map((env) => (
            <button
              key={env}
              onClick={() => patch("ambiente", env)}
              className={`
                flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 px-3
                text-sm font-semibold transition-all duration-150
                ${cfg.ambiente === env
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/30"}
              `}
            >
              {env === "SANDBOX" ? (
                <><Plug2 className="h-5 w-5" /> Sandbox<span className="text-xs font-normal">Para testes</span></>
              ) : (
                <><Zap className="h-5 w-5" /> Produção<span className="text-xs font-normal">Operações reais</span></>
              )}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Seção 2: Credenciais OAuth ────────────────────────────────────── */}
      <SectionCard
        icon={KeyRound}
        title="Credenciais OAuth 2.0"
        description="Client ID e Secret obtidos no Portal do Desenvolvedor do Banco Inter."
      >
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/50 dark:bg-blue-950/30">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Acesse <strong>developers.inter.co</strong> → Aplicações → crie ou selecione seu app para obter o Client ID e Client Secret.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Client ID *</Label>
            <Input
              value={cfg.client_id}
              onChange={(e) => patch("client_id", e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="font-mono text-sm"
            />
          </div>

          <SecretInput
            label="Client Secret *"
            value={cfg.client_secret}
            onChange={(v) => patch("client_secret", v)}
            placeholder="••••••••••••••••••••••••"
          />
        </div>
      </SectionCard>

      {/* ── Seção 3: Certificado mTLS ─────────────────────────────────────── */}
      <SectionCard
        icon={ShieldCheck}
        title="Certificado mTLS"
        description="A API do Banco Inter exige autenticação mútua com certificado digital."
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30 space-y-1.5">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Como obter o certificado:</p>
          <ol className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5 list-decimal list-inside">
            <li>Acesse o Portal do Desenvolvedor do Banco Inter</li>
            <li>Vá em <strong>Meus Certificados</strong> e gere um novo par</li>
            <li>Baixe os arquivos <code className="bg-amber-100 px-1 rounded">.crt</code> (certificado) e <code className="bg-amber-100 px-1 rounded">.key</code> (chave privada)</li>
            <li>Cole o conteúdo completo de cada arquivo nos campos abaixo</li>
          </ol>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FileKey2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-sm font-medium">Certificado (.crt) *</Label>
          </div>
          <Textarea
            value={cfg.certificado_pem}
            onChange={(e) => patch("certificado_pem", e.target.value)}
            placeholder={"-----BEGIN CERTIFICATE-----\nMIIxxxxx...\n-----END CERTIFICATE-----"}
            rows={5}
            className="font-mono text-xs resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-sm font-medium">Chave Privada (.key) *</Label>
          </div>
          <Textarea
            value={cfg.chave_privada_pem}
            onChange={(e) => patch("chave_privada_pem", e.target.value)}
            placeholder={"-----BEGIN PRIVATE KEY-----\nMIIxxxxx...\n-----END PRIVATE KEY-----"}
            rows={5}
            className="font-mono text-xs resize-none"
          />
          <p className="text-xs text-muted-foreground">
            A chave privada nunca é compartilhada com terceiros e fica armazenada de forma segura.
          </p>
        </div>
      </SectionCard>

      {/* ── Seção 4: Dados da Conta ───────────────────────────────────────── */}
      <SectionCard
        icon={Wallet}
        title="Dados da Conta"
        description="Número da conta corrente associada às operações desta integração."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Conta Corrente *</Label>
            <Input
              value={cfg.conta_corrente}
              onChange={(e) => patch("conta_corrente", e.target.value.replace(/\D/g, ""))}
              placeholder="12345678"
              maxLength={12}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Somente dígitos, sem traço ou dígito verificador.</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Seção 5: Webhook ──────────────────────────────────────────────── */}
      <SectionCard
        icon={Link2}
        title="Webhook de Notificações"
        description="URL que o Banco Inter chamará para notificar eventos (Pix recebido, boleto pago, etc.)."
      >
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">URL do Webhook</Label>
          <div className="flex gap-2">
            <Input
              value={cfg.webhook_url}
              onChange={(e) => patch("webhook_url", e.target.value)}
              placeholder="https://seudominio.com/api/inter/webhook"
              className="font-mono text-sm"
            />
            {cfg.webhook_url && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { navigator.clipboard.writeText(cfg.webhook_url); toast.success("URL copiada!"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe em branco se não quiser receber notificações automáticas. O endpoint deve aceitar POST com JSON assinado pelo Inter.
          </p>
        </div>
      </SectionCard>

      {/* ── Seção 6: Serviços ─────────────────────────────────────────────── */}
      <SectionCard
        icon={Plug2}
        title="Serviços Habilitados"
        description="Selecione quais funcionalidades da API do Banco Inter serão utilizadas."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "pix",      label: "Pix",       desc: "Gerar cobranças e receber via Pix",      emoji: "⚡" },
              { key: "cobranca", label: "Cobranças",  desc: "Emitir boletos e links de pagamento",   emoji: "📄" },
              { key: "extrato",  label: "Extrato",    desc: "Consultar lançamentos e histórico",     emoji: "📊" },
              { key: "saldo",    label: "Saldo",      desc: "Verificar saldo disponível em conta",   emoji: "💰" },
            ] as const
          ).map(({ key, label, desc, emoji }) => (
            <label
              key={key}
              className={`
                flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all duration-150
                ${cfg.servicos[key]
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background hover:border-primary/20"}
              `}
            >
              <Switch
                checked={cfg.servicos[key]}
                onCheckedChange={(v) => patchServico(key, v)}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">{emoji} {label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>
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
            disabled={testMut.isPending || !cfg.client_id || !cfg.client_secret}
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
