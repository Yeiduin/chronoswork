import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { MdLockOutline, MdVisibility, MdVisibilityOff, MdCheckCircle, MdError } from 'react-icons/md';

// ── Medidor de fuerza de contraseña ──────────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: 'Mínimo 8 caracteres',    ok: password.length >= 8 },
    { label: 'Letra mayúscula',         ok: /[A-Z]/.test(password) },
    { label: 'Letra minúscula',         ok: /[a-z]/.test(password) },
    { label: 'Número',                  ok: /\d/.test(password) },
    { label: 'Carácter especial (@#$)', ok: /[@#$%&*!]/.test(password) },
  ];

  const passed = checks.filter(c => c.ok).length;
  const strength = passed <= 1 ? 'Débil' : passed <= 3 ? 'Media' : 'Fuerte';
  const color = passed <= 1 ? '#ef4444' : passed <= 3 ? '#f59e0b' : '#22c55e';
  const width = `${(passed / checks.length) * 100}%`;

  if (!password) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Barra de progreso */}
      <div style={{
        height: 4, borderRadius: 2, background: 'var(--border-medium)',
        marginBottom: '0.5rem', overflow: 'hidden',
      }}>
        <div style={{
          width, height: '100%', borderRadius: 2,
          background: color, transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Seguridad</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color }}>{strength}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {checks.map(c => (
          <div key={c.label} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.72rem',
            color: c.ok ? '#22c55e' : 'var(--text-muted)',
          }}>
            {c.ok
              ? <MdCheckCircle style={{ fontSize: '0.85rem', flexShrink: 0 }} />
              : <span style={{ width: '0.85rem', height: '0.85rem', display: 'inline-flex', flexShrink: 0 }}>·</span>
            }
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal de Reset Password ───────────────────────────────────────
export default function ResetPasswordPage() {
  const { updatePassword, user, userRole } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase envía el token como fragmento de URL (#access_token=...)
  // onAuthStateChange lo procesa automáticamente y crea una sesión de tipo PASSWORD_RECOVERY
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Si ya hay una sesión activa (ej: el usuario está logueado y fue al link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validate = () => {
    const newErrors = {};
    if (form.password.length < 8)
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(form.password))
      newErrors.password = (newErrors.password || '') + ' Incluya una mayúscula.';
    if (!/\d/.test(form.password))
      newErrors.password = (newErrors.password || '') + ' Incluya un número.';
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await updatePassword(form.password);
      setSuccess(true);
      // Redirigir al destino correcto después de 2.5 segundos
      setTimeout(() => {
        navigate(getRoleRedirect(userRole), { replace: true });
      }, 2500);
    } catch (err) {
      setApiError(err.message || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  // ── Vista de enlace inválido ──────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card animate-slide-up">
            <div className="auth-logo">
              <div className="auth-logo__icon">⏱️</div>
              <div className="auth-logo__title">ChronosWork</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <MdError style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Enlace inválido o expirado
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Este enlace de recuperación ya no es válido. Solicite uno nuevo desde la pantalla de inicio de sesión.
              </p>
              <button
                className="cw-btn cw-btn--primary"
                onClick={() => navigate('/login')}
                style={{ width: '100%' }}
              >
                Volver al inicio de sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista de éxito ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card animate-slide-up">
            <div className="auth-logo">
              <div className="auth-logo__icon">⏱️</div>
              <div className="auth-logo__title">ChronosWork</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <MdCheckCircle style={{ fontSize: '3.5rem', color: '#22c55e', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                ¡Contraseña actualizada!
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Su contraseña ha sido cambiada exitosamente. Será redirigido automáticamente...
              </p>
              <div className="cw-spinner" style={{ margin: '1.5rem auto 0' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ──────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card animate-slide-up">
          <div className="auth-logo">
            <div className="auth-logo__icon">⏱️</div>
            <div className="auth-logo__title">ChronosWork</div>
            <div className="auth-logo__subtitle">Establecer nueva contraseña</div>
          </div>

          {apiError && (
            <div className="cw-alert cw-alert--error">🚫 {apiError}</div>
          )}

          <form onSubmit={handleSubmit} id="reset-password-form">
            {/* Nueva contraseña */}
            <div className="cw-form-group">
              <label className="cw-label" htmlFor="new-password">
                Nueva Contraseña <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MdLockOutline style={{
                  position: 'absolute', left: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
                }} />
                <input
                  id="new-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  className={`cw-input${errors.password ? ' error' : ''}`}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => { setForm(p => ({ ...p, password: e.target.value })); setErrors(p => ({ ...p, password: '' })); }}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  autoComplete="new-password"
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
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirmar contraseña */}
            <div className="cw-form-group">
              <label className="cw-label" htmlFor="confirm-password">
                Confirmar Contraseña <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MdLockOutline style={{
                  position: 'absolute', left: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
                }} />
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  className={`cw-input${errors.confirmPassword ? ' error' : ''}`}
                  placeholder="Repita la contraseña"
                  value={form.confirmPassword}
                  onChange={(e) => { setForm(p => ({ ...p, confirmPassword: e.target.value })); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showConfirm ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.confirmPassword && <span className="cw-input-error">⚠ {errors.confirmPassword}</span>}
            </div>

            <button
              id="btn-update-password"
              type="submit"
              className="cw-btn cw-btn--primary cw-btn--lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                <><span className="cw-spinner cw-spinner--sm"></span> Actualizando...</>
              ) : '🔐 Establecer nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
