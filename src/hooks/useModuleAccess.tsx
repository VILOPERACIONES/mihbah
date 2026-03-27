import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "movimientos", label: "Movimientos" },
  { key: "cargas", label: "Cargas Excel" },
  { key: "flujo", label: "Flujo de Caja" },
  { key: "proyectos", label: "Proyectos" },
  { key: "cuentas", label: "Cuentas" },
  { key: "reportes", label: "Reportes" },
  { key: "admin", label: "Administración" },
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number]["key"];

interface ModuleAccessResult {
  allowedModules: ModuleKey[];
  loading: boolean;
  refresh: () => void;
}

export function useModuleAccess(): ModuleAccessResult {
  const { user } = useAuth();
  const [allowedModules, setAllowedModules] = useState<ModuleKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setAllowedModules([]);
      setLoading(false);
      return;
    }

    async function load() {
      // 1. Get role defaults
      const { data: roleAccess } = await supabase
        .from("role_module_access")
        .select("module, allowed")
        .eq("role", user!.rol as any);

      const roleMap: Record<string, boolean> = {};
      roleAccess?.forEach((r: any) => {
        roleMap[r.module] = r.allowed;
      });

      // 2. Get user override from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("modulos_override")
        .eq("user_id", user!.id)
        .single();

      const overrides = (profile as any)?.modulos_override as Record<string, boolean> | null;

      // 3. Merge: override > role default > false
      const result: ModuleKey[] = [];
      for (const mod of ALL_MODULES) {
        const overrideVal = overrides?.[mod.key];
        const roleVal = roleMap[mod.key];
        const allowed = overrideVal !== undefined ? overrideVal : (roleVal ?? false);
        if (allowed) result.push(mod.key);
      }

      setAllowedModules(result);
      setLoading(false);
    }

    load();
  }, [user, refreshKey]);

  return { allowedModules, loading, refresh: () => setRefreshKey((k) => k + 1) };
}
