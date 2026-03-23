import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay, formatMonto, formatMontoAbreviado } from "@/components/shared/MontoDisplay";
import { TipoChip } from "@/components/shared/TipoChip";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Percent, ArrowUpDown, Calendar } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { MovimientoDetailSheet } from "@/components/movimientos/MovimientoDetailSheet";

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

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function DashboardPage() {
  const { empresaActiva } = useAppStore();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [flujo, setFlujo] = useState<FlujoMes[]>([]);
  const [topCats, setTopCats] = useState<CatGasto[]>([]);
  const [recientes, setRecientes] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoLabel, setPeriodoLabel] = useState("");
  const [availablePeriods, setAvailablePeriods] = useState<{ anio: number; mes: number }[]>([]);
  const [selectedAnio, setSelectedAnio] = useState<number | null>(null);
  const [selectedMes, setSelectedMes] = useState<number | null>(null);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPeriods() {
      const [periodsRes, latestRes] = await Promise.all([
        supabase.rpc("get_available_periods"),
        supabase.rpc("get_latest_month"),
      ]);
      if (periodsRes.data) setAvailablePeriods(periodsRes.data as any[]);
      if (latestRes.data?.[0]) {
        setSelectedAnio(latestRes.data[0].anio);
        setSelectedMes(latestRes.data[0].mes);
      }
      setPeriodsLoaded(true);
    }
    loadPeriods();
  }, []);

  const availableYears = useMemo(() =>
    [...new Set(availablePeriods.map(p => p.anio))].sort((a, b) => b - a),
    [availablePeriods]
  );

  const availableMonths = useMemo(() =>
    availablePeriods.filter(p => p.anio === selectedAnio).map(p => p.mes).sort((a, b) => a - b),
    [availablePeriods, selectedAnio]
  );

  useEffect(() => {
    if (!periodsLoaded || !selectedAnio || !selectedMes) return;
    async function load() {
      setLoading(true);
      const empresaFilter = empresaActiva !== "TODAS" ? empresaActiva : null;
      const anio = selectedAnio!;
      const mes = selectedMes!;

      setPeriodoLabel(`${MESES[mes]} ${anio}`);

      const [kpiRes, flujoRes, catRes, recRes] = await Promise.all([
        supabase.rpc("get_kpis_mes", { _anio: anio, _mes: mes, _empresa: empresaFilter }),
        supabase.rpc("get_flujo_mensual", { _anio_desde: anio - 2, _empresa: empresaFilter }),
        supabase.rpc("get_top_categorias", { _anio: anio, _mes: mes, _limite: 8, _empresa: empresaFilter }),
        (() => {
          let q = supabase
            .from("movimientos")
            .select("id, fecha, empresa, tipo, categoria, concepto, monto")
            .eq("activo", true)
            .order("fecha", { ascending: false })
            .limit(15);
          if (empresaFilter) q = q.eq("empresa", empresaFilter);
          return q;
        })(),
      ]);

      if (kpiRes.data) {
        const d = kpiRes.data as any;
        const ingresos = Number(d.ingresos) || 0;
        const salidas = Number(d.salidas) || 0;
        const resultado = ingresos - salidas;
        setKpis({
          ingresos, salidas, resultado,
          margen: ingresos > 0 ? Math.round((resultado / ingresos) * 10000) / 100 : 0,
          conteoIngresos: Number(d.conteo_ingresos) || 0,
          conteoSalidas: Number(d.conteo_salidas) || 0,
        });
      }

      if (flujoRes.data && Array.isArray(flujoRes.data)) {
        let balance = 0;
        const flujoArr = (flujoRes.data as any[]).slice(-12).map((row) => {
          const ing = Number(row.ingresos) || 0;
          const sal = Number(row.salidas) || 0;
          balance += ing - sal;
          return { periodo: row.periodo, ingresos: ing, salidas: sal, balance };
        });
        setFlujo(flujoArr);
      }

      if (catRes.data && Array.isArray(catRes.data)) {
        setTopCats((catRes.data as any[]).map((r) => ({ categoria: r.categoria, total: Number(r.total) || 0 })));
      }

      if (recRes.data) setRecientes(recRes.data as Movimiento[]);
      setLoading(false);
    }
    load();
  }, [empresaActiva, selectedAnio, selectedMes, periodsLoaded]);

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {empresaActiva === "TODAS" ? "Vista consolidada" : empresaActiva} · {periodoLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={String(selectedMes)} onValueChange={(v) => setSelectedMes(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={String(m)}>{MESES[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedAnio)} onValueChange={(v) => setSelectedAnio(Number(v))}>
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="p-4 border-border rounded-xl bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
            </div>
            {"isPercent" in kpi && kpi.isPercent ? (
              <span className={`font-money text-xl md:text-2xl font-semibold ${kpi.value >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 border-border rounded-xl bg-card">
          <h3 className="text-sm font-medium text-foreground mb-4">Flujo Mensual</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={flujo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: "#888888" }} />
              <YAxis tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "#888888" }} />
              <Tooltip
                contentStyle={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 8, fontSize: 12, color: "#FFFFFF" }}
                formatter={(v: number, name: string) => [formatMonto(v, true), name === "ingresos" ? "Ingresos" : name === "salidas" ? "Egresos" : "Balance"]}
              />
              <Area type="monotone" dataKey="ingresos" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="salidas" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="balance" stroke="#4ADE80" fill="none" strokeWidth={2} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 border-border rounded-xl bg-card">
          <h3 className="text-sm font-medium text-foreground mb-4">Top Egresos por Categoría</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
              <XAxis type="number" tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "#888888" }} />
              <YAxis dataKey="categoria" type="category" width={100} tick={{ fontSize: 10, fill: "#888888" }} />
              <Tooltip
                contentStyle={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 8, fontSize: 12, color: "#FFFFFF" }}
                formatter={(v: number) => [formatMonto(v, true), "Total"]}
              />
              <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card className="border-border rounded-xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Últimos Movimientos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted">
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
                  className={`border-t border-border hover:bg-muted/50 transition-colors cursor-pointer ${i % 2 === 1 ? "bg-background" : ""}`}
                  onClick={() => setDetailId(mov.id)}
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

      <MovimientoDetailSheet
        movimientoId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
