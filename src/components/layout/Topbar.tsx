import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { Menu, MessageCircle, Upload, ChevronsUpDown, Check, Building2 } from "lucide-react";
import { ModalExcelUpload } from "@/components/movimientos/ModalExcelUpload";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface EmpresaOption {
  id: string;
  nombre: string;
}

export function Topbar() {
  const { empresaActiva, setEmpresaActiva, setSidebarOpen, chatOpen, setChatOpen } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);

  useEffect(() => {
    async function loadEmpresas() {
      try {
        const res = await fetch("/api/empresas", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setEmpresas(data.empresas ?? []);
        }
      } catch {}
    }
    loadEmpresas();
  }, [user]);

  const canUpload = user?.rol === "SUPER_ADMIN" || user?.rol === "SUPER_ADMIN_DEV" || user?.rol === "ADMIN";
  const displayLabel = empresaActiva === "TODAS" ? "Todas las empresas" : empresaActiva;

  return (
    <>
      <header className="h-[var(--topbar-height)] flex items-center px-3 md:px-4 gap-2 md:gap-4 border-b border-border shrink-0 bg-[hsl(var(--bg-surface))]">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>

        <Popover open={empresaOpen} onOpenChange={setEmpresaOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors text-sm min-w-[160px] max-w-[240px]"
              aria-expanded={empresaOpen}
            >
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate flex-1 text-left font-medium text-foreground">{displayLabel}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar empresa..." className="h-9" />
              <CommandList>
                <CommandEmpty>No se encontró empresa.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="TODAS"
                    onSelect={() => { setEmpresaActiva("TODAS"); setEmpresaOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", empresaActiva === "TODAS" ? "opacity-100" : "opacity-0")} />
                    Todas las empresas
                  </CommandItem>
                  {empresas.map((emp) => (
                    <CommandItem
                      key={emp.id}
                      value={emp.nombre}
                      onSelect={() => { setEmpresaActiva(emp.nombre); setEmpresaOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5", empresaActiva === emp.nombre ? "opacity-100" : "opacity-0")} />
                      {emp.nombre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

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

        {/* Chat button hidden until AI module is ready */}
      </header>

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
