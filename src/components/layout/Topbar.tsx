import { cn } from "@/lib/utils";
import { useAppStore, type EmpresaFiltro } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ALL_EMPRESAS: EmpresaFiltro[] = ["TODAS", "BM CORP", "MIHBAH", "YCDI"];

export function Topbar() {
  const { empresaActiva, setEmpresaActiva } = useAppStore();
  const { user, signOut } = useAuth();

  const allowedEmpresas = user?.empresas.includes("*")
    ? ALL_EMPRESAS
    : ["TODAS" as EmpresaFiltro, ...(user?.empresas ?? []) as EmpresaFiltro[]];

  return (
    <header
      className="h-[var(--topbar-height)] flex items-center px-4 gap-4 border-b border-border"
      style={{ background: "hsl(var(--bg-surface))" }}
    >
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">SF</span>
        </div>
        <span className="font-semibold text-sm text-foreground">SIG Financiero</span>
      </div>

      <div className="w-px h-6 bg-border" />

      <div className="flex items-center gap-1">
        {allowedEmpresas.map((emp) => (
          <button
            key={emp}
            onClick={() => setEmpresaActiva(emp)}
            className={cn(
              "px-3 py-1 rounded-md text-sm font-medium transition-colors",
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
        <div className="flex items-center gap-3">
          <div className="text-right">
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
    </header>
  );
}
