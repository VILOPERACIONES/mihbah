import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app.store";
import { supabase } from "@/integrations/supabase/client";
import { MontoDisplay, formatMonto } from "@/components/shared/MontoDisplay";
import { TipoChip } from "@/components/shared/TipoChip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import { ModalExcelUpload } from "@/components/movimientos/ModalExcelUpload";
import { MovimientoDetailSheet } from "@/components/movimientos/MovimientoDetailSheet";
import { useSearchParams, useNavigate } from "react-router-dom";

const TIPOS = ["INGRESO", "SALIDA", "INTERNO", "PRESTAMO"];
const PAGE_SIZE = 50;

interface Mov {
  id: string;
  fecha: string;
  empresa: string;
  tipo: string;
  categoria: string | null;
  grupo: string | null;
  concepto: string;
  nombre: string | null;
  monto: number;
  cuenta: string | null;
  proyecto: string | null;
}

export default function MovimientosPage() {
  const { empresaActiva, filtroTipo, filtroBusqueda, setFiltro } = useAppStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [movs, setMovs] = useState<Mov[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [excelOpen, setExcelOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cardData, setCardData] = useState({ ventas: 0, ventasCount: 0, inversion: 0, inversionCount: 0 });
  const [activeUpload, setActiveUpload] = useState<{ id: string; nombre: string } | null>(null);
  const [latestUploadId, setLatestUploadId] = useState<string | null>(null);

  // Determine which upload_id to filter by
  const uploadParam = searchParams.get("upload");

  // Load latest upload id for reference only
  useEffect(() => {
    async function fetchLatest() {
      const { data } = await supabase
        .from("excel_uploads")
        .select("id, nombre_archivo")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLatestUploadId(data[0].id);
      }
    }
    fetchLatest();
  }, []);

  // Set active upload only from URL param
  useEffect(() => {
    if (uploadParam) {
      supabase
        .from("excel_uploads")
        .select("id, nombre_archivo")
        .eq("id", uploadParam)
        .single()
        .then(({ data }) => {
          if (data) setActiveUpload({ id: data.id, nombre: data.nombre_archivo });
        });
    } else {
      setActiveUpload(null);
    }
  }, [uploadParam]);

  const effectiveUploadId = uploadParam || activeUpload?.id || null;

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("movimientos")
      .select("id, fecha, empresa, tipo, categoria, grupo, concepto, nombre, monto, cuenta, proyecto", { count: "exact" })
      .eq("activo", true)
      .order("fecha", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (effectiveUploadId) query = query.eq("upload_id", effectiveUploadId);
    if (empresaActiva !== "TODAS") query = query.eq("empresa", empresaActiva);
    if (tipoFilter !== "all") query = query.eq("tipo", tipoFilter as "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO");
    if (filtroBusqueda) query = query.ilike("concepto", `%${filtroBusqueda}%`);

    const { data, count } = await query;
    setMovs((data as Mov[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [empresaActiva, tipoFilter, filtroBusqueda, page, effectiveUploadId]);

  const loadCards = useCallback(async () => {
    const baseFilter = (q: any) => {
      let r = q.eq("activo", true).eq("tipo", "INGRESO");
      if (empresaActiva !== "TODAS") r = r.eq("empresa", empresaActiva);
      return r;
    };

    const [ventasRes, inversionRes] = await Promise.all([
      baseFilter(supabase.from("movimientos").select("monto", { count: "exact" }))
        .eq("categoria", "CLIENTES"),
      baseFilter(supabase.from("movimientos").select("monto", { count: "exact" }))
        .in("categoria", ["ACCIONISTAS", "SOCIOS", "EMPRESA"]),
    ]);

    const sum = (rows: any[] | null) => (rows ?? []).reduce((s: number, r: any) => s + Number(r.monto), 0);
    setCardData({
      ventas: sum(ventasRes.data),
      ventasCount: ventasRes.count ?? 0,
      inversion: sum(inversionRes.data),
      inversionCount: inversionRes.count ?? 0,
    });
  }, [empresaActiva]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => { setPage(0); }, [empresaActiva, tipoFilter, filtroBusqueda]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Active upload indicator */}
      {activeUpload && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs py-1 px-2.5">
            📄 {activeUpload.nombre}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setActiveUpload(null);
              navigate("/movimientos", { replace: true });
            }}
          >
            <X className="h-3 w-3 mr-1" /> Ver todos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => navigate("/cargas")}
          >
            Ir a Cargas
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 border-border flex flex-col gap-1" style={{ background: "hsl(var(--bg-card))" }}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingreso por Ventas</p>
          <p className="text-2xl font-semibold text-[hsl(var(--jade))]">{formatMonto(cardData.ventas)}</p>
          <p className="text-xs text-muted-foreground">{cardData.ventasCount.toLocaleString()} movimientos · Categoría: CLIENTES</p>
        </Card>
        <Card className="p-5 border-border flex flex-col gap-1" style={{ background: "hsl(var(--bg-card))" }}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingreso de Inversión</p>
          <p className="text-2xl font-semibold text-[hsl(var(--turquesa))]">{formatMonto(cardData.inversion)}</p>
          <p className="text-xs text-muted-foreground">{cardData.inversionCount.toLocaleString()} movimientos · ACCIONISTAS, SOCIOS, EMPRESA</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} registros</p>
        </div>
        <Button size="sm" className="gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0" onClick={() => setExcelOpen(true)}>
          <Upload className="h-4 w-4" /> Cargar Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3 border-border flex items-center gap-3 flex-wrap" style={{ background: "hsl(var(--bg-card))" }}>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-36 bg-background border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar concepto..."
            value={filtroBusqueda}
            onChange={(e) => setFiltro("filtroBusqueda", e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="border-border rounded-xl overflow-hidden" style={{ background: "hsl(var(--bg-card))" }}>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "hsl(var(--bg-surface))" }}>
                  {["Fecha", "Empresa", "Tipo", "Categoría", "Concepto", "Nombre", "Monto", "Cuenta", "Proyecto"].map((h) => (
                    <th key={h} className={`px-4 py-2 text-xs font-medium text-muted-foreground ${h === "Monto" ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movs.map((m, i) => (
                  <tr
                    key={m.id}
                    className="border-t border-border hover:bg-[hsl(var(--bg-card-hover))] transition-colors cursor-pointer"
                    style={{ background: i % 2 === 0 ? undefined : "hsl(var(--bg-base))" }}
                    onClick={() => setDetailId(m.id)}
                  >
                    <td className="px-4 py-2 font-money text-xs text-muted-foreground">{new Date(m.fecha).toLocaleDateString("es-MX")}</td>
                    <td className="px-4 py-2 text-xs">{m.empresa}</td>
                    <td className="px-4 py-2"><TipoChip tipo={m.tipo} /></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{m.categoria ?? "—"}</td>
                    <td className="px-4 py-2 text-xs max-w-[180px] truncate">{m.concepto}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{m.nombre ?? "—"}</td>
                    <td className="px-4 py-2 text-right"><MontoDisplay monto={Number(m.monto)} tipo={m.tipo} size="sm" /></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{m.cuenta ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{m.proyecto ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page + 1} / {totalPages || 1}</span>
            <Button size="icon" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <ModalExcelUpload open={excelOpen} onClose={() => setExcelOpen(false)} onDone={load} />
      <MovimientoDetailSheet
        movimientoId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
