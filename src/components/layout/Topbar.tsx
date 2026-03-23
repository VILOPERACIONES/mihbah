import { cn } from "@/lib/utils";
import { useAppStore, type EmpresaFiltro } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { Menu, MessageCircle } from "lucide-react";

const ALL_EMPRESAS: EmpresaFiltro[] = ["TODAS", "BM CORP", "MIHBAH", "YCDI"];

export function Topbar() {
  const { empresaActiva, setEmpresaActiva, setSidebarOpen, setChatOpen } = useAppStore();
  const { user } = useAuth();

  const allowedEmpresas = user?.empresas.includes("*")
    ? ALL_EMPRESAS
    : ["TODAS" as EmpresaFiltro, ...(user?.empresas ?? []) as EmpresaFiltro[]];

  return (
    <header className="h-[var(--topbar-height)] flex items-center px-3 md:px-4 gap-2 md:gap-4 border-b border-border shrink-0 bg-[hsl(var(--bg-surface))]">
      {/* Mobile menu button */}
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>

      {/* Empresa selector */}
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

      {/* Mobile chat toggle */}
      <button onClick={() => setChatOpen(true)} className="xl:hidden text-muted-foreground hover:text-foreground">
        <MessageCircle className="h-5 w-5" />
      </button>
    </header>
  );
}
