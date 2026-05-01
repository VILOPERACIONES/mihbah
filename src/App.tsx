import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useModuleAccess, type ModuleKey } from "@/hooks/useModuleAccess";
import { AppShell } from "@/components/layout/AppShell";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import MovimientosPage from "@/pages/Movimientos";
import FlujoPage from "@/pages/Flujo";
import ProyectosPage from "@/pages/Proyectos";
import CuentasPage from "@/pages/Cuentas";
import ReportesPage from "@/pages/Reportes";
import AdminPage from "@/pages/Admin";
import CargasPage from "@/pages/Cargas";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ROLE_ORDER = ["VIEWER", "ADMIN", "SUPER_ADMIN", "SUPER_ADMIN_DEV"] as const;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--bg-base))" }}>
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ModuleGuard({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { allowedModules, loading } = useModuleAccess();
  if (loading) return null;
  if (!allowedModules.includes(module)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RoleGuard({ minRole, children }: { minRole: typeof ROLE_ORDER[number]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const userLevel = ROLE_ORDER.indexOf((user?.rol ?? "VIEWER") as typeof ROLE_ORDER[number]);
  const minLevel = ROLE_ORDER.indexOf(minRole);
  if (userLevel < minLevel) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<ModuleGuard module="dashboard"><DashboardPage /></ModuleGuard>} />
              <Route path="movimientos" element={<ModuleGuard module="cargas_excel"><MovimientosPage /></ModuleGuard>} />
              <Route path="cargas" element={<ModuleGuard module="cargas_excel"><CargasPage /></ModuleGuard>} />
              <Route path="flujo" element={<ModuleGuard module="flujo_caja"><FlujoPage /></ModuleGuard>} />
              <Route path="proyectos" element={<ModuleGuard module="proyectos"><ProyectosPage /></ModuleGuard>} />
              <Route path="cuentas" element={<ModuleGuard module="cuentas"><CuentasPage /></ModuleGuard>} />
              <Route path="reportes" element={<ModuleGuard module="reportes"><ReportesPage /></ModuleGuard>} />
              <Route path="admin" element={<RoleGuard minRole="SUPER_ADMIN"><AdminPage /></RoleGuard>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
