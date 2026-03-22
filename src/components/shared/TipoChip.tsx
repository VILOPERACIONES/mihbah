import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<string, string> = {
  INGRESO: "bg-emerald-950 text-emerald-400 border border-emerald-800/60",
  SALIDA: "bg-rose-950 text-rose-400 border border-rose-800/60",
  INTERNO: "bg-indigo-950 text-indigo-400 border border-indigo-800/60",
  PRESTAMO: "bg-amber-950 text-amber-400 border border-amber-800/60",
};

export function TipoChip({ tipo }: { tipo: string }) {
  return (
    <span
      className={cn(
        "text-xs px-2.5 py-0.5 rounded-full font-medium inline-block",
        CHIP_STYLES[tipo] ?? "bg-slate-800 text-slate-400 border border-slate-700"
      )}
    >
      {tipo}
    </span>
  );
}
