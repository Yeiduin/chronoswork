import { Link } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../context/AuthContext';

export default function NotFoundPage() {
  const { userRole } = useAuth();
  const homeRoute = getRoleRedirect(userRole);

  return (
    <div className="animate-fade-in" style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'center',
      padding: '2rem',
    }}>
      <div className="empty-state__icon" style={{ fontSize: '6rem', marginBottom: '1rem' }}>⏱️</div>
      <h1 className="page-title" style={{
        fontSize: '8rem', fontWeight: 900,
        background: 'linear-gradient(135deg, var(--cw-accent), var(--cw-purple))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        lineHeight: 1, marginBottom: '0.5rem',
      }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        Página no encontrada
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: 400 }}>
        La ruta que busca no existe en ChronosWork. Verifique la URL o regrese al panel principal.
      </p>
      <Link to={homeRoute} className="cw-btn cw-btn--primary cw-btn--lg">
        ← Volver al inicio
      </Link>
    </div>
  );
}

