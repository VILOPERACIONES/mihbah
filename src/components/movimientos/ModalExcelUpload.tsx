import { useState, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TipoChip } from "@/components/shared/TipoChip";
import { MontoDisplay } from "@/components/shared/MontoDisplay";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Building2, Calendar, Hash, ArrowUpDown, X } from "lucide-react";
import * as XLSX from "xlsx";

const TIPOS_VALIDOS = ["INGRESO", "SALIDA", "INTERNO", "PRESTAMO"] as const;
const BATCH_SIZE = 250;

interface FilaParsed {
  empresa: string;
  anio: number;
  mes: number;
  fecha: string;
  tipo: "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO";
  categoria: string | null;
  grupo: string | null;
  nombre: string | null;
  concepto: string;
  monto: number;
  cuenta: string | null;
  proyecto: string | null;
  comentario: string | null;
}

interface ParseError {
  fila: number;
  error: string;
}

type Step = "select" | "parsing" | "preview" | "importing" | "done";

function normalizeDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
}

function parsearFecha(valor: unknown): Date | null {
  if (valor instanceof Date && !isNaN(valor.getTime())) return normalizeDate(valor);

  if (typeof valor === "number") {
    const parsed = XLSX.SSF.parse_date_code(valor);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0));
    }
  }

  if (typeof valor === "string" && valor.trim()) {
    const text = valor.trim();

    const mxMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (mxMatch) {
      const day = Number(mxMatch[1]);
      const month = Number(mxMatch[2]);
      const rawYear = Number(mxMatch[3]);
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }

    const iso = new Date(text);
    if (!isNaN(iso.getTime())) return normalizeDate(iso);
  }

  return null;
}

function parsearMonto(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;

  if (typeof valor === "string") {
    const text = valor.trim();
    if (!text) return NaN;

    const negativeByParens = text.startsWith("(") && text.endsWith(")");
    const cleaned = text
      .replace(/[$,\s]/g, "")
      .replace(/[()]/g, "")
      .replace(/[^0-9.-]/g, "");

    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return negativeByParens ? -parsed : parsed;
  }

  return NaN;
}

function parseExcel(buffer: ArrayBuffer): { filas: FilaParsed[]; errores: ParseError[]; totalRaw: number } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((n) => n.trim().toUpperCase() === "BASE") || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("No se encontró una hoja válida para importar.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 2,
    defval: null,
    raw: true,
  });

  const filas: FilaParsed[] = [];
  const errores: ParseError[] = [];

  rawRows.forEach((row, idx) => {
    const numFila = idx + 4;

    try {
      const empresa = String(row["EMPRESA"] ?? "").trim().toUpperCase();
      const conceptoRaw = String(row["CONCEPTO"] ?? "").trim();
      const tipoRaw = String(row["TIPO"] ?? "").trim().toUpperCase();
      const montoRaw = parsearMonto(row["MONTO"]);

      if (!empresa) throw new Error("EMPRESA vacía");

      // Fallback para concepto vacío
      const categoria = row["CATEGORÍA"] ? String(row["CATEGORÍA"]).trim().toUpperCase() : "";
      const grupo = row["GRUPO"] ? String(row["GRUPO"]).trim() : "";
      const nombre = row["NOMBRE"] ? String(row["NOMBRE"]).trim() : "";
      const concepto = conceptoRaw
        || (categoria && grupo ? `${categoria} - ${grupo}` : "")
        || categoria
        || nombre
        || "Sin concepto";
      if (Number.isNaN(montoRaw)) throw new Error(`MONTO inválido: \"${String(row["MONTO"] ?? "")}\"`);
      if (!TIPOS_VALIDOS.includes(tipoRaw as FilaParsed["tipo"])) {
        throw new Error(`TIPO inválido: \"${tipoRaw}\"`);
      }

      const fechaObj = parsearFecha(row["FECHA"]);
      if (!fechaObj) throw new Error(`Fecha inválida: \"${String(row["FECHA"] ?? "")}\"`);

      const anio = Number(row["AÑO"]) || fechaObj.getUTCFullYear();
      const mes = Number(row["MES"]) || fechaObj.getUTCMonth() + 1;

      if (mes < 1 || mes > 12) throw new Error(`MES inválido: ${mes}`);

      filas.push({
        empresa,
        anio,
        mes,
        fecha: fechaObj.toISOString(),
        tipo: tipoRaw as FilaParsed["tipo"],
        categoria: row["CATEGORÍA"] ? String(row["CATEGORÍA"]).trim().toUpperCase() : null,
        grupo: row["GRUPO"] ? String(row["GRUPO"]).trim() : null,
        nombre: row["NOMBRE"] ? String(row["NOMBRE"]).trim() : null,
        concepto,
        monto: montoRaw,
        cuenta: row["CUENTA"] ? String(row["CUENTA"]).trim() : null,
        proyecto: row["PROYECTO"] ? String(row["PROYECTO"]).trim().toUpperCase() : null,
        comentario: row["COMENTARIO"] ? String(row["COMENTARIO"]).trim() : null,
      });
    } catch (e) {
      errores.push({
        fila: numFila,
        error: e instanceof Error ? e.message : "Error desconocido al leer la fila",
      });
    }
  });

  return { filas, errores, totalRaw: rawRows.length };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

