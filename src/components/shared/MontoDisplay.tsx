import { cn } from "@/lib/utils";

interface MontoDisplayProps {
  monto: number;
  tipo?: string;
  showSign?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function formatMonto(n: number, showMXN = false): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `$${formatted}${showMXN ? " MXN" : ""}`;
}

export function formatMontoAbreviado(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

const SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl md:text-2xl font-semibold",
};

export function MontoDisplay({ monto, tipo, showSign, className, size = "md" }: MontoDisplayProps) {
  const isPositive = tipo === "INGRESO" || (!tipo && monto > 0);
  const isNegative = tipo === "SALIDA" || (!tipo && monto < 0);

  const colorClass = isPositive
    ? "text-[#22C55E]"
    : isNegative
    ? "text-[#EF4444]"
    : "text-foreground";

  const sign = showSign ? (monto >= 0 ? "+" : "-") : "";

  return (
    <span className={cn("font-money", SIZES[size], colorClass, className)}>
      {sign}
      {formatMonto(monto)}
    </span>
  );
}
