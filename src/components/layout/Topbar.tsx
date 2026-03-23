import { cn } from "@/lib/utils";
import { useAppStore, type EmpresaFiltro } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Menu, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoJade from "@/assets/logo-jade.png";

const ALL_EMPRESAS: EmpresaFiltro[] = ["TODAS", "BM CORP", "MIHBAH", "YCDI"];

export function Topbar() {
  const { empresaActiva, setEmpresaActiva, setSidebarOpen, setChatOpen } = useAppStore();
  const { user, signOut } = useAuth();

  const allowedEmpresas = user?.empresas.includes("*")
    ? ALL_EMPRESAS
    : ["TODAS" as EmpresaFiltro, ...(user?.empresas ?? []) as EmpresaFiltro[]];

  return (
    <header className="h-[var(--topbar-height)] flex items-center px-3 md:px-4 gap-2 md:gap-4 border-b border-border shrink-0 bg-[hsl(var(--bg-surface))]">
      {/* Mobile menu button */}
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2">
        <img src={logoJade} alt="Jade" className="h-7 w-7 rounded-lg object-contain" />
        <span className="font-semibold text-sm text-foreground tracking-tight hidden sm:inline">Jade</span>
      </div>

      <div className="w-px h-6 bg-border hidden sm:block" />

      {/* Empresa selector — scrollable on mobile */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {allowedEmpresas.map((emp) => (
          <button
            key={emp}
            onClick={() => setEmpresaActiva(emp)}
            className={cn(
              "px-2.5 md:px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
              empresaActiva === emp
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-card"
            )}
          >
            {emp}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-foreground">{user.nombre}</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {user.rol}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Mobile chat toggle */}
      <button onClick={() => setChatOpen(true)} className="xl:hidden text-muted-foreground hover:text-foreground">
        <MessageCircle className="h-5 w-5" />
      </button>
    </header>
  );
}
