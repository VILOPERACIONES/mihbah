import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay, formatMonto } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface ReporteRow {
  mes: number;
  ingresos: number;
  egresos: number;
  resultado: number;
  margen: number;
}

export default function ReportesPage() {
  const { empresaActiva } = useAppStore();
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<ReporteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("movimientos")
        .select("mes, tipo, monto")
        .eq("activo", true)
        .eq("anio", Number(anio));

      if (empresaActiva !== "TODAS") query = query.eq("empresa", empresaActiva);
      const { data } = await query;

      if (data) {
        const mapa = new Map<number, { ingresos: number; egresos: number }>();
        for (let m = 1; m <= 12; m++) mapa.set(m, { ingresos: 0, egresos: 0 });
        data.forEach((m: { mes: number; tipo: string; monto: number }) => {
          const e = mapa.get(m.mes)!;
          if (m.tipo === "INGRESO") e.ingresos += Number(m.monto);
          if (m.tipo === "SALIDA") e.egresos += Math.abs(Number(m.monto));
        });

        setRows(
          [...mapa.entries()].map(([mes, d]) => ({
            mes,
            ingresos: d.ingresos,
            egresos: d.egresos,
            resultado: d.ingresos - d.egresos,
            margen: d.ingresos > 0 ? ((d.ingresos - d.egresos) / d.ingresos) * 100 : 0,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [empresaActiva, anio]);

  const totals = rows.reduce(
    (acc, r) => ({ ingresos: acc.ingresos + r.ingresos, egresos: acc.egresos + r.egresos, resultado: acc.resultado + r.resultado }),
    { ingresos: 0, egresos: 0, resultado: 0 }
  );
  const totalMargen = totals.ingresos > 0 ? (totals.resultado / totals.ingresos) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reportes — Estado de Resultados</h1>
          <p className="text-sm text-muted-foreground">{empresaActiva === "TODAS" ? "Consolidado" : empresaActiva}</p>
        </div>
        <Select value={anio} onValueChange={setAnio}>
          <SelectTrigger className="w-24 bg-background border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["2023", "2024", "2025", "2026"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-96 rounded-xl" /> : (
        <Card className="border-border rounded-xl overflow-hidden" style={{ background: "hsl(var(--bg-card))" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "hsl(var(--bg-surface))" }}>
                  {["Mes", "Ingresos", "Egresos", "Resultado", "Margen %"].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-medium text-muted-foreground text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.mes} className="border-t border-border" style={{ background: i % 2 === 0 ? undefined : "hsl(var(--bg-base))" }}>
                    <td className="px-4 py-2 text-xs">{MESES[r.mes - 1]}</td>
                    <td className="px-4 py-2 text-right"><MontoDisplay monto={r.ingresos} tipo="INGRESO" size="sm" /></td>
                    <td className="px-4 py-2 text-right"><MontoDisplay monto={r.egresos} tipo="SALIDA" size="sm" /></td>
                    <td className="px-4 py-2 text-right"><MontoDisplay monto={r.resultado} showSign size="sm" /></td>
                    <td className={`px-4 py-2 text-right font-money text-xs ${r.margen >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {r.margen.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary/30 font-semibold" style={{ background: "hsl(var(--bg-surface))" }}>
                  <td className="px-4 py-2 text-xs">Total {anio}</td>
                  <td className="px-4 py-2 text-right"><MontoDisplay monto={totals.ingresos} tipo="INGRESO" size="sm" /></td>
                  <td className="px-4 py-2 text-right"><MontoDisplay monto={totals.egresos} tipo="SALIDA" size="sm" /></td>
                  <td className="px-4 py-2 text-right"><MontoDisplay monto={totals.resultado} showSign size="sm" /></td>
                  <td className={`px-4 py-2 text-right font-money text-xs ${totalMargen >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {totalMargen.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
