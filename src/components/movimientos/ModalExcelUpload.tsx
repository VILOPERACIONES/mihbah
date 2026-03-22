import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TipoChip } from "@/components/shared/TipoChip";
import { MontoDisplay } from "@/components/shared/MontoDisplay";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";

const TIPOS_VALIDOS = ["INGRESO", "SALIDA", "INTERNO", "PRESTAMO"] as const;
const BATCH_SIZE = 500;

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

function parsearFecha(valor: unknown): Date | null {
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
  if (typeof valor === "number") {
    return new Date(Math.round((valor - 25569) * 86400 * 1000));
  }
  if (typeof valor === "string" && valor.trim()) {
    const d = new Date(valor);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseExcel(buffer: ArrayBuffer): { filas: FilaParsed[]; errores: ParseError[]; totalRaw: number } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((n) => n.trim().toUpperCase() === "BASE") || workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    range: 2,
    defval: null,
    raw: false,
  });

  const filas: FilaParsed[] = [];
  const errores: ParseError[] = [];

  rawRows.forEach((row, idx) => {
    const numFila = idx + 4;
    try {
      const empresa = String(row["EMPRESA"] ?? "").trim().toUpperCase();
      const concepto = String(row["CONCEPTO"] ?? "").trim();
      const tipoRaw = String(row["TIPO"] ?? "").trim().toUpperCase();
      const montoRaw = Number(row["MONTO"]);

      if (!empresa) throw new Error("EMPRESA vacía");
      if (!concepto) throw new Error("CONCEPTO vacío");
      if (isNaN(montoRaw)) throw new Error(`MONTO inválido: "${row["MONTO"]}"`);
      if (!TIPOS_VALIDOS.includes(tipoRaw as any)) throw new Error(`TIPO inválido: "${tipoRaw}"`);

      const fechaObj = parsearFecha(row["FECHA"]);
      if (!fechaObj) throw new Error(`Fecha inválida: "${row["FECHA"]}"`);

      const anio = Number(row["AÑO"]) || fechaObj.getFullYear();
      const mes = Number(row["MES"]) || fechaObj.getMonth() + 1;

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
    } catch (e: any) {
      errores.push({ fila: numFila, error: e.message });
    }
  });

  return { filas, errores, totalRaw: rawRows.length };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
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
    const buffer = await file.arrayBuffer();
    const result = parseExcel(buffer);
    setFilas(result.filas);
    setErrores(result.errores);
    setTotalRaw(result.totalRaw);
    setStep("preview");
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create upload record
    const { data: upload } = await supabase.from("excel_uploads").insert({
      nombre_archivo: fileName,
      total_filas: totalRaw,
      filas_importadas: 0,
      filas_error: errores.length,
      errores_detalle: errores.length > 0 ? errores as any : null,
      subido_por_id: user.id,
    }).select("id").single();

    const uploadId = upload?.id;
    let imported = 0;

    for (let i = 0; i < filas.length; i += BATCH_SIZE) {
      const batch = filas.slice(i, i + BATCH_SIZE).map((f) => ({
        empresa: f.empresa,
        anio: f.anio,
        mes: f.mes,
        fecha: f.fecha,
        tipo: f.tipo as "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO",
        categoria: f.categoria,
        grupo: f.grupo,
        nombre: f.nombre,
        concepto: f.concepto,
        monto: f.monto,
        cuenta: f.cuenta,
        proyecto: f.proyecto,
        comentario: f.comentario,
        fuente: "EXCEL",
        upload_id: uploadId ?? undefined,
      }));

      const { error } = await supabase.from("movimientos").insert(batch);
      if (!error) imported += batch.length;
      setProgress(Math.round(((i + batch.length) / filas.length) * 100));
    }

    // Update upload record
    if (uploadId) {
      await supabase.from("excel_uploads").update({ filas_importadas: imported }).eq("id", uploadId);
    }

    setImportResult({ ok: imported, fail: filas.length - imported });
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg bg-[hsl(var(--bg-card))] border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Excel
          </DialogTitle>
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

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium">{filas.length.toLocaleString()} filas válidas</p>
                {errores.length > 0 && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {errores.length} errores
                  </p>
                )}
              </div>
            </div>

            {/* Preview table */}
            <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--bg-surface))]">
                    {["Empresa", "Tipo", "Concepto", "Monto"].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 5).map((f, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{f.empresa}</td>
                      <td className="px-3 py-1.5"><TipoChip tipo={f.tipo} /></td>
                      <td className="px-3 py-1.5 max-w-[150px] truncate">{f.concepto}</td>
                      <td className="px-3 py-1.5"><MontoDisplay monto={f.monto} tipo={f.tipo} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errores.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-amber-400">Ver errores ({errores.length})</summary>
                <div className="mt-2 max-h-28 overflow-y-auto space-y-1 text-muted-foreground">
                  {errores.slice(0, 20).map((e, i) => (
                    <p key={i}>Fila {e.fila}: {e.error}</p>
                  ))}
                </div>
              </details>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar {filas.length.toLocaleString()} registros
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
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
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
