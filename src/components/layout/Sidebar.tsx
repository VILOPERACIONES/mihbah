import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/app.store";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  Hammer,
  Landmark,
  ClipboardList,
  Settings,
  X,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  FileSpreadsheet,
} from "lucide-react";
import logoJade from "@/assets/logo-jade.png";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useModuleAccess } from "@/hooks/useModuleAccess";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/movimientos", label: "Movimientos", icon: ArrowUpDown, module: "movimientos" },
  { to: "/cargas", label: "Cargas Excel", icon: FileSpreadsheet, module: "movimientos" },
  { to: "/flujo", label: "Flujo de Caja", icon: TrendingUp, module: "flujo" },
  { to: "/proyectos", label: "Proyectos", icon: Hammer, module: "proyectos" },
  { to: "/cuentas", label: "Cuentas", icon: Landmark, module: "cuentas" },
  { to: "/reportes", label: "Reportes", icon: ClipboardList, module: "reportes" },
];

const ADMIN_ITEMS = [
  { to: "/admin", label: "Administración", icon: Settings, module: "admin" },
];

interface SidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
}

export function AppSidebar({ onClose, collapsed = false }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { allowedModules } = useModuleAccess();
  const location = useLocation();

  const filteredNavItems = NAV_ITEMS.filter((item) => allowedModules.includes(item.module as any));
  const filteredAdminItems = ADMIN_ITEMS.filter((item) => allowedModules.includes(item.module as any));

  // On mobile overlay, never use collapsed mode
  const isCollapsed = onClose ? false : (collapsed || sidebarCollapsed);

  function NavItem({ item }: { item: typeof NAV_ITEMS[0] }) {
    const active = location.pathname === item.to;
    const link = (
      <NavLink
        to={item.to}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative",
          isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
          active
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-card"
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
        )}
        <item.icon className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span>{item.label}</span>}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Logo header */}
      <div className={cn("flex items-center shrink-0 border-b border-border", isCollapsed ? "justify-center px-2 py-4" : "px-4 py-4 gap-2.5")}>
        <img src={logoJade} alt="Jade" className="h-7 w-7 rounded-md object-contain" />
        {!isCollapsed && (
          <span className="font-semibold text-sm text-foreground tracking-tight">Jade</span>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 py-3 space-y-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
        {filteredNavItems.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}

        {filteredAdminItems.length > 0 && (
          <>
            <div className="h-px bg-border my-3" />
            {filteredAdminItems.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom: collapse toggle + user + logout */}
      <div className="border-t border-border shrink-0">
        {/* Collapse button — desktop only */}
        {!onClose && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-card transition-colors text-xs",
              isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
            )}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!isCollapsed && <span>Colapsar</span>}
          </button>
        )}

        {user && (
          <div className={cn("border-t border-border", isCollapsed ? "px-2 py-3" : "px-4 py-3")}>
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {user.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{user.nombre}</p>
                  <p className="text-xs text-muted-foreground">{user.rol}</p>
                </div>
              )}
              {!isCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">Cerrar sesión</TooltipContent>
                </Tooltip>
              )}
            </div>
            {isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={signOut} className="mt-2 w-full flex justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Cerrar sesión</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
