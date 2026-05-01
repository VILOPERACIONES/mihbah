import { useAuth } from "@/hooks/useAuth";

export const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "flujo_caja", label: "Flujo de Caja" },
  { key: "proyectos", label: "Proyectos" },
  { key: "cuentas", label: "Cuentas" },
  { key: "reportes", label: "Reportes" },
  { key: "cargas_excel", label: "Cargas Excel" },
  { key: "sincronizacion_monday", label: "Sync Monday" },
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number]["key"];

interface ModuleAccessResult {
  allowedModules: ModuleKey[];
  loading: boolean;
  refresh: () => void;
}

export function useModuleAccess(): ModuleAccessResult {
  const { user, loading, refresh } = useAuth();

  const allowedModules: ModuleKey[] = user
    ? (user.modules.filter((m): m is ModuleKey =>
        ALL_MODULES.some((mod) => mod.key === m)
      ))
    : [];

  return { allowedModules, loading, refresh };
}
