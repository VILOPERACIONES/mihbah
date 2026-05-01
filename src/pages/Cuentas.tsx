import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app.store";
import { MontoDisplay } from "@/components/shared/MontoDisplay";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface CuentaData {
  cuenta: string;
  saldo: number;
  count: number;
}

export default function CuentasPage() {
  const { empresaActiva } = useAppStore();
  const [cuentas, setCuentas] = useState<CuentaData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (empresaActiva !== "TODAS") params.set("empresa", empresaActiva);
        const res = await fetch(`/api/dashboard/cuentas-saldo?${params}`, { credentials: "include" });
        const { cuentas: data } = await res.json() as { cuentas: CuentaData[] };
        setCuentas(data ?? []);
      } catch {
        setCuentas([]);
      }
      setLoading(false);
    }
    load();
  }, [empresaActiva]);

  if (loading)
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    );

  if (cuentas.length === 0)
    return <EmptyState icon={Landmark} title="Sin cuentas" description="No hay movimientos con cuenta asignada." />;

  return (
    <div className="space-y-6">
      <h1 className="text-lg md:text-xl font-semibold">Cuentas</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cuentas.map((c) => (
          <Card key={c.cuenta} className="p-4 border-border rounded-xl hover:bg-card/80 transition-colors" style={{ background: "hsl(var(--bg-card))" }}>
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">{c.cuenta}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Saldo neto:</p>
            <MontoDisplay monto={c.saldo} showSign size="xl" />
            <p className="text-xs text-muted-foreground mt-2">{c.count} movimientos</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
