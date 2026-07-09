import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../../context/AuthContext';
import { validarEmail } from '../../core/validators';
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
    } catch {
      setApiError('No se pudo enviar el correo. Verifique el email ingresado.');
    } finally {
      setLoading(false);
    }
  };

  // ── Vista: Correo enviado ──────────────────────────────────────────────
  if (sent) {
    return (
      <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
        <div className="d-flex justify-center mb-2">
          <MdCheckCircle size="3.5rem" color="var(--cw-success)" />
        </div>
        <h3 className="text-primary fw-bold mb-2" style={{ fontSize: '1.1rem', textAlign: 'center' }}>
          Correo enviado
        </h3>
        <p className="text-muted mb-3" style={{ fontSize: '0.85rem', lineHeight: 1.6, textAlign: 'center' }}>
          Hemos enviado un enlace de restablecimiento a{' '}
          <strong className="text-primary">{email}</strong>.
          Revise su bandeja de entrada y carpeta de spam.
        </p>
        <button className="cw-btn cw-btn--secondary" style={{ width: '100%' }} onClick={onBack}>
          <MdArrowBack /> Volver al inicio de sesión
        </button>
      </div>
    );
  }

  // ── Vista: Formulario forgot ───────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="d-flex align-center gap-1 text-muted mb-3"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
      >
        <MdArrowBack /> Volver al inicio de sesión
      </button>

      <h3 className="text-primary fw-bold mb-1" style={{ fontSize: '1.05rem' }}>
        Recuperar contraseña
      </h3>
      <p className="text-muted mb-3" style={{ fontSize: '0.82rem' }}>
        Ingrese su correo corporativo y le enviaremos un enlace para restablecer su contraseña.
      </p>

      {apiError && <div className="cw-alert cw-alert--error mb-3">{apiError}</div>}

      <form onSubmit={handleSubmit} id="forgot-password-form">
        <div className="cw-form-group">
          <label className="cw-label" htmlFor="reset-email">
            Correo Corporativo <span className="required">*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <MdMailOutline className="input-icon-left" />
            <input
              id="reset-email"
              name="email"
              type="email"
              className={`cw-input pl-icon${emailError ? ' error' : ''}`}
              placeholder="admin@empresa.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
              autoComplete="email"
            />
          </div>
          {emailError && <span className="cw-input-error">{emailError}</span>}
        </div>

        <button
          id="btn-reset-password"
          type="submit"
          className="cw-btn cw-btn--primary cw-btn--lg"
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? (
            <><span className="cw-spinner cw-spinner--sm"></span> Enviando...</>
          ) : (
            'Enviar enlace de recuperación'
          )}
        </button>
      </form>
    </div>
  );
}

// ── Componente: Icono posicionado a la izquierda del input ────────────────────
function InputIcon({ icon: Icon, side = 'left' }) {
  const style = {
    position: 'absolute',
    [side]: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: '1.1rem',
    pointerEvents: 'none',
  };
  return <Icon style={style} />;
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

  // Redirigir si ya está autenticado
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
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('invalid')) {
        setApiError('Credenciales incorrectas. Verifique su correo y contraseña.');
      } else if (msg.includes('email not confirmed')) {
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
          {/* ── Logo ──────────────────────────────────────────────── */}
          <Link to="/landing" className="auth-logo" style={{ textDecoration: 'none' }}>
            <div className="auth-logo__icon">⏱️</div>
            <div className="auth-logo__title">ChronosWork</div>
            <div className="auth-logo__subtitle">
              {showForgot ? 'Recuperación de Contraseña' : 'Gestión inteligente de turnos'}
            </div>
          </Link>

          {/* ── Vista Forgot o Login ──────────────────────────────── */}
          {showForgot ? (
            <ForgotPasswordView onBack={() => setShowForgot(false)} />
          ) : (
            <>
              {apiError && <div className="cw-alert cw-alert--error mb-3">{apiError}</div>}

              <form onSubmit={handleSubmit} id="login-form">
                {/* Email */}
                <div className="cw-form-group">
                  <label className="cw-label" htmlFor="email">
                    Correo Corporativo <span className="required">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <InputIcon icon={MdMailOutline} />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={`cw-input pl-icon${errors.email ? ' error' : ''}`}
                      placeholder="admin@empresa.com"
                      value={form.email}
                      onChange={handleChange}
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && <span className="cw-input-error">{errors.email}</span>}
                </div>

                {/* Password */}
                <div className="cw-form-group">
                  <div className="d-flex align-center justify-between mb-1">
                    <label className="cw-label" htmlFor="password" style={{ marginBottom: 0 }}>
                      Contraseña <span className="required">*</span>
                    </label>
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => setShowForgot(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.78rem', color: 'var(--cw-accent)',
                        fontWeight: 500, padding: 0,
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <InputIcon icon={MdLockOutline} />
                    <input
                      id="password"
                      name="password"
                      type={showPass ? 'text' : 'password'}
                      className={`cw-input pl-icon pr-icon${errors.password ? ' error' : ''}`}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      id="btn-toggle-password"
                      onClick={() => setShowPass(!showPass)}
                      className="input-icon-right-btn"
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                    </button>
                  </div>
                  {errors.password && <span className="cw-input-error">{errors.password}</span>}
                </div>

                {/* Botón Login */}
                <button
                  id="btn-login"
                  type="submit"
                  className="cw-btn cw-btn--primary cw-btn--lg"
                  style={{ width: '100%' }}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="cw-spinner cw-spinner--sm"></span> Autenticando...</>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </form>

              {/* Link a registro */}
              <div className="text-center mt-3">
                <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                  ¿No tienes cuenta?{' '}
                </span>
                <Link to="/register" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Regístrate
                </Link>
              </div>

              {/* Badges de confianza */}
              <div className="divider" />
              <div className="d-flex justify-center gap-2 flex-wrap">
                {[
                  { emoji: '🔐', label: 'Datos cifrados' },
                  { emoji: '🏢', label: 'Multi-empresa' },
                  { emoji: '📋', label: 'CST Colombia' },
                ].map(item => (
                  <span key={item.label} className="text-muted d-flex align-center gap-1" style={{ fontSize: '0.7rem' }}>
                    {item.emoji} {item.label}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* ── Footer ────────────────────────────────────────────── */}
          <div className="text-center mt-3 text-muted" style={{ fontSize: '0.75rem' }}>
            &copy; {new Date().getFullYear()} ChronosWork &middot; CST Colombia
          </div>
        </div>
      </div>
    </div>
  );
}
