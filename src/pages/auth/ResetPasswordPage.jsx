import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { MdLockOutline, MdVisibility, MdVisibilityOff, MdCheckCircle, MdErrorOutline } from 'react-icons/md';

// ── Medidor de fuerza de contraseña ──────────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: 'Mínimo 8 caracteres',    ok: password.length >= 8 },
    { label: 'Al menos 1 mayúscula',   ok: /[A-Z]/.test(password) },
    { label: 'Al menos 1 minúscula',   ok: /[a-z]/.test(password) },
    { label: 'Al menos 1 número',      ok: /\d/.test(password) },
    { label: 'Carácter especial',      ok: /[@#$%&*!.]/.test(password) },
  ];

  const passed = checks.filter(c => c.ok).length;
  const strength = passed <= 1 ? 'Débil' : passed <= 3 ? 'Media' : 'Fuerte';
  const color = passed <= 1 ? 'var(--cw-danger)' : passed <= 3 ? 'var(--cw-warning)' : 'var(--cw-success)';
  const width = `${(passed / checks.length) * 100}%`;

  if (!password) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Barra de progreso */}
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border-medium)', marginBottom: '0.5rem', overflow: 'hidden' }}>
        <div style={{ width, height: '100%', borderRadius: 2, background: color, transition: 'width 0.3s ease, background 0.3s ease' }} />
      </div>

      <div className="d-flex justify-between mb-1">
        <span className="text-muted" style={{ fontSize: '0.72rem' }}>Seguridad</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color }}>{strength}</span>
      </div>

      <div className="d-flex flex-wrap gap-1">
        {checks.map(c => (
          <div key={c.label} className="d-flex align-center gap-1" style={{ fontSize: '0.72rem', color: c.ok ? 'var(--cw-success)' : 'var(--text-muted)', width: c.ok ? 'auto' : '48%', minWidth: c.ok ? 'auto' : '48%' }}>
            {c.ok ? (
              <MdCheckCircle size="0.85rem" style={{ flexShrink: 0 }} />
            ) : (
              <span style={{ width: '0.85rem', display: 'inline-flex', flexShrink: 0 }}>·</span>
            )}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente: Icono en input ────────────────────────────────────────────────
function InputIcon({ icon: Icon }) {
  return (
    <Icon style={{
      position: 'absolute', left: '0.75rem', top: '50%',
      transform: 'translateY(-50%)', color: 'var(--text-muted)',
      fontSize: '1.1rem', pointerEvents: 'none',
    }} />
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
  const timerRef = useRef(null);

  // Limpiar timer al desmontar para evitar navegación en componente desmontado
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validate = () => {
    const newErrors = {};
    if (form.password.length < 8) newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(form.password)) newErrors.password = 'Incluya al menos una mayúscula.';
    if (!/\d/.test(form.password)) newErrors.password = 'Incluya al menos un número.';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden.';
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
      timerRef.current = setTimeout(() => {
        navigate(getRoleRedirect(userRole), { replace: true });
      }, 2500);
    } catch (err) {
      setApiError(err.message || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  // ── Vista: Enlace inválido ─────────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card animate-slide-up">
            <Link to="/landing" className="auth-logo" style={{ textDecoration: 'none' }}>
              <div className="auth-logo__icon">⏱️</div>
              <div className="auth-logo__title">ChronosWork</div>
            </Link>

            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <MdErrorOutline size="3.5rem" color="var(--cw-danger)" style={{ marginBottom: '1rem' }} />
              <h3 className="text-primary fw-bold mb-2" style={{ fontSize: '1.05rem' }}>
                Enlace inválido o expirado
              </h3>
              <p className="text-muted mb-3" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
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

            <div className="text-center mt-3 text-muted" style={{ fontSize: '0.75rem' }}>
              &copy; {new Date().getFullYear()} ChronosWork &middot; CST Colombia
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista: Éxito ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card animate-slide-up">
            <Link to="/landing" className="auth-logo" style={{ textDecoration: 'none' }}>
              <div className="auth-logo__icon">⏱️</div>
              <div className="auth-logo__title">ChronosWork</div>
            </Link>

            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <MdCheckCircle size="3.5rem" color="var(--cw-success)" style={{ marginBottom: '1rem' }} />
              <h3 className="text-primary fw-bold mb-2" style={{ fontSize: '1.1rem' }}>
                ¡Contraseña actualizada!
              </h3>
              <p className="text-muted mb-3" style={{ fontSize: '0.85rem' }}>
                Su contraseña ha sido cambiada exitosamente. Será redirigido automáticamente...
              </p>
              <div className="cw-spinner" style={{ margin: '0 auto' }}></div>
            </div>

            <div className="text-center mt-3 text-muted" style={{ fontSize: '0.75rem' }}>
              &copy; {new Date().getFullYear()} ChronosWork &middot; CST Colombia
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista: Formulario principal ────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card animate-slide-up">
          {/* ── Logo ────────────────────────────────────────────── */}
          <div className="auth-logo">
            <div className="auth-logo__icon">⏱️</div>
            <div className="auth-logo__title">ChronosWork</div>
            <div className="auth-logo__subtitle">Establecer nueva contraseña</div>
          </div>

          {apiError && <div className="cw-alert cw-alert--error mb-3">{apiError}</div>}

          <form onSubmit={handleSubmit} id="reset-password-form">
            {/* Nueva contraseña */}
            <div className="cw-form-group">
              <label className="cw-label" htmlFor="new-password">
                Nueva Contraseña <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <InputIcon icon={MdLockOutline} />
                <input
                  id="new-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  className={`cw-input pl-icon pr-icon${errors.password ? ' error' : ''}`}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => {
                    setForm(p => ({ ...p, password: e.target.value }));
                    setErrors(p => ({ ...p, password: '' }));
                  }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="input-icon-right-btn"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.password && <span className="cw-input-error">{errors.password}</span>}
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirmar contraseña */}
            <div className="cw-form-group">
              <label className="cw-label" htmlFor="confirm-password">
                Confirmar Contraseña <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <InputIcon icon={MdLockOutline} />
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  className={`cw-input pl-icon pr-icon${errors.confirmPassword ? ' error' : ''}`}
                  placeholder="Repita la contraseña"
                  value={form.confirmPassword}
                  onChange={(e) => {
                    setForm(p => ({ ...p, confirmPassword: e.target.value }));
                    setErrors(p => ({ ...p, confirmPassword: '' }));
                  }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="input-icon-right-btn"
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirm ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.confirmPassword && <span className="cw-input-error">{errors.confirmPassword}</span>}
            </div>

            <button
              id="btn-update-password"
              type="submit"
              className="cw-btn cw-btn--primary cw-btn--lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? (
                <><span className="cw-spinner cw-spinner--sm"></span> Actualizando...</>
              ) : (
                'Cambiar Contraseña'
              )}
            </button>
          </form>

          {/* ── Footer ──────────────────────────────────────────── */}
          <div className="text-center mt-3 text-muted" style={{ fontSize: '0.75rem' }}>
            &copy; {new Date().getFullYear()} ChronosWork &middot; CST Colombia
          </div>
        </div>
      </div>
    </div>
  );
}
