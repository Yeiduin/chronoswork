import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../../context/AuthContext';
import { validarEmail, validarPassword } from '../../core/validators';
import { MdVisibility, MdVisibilityOff, MdLockOutline, MdMailOutline, MdArrowBack, MdCheckCircle } from 'react-icons/md';

// ── Vista de "Olvidé mi contraseña" ──────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validarEmail(email);
    if (!v.valid) { setEmailError(v.message); return; }

    setLoading(true);
    setApiError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setApiError('No se pudo enviar el correo. Verifique el email ingresado.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          <MdCheckCircle style={{ color: '#22c55e', fontSize: '3.5rem' }} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Correo enviado
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Hemos enviado un enlace de restablecimiento a <strong>{email}</strong>.
          Revise su bandeja de entrada y carpeta de spam.
        </p>
        <button
          className="cw-btn cw-btn--secondary"
          onClick={onBack}
          style={{ width: '100%' }}
        >
          <MdArrowBack /> Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '0.82rem',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          marginBottom: '1.25rem', padding: 0,
        }}
      >
        <MdArrowBack /> Volver al inicio de sesión
      </button>

      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Recuperar contraseña
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Ingrese su correo corporativo y le enviaremos un enlace para restablecer su contraseña.
      </p>

      {apiError && <div className="cw-alert cw-alert--error">🚫 {apiError}</div>}

      <form onSubmit={handleSubmit} id="forgot-password-form">
        <div className="cw-form-group">
          <label className="cw-label" htmlFor="reset-email">
            Correo Corporativo <span className="required">*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <MdMailOutline style={{
              position: 'absolute', left: '0.75rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
            }} />
            <input
              id="reset-email"
              name="email"
              type="email"
              className={`cw-input${emailError ? ' error' : ''}`}
              placeholder="admin@empresa.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
              style={{ paddingLeft: '2.5rem' }}
              autoComplete="email"
            />
          </div>
          {emailError && <span className="cw-input-error">⚠ {emailError}</span>}
        </div>

        <button
          id="btn-reset-password"
          type="submit"
          className="cw-btn cw-btn--primary cw-btn--lg"
          style={{ width: '100%', marginTop: '0.5rem' }}
          disabled={loading}
        >
          {loading ? (
            <><span className="cw-spinner cw-spinner--sm"></span> Enviando...</>
          ) : 'Enviar enlace de recuperación'}
        </button>
      </form>
    </div>
  );
}

// ── Vista principal de Login ──────────────────────────────────────────────────
export default function LoginPage() {
  const { signIn, user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Si ya está autenticado, redirigir según su rol
  useEffect(() => {
    if (!authLoading && user && userRole) {
      navigate(getRoleRedirect(userRole), { replace: true });
    }
  }, [user, userRole, authLoading, navigate]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
    setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    const emailV = validarEmail(form.email);
    if (!emailV.valid) newErrors.email = emailV.message;
    if (!form.password) newErrors.password = 'Ingrese su contraseña.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      // La redirección la maneja el useEffect de arriba cuando userRole se actualice
    } catch (err) {
      if (err.message?.toLowerCase().includes('invalid')) {
        setApiError('Credenciales incorrectas. Verifique su correo y contraseña.');
      } else if (err.message?.toLowerCase().includes('email not confirmed')) {
        setApiError('Su correo aún no ha sido confirmado. Revise su bandeja de entrada.');
      } else {
        setApiError(err.message || 'Error al iniciar sesión. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card animate-slide-up">
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo__icon">⏱️</div>
            <div className="auth-logo__title">ChronosWork</div>
            <div className="auth-logo__subtitle">
              {showForgot ? 'Recuperación de Contraseña' : 'Plataforma SaaS de Gestión de Turnos Corporativa'}
            </div>
          </div>

          {/* Mostrar vista forgot o login según estado */}
          {showForgot ? (
            <ForgotPasswordView onBack={() => setShowForgot(false)} />
          ) : (
            <>
              {/* Error de API */}
              {apiError && (
                <div className="cw-alert cw-alert--error">
                  🚫 {apiError}
                </div>
              )}

              <form onSubmit={handleSubmit} id="login-form">
                <div className="cw-form-group">
                  <label className="cw-label" htmlFor="email">
                    Correo Corporativo <span className="required">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MdMailOutline style={{
                      position: 'absolute', left: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
                    }} />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={`cw-input${errors.email ? ' error' : ''}`}
                      placeholder="admin@empresa.com"
                      value={form.email}
                      onChange={handleChange}
                      style={{ paddingLeft: '2.5rem' }}
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && <span className="cw-input-error">⚠ {errors.email}</span>}
                </div>

                <div className="cw-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="cw-label" htmlFor="password" style={{ margin: 0 }}>
                      Contraseña <span className="required">*</span>
                    </label>
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => setShowForgot(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.75rem', color: 'var(--primary)',
                        fontWeight: 500, padding: 0,
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <MdLockOutline style={{
                      position: 'absolute', left: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
                    }} />
                    <input
                      id="password"
                      name="password"
                      type={showPass ? 'text' : 'password'}
                      className={`cw-input${errors.password ? ' error' : ''}`}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={handleChange}
                      style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      id="btn-toggle-password"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)', background: 'none', border: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                    </button>
                  </div>
                  {errors.password && <span className="cw-input-error">⚠ {errors.password}</span>}
                </div>

                <button
                  id="btn-login"
                  type="submit"
                  className="cw-btn cw-btn--primary cw-btn--lg"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="cw-spinner cw-spinner--sm"></span> Autenticando...</>
                  ) : 'Ingresar al Sistema'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  ¿Su empresa aún no está registrada?{' '}
                </span>
                <Link to="/register" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Crear cuenta empresarial
                </Link>
              </div>

              <div style={{
                marginTop: '2rem', paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', justifyContent: 'center', gap: '1.5rem',
              }}>
                {['🔐 Datos cifrados', '🏢 Multi-empresa', '📋 CST Colombia'].map(item => (
                  <span key={item} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {item}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
