import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay, formatMonto, formatMontoAbreviado } from "@/components/shared/MontoDisplay";
import { TipoChip } from "@/components/shared/TipoChip";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Percent, ArrowUpDown } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface KPIs {
  ingresos: number;
  salidas: number;
  resultado: number;
  margen: number;
  conteoIngresos: number;
  conteoSalidas: number;
}

interface FlujoMes {
  periodo: string;
  ingresos: number;
  salidas: number;
  balance: number;
}

interface CatGasto {
  categoria: string;
  total: number;
}

interface Movimiento {
  id: string;
  fecha: string;
  empresa: string;
  tipo: string;
  categoria: string | null;
  concepto: string;
  monto: number;
}

export default function DashboardPage() {
  const { empresaActiva } = useAppStore();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [flujo, setFlujo] = useState<FlujoMes[]>([]);
  const [topCats, setTopCats] = useState<CatGasto[]>([]);
  const [recientes, setRecientes] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const anioAct = now.getFullYear();
  const mesAct = now.getMonth() + 1;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const empresaFilter = empresaActiva !== "TODAS" ? empresaActiva : null;

      // Build queries
      let kpiQuery = supabase
        .from("movimientos")
        .select("tipo, monto")
        .eq("activo", true)
        .eq("anio", anioAct)
        .eq("mes", mesAct);

      if (empresaFilter) kpiQuery = kpiQuery.eq("empresa", empresaFilter);

      const { data: movs } = await kpiQuery;

      if (movs) {
        let ingresos = 0, salidas = 0, cIngresos = 0, cSalidas = 0;
        movs.forEach((m: { tipo: string; monto: number }) => {
          if (m.tipo === "INGRESO") { ingresos += Number(m.monto); cIngresos++; }
          if (m.tipo === "SALIDA") { salidas += Math.abs(Number(m.monto)); cSalidas++; }
        });
        const resultado = ingresos - salidas;
        setKpis({
          ingresos, salidas, resultado,
          margen: ingresos > 0 ? Math.round((resultado / ingresos) * 10000) / 100 : 0,
          conteoIngresos: cIngresos,
          conteoSalidas: cSalidas,
        });
      }

      // Flujo últimos 12 meses
      let flujoQuery = supabase
        .from("movimientos")
        .select("anio, mes, tipo, monto")
        .eq("activo", true)
        .gte("anio", anioAct - 1);
      if (empresaFilter) flujoQuery = flujoQuery.eq("empresa", empresaFilter);
      const { data: flujoData } = await flujoQuery;

      if (flujoData) {
        const mapa = new Map<string, { ingresos: number; salidas: number }>();
        flujoData.forEach((m: { anio: number; mes: number; tipo: string; monto: number }) => {
          const key = `${m.anio}-${String(m.mes).padStart(2, "0")}`;
          if (!mapa.has(key)) mapa.set(key, { ingresos: 0, salidas: 0 });
          const entry = mapa.get(key)!;
          if (m.tipo === "INGRESO") entry.ingresos += Number(m.monto);
          if (m.tipo === "SALIDA") entry.salidas += Math.abs(Number(m.monto));
        });

        let balance = 0;
        const flujoArr = [...mapa.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([periodo, { ingresos, salidas }]) => {
            balance += ingresos - salidas;
            return { periodo, ingresos, salidas, balance };
          });
        setFlujo(flujoArr);
      }

      // Top categorías egreso
      let catQuery = supabase
        .from("movimientos")
        .select("categoria, monto")
        .eq("activo", true)
        .eq("anio", anioAct)
        .eq("mes", mesAct)
        .eq("tipo", "SALIDA")
        .not("categoria", "is", null);
      if (empresaFilter) catQuery = catQuery.eq("empresa", empresaFilter);
      const { data: catData } = await catQuery;

      if (catData) {
        const catMap = new Map<string, number>();
        catData.forEach((m: { categoria: string | null; monto: number }) => {
          const cat = m.categoria ?? "Sin categoría";
          catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(Number(m.monto)));
        });
        setTopCats(
          [...catMap.entries()]
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([categoria, total]) => ({ categoria, total }))
        );
      }

      // Últimos 15 movimientos
      let recQuery = supabase
        .from("movimientos")
        .select("id, fecha, empresa, tipo, categoria, concepto, monto")
        .eq("activo", true)
        .order("fecha", { ascending: false })
        .limit(15);
      if (empresaFilter) recQuery = recQuery.eq("empresa", empresaFilter);
      const { data: recData } = await recQuery;
      if (recData) setRecientes(recData as Movimiento[]);

      setLoading(false);
    }
    load();
  }, [empresaActiva, anioAct, mesAct]);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Ingresos", value: kpis.ingresos, icon: TrendingUp, tipo: "INGRESO" },
      { label: "Egresos", value: kpis.salidas, icon: TrendingDown, tipo: "SALIDA" },
      { label: "Resultado", value: kpis.resultado, icon: DollarSign, tipo: kpis.resultado >= 0 ? "INGRESO" : "SALIDA" },
      { label: "Margen", value: kpis.margen, icon: Percent, isPercent: true, tipo: kpis.margen >= 0 ? "INGRESO" : "SALIDA" },
    ];
  }, [kpis]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {empresaActiva === "TODAS" ? "Vista consolidada" : empresaActiva} · {now.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card
            key={kpi.label}
            className="p-4 border-border rounded-xl transition-colors hover:bg-card/80"
            style={{ background: "hsl(var(--bg-card))" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
            </div>
            {kpi.isPercent ? (
              <span className={`font-money text-2xl font-semibold ${kpi.value >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {kpi.value >= 0 ? "+" : ""}{kpi.value}%
              </span>
            ) : (
              <MontoDisplay monto={kpi.value} tipo={kpi.tipo} size="xl" />
            )}
            <p className="text-xs text-muted-foreground mt-1">MXN</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Flujo Chart */}
        <Card className="p-4 border-border rounded-xl" style={{ background: "hsl(var(--bg-card))" }}>
          <h3 className="text-sm font-medium text-foreground mb-4">Flujo Mensual</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={flujo}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bg-border))" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [formatMonto(v, true), name === "ingresos" ? "Ingresos" : name === "salidas" ? "Egresos" : "Balance"]}
              />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="salidas" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="none" strokeWidth={2} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Categorías */}
        <Card className="p-4 border-border rounded-xl" style={{ background: "hsl(var(--bg-card))" }}>
          <h3 className="text-sm font-medium text-foreground mb-4">Top Egresos por Categoría</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bg-border))" />
              <XAxis type="number" tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="categoria" type="category" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatMonto(v, true), "Total"]}
              />
              <Bar dataKey="total" fill="#f43f5e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card className="border-border rounded-xl overflow-hidden" style={{ background: "hsl(var(--bg-card))" }}>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Últimos Movimientos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(var(--bg-surface))" }}>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Categoría</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Concepto</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Monto</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((mov, i) => (
                <tr
                  key={mov.id}
                  className="border-t border-border hover:bg-[hsl(var(--bg-card-hover))] transition-colors"
                  style={{ background: i % 2 === 0 ? "hsl(var(--bg-card))" : "hsl(var(--bg-base))" }}
                >
                  <td className="px-4 py-2 text-muted-foreground font-money text-xs">
                    {new Date(mov.fecha).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-4 py-2 text-xs">{mov.empresa}</td>
                  <td className="px-4 py-2"><TipoChip tipo={mov.tipo} /></td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{mov.categoria ?? "—"}</td>
                  <td className="px-4 py-2 text-xs max-w-[200px] truncate">{mov.concepto}</td>
                  <td className="px-4 py-2 text-right">
                    <MontoDisplay monto={Number(mov.monto)} tipo={mov.tipo} size="sm" />
                  </td>
                </tr>
              ))}
              {recientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No hay movimientos registrados. Importa tu primer Excel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
