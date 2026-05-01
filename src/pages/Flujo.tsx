import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app.store";
import { MontoDisplay, formatMonto, formatMontoAbreviado } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { empresaActiva, dataVersion } = useAppStore();
  const [data, setData] = useState<FlujoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioDesde, setAnioDesde] = useState("2023");
  const [anioHasta, setAnioHasta] = useState("2026");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ anioDesde, anioHasta });
        if (empresaActiva !== "TODAS") params.set("empresa", empresaActiva);
        const res = await fetch(`/api/dashboard/flujo?${params}`, { credentials: "include" });
        const { flujo } = await res.json() as {
          flujo: { anio: number; mes: number; ingresos: number; salidas: number; balance: number }[]
        };
        let acumulado = 0;
        const result = (flujo ?? []).map((r) => {
          const row: FlujoRow = {
            anio: r.anio,
            mes: r.mes,
            balanceInicial: acumulado,
            ingresos: r.ingresos,
            salidas: r.salidas,
            diferencia: r.ingresos - r.salidas,
            balanceFinal: r.balance,
          };
          acumulado = r.balance;
          return row;
        });
        setData(result);
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    load();
  }, [empresaActiva, anioDesde, anioHasta, dataVersion]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Flujo de Caja</h1>
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
          {data.length > 0 && (() => {
            const latest = data[data.length - 1];
            const prev = data.length > 1 ? data[data.length - 2] : null;
            const totalIngresos = data.reduce((s, r) => s + r.ingresos, 0);
            const totalSalidas = data.reduce((s, r) => s + r.salidas, 0);
            const burnRate = data.length > 0 ? totalSalidas / data.length : 0;
            const monthsRunway = burnRate > 0 ? latest.balanceFinal / burnRate : Infinity;
            const balanceChange = prev ? latest.balanceFinal - prev.balanceFinal : 0;
            const balancePct = prev && prev.balanceFinal !== 0 ? (balanceChange / Math.abs(prev.balanceFinal)) * 100 : 0;
            const isPositive = latest.balanceFinal >= 0;
            const isGrowing = balanceChange >= 0;

            return (
              <Card className="border-border rounded-xl overflow-hidden relative" style={{ background: "hsl(var(--bg-card))" }}>
                <div className="absolute inset-0 opacity-5" style={{
                  background: isPositive
                    ? "linear-gradient(135deg, hsl(var(--jade)) 0%, transparent 60%)"
                    : "linear-gradient(135deg, hsl(var(--destructive)) 0%, transparent 60%)"
                }} />
                <div className="relative p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={cn("p-2 rounded-lg", isPositive ? "bg-[hsl(var(--jade)/.15)]" : "bg-[hsl(var(--destructive)/.15)]")}>
                      <Wallet className={cn("h-5 w-5", isPositive ? "text-[hsl(var(--jade))]" : "text-destructive")} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flujo Disponible</p>
                      <p className="text-xs text-muted-foreground">{`${MESES[latest.mes - 1]} ${latest.anio}`}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div>
                      <p className={cn("text-xl md:text-3xl font-bold font-money", isPositive ? "text-[hsl(var(--jade))]" : "text-destructive")}>
                        {formatMonto(latest.balanceFinal)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {isGrowing ? <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(var(--jade))]" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                        <span className={cn("text-xs font-medium", isGrowing ? "text-[hsl(var(--jade))]" : "text-destructive")}>
                          {balancePct >= 0 ? "+" : ""}{balancePct.toFixed(1)}% vs mes anterior
                        </span>
                      </div>
                    </div>

                    <div className="md:border-l border-t md:border-t-0 border-border pt-4 md:pt-0 md:pl-6">
                      <p className="text-xs text-muted-foreground mb-1">Gasto Promedio / Mes</p>
                      <p className="text-lg font-semibold font-money text-foreground">{formatMonto(burnRate)}</p>
                      <p className="text-xs text-muted-foreground mt-1">en {data.length} meses</p>
                    </div>

                    <div className="md:border-l border-t md:border-t-0 border-border pt-4 md:pt-0 md:pl-6">
                      <p className="text-xs text-muted-foreground mb-1">Runway Estimado</p>
                      <p className={cn("text-lg font-semibold", monthsRunway > 6 ? "text-[hsl(var(--jade))]" : monthsRunway > 3 ? "text-[hsl(var(--warning))]" : "text-destructive")}>
                        {monthsRunway === Infinity ? "∞" : `${monthsRunway.toFixed(1)} meses`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {monthsRunway > 6 ? "Saludable" : monthsRunway > 3 ? "Precaución" : "Crítico"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}

          {data.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
              <TrendingUp className="h-4 w-4" />
              Sin datos de flujo para el período seleccionado
            </div>
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
                  <AreaChart data={data.map((r) => ({ periodo: `${MESES[r.mes - 1]} ${r.anio}`, balance: r.balanceFinal, ingresos: r.ingresos, salidas: r.salidas }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bg-border))" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: "#CCCCCC" }} />
                    <YAxis tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "#CCCCCC" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 12, color: "#FFFFFF" }}
                      formatter={(v: number) => [formatMonto(v, true)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#CCCCCC" }} />
                    <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="hsl(142,71%,45%)" fill="hsl(142,71%,45%)" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="salidas" name="Salidas" stroke="hsl(0,84%,60%)" fill="hsl(0,84%,60%)" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="balance" name="Balance Final" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </>
      )}

      {!loading && data.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--jade))]" />
            <span>Total ingresos: {formatMonto(data.reduce((s, r) => s + r.ingresos, 0))}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            <span>Total salidas: {formatMonto(data.reduce((s, r) => s + r.salidas, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
