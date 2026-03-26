import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

export function Topbar() {
  const { empresaActiva, setEmpresaActiva, setSidebarOpen, chatOpen, setChatOpen } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresas, setEmpresas] = useState<string[]>([]);

  useEffect(() => {
    async function loadEmpresas() {
      const { data } = await supabase
        .from("movimientos")
        .select("empresa")
        .eq("activo", true);
      if (data) {
        const unique = [...new Set(data.map((m) => m.empresa))].sort();
        setEmpresas(unique);
      }
    }
    loadEmpresas();
  }, []);

  const allowedEmpresas = user?.empresas.includes("*")
    ? empresas
    : empresas.filter((e) => user?.empresas.includes(e));

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
                <CommandEmpty>No se encontro empresa.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="TODAS"
                    onSelect={() => { setEmpresaActiva("TODAS"); setEmpresaOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", empresaActiva === "TODAS" ? "opacity-100" : "opacity-0")} />
                    Todas las empresas
                  </CommandItem>
                  {allowedEmpresas.map((emp) => (
                    <CommandItem
                      key={emp}
                      value={emp}
                      onSelect={() => { setEmpresaActiva(emp); setEmpresaOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5", empresaActiva === emp ? "opacity-100" : "opacity-0")} />
                      {emp}
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

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            chatOpen
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-card"
          )}
          title={chatOpen ? "Ocultar chat" : "Mostrar chat"}
          aria-label={chatOpen ? "Ocultar chat" : "Mostrar chat"}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden md:inline">Chat</span>
        </button>
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
