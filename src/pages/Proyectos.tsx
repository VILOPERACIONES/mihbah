import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface ProyectoData {
  proyecto: string;
  ingresos: number;
  salidas: number;
  saldo: number;
  count: number;
}

export default function ProyectosPage() {
  const { empresaActiva } = useAppStore();
  const [proyectos, setProyectos] = useState<ProyectoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("movimientos")
        .select("proyecto, tipo, monto")
        .eq("activo", true)
        .not("proyecto", "is", null);

      if (empresaActiva !== "TODAS") query = query.eq("empresa", empresaActiva);
      const { data } = await query;

      if (data) {
        const mapa = new Map<string, { ingresos: number; salidas: number; count: number }>();
        data.forEach((m: { proyecto: string | null; tipo: string; monto: number }) => {
          const p = m.proyecto ?? "";
          if (!p) return;
          if (!mapa.has(p)) mapa.set(p, { ingresos: 0, salidas: 0, count: 0 });
          const e = mapa.get(p)!;
          e.count++;
          if (m.tipo === "INGRESO") e.ingresos += Number(m.monto);
          if (m.tipo === "SALIDA") e.salidas += Math.abs(Number(m.monto));
        });

        setProyectos(
          [...mapa.entries()]
            .map(([proyecto, d]) => ({
              proyecto,
              ingresos: d.ingresos,
              salidas: d.salidas,
              saldo: d.ingresos - d.salidas,
              count: d.count,
            }))
            .sort((a, b) => b.count - a.count)
        );
      }
      setLoading(false);
    }
    load();
  }, [empresaActiva]);

  if (loading) return <div className="grid grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;

  if (proyectos.length === 0) return <EmptyState icon={Hammer} title="Sin proyectos" description="No hay movimientos con proyecto asignado." />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Proyectos</h1>
      <div className="grid grid-cols-3 gap-4">
        {proyectos.map((p) => (
          <Card key={p.proyecto} className="p-4 border-border rounded-xl hover:bg-card/80 transition-colors cursor-pointer" style={{ background: "hsl(var(--bg-card))" }}>
            <div className="flex items-center gap-2 mb-3">
              <Hammer className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">{p.proyecto}</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Ingresos:</span>
                <MontoDisplay monto={p.ingresos} tipo="INGRESO" size="sm" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Egresos:</span>
                <MontoDisplay monto={p.salidas} tipo="SALIDA" size="sm" />
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Saldo:</span>
                <MontoDisplay monto={p.saldo} showSign size="sm" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{p.count} movimientos</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
