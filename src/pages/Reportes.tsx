import { useEffect, useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { formatMonto, formatMontoAbreviado } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Download, ChevronDown, ChevronRight, BarChart3, DollarSign, Percent,
  Shield, Zap, Target, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Area, AreaChart, Cell, PieChart, Pie
} from "recharts";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface MonthData {
  mes: number;
  ingresos: number;
  egresos: number;
  internos: number;
  prestamos: number;
  resultado: number;
  margen: number;
}

interface CategoryData {
  categoria: string;
  total: number;
  pct: number;
}

interface DrillItem {
  id: string;
  fecha: string;
  empresa: string;
  concepto: string;
  monto: number;
  tipo: string;
  categoria: string | null;
}

// ── Strategic KPI Card ─────────────────────────────────────
function KPICard({ title, value, subtitle, icon: Icon, trend, trendLabel, accent = "primary" }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType;
  trend?: number; trendLabel?: string; accent?: string;
}) {
  const isPos = (trend ?? 0) >= 0;
  return (
    <Card className="p-4 border-border relative overflow-hidden group hover:border-primary/30 transition-all" style={{ background: "hsl(var(--bg-card))" }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-[0.07]"
        style={{ background: `hsl(var(--${accent}))` }} />
      <div className="flex items-start justify-between mb-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `hsl(var(--${accent}) / 0.15)` }}>
          <Icon className="h-4 w-4" style={{ color: `hsl(var(--${accent}))` }} />
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
            isPos ? "text-positive bg-positive/10" : "text-negative bg-negative/10")}>
            {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
      <p className="text-xl font-bold font-money">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      {trendLabel && <p className="text-[10px] text-muted-foreground mt-0.5">{trendLabel}</p>}
    </Card>
  );
}

