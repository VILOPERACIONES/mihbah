import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/app.store";
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
  nombreArchivo: string;
  totalFilas: number;
  filasImportadas: number;
  filasError: number;
  createdAt: string;
  stats: {
    movCount: number;
    totalMonto: number;
    empresas: string[];
  };
}

export default function CargasPage() {
  const { user } = useAuth();
  const { dataVersion } = useAppStore();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [excelOpen, setExcelOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canDelete = user && ["SUPER_ADMIN", "SUPER_ADMIN_DEV"].includes(user.rol);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/movimientos/cargas", { credentials: "include" });
      const { cargas } = await res.json() as { cargas: UploadRecord[] };
      setUploads(cargas ?? []);
    } catch {
      setUploads([]);
    }
    setLoading(false);
  }, [dataVersion]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (uploadId: string) => {
    setDeletingId(uploadId);
    try {
      await fetch(`/api/movimientos/cargas/${uploadId}`, { method: "DELETE", credentials: "include" });
      toast.success("Carga eliminada correctamente");
      load();
    } catch {
      toast.error("Error al eliminar la carga");
    }
    setDeletingId(null);
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
          {uploads.map((u, idx) => (
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
                  <p className="text-sm font-medium truncate">{u.nombreArchivo}</p>
                  {idx === 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Más reciente</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(u.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    {u.filasImportadas.toLocaleString()} filas
                  </span>
                  {u.filasError > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {u.filasError} errores
                    </span>
                  )}
                  {u.stats && (
                    <>
                      <span>Monto total: {formatMonto(u.stats.totalMonto)}</span>
                      {u.stats.empresas.length > 0 && (
                        <span>{u.stats.empresas.length} empresa{u.stats.empresas.length !== 1 ? "s" : ""}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end">
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
                          Se eliminarán los {u.filasImportadas.toLocaleString()} movimientos asociados a "{u.nombreArchivo}". Esta acción no se puede deshacer.
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
          ))}
        </div>
      )}

      <ModalExcelUpload open={excelOpen} onClose={() => setExcelOpen(false)} onDone={load} />
    </div>
  );
}
