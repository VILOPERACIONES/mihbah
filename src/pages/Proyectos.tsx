import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface ProyectoData {
  proyecto: string;
  empresa: string;
  registros: number;
  flujo: number;
  fechaMin: string;
  fechaMax: string;
}

export default function ProyectosPage() {
  const navigate = useNavigate();
  const { empresaActiva } = useAppStore();
  const [proyectos, setProyectos] = useState<ProyectoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const empresaFilter = empresaActiva === "TODAS" ? undefined : empresaActiva;
      const { data } = await supabase.rpc("get_proyectos_resumen", {
        ...(empresaFilter ? { _empresa: empresaFilter } : {}),
      });

      if (data) {
        setProyectos(
          (data as any[]).map((r) => ({
            proyecto: r.proyecto,
            empresa: r.empresa,
            registros: Number(r.registros),
            flujo: Number(r.flujo),
            fechaMin: r.fecha_min,
            fechaMax: r.fecha_max,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [empresaActiva]);

  if (loading)
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Proyectos</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );

  if (proyectos.length === 0)
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Proyectos</h1>
        <EmptyState
          icon={Hammer}
          title="Sin proyectos"
          description={
            empresaActiva !== "TODAS"
              ? `${empresaActiva} no tiene proyectos asignados en el archivo.`
              : "No hay movimientos con proyecto asignado."
          }
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          {empresaActiva === "TODAS" ? "Todas las empresas" : empresaActiva} · {proyectos.length} proyectos
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {proyectos.map((p) => (
          <Card
            key={`${p.empresa}-${p.proyecto}`}
            className="p-4 border-border rounded-xl hover:bg-card/80 transition-colors cursor-pointer"
            style={{ background: "hsl(var(--bg-card))" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Hammer className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">{p.proyecto}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{p.empresa}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Flujo:</span>
                <MontoDisplay monto={p.flujo} showSign size="sm" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Registros:</span>
                <span className="font-money">{p.registros.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {p.fechaMin} → {p.fechaMax}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
