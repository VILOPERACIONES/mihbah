import { useAuth } from "@/hooks/useAuth";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminPage() {
  const { user } = useAuth();

  if (user?.rol !== "SUPER_ADMIN" && user?.rol !== "ADMIN") {
    return <EmptyState icon={Settings} title="Acceso denegado" description="No tienes permisos para esta sección." />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Administración</h1>
      <p className="text-sm text-muted-foreground">Gestión de usuarios e historial de cargas — próximamente.</p>
    </div>
  );
}
