import { Navigate } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../../context/AuthContext';

/**
 * ProtectedRoute — Protege rutas según autenticación y rol.
 *
 * Props:
 *   children      — Contenido a renderizar si el acceso es permitido.
 *   allowedRoles  — Array de roles permitidos. Si está vacío/undefined, solo
 *                   verifica que el usuario esté autenticado.
 *
 * Comportamiento:
 *   1. Loading → Spinner
 *   2. No autenticado → /login
 *   3. userRole aún null (cargando datos) → Spinner adicional
 *   4. Rol no permitido → Redirige al destino correcto según su rol
 *   5. Acceso permitido → Renderiza children
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="cw-spinner"></div>
        <span>Cargando ChronosWork...</span>
      </div>
    );
  }

  // Sin sesión → Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si no se especifican roles, solo se requiere autenticación
  if (allowedRoles.length === 0) {
    return children;
  }

  // Si el rol aún no ha sido determinado (null), esperar para evitar
  // loops de redirección. Esto ocurre si las queries de rol están lentas.
  if (userRole === null) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="cw-spinner"></div>
        <span>Verificando permisos...</span>
      </div>
    );
  }

  // Verificar si el rol del usuario está en los permitidos
  if (allowedRoles.includes(userRole)) {
    return children;
  }

  // Rol no autorizado → Redirigir al destino correcto según su rol
  const correctDestination = getRoleRedirect(userRole);
  return <Navigate to={correctDestination} replace />;
}
