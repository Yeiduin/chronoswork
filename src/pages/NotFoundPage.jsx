import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{ fontSize: '6rem', marginBottom: '1rem' }}>⏱️</div>
      <h1 style={{
        fontSize: '8rem', fontWeight: 900,
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        lineHeight: 1, marginBottom: '0.5rem',
      }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        Página no encontrada
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: 400 }}>
        La ruta que busca no existe en ChronosWork. Verifique la URL o regrese al panel principal.
      </p>
      <Link to="/dashboard" className="cw-btn cw-btn--primary cw-btn--lg">
        ← Volver al Dashboard
      </Link>
    </div>
  );
}
