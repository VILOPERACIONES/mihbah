import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore, type EmpresaFiltro } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { Menu, MessageCircle, Upload } from "lucide-react";
import { ModalExcelUpload } from "@/components/movimientos/ModalExcelUpload";

const ALL_EMPRESAS: EmpresaFiltro[] = ["TODAS", "BM CORP", "MIHBAH", "YCDI"];

export function Topbar() {
  const { empresaActiva, setEmpresaActiva, setSidebarOpen, setChatOpen } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  const allowedEmpresas = user?.empresas.includes("*")
    ? ALL_EMPRESAS
    : ["TODAS" as EmpresaFiltro, ...(user?.empresas ?? []) as EmpresaFiltro[]];

  // Check if user has admin/super_admin role for upload permission
  const canUpload = user?.role === "SUPER_ADMIN" || user?.role === "SUPER_ADMIN_DEV" || user?.role === "ADMIN";

  return (
    <>
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

        {/* Upload Excel button */}
        {canUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            title="Importar Excel"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden md:inline">Importar</span>
          </button>
        )}

        {/* Mobile chat toggle */}
        <button onClick={() => setChatOpen(true)} className="xl:hidden text-muted-foreground hover:text-foreground">
          <MessageCircle className="h-5 w-5" />
        </button>
      </header>

      {/* Excel upload modal */}
      <ModalExcelUpload
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onDone={() => {
          setShowUpload(false);
          navigate("/dashboard");
        }}
      />
    </>
  );
}
