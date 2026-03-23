import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<string, string> = {
  INGRESO: "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30",
  SALIDA: "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
  INTERNO: "bg-[#8A9FFF]/15 text-[#8A9FFF] border border-[#8A9FFF]/30",
  PRESTAMO: "bg-[#EAB308]/15 text-[#EAB308] border border-[#EAB308]/30",
};

export function TipoChip({ tipo }: { tipo: string }) {
  return (
    <span
      className={cn(
        "text-xs px-2.5 py-0.5 rounded-full font-medium inline-block",
        CHIP_STYLES[tipo] ?? "bg-muted text-muted-foreground border border-border"
      )}
    >
      {tipo}
    </span>
  );
}
