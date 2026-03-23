import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<string, string> = {
  INGRESO: "bg-[#00C896]/15 text-[#00C896] border border-[#00C896]/30",
  SALIDA: "bg-[#E05C5C]/15 text-[#E05C5C] border border-[#E05C5C]/30",
  INTERNO: "bg-[#8A9FFF]/15 text-[#8A9FFF] border border-[#8A9FFF]/30",
  PRESTAMO: "bg-[#D4A843]/15 text-[#D4A843] border border-[#D4A843]/30",
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
