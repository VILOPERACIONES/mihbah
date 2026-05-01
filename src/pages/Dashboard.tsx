import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/store/app.store";
import { MontoDisplay, formatMonto, formatMontoAbreviado } from "@/components/shared/MontoDisplay";
import { TipoChip } from "@/components/shared/TipoChip";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Percent, ArrowUpDown, Calendar, FileCheck, FileWarning, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

interface CuentasDashboard {
  cxc: number;
  cxp: number;
}

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export default function DashboardPage() {
  const { empresaActiva, dataVersion } = useAppStore();
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
  const [cuentas, setCuentas] = useState<CuentasDashboard | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setPeriodsLoaded(false);
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    apiFetch<{ periodos: { anio: number; mes: number }[] }>("/api/dashboard/periodos")
      .then(({ periodos }) => {
        setAvailablePeriods(periodos);
        if (periodos.length > 0) {
          setSelectedAnio(periodos[0].anio);
          setSelectedMes(periodos[0].mes);
        }
        setPeriodsLoaded(true);
      })
      .catch(() => setPeriodsLoaded(true));
  }, [refreshKey, dataVersion]);

  const availableYears = useMemo(() =>
    [...new Set(availablePeriods.map((p) => p.anio))].sort((a, b) => b - a),
    [availablePeriods]
  );

  const availableMonths = useMemo(() =>
    availablePeriods.filter((p) => p.anio === selectedAnio).map((p) => p.mes).sort((a, b) => a - b),
    [availablePeriods, selectedAnio]
  );

  useEffect(() => {
    if (!periodsLoaded) return;

    if (!selectedAnio || !selectedMes) {
      setKpis({ ingresos: 0, salidas: 0, resultado: 0, margen: 0, conteoIngresos: 0, conteoSalidas: 0 });
      setFlujo([]);
      setTopCats([]);
      setRecientes([]);
      setCuentas({ cxc: 0, cxp: 0 });
      setPeriodoLabel("Sin datos");
      setLoading(false);
      return;
    }

    const empresa = empresaActiva !== "TODAS" ? empresaActiva : "";
    const anioDesde = selectedAnio - 2;
    setPeriodoLabel(`${MESES[selectedMes]} ${selectedAnio}`);

    const params = new URLSearchParams({
      anio: String(selectedAnio),
      mes: String(selectedMes),
      ...(empresa ? { empresa } : {}),
    });

    setLoading(true);
    Promise.all([
      apiFetch<KPIs>(`/api/dashboard/kpis?${params}`),
      apiFetch<{ flujo: FlujoMes[] }>(`/api/dashboard/flujo?anioDesde=${anioDesde}${empresa ? `&empresa=${empresa}` : ""}`),
      apiFetch<{ categorias: CatGasto[] }>(`/api/dashboard/categorias?${params}&limite=8`),
      apiFetch<{ movimientos: Movimiento[] }>(`/api/dashboard/recientes${empresa ? `?empresa=${empresa}` : ""}`),
      apiFetch<CuentasDashboard>(`/api/dashboard/cuentas${empresa ? `?empresa=${empresa}` : ""}`),
    ])
      .then(([kpiData, flujoData, catData, recData, cuentasData]) => {
        setKpis(kpiData);
        setFlujo(flujoData.flujo);
        setTopCats(catData.categorias);
        setRecientes(recData.movimientos);
        setCuentas(cuentasData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [empresaActiva, selectedAnio, selectedMes, periodsLoaded, dataVersion]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Refrescar datos">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedMes ? String(selectedMes) : ""}
            onValueChange={(v) => setSelectedMes(Number(v))}
            disabled={availableMonths.length === 0}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={String(m)}>{MESES[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedAnio ? String(selectedAnio) : ""}
            onValueChange={(v) => setSelectedAnio(Number(v))}
            disabled={availableYears.length === 0}
          >
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue placeholder="Año" />
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
          <Card key={kpi.label} className="p-3 sm:p-4 border-border rounded-xl bg-card hover:bg-muted/50 transition-colors overflow-hidden">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <kpi.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{kpi.label}</span>
            </div>
            {"isPercent" in kpi && kpi.isPercent ? (
              <span className={`font-money text-base sm:text-lg md:text-2xl font-semibold ${kpi.value >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {kpi.value >= 0 ? "+" : ""}{kpi.value}%
              </span>
            ) : (
              <MontoDisplay monto={kpi.value} tipo={kpi.tipo} size="xl" />
            )}
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">MXN</p>
          </Card>
        ))}
      </div>

      {/* CXC / CXP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <Card className="p-4 border-border rounded-xl bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <FileCheck className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Cuentas por Cobrar</span>
          </div>
          <MontoDisplay monto={cuentas?.cxc ?? 0} tipo="INGRESO" size="xl" />
          <p className="text-xs text-muted-foreground mt-2">Basado en ingresos de clientes registrados</p>
        </Card>
        <Card className="p-4 border-border rounded-xl bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <FileWarning className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground font-medium">Cuentas por Pagar</span>
          </div>
          <MontoDisplay monto={cuentas?.cxp ?? 0} tipo="SALIDA" size="xl" />
          <p className="text-xs text-muted-foreground mt-2">Basado en obligaciones y filiales registradas</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 border-border rounded-xl bg-card">
          <h3 className="text-sm font-medium text-foreground mb-4">Flujo Mensual</h3>
          {flujo.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
              Sin movimientos registrados — importa tu primer Excel
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={flujo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: "#CCCCCC" }} />
                <YAxis tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "#CCCCCC" }} />
                <Tooltip
                  contentStyle={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 8, fontSize: 12, color: "#FFFFFF" }}
                  formatter={(v: number, name: string) => [formatMonto(v, true), name === "ingresos" ? "Ingresos" : name === "salidas" ? "Egresos" : "Balance"]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#CCCCCC" }} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="salidas" name="Egresos" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="balance" name="Balance" stroke="#4ADE80" fill="none" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4 border-border rounded-xl bg-card">
          <h3 className="text-sm font-medium text-foreground mb-4">Top Egresos por Categoría</h3>
          {topCats.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
              Sin egresos categorizados en este período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topCats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis type="number" tickFormatter={formatMontoAbreviado} tick={{ fontSize: 10, fill: "#CCCCCC" }} />
                <YAxis dataKey="categoria" type="category" width={100} tick={{ fontSize: 10, fill: "#CCCCCC" }} />
                <Tooltip
                  contentStyle={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 8, fontSize: 12, color: "#FFFFFF" }}
                  formatter={(v: number) => [formatMonto(v, true), "Total"]}
                />
                <Bar dataKey="total" name="Total" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Últimos Movimientos */}
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