// ── Alert Card ──────────────────────────────────────────────
function AlertCard({ level, title, description }: { level: "critical" | "warning" | "info"; title: string; description: string }) {
  const colors = {
    critical: { bg: "bg-negative/10", border: "border-negative/30", text: "text-negative", icon: AlertTriangle },
    warning: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: AlertTriangle },
    info: { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: Zap },
  };
  const c = colors[level];
  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", c.bg, c.border)}>
      <c.icon className={cn("h-4 w-4 mt-0.5 shrink-0", c.text)} />
      <div>
        <p className={cn("text-xs font-semibold", c.text)}>{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Drill-down Panel ────────────────────────────────────────
function DrillPanel({ items, title, onClose }: { items: DrillItem[]; title: string; onClose: () => void }) {
  return (
    <Card className="border-border mt-2 overflow-hidden animate-in slide-in-from-top-2" style={{ background: "hsl(var(--bg-card))" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border" style={{ background: "hsl(var(--bg-surface))" }}>
        <p className="text-xs font-semibold">{title} — {items.length} movimientos</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3 w-3" /></Button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Fecha","Empresa","Concepto","Categoría","Monto"].map(h => (
                <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 50).map(item => (
              <tr key={item.id} className="border-b border-border/50 hover:bg-card/80">
                <td className="px-3 py-1.5">{new Date(item.fecha).toLocaleDateString("es-MX")}</td>
                <td className="px-3 py-1.5">{item.empresa}</td>
                <td className="px-3 py-1.5 max-w-[200px] truncate">{item.concepto}</td>
                <td className="px-3 py-1.5">{item.categoria ?? "—"}</td>
                <td className={cn("px-3 py-1.5 font-money text-right", item.tipo === "INGRESO" ? "text-positive" : "text-negative")}>
                  {formatMonto(Math.abs(item.monto))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function ReportesPage() {
  const { empresaActiva } = useAppStore();
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<MonthData[]>([]);
  const [prevRows, setPrevRows] = useState<MonthData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [drillItems, setDrillItems] = useState<DrillItem[]>([]);
  const [drillTitle, setDrillTitle] = useState("");

  const empresa = empresaActiva === "TODAS" ? null : empresaActiva;

  // Load data for current and previous year
  useEffect(() => {
    async function load() {
      setLoading(true);
      setExpandedMonth(null);
      setDrillItems([]);

      const numAnio = Number(anio);
      const [{ data: curr }, { data: prev }, { data: cats }] = await Promise.all([
        supabase.rpc("get_flujo_mensual", { _anio_desde: numAnio, _empresa: empresa } as any),
        supabase.rpc("get_flujo_mensual", { _anio_desde: numAnio - 1, _empresa: empresa } as any),
        supabase.rpc("get_top_categorias", { _anio: numAnio, _mes: new Date().getMonth() + 1, _limite: 10, _empresa: empresa } as any),
      ]);

      const parseRows = (data: any[], targetYear: number): MonthData[] => {
        const map = new Map<number, MonthData>();
        for (let m = 1; m <= 12; m++) map.set(m, { mes: m, ingresos: 0, egresos: 0, internos: 0, prestamos: 0, resultado: 0, margen: 0 });
        data?.filter((d: any) => d.periodo.startsWith(String(targetYear))).forEach((d: any) => {
          const mes = parseInt(d.periodo.split("-")[1]);
          const entry = map.get(mes);
          if (entry) {
            entry.ingresos = Number(d.ingresos);
            entry.egresos = Number(d.salidas);
            entry.resultado = entry.ingresos - entry.egresos;
            entry.margen = entry.ingresos > 0 ? ((entry.resultado) / entry.ingresos) * 100 : 0;
          }
        });
        return [...map.values()];
      };

      setRows(parseRows(curr ?? [], numAnio));
      setPrevRows(parseRows(prev ?? [], numAnio - 1));

      const totalEgr = (cats ?? []).reduce((s: number, c: any) => s + Number(c.total), 0);
      setCategories((cats ?? []).map((c: any) => ({
        categoria: c.categoria, total: Number(c.total),
        pct: totalEgr > 0 ? (Number(c.total) / totalEgr) * 100 : 0,
      })));

      setLoading(false);
    }
    load();
  }, [empresaActiva, anio]);

  // Computed totals
  const totals = useMemo(() => {
    const t = rows.reduce((a, r) => ({
      ingresos: a.ingresos + r.ingresos, egresos: a.egresos + r.egresos, resultado: a.resultado + r.resultado,
    }), { ingresos: 0, egresos: 0, resultado: 0 });
    return { ...t, margen: t.ingresos > 0 ? (t.resultado / t.ingresos) * 100 : 0 };
  }, [rows]);

  const prevTotals = useMemo(() => {
    const t = prevRows.reduce((a, r) => ({
      ingresos: a.ingresos + r.ingresos, egresos: a.egresos + r.egresos, resultado: a.resultado + r.resultado,
    }), { ingresos: 0, egresos: 0, resultado: 0 });
    return { ...t, margen: t.ingresos > 0 ? (t.resultado / t.ingresos) * 100 : 0 };
  }, [prevRows]);

  const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : undefined;

  // Alerts
  const alerts = useMemo(() => {
    const list: { level: "critical" | "warning" | "info"; title: string; description: string }[] = [];
    if (totals.resultado < 0) list.push({ level: "critical", title: "Resultado negativo", description: `El acumulado ${anio} muestra pérdida de ${formatMonto(Math.abs(totals.resultado))}.` });
    const negMonths = rows.filter(r => r.resultado < 0 && (r.ingresos > 0 || r.egresos > 0));
    if (negMonths.length >= 3) list.push({ level: "warning", title: `${negMonths.length} meses en rojo`, description: `Los meses ${negMonths.map(m => MESES[m.mes - 1]).join(", ")} tuvieron más egresos que ingresos.` });
    if (totals.margen < 10 && totals.margen > 0) list.push({ level: "warning", title: "Margen ajustado", description: `El margen del ${totals.margen.toFixed(1)}% está por debajo del 10%. Revisa costos.` });
    if (categories.length > 0 && categories[0].pct > 50) list.push({ level: "warning", title: `${categories[0].categoria} concentra ${categories[0].pct.toFixed(0)}% del gasto`, description: "Alta concentración de gasto en una sola categoría." });
    const ingTrend = pctChange(totals.ingresos, prevTotals.ingresos);
    if (ingTrend !== undefined && ingTrend > 20) list.push({ level: "info", title: `Ingresos crecieron ${ingTrend.toFixed(0)}%`, description: `Comparado con ${Number(anio) - 1}. Buen ritmo de crecimiento.` });
    if (list.length === 0) list.push({ level: "info", title: "Sin alertas críticas", description: "Los indicadores financieros están dentro de parámetros normales." });
    return list;
  }, [rows, totals, prevTotals, categories, anio]);

  // Chart data
  const chartData = useMemo(() => rows.map((r, i) => ({
    name: MESES[r.mes - 1],
    Ingresos: r.ingresos,
    Egresos: r.egresos,
    Resultado: r.resultado,
    "Año Ant.": prevRows[i]?.resultado ?? 0,
    Margen: r.margen,
  })), [rows, prevRows]);

  // Drill-down handler
  const handleDrill = useCallback(async (mes: number, tipo?: string) => {
    if (expandedMonth === mes && !tipo) {
      setExpandedMonth(null);
      setDrillItems([]);
      return;
    }
    setExpandedMonth(mes);
    let query = supabase.from("movimientos")
      .select("id, fecha, empresa, concepto, monto, tipo, categoria")
      .eq("activo", true).eq("anio", Number(anio)).eq("mes", mes)
      .order("monto", { ascending: true });
    if (empresa) query = query.eq("empresa", empresa);
    if (tipo) query = query.eq("tipo", tipo as any);
    const { data } = await query.limit(100);
    setDrillItems((data as DrillItem[]) ?? []);
    setDrillTitle(`${MESES_FULL[mes - 1]} ${anio}${tipo ? ` — ${tipo}` : ""}`);
  }, [expandedMonth, anio, empresa]);

  // Export to CSV
  const exportCSV = useCallback(() => {
    const header = "Mes,Ingresos,Egresos,Resultado,Margen %\n";
    const body = rows.map(r => `${MESES_FULL[r.mes - 1]},${r.ingresos},${r.egresos},${r.resultado},${r.margen.toFixed(1)}`).join("\n");
    const total = `\nTOTAL,${totals.ingresos},${totals.egresos},${totals.resultado},${totals.margen.toFixed(1)}`;
    const blob = new Blob([header + body + total], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estado_resultados_${anio}_${empresaActiva}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, totals, anio, empresaActiva]);

  const PIE_COLORS = ["hsl(142,71%,45%)", "hsl(142,71%,35%)", "hsl(142,71%,55%)", "hsl(45,80%,50%)", "hsl(0,80%,60%)", "hsl(210,50%,60%)", "hsl(180,50%,50%)", "hsl(270,40%,55%)"];

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Estado de Resultados
          </h1>
          <p className="text-sm text-muted-foreground">{empresaActiva === "TODAS" ? "Consolidado" : empresaActiva} — Vista Estratégica</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger className="w-24 bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["2023","2024","2025","2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Ingresos Totales" value={formatMontoAbreviado(totals.ingresos)}
          icon={TrendingUp} accent="primary"
          trend={pctChange(totals.ingresos, prevTotals.ingresos)}
          trendLabel={`vs ${Number(anio) - 1}`}
          subtitle={`${rows.filter(r => r.ingresos > 0).length} meses con ingresos`}
        />
        <KPICard
          title="Egresos Totales" value={formatMontoAbreviado(totals.egresos)}
          icon={TrendingDown} accent="destructive"
          trend={pctChange(totals.egresos, prevTotals.egresos)}
          trendLabel={`vs ${Number(anio) - 1}`}
        />
        <KPICard
          title="Resultado Neto" value={formatMontoAbreviado(totals.resultado)}
          icon={DollarSign} accent={totals.resultado >= 0 ? "primary" : "destructive"}
          trend={pctChange(totals.resultado, prevTotals.resultado)}
          trendLabel={`vs ${Number(anio) - 1}`}
        />
        <KPICard
          title="Margen Operativo" value={`${totals.margen.toFixed(1)}%`}
          icon={Percent} accent={totals.margen >= 15 ? "primary" : totals.margen >= 0 ? "warning" : "destructive"}
          subtitle={totals.margen >= 15 ? "Saludable" : totals.margen >= 0 ? "Ajustado" : "En pérdida"}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {alerts.map((a, i) => <AlertCard key={i} {...a} />)}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart - Flujo */}
        <Card className="lg:col-span-2 p-4 border-border" style={{ background: "hsl(var(--bg-card))" }}>
          <p className="text-xs font-semibold mb-3">Flujo Mensual vs Año Anterior</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradIng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142,71%,45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEgr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0,84%,60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0,84%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bg-border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--text-3))" }} />
              <YAxis tickFormatter={(v: number) => formatMontoAbreviado(v)} tick={{ fontSize: 10, fill: "hsl(var(--text-3))" }} width={55} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => formatMonto(v)}
              />
              <Area type="monotone" dataKey="Ingresos" stroke="hsl(142,71%,45%)" fill="url(#gradIng)" strokeWidth={2} />
              <Area type="monotone" dataKey="Egresos" stroke="hsl(0,84%,60%)" fill="url(#gradEgr)" strokeWidth={2} />
              <Line type="monotone" dataKey="Año Ant." stroke="hsl(var(--text-4))" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie - Top Categorías */}
        <Card className="p-4 border-border" style={{ background: "hsl(var(--bg-card))" }}>
          <p className="text-xs font-semibold mb-3">Distribución de Gastos</p>
          {categories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={categories} dataKey="total" nameKey="categoria" cx="50%" cy="50%"
                    innerRadius={35} outerRadius={60} paddingAngle={2} strokeWidth={0}>
                    {categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => formatMonto(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {categories.slice(0, 5).map((c, i) => (
                  <div key={c.categoria} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[120px]">{c.categoria}</span>
                    </div>
                    <span className="font-money">{c.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-10">Sin datos de categorías</p>
          )}
        </Card>
      </div>

      {/* Margin trend */}
      <Card className="p-4 border-border" style={{ background: "hsl(var(--bg-card))" }}>
        <p className="text-xs font-semibold mb-3">Evolución del Margen Operativo</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bg-border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--text-3))" }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: "hsl(var(--text-3))" }} width={40} />
            <RTooltip
              contentStyle={{ background: "hsl(var(--bg-surface))", border: "1px solid hsl(var(--bg-border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Bar dataKey="Margen" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.Margen >= 0 ? "hsl(142,71%,45%)" : "hsl(0,84%,60%)"} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* P&L Table with drill-down */}
      <Card className="border-border overflow-hidden" style={{ background: "hsl(var(--bg-card))" }}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ background: "hsl(var(--bg-surface))" }}>
          <p className="text-xs font-semibold">Detalle Mensual — Click para desglose</p>
          <Badge variant="outline" className="text-[10px]">Interactivo</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border" style={{ background: "hsl(var(--bg-surface))" }}>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mes</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ingresos</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Egresos</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Resultado</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Margen</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">vs {Number(anio) - 1}</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Señal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const prevR = prevRows[i];
                const yoyChange = prevR && prevR.resultado !== 0 ? ((r.resultado - prevR.resultado) / Math.abs(prevR.resultado)) * 100 : undefined;
                const hasData = r.ingresos > 0 || r.egresos > 0;
                const isExpanded = expandedMonth === r.mes;

                return (
                  <tr key={r.mes}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      hasData && "cursor-pointer hover:bg-card/80",
                      isExpanded && "bg-primary/5"
                    )}
                    onClick={() => hasData && handleDrill(r.mes)}
                  >
                    <td className="px-3 py-2 text-muted-foreground">
                      {hasData && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                    </td>
                    <td className="px-3 py-2 font-medium">{MESES_FULL[r.mes - 1]}</td>
                    <td className="px-3 py-2 text-right font-money text-positive">{hasData ? formatMonto(r.ingresos) : "—"}</td>
                    <td className="px-3 py-2 text-right font-money text-negative">{hasData ? formatMonto(r.egresos) : "—"}</td>
                    <td className={cn("px-3 py-2 text-right font-money font-semibold", r.resultado >= 0 ? "text-positive" : "text-negative")}>
                      {hasData ? `${r.resultado >= 0 ? "+" : "-"}${formatMonto(Math.abs(r.resultado))}` : "—"}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-money", r.margen >= 15 ? "text-positive" : r.margen >= 0 ? "text-warning" : "text-negative")}>
                      {hasData ? `${r.margen.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">
                      {yoyChange !== undefined ? (
                        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium",
                          yoyChange >= 0 ? "text-positive" : "text-negative")}>
                          {yoyChange >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                          {Math.abs(yoyChange).toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {hasData && (
                        r.margen >= 15 ? <div className="h-2.5 w-2.5 rounded-full bg-positive mx-auto" title="Saludable" /> :
                        r.margen >= 0 ? <div className="h-2.5 w-2.5 rounded-full bg-warning mx-auto" title="Ajustado" /> :
                        <div className="h-2.5 w-2.5 rounded-full bg-negative mx-auto animate-pulse" title="En rojo" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-primary/30 font-semibold" style={{ background: "hsl(var(--bg-surface))" }}>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2">Total {anio}</td>
                <td className="px-3 py-2 text-right font-money text-positive">{formatMonto(totals.ingresos)}</td>
                <td className="px-3 py-2 text-right font-money text-negative">{formatMonto(totals.egresos)}</td>
                <td className={cn("px-3 py-2 text-right font-money", totals.resultado >= 0 ? "text-positive" : "text-negative")}>
                  {totals.resultado >= 0 ? "+" : "-"}{formatMonto(Math.abs(totals.resultado))}
                </td>
                <td className={cn("px-3 py-2 text-right font-money", totals.margen >= 0 ? "text-positive" : "text-negative")}>
                  {totals.margen.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right hidden sm:table-cell">
                  {pctChange(totals.resultado, prevTotals.resultado) !== undefined && (
                    <span className={cn("text-[10px] font-medium",
                      pctChange(totals.resultado, prevTotals.resultado)! >= 0 ? "text-positive" : "text-negative")}>
                      {pctChange(totals.resultado, prevTotals.resultado)! >= 0 ? "+" : ""}
                      {pctChange(totals.resultado, prevTotals.resultado)!.toFixed(0)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drill-down panel */}
      {drillItems.length > 0 && (
        <DrillPanel items={drillItems} title={drillTitle} onClose={() => { setExpandedMonth(null); setDrillItems([]); }} />
      )}
    </div>
  );
}
