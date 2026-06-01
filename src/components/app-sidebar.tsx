import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart, Package, Receipt, Wallet, ArrowDownCircle, ArrowUpCircle,
  BarChart3, Users, ListTree, Settings, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

const groups = [
  {
    label: "Operacional",
    items: [
      { title: "PDV", url: "/pdv", icon: ShoppingCart },
      { title: "Vendas", url: "/vendas", icon: Receipt },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Contas a pagar", url: "/financeiro/pagar", icon: ArrowUpCircle },
      { title: "Contas a receber", url: "/financeiro/receber", icon: ArrowDownCircle },
      { title: "Balancete", url: "/financeiro/balancete", icon: BarChart3 },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Usuários", url: "/config/usuarios", icon: Users },
      { title: "Plano de contas", url: "/config/plano-contas", icon: ListTree },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu.");
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <img src={logo} alt="Buratin" className="h-9 w-9 rounded-md object-contain bg-white/10 p-0.5" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">BURATIN</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-primary">Outlet</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
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

      <SidebarFooter className="border-t border-sidebar-border">
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
