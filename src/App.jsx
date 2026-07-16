import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import {
  ROLE_SAAS_ADMIN, ROLE_SUPER_ADMIN, ROLE_COORDINATOR, ROLE_EMPLEADO,
  getRoleRedirect,
} from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';

// Auth pages (eager — pequeñas, necesarias para login)
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Pages pesadas (lazy — se cargan bajo demanda)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const AbsencesPage = lazy(() => import('./pages/AbsencesPage'));
const AreasPage = lazy(() => import('./pages/AreasPage'));
const SchedulingPage = lazy(() => import('./pages/SchedulingPage'));
const PrenominaPage = lazy(() => import('./pages/PrenominaPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const SaasDashboardPage = lazy(() => import('./pages/SaasDashboardPage'));
const EmployeeProfilePage = lazy(() => import('./pages/EmployeeProfilePage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));

import NotFoundPage from './pages/NotFoundPage';

// ── Layouts ───────────────────────────────────────────────────────────────────

function AppShell({ children }) {
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

// ── Smart Root Redirect: landing page para visitantes, dashboard para autenticados ──
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

  // Usuario no autenticado → landing page
  if (!user) return <LandingPage />;
  // Usuario autenticado → dashboard según rol
  return <Navigate to={getRoleRedirect(userRole)} replace />;
}

// ── Roles para rutas operativas (Super_Admin y Coordinator) ───────────────────
const ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_COORDINATOR];

// Fallback de carga para lazy pages
function PageFallback() {
  return (
    <div className="loading-overlay" style={{ minHeight: '100vh' }}>
      <div className="cw-spinner"></div>
      <span>Cargando...</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ── Rutas Públicas ───────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register-company" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* ── Ruta Raíz: redirección inteligente por rol ───────────────── */}
          <Route path="/" element={<RootRedirect />} />
          {/* Landing page siempre accesible */}
          <Route path="/landing" element={<LandingPage />} />

          {/* ── SaaS Admin Dashboard ─────────────────────────────────────── */}
          <Route
            path="/saas-dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLE_SAAS_ADMIN]}>
                <AppShell><SaasDashboardPage /></AppShell>
              </ProtectedRoute>
            }
          />

          {/* ── Rutas Operativas (Super_Admin + Coordinador) ─────────────── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><DashboardPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/empleados"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><EmployeesPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/novedades"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><AbsencesPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/anuncios"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><AnnouncementsPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/areas"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><AreasPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/programacion"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><SchedulingPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prenomina"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AppShell><PrenominaPage /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracion"
            element={
              <ProtectedRoute allowedRoles={[ROLE_SUPER_ADMIN]}>
                <AppShell><ConfigPage /></AppShell>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
