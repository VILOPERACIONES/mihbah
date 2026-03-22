import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay, formatMonto, formatMontoAbreviado } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface FlujoRow {
  anio: number;
  mes: number;
  balanceInicial: number;
  ingresos: number;
  salidas: number;
  diferencia: number;
  balanceFinal: number;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function FlujoPage() {
  const { empresaActiva } = useAppStore();
  const [data, setData] = useState<FlujoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioDesde, setAnioDesde] = useState("2023");
  const [anioHasta, setAnioHasta] = useState("2026");

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("movimientos")
        .select("anio, mes, tipo, monto")
        .eq("activo", true)
        .gte("anio", Number(anioDesde))
        .lte("anio", Number(anioHasta));

      if (empresaActiva !== "TODAS") query = query.eq("empresa", empresaActiva);
      const { data: movs } = await query;

      if (movs) {
        const mapa = new Map<string, { anio: number; mes: number; ingresos: number; salidas: number }>();
        movs.forEach((m: { anio: number; mes: number; tipo: string; monto: number }) => {
          const key = `${m.anio}-${String(m.mes).padStart(2, "0")}`;
          if (!mapa.has(key)) mapa.set(key, { anio: m.anio, mes: m.mes, ingresos: 0, salidas: 0 });
          const entry = mapa.get(key)!;
          if (m.tipo === "INGRESO") entry.ingresos += Number(m.monto);
          if (m.tipo === "SALIDA") entry.salidas += Math.abs(Number(m.monto));
        });

        let balance = 0;
        const rows = [...mapa.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, e]) => {
            const dif = e.ingresos - e.salidas;
            const row: FlujoRow = {
              anio: e.anio, mes: e.mes,
              balanceInicial: balance,
              ingresos: e.ingresos,
              salidas: e.salidas,
              diferencia: dif,
              balanceFinal: balance + dif,
            };
            balance += dif;
            return row;
          });
        setData(rows);
      }
      setLoading(false);
    }
    load();
  }, [empresaActiva, anioDesde, anioHasta]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Flujo de Caja</h1>
          <p className="text-sm text-muted-foreground">{empresaActiva === "TODAS" ? "Consolidado" : empresaActiva}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={anioDesde} onValueChange={setAnioDesde}>
            <SelectTrigger className="w-24 bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["2023", "2024", "2025", "2026"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">→</span>
          <Select value={anioHasta} onValueChange={setAnioHasta}>
            <SelectTrigger className="w-24 bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["2023", "2024", "2025", "2026"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <Card className="border-border rounded-xl overflow-hidden" style={{ background: "hsl(var(--bg-card))" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "hsl(var(--bg-surface))" }}>
                    {["Período", "Bal. Inicial", "Ingresos", "Egresos", "Diferencia", "Bal. Final"].map((h) => (
                      <th key={h} className="px-4 py-2 text-xs font-medium text-muted-foreground text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr
                      key={`${r.anio}-${r.mes}`}
                      className="border-t border-border hover:bg-[hsl(var(--bg-card-hover))] transition-colors"
                      style={{ background: i % 2 === 0 ? undefined : "hsl(var(--bg-base))" }}
                    >
                      <td className="px-4 py-2 text-xs">{MESES[r.mes - 1]} {r.anio}</td>
                      <td className="px-4 py-2 text-right"><MontoDisplay monto={r.balanceInicial} size="sm" /></td>
                      <td className="px-4 py-2 text-right"><MontoDisplay monto={r.ingresos} tipo="INGRESO" size="sm" /></td>
                      <td className="px-4 py-2 text-right"><MontoDisplay monto={r.salidas} tipo="SALIDA" size="sm" /></td>
                      <td className="px-4 py-2 text-right"><MontoDisplay monto={r.diferencia} showSign size="sm" /></td>
                      <td className="px-4 py-2 text-right"><MontoDisplay monto={r.balanceFinal} showSign size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4 border-border rounded-xl" style={{ background: "hsl(var(--bg-card))" }}>
            <h3 className="text-sm font-medium mb-4">Balance Final</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.map((r) => ({ periodo: `${MESES[r.mes - 1]} ${r.anio}`, balance: r.balanceFinal }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bg-border))" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatMonto(v, true), "Balance"]}
                />
                <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
