import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Trash2, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ModalExcelUpload } from "@/components/movimientos/ModalExcelUpload";
import { useNavigate } from "react-router-dom";
import { formatMonto } from "@/components/shared/MontoDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface UploadRecord {
  id: string;
  nombre_archivo: string;
  total_filas: number;
  filas_importadas: number;
  filas_error: number;
  created_at: string;
}

interface UploadStats {
  upload_id: string;
  movCount: number;
  totalMonto: number;
  empresas: string[];
}

export default function CargasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [stats, setStats] = useState<Record<string, UploadStats>>({});
  const [loading, setLoading] = useState(true);
  const [excelOpen, setExcelOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canDelete = user && ["SUPER_ADMIN", "SUPER_ADMIN_DEV"].includes(user.rol);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("excel_uploads")
      .select("id, nombre_archivo, total_filas, filas_importadas, filas_error, created_at")
      .order("created_at", { ascending: false });

    const records = (data ?? []) as UploadRecord[];
    setUploads(records);

    // Load stats for each upload
    if (records.length > 0) {
      const statsMap: Record<string, UploadStats> = {};
      // Get aggregate data per upload_id
      for (const rec of records) {
        const { data: movData } = await supabase
          .from("movimientos")
          .select("monto, empresa")
          .eq("upload_id", rec.id)
          .eq("activo", true);

        const rows = movData ?? [];
        const empresasSet = new Set(rows.map((r: any) => r.empresa));
        statsMap[rec.id] = {
          upload_id: rec.id,
          movCount: rows.length,
          totalMonto: rows.reduce((s: number, r: any) => s + Math.abs(Number(r.monto)), 0),
          empresas: Array.from(empresasSet).sort(),
        };
      }
      setStats(statsMap);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (uploadId: string) => {
    setDeletingId(uploadId);
    // Delete movimientos for this upload
    await supabase.from("movimientos").delete().eq("upload_id", uploadId);
    // Delete the upload record
    await supabase.from("excel_uploads").delete().eq("id", uploadId);
    setDeletingId(null);
    toast.success("Carga eliminada correctamente");
    load();
  };

  const handleViewMovimientos = (uploadId: string) => {
    navigate(`/movimientos?upload=${uploadId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Cargas de Excel</h1>
          <p className="text-sm text-muted-foreground">{uploads.length} archivos importados</p>
        </div>
        <Button size="sm" className="gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0" onClick={() => setExcelOpen(true)}>
          <Upload className="h-4 w-4" /> Nueva Carga
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : uploads.length === 0 ? (
        <Card className="p-10 text-center border-border" style={{ background: "hsl(var(--bg-card))" }}>
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No hay cargas registradas</p>
          <p className="text-xs text-muted-foreground mt-1">Sube tu primer archivo Excel para comenzar</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {uploads.map((u, idx) => {
            const s = stats[u.id];
            return (
              <Card
                key={u.id}
                className="p-4 border-border flex flex-col sm:flex-row items-start gap-4 hover:bg-[hsl(var(--bg-card-hover))] transition-colors"
                style={{ background: "hsl(var(--bg-card))" }}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.nombre_archivo}</p>
                    {idx === 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Más reciente</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(u.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {u.filas_importadas.toLocaleString()} filas
                    </span>
                    {u.filas_error > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {u.filas_error} errores
                      </span>
                    )}
                    {s && (
                      <>
                        <span>Monto total: {formatMonto(s.totalMonto)}</span>
                        <span>{s.empresas.length} empresa{s.empresas.length !== 1 ? "s" : ""}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => handleViewMovimientos(u.id)}>
                    <Eye className="h-4 w-4" /> Ver
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar esta carga?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminarán los {u.filas_importadas.toLocaleString()} movimientos asociados a "{u.nombre_archivo}". Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingId === u.id ? "Eliminando..." : "Eliminar"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ModalExcelUpload open={excelOpen} onClose={() => setExcelOpen(false)} onDone={load} />
    </div>
  );
}
