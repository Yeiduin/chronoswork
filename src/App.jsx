import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import AbsencesPage from './pages/AbsencesPage';
import AreasPage from './pages/AreasPage';
import SchedulingPage from './pages/SchedulingPage';
import PrenominaPage from './pages/PrenominaPage';
import ConfigPage from './pages/ConfigPage';
import NotFoundPage from './pages/NotFoundPage';

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout><DashboardPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/empleados"
            element={
              <ProtectedRoute>
                <AppLayout><EmployeesPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/novedades"
            element={
              <ProtectedRoute>
                <AppLayout><AbsencesPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/areas"
            element={
              <ProtectedRoute>
                <AppLayout><AreasPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/programacion"
            element={
              <ProtectedRoute>
                <AppLayout><SchedulingPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prenomina"
            element={
              <ProtectedRoute>
                <AppLayout><PrenominaPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracion"
            element={
              <ProtectedRoute>
                <AppLayout><ConfigPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
