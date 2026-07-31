import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart, Package, Receipt, Wallet, ArrowDownCircle, ArrowUpCircle,
  BarChart3, Users, ListTree, LogOut, History, Building2, Palette, Plug2, MessageCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-gtech-sem-fundo.png";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { temAcesso, isOwner, type Modulo } from "@/lib/auth";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  modulo: Modulo;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Operacional",
    items: [
      { title: "PDV", url: "/pdv", icon: ShoppingCart, modulo: "pdv" },
      { title: "Histórico de Vendas", url: "/historico-vendas", icon: History, modulo: "historico_vendas" },
      { title: "Vendas", url: "/vendas", icon: Receipt, modulo: "vendas" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package, modulo: "produtos" },
      { title: "Fornecedores", url: "/cadastros/fornecedores", icon: Building2, modulo: "fornecedores" },
      { title: "Clientes", url: "/cadastros/clientes", icon: Users, modulo: "clientes" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Contas a pagar", url: "/financeiro/pagar", icon: ArrowUpCircle, modulo: "financeiro" },
      { title: "Contas a receber", url: "/financeiro/receber", icon: ArrowDownCircle, modulo: "financeiro" },
      { title: "Balancete", url: "/financeiro/balancete", icon: BarChart3, modulo: "financeiro" },
      { title: "Dashboard", url: "/financeiro/dashboard", icon: Wallet, modulo: "financeiro" },
      { title: "Relatórios de Caixa", url: "/financeiro/relatorios-caixa", icon: BarChart3, modulo: "financeiro" },
      { title: "Curva ABC", url: "/financeiro/curva-abc", icon: BarChart3, modulo: "financeiro" },
    ],
  },
  {
    label: "Personalização",
    items: [
      { title: "Templates", url: "/templates", icon: Palette, modulo: "templates" },
    ],
  },
  {
    label: "Integrações",
    items: [
      { title: "Banco Inter", url: "/integracoes/banco-inter", icon: Plug2, modulo: "integracoes" },
      { title: "WhatsApp", url: "/integracoes/whatsapp", icon: MessageCircle, modulo: "integracoes" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Usuários", url: "/config/usuarios", icon: Users, modulo: "configuracoes" },
      { title: "Plano de contas", url: "/config/plano-contas", icon: ListTree, modulo: "configuracoes" },
      { title: "Operadores", url: "/config/operadores", icon: Users, modulo: "configuracoes" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");
  const { profile } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu.");
    navigate({ to: "/login" });
  };

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => temAcesso(profile, item.modulo)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border" style={{ background: "linear-gradient(180deg, oklch(0.22 0.14 255) 0%, oklch(0.17 0.1 250) 100%)" }}>
        <div className="flex items-center gap-2 px-2 py-2">
          <img src={logo} alt="PDVGtech" className="h-9 w-9 rounded-md object-contain bg-white/10 p-0.5" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">PDVGtech</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-primary">Sistema</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar shrink-0">
        {profile && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 border-b border-sidebar-border mb-1 bg-sidebar">
            <p className="font-medium text-sidebar-foreground truncate">{profile.full_name ?? "Usuário"}</p>
            <p className="capitalize">{profile.role === "OWNER" ? "Administrador" : profile.role === "MANAGER" ? "Gerente" : "Usuário"}</p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}