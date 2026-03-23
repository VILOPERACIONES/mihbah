import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  Hammer,
  Landmark,
  ClipboardList,
  Settings,
} from "lucide-react";
import logoJade from "@/assets/logo-jade.png";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/movimientos", label: "Movimientos", icon: ArrowUpDown },
  { to: "/flujo", label: "Flujo de Caja", icon: TrendingUp },
  { to: "/proyectos", label: "Proyectos", icon: Hammer },
  { to: "/cuentas", label: "Cuentas", icon: Landmark },
  { to: "/reportes", label: "Reportes", icon: ClipboardList },
];

const ADMIN_ITEMS = [
  { to: "/admin", label: "Administración", icon: Settings },
];

export function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.rol === "SUPER_ADMIN" || user?.rol === "ADMIN";

  return (
    <aside
      className="w-[var(--sidebar-width)] h-full flex flex-col border-r border-border"
      style={{ background: "hsl(var(--bg-surface))" }}
    >
      {/* Logo header */}
      <div className="px-4 py-4 flex items-center gap-2.5">
        <img src={logoJade} alt="Jade" className="h-7 w-7 rounded-md object-contain" />
        <span className="font-semibold text-sm text-foreground tracking-tight">Jade</span>
      </div>

      <nav className="flex-1 py-2 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              )}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {isAdmin && (
          <>
            <div className="h-px bg-border my-3" />
            {ADMIN_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card"
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                  )}
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {user && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">
                {user.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.nombre}</p>
              <p className="text-xs text-muted-foreground">{user.rol}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
