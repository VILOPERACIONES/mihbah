import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<ModuleGuard module="dashboard"><DashboardPage /></ModuleGuard>} />
              <Route path="movimientos" element={<ModuleGuard module="movimientos"><MovimientosPage /></ModuleGuard>} />
              <Route path="flujo" element={<ModuleGuard module="flujo"><FlujoPage /></ModuleGuard>} />
              <Route path="proyectos" element={<ModuleGuard module="proyectos"><ProyectosPage /></ModuleGuard>} />
              <Route path="cuentas" element={<ModuleGuard module="cuentas"><CuentasPage /></ModuleGuard>} />
              <Route path="reportes" element={<ModuleGuard module="reportes"><ReportesPage /></ModuleGuard>} />
              <Route path="admin" element={<ModuleGuard module="admin"><AdminPage /></ModuleGuard>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
