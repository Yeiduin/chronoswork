import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validarEmail, validarPassword } from '../../core/validators';
import { MdVisibility, MdVisibilityOff, MdLockOutline, MdMailOutline } from 'react-icons/md';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
      navigate('/dashboard');
    } catch (err) {
      setApiError('Credenciales incorrectas. Verifique su correo y contraseña.');
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
            <div className="auth-logo__subtitle">Plataforma SaaS de Gestión de Turnos Corporativa</div>
          </div>

          {/* Error */}
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
              <label className="cw-label" htmlFor="password">
                Contraseña <span className="required">*</span>
              </label>
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
                <>
                  <span className="cw-spinner cw-spinner--sm"></span>
                  Autenticando...
                </>
              ) : 'Ingresar al Sistema'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              ¿Su empresa aún no está registrada?{' '}
            </span>
            <a href="/register" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              Crear cuenta empresarial
            </a>
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
        </div>
      </div>
    </div>
  );
}
