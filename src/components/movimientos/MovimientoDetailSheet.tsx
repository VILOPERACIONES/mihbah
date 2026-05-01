import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TipoChip } from "@/components/shared/TipoChip";
import { MontoDisplay } from "@/components/shared/MontoDisplay";
import { Calendar, Building2, Tag, Layers, FileText, Wallet, FolderKanban, MessageSquare, Clock, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface MovimientoFull {
  id: string;
  fecha: string;
  empresa: string | null;
  tipo: string;
  monto: number;
  concepto: string;
  categoria: string | null;
  grupo: string | null;
  nombre: string | null;
  cuenta: string | null;
  proyecto: string | null;
  comentario: string | null;
  fuente: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  movimientoId: string | null;
  open: boolean;
  onClose: () => void;
}

function DetailRow({ icon: Icon, label, value, className }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-muted/50">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className={cn("text-sm mt-0.5", className)}>{value}</div>
      </div>
    </div>
  );
}

export function MovimientoDetailSheet({ movimientoId, open, onClose }: Props) {
  const [mov, setMov] = useState<MovimientoFull | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!movimientoId || !open) return;
    setLoading(true);
    fetch(`/api/dashboard/movimiento/${movimientoId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(({ mov: data }) => setMov(data ?? null))
      .catch(() => setMov(null))
      .finally(() => setLoading(false));
  }, [movimientoId, open]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md border-border bg-background overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Detalle de Movimiento</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : mov ? (
          <div className="mt-2 space-y-1">
            <div className="rounded-xl p-5 text-center border border-border" style={{ background: "hsl(var(--bg-card))" }}>
              <MontoDisplay monto={Number(mov.monto)} tipo={mov.tipo} size="xl" showSign />
              <div className="mt-2 flex items-center justify-center gap-2">
                <TipoChip tipo={mov.tipo} />
                <Badge variant="outline" className="text-[10px]">{mov.fuente}</Badge>
              </div>
            </div>

            <Separator className="my-3" />

            <div className="rounded-lg p-3 border border-border" style={{ background: "hsl(var(--bg-surface))" }}>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Concepto</p>
              <p className="text-sm font-medium leading-relaxed">{mov.concepto}</p>
            </div>

            <Separator className="my-3" />

            <DetailRow icon={Calendar} label="Fecha" value={new Date(mov.fecha).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
            <DetailRow icon={Building2} label="Empresa" value={mov.empresa ?? "—"} className="font-medium" />
            <DetailRow icon={Tag} label="Categoría" value={mov.categoria ?? "—"} />
            <DetailRow icon={Layers} label="Grupo" value={mov.grupo ?? "—"} />
            <DetailRow icon={FileText} label="Nombre" value={mov.nombre ?? "—"} />
            <DetailRow icon={Wallet} label="Cuenta" value={mov.cuenta ?? "—"} />
            <DetailRow icon={FolderKanban} label="Proyecto" value={mov.proyecto ?? "—"} />

            {mov.comentario && (
              <>
                <Separator className="my-2" />
                <DetailRow icon={MessageSquare} label="Comentario" value={mov.comentario} className="text-muted-foreground italic" />
              </>
            )}

            <Separator className="my-2" />

            <DetailRow icon={Hash} label="ID" value={
              <span className="font-mono text-[11px] text-muted-foreground">{mov.id.slice(0, 8)}…</span>
            } />
            <DetailRow icon={Clock} label="Creado" value={new Date(mov.createdAt).toLocaleString("es-MX")} />
            {mov.updatedAt !== mov.createdAt && (
              <DetailRow icon={Clock} label="Actualizado" value={new Date(mov.updatedAt).toLocaleString("es-MX")} />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Movimiento no encontrado</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