export function ModalExcelUpload({ open, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [fileName, setFileName] = useState("");
  const [filas, setFilas] = useState<FilaParsed[]>([]);
  const [errores, setErrores] = useState<ParseError[]>([]);
  const [totalRaw, setTotalRaw] = useState(0);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("select");
    setFileName("");
    setFilas([]);
    setErrores([]);
    setTotalRaw(0);
    setProgress(0);
    setImportResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStep("parsing");

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcel(buffer);
      setFilas(result.filas);
      setErrores(result.errores);
      setTotalRaw(result.totalRaw);
      setStep("preview");
    } catch {
      setFilas([]);
      setErrores([{ fila: 0, error: "No se pudo leer este archivo. Asegúrate de que sea un Excel válido con una hoja BASE." }]);
      setTotalRaw(0);
      setStep("preview");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);

    let imported = 0;
    const batchErrors: ParseError[] = [];

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrores([{ fila: 0, error: "Tu sesión expiró. Inicia sesión de nuevo para importar." }]);
      setImportResult({ ok: 0, fail: filas.length });
      setStep("done");
      return;
    }

    // Crear registro de upload primero para obtener el upload_id
    const { data: uploadRecord, error: uploadError } = await supabase.from("excel_uploads").insert([
      {
        nombre_archivo: fileName,
        total_filas: totalRaw,
        filas_importadas: 0,
        filas_error: 0,
        errores_detalle: null,
        subido_por_id: user.id,
      },
    ]).select("id").single();

    if (uploadError || !uploadRecord) {
      setErrores([{ fila: 0, error: "No se pudo registrar la carga: " + (uploadError?.message ?? "Error desconocido") }]);
      setImportResult({ ok: 0, fail: filas.length });
      setStep("done");
      return;
    }

    const uploadId = uploadRecord.id;

    for (let i = 0; i < filas.length; i += BATCH_SIZE) {
      const batch = filas.slice(i, i + BATCH_SIZE).map((f) => ({
        empresa: f.empresa,
        anio: f.anio,
        mes: f.mes,
        fecha: f.fecha,
        tipo: f.tipo,
        categoria: f.categoria,
        grupo: f.grupo,
        nombre: f.nombre,
        concepto: f.concepto,
        monto: f.monto,
        cuenta: f.cuenta,
        proyecto: f.proyecto,
        comentario: f.comentario,
        fuente: "EXCEL",
        upload_id: uploadId,
      }));

      const { error } = await supabase.from("movimientos").insert(batch);

      if (error) {
        batchErrors.push({ fila: i + 4, error: error.message });
      } else {
        imported += batch.length;
      }

      setProgress(Math.round((Math.min(i + batch.length, filas.length) / Math.max(filas.length, 1)) * 100));
    }

    const uploadErrors: Json | null =
      errores.length + batchErrors.length > 0
        ? ([...errores, ...batchErrors].map((item) => ({ fila: item.fila, error: item.error })) as unknown as Json)
        : null;

    // Actualizar el registro de upload con los resultados
    await supabase.from("excel_uploads").update({
      filas_importadas: imported,
      filas_error: errores.length + batchErrors.length,
      errores_detalle: uploadErrors,
    }).eq("id", uploadId);

    setImportResult({ ok: imported, fail: filas.length - imported });
    setErrores((prev) => [...prev, ...batchErrors]);
    setStep("done");
  };

  // Compute summary stats for preview
  const previewStats = useMemo(() => {
    if (filas.length === 0) return null;
    const empresas = [...new Set(filas.map((f) => f.empresa))];
    const tipos = filas.reduce<Record<string, number>>((acc, f) => {
      acc[f.tipo] = (acc[f.tipo] || 0) + 1;
      return acc;
    }, {});
    const totalIngresos = filas.filter((f) => f.tipo === "INGRESO").reduce((s, f) => s + f.monto, 0);
    const totalSalidas = filas.filter((f) => f.tipo === "SALIDA").reduce((s, f) => s + Math.abs(f.monto), 0);
    const periodos = [...new Set(filas.map((f) => `${f.anio}-${String(f.mes).padStart(2, "0")}`))].sort();
    return { empresas, tipos, totalIngresos, totalSalidas, periodos };
  }, [filas]);

  const isPreviewStep = step === "preview";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={`bg-[hsl(var(--bg-card))] border-border transition-all ${
          isPreviewStep
            ? "sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            : "sm:max-w-lg"
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {isPreviewStep ? "Validar datos antes de importar" : "Importar Excel"}
          </DialogTitle>
          {isPreviewStep && (
            <DialogDescription className="text-muted-foreground">
              Revisa el resumen y la vista previa antes de confirmar la importación de <strong>{fileName}</strong>
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "select" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra tu Excel aquí</p>
            <p className="text-xs text-muted-foreground mt-1">o haz click para seleccionar (.xlsx, .xls)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {step === "parsing" && (
          <div className="py-8 text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Analizando {fileName}...</p>
          </div>
        )}

        {step === "preview" && previewStats && (
          <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3 space-y-1" style={{ background: "hsl(var(--bg-surface))" }}>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Registros</span>
                </div>
                <p className="text-xl font-bold text-foreground">{filas.length.toLocaleString()}</p>
                {errores.length > 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {errores.length} con error
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1" style={{ background: "hsl(var(--bg-surface))" }}>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Empresas</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {previewStats.empresas.map((e) => (
                    <Badge key={e} variant="secondary" className="text-xs px-1.5 py-0">{e}</Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1" style={{ background: "hsl(var(--bg-surface))" }}>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Períodos</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {previewStats.periodos.length === 1
                    ? previewStats.periodos[0]
                    : `${previewStats.periodos[0]} → ${previewStats.periodos[previewStats.periodos.length - 1]}`}
                </p>
                <p className="text-xs text-muted-foreground">{previewStats.periodos.length} mes(es)</p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1" style={{ background: "hsl(var(--bg-surface))" }}>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Totales</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ingresos</span>
                    <MontoDisplay monto={previewStats.totalIngresos} tipo="INGRESO" size="sm" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Salidas</span>
                    <MontoDisplay monto={-previewStats.totalSalidas} tipo="SALIDA" size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tipo breakdown */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Tipos:</span>
              {Object.entries(previewStats.tipos).map(([tipo, count]) => (
                <div key={tipo} className="flex items-center gap-1.5">
                  <TipoChip tipo={tipo as FilaParsed["tipo"]} />
                  <span className="text-xs text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>

            {/* Data table */}
            <div className="border border-border rounded-lg overflow-hidden flex-1 min-h-0">
              <div className="overflow-auto max-h-[40vh]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: "hsl(var(--bg-surface))" }}>
                      {["#", "Empresa", "Fecha", "Tipo", "Categoría", "Concepto", "Cuenta", "Monto"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-border">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filas.slice(0, 50).map((f, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium whitespace-nowrap">{f.empresa}</td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                          {new Date(f.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-3 py-1.5"><TipoChip tipo={f.tipo} /></td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[120px] truncate">{f.categoria ?? "—"}</td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate">{f.concepto}</td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{f.cuenta ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right"><MontoDisplay monto={f.monto} tipo={f.tipo} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filas.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border" style={{ background: "hsl(var(--bg-surface))" }}>
                  Mostrando 50 de {filas.length.toLocaleString()} registros
                </div>
              )}
            </div>

            {/* Errors */}
            {errores.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {errores.length} filas con errores (no se importarán)
                </summary>
                <div className="mt-2 max-h-28 overflow-y-auto space-y-1 text-muted-foreground rounded-lg border border-border p-2" style={{ background: "hsl(var(--bg-surface))" }}>
                  {errores.slice(0, 20).map((e, i) => (
                    <p key={i}><span className="font-medium text-foreground">Fila {e.fila}:</span> {e.error}</p>
                  ))}
                  {errores.length > 20 && <p className="text-muted-foreground italic">... y {errores.length - 20} más</p>}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border shrink-0">
              <Button variant="ghost" onClick={handleClose} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button onClick={handleImport} className="gap-2" disabled={filas.length === 0}>
                <Upload className="h-4 w-4" />
                Confirmar importación ({filas.length.toLocaleString()} registros)
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-6 space-y-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              Guardando... {Math.round((progress / 100) * filas.length).toLocaleString()} / {filas.length.toLocaleString()}
            </p>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div>
              <p className="text-sm font-medium">Importación completada</p>
              <p className="text-xs text-muted-foreground mt-1">
                {importResult.ok.toLocaleString()} registros guardados
                {importResult.fail > 0 && ` · ${importResult.fail} fallidos`}
              </p>
            </div>
            <Button onClick={() => { handleClose(); onDone(); }}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
