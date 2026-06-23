import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import {
  ROLE_SAAS_ADMIN, ROLE_SUPER_ADMIN, ROLE_COORDINATOR, ROLE_EMPLEADO,
  getRoleRedirect,
} from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Admin pages
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import AbsencesPage from './pages/AbsencesPage';
import AreasPage from './pages/AreasPage';
import SchedulingPage from './pages/SchedulingPage';
import PrenominaPage from './pages/PrenominaPage';
import ConfigPage from './pages/ConfigPage';

// New role-specific pages
import SaasDashboardPage from './pages/SaasDashboardPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';

import NotFoundPage from './pages/NotFoundPage';

// ── Layouts ───────────────────────────────────────────────────────────────────

function AdminLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

// El SaaS_Admin tiene un shell simplificado (sin sidebar operativo)
function SaasLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

// El Empleado NO tiene sidebar completo (layout limpio)
function EmployeeLayout({ children }) {
  return (
    <div className="app-shell app-shell--employee">
      <div className="main-content main-content--full">
        {children}
      </div>
    </div>
  );
}

// ── Smart Root Redirect: redirige según el rol del usuario autenticado ────────
function RootRedirect() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="cw-spinner"></div>
        <span>Cargando ChronosWork...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleRedirect(userRole)} replace />;
}

// ── Roles para rutas operativas (Super_Admin y Coordinator) ───────────────────
const ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_COORDINATOR];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Rutas Públicas ───────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register-company" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* ── Ruta Raíz: redirección inteligente por rol ───────────────── */}
          <Route path="/" element={<RootRedirect />} />

          {/* ── SaaS Admin Dashboard ─────────────────────────────────────── */}
          <Route
            path="/saas-dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLE_SAAS_ADMIN]}>
                <SaasLayout><SaasDashboardPage /></SaasLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Rutas Operativas (Super_Admin + Coordinador) ─────────────── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout><DashboardPage /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/empleados"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout><EmployeesPage /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/novedades"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout><AbsencesPage /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/areas"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout><AreasPage /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/programacion"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout><SchedulingPage /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prenomina"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout><PrenominaPage /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracion"
            element={
              <ProtectedRoute allowedRoles={[ROLE_SUPER_ADMIN]}>
                <AdminLayout><ConfigPage /></AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Vista del Empleado ────────────────────────────────────────── */}
          <Route
            path="/mi-perfil"
            element={
              <ProtectedRoute allowedRoles={[ROLE_EMPLEADO]}>
                <EmployeeLayout><EmployeeProfilePage /></EmployeeLayout>
              </ProtectedRoute>
            }
          />

          {/* ── 404 ──────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
