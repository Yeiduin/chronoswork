import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { validarEmail, validarPassword, validarNIT } from '../../core/validators';
import { MdBusiness, MdMailOutline, MdLockOutline, MdPhone, MdLocationOn, MdBadge, MdCheckCircle } from 'react-icons/md';

// ── Medidor de fortaleza de contraseña ────────────────────────────────────────
function PasswordStrengthMeter({ password }) {
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
        <span className="text-muted" style={{ fontSize: '0.72rem' }}>Seguridad:</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color }}>{strength}</span>
      </div>

      <div className="d-flex flex-wrap gap-1">
        {checks.map(c => (
          <div key={c.label} className="d-flex align-center gap-1" style={{ fontSize: '0.7rem', color: c.ok ? 'var(--cw-success)' : 'var(--text-muted)', width: c.ok ? 'auto' : '48%', minWidth: c.ok ? 'auto' : '48%' }}>
            {c.ok ? <MdCheckCircle size="0.8rem" /> : <span style={{ width: '0.8rem', display: 'inline-block' }}>·</span>}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente: Icono posicionado en input ────────────────────────────────────
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

// ── Página de Registro ───────────────────────────────────────────────────────
export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    razon_social: '',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
    setApiError('');
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!form.razon_social.trim()) newErrors.razon_social = 'La razón social es obligatoria.';
    const nitV = validarNIT(form.nit);
    if (!nitV.valid) newErrors.nit = nitV.message;
    if (!form.direccion.trim()) newErrors.direccion = 'La dirección es obligatoria.';
    if (!form.telefono.trim()) newErrors.telefono = 'El teléfono es obligatorio.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    const emailV = validarEmail(form.email);
    if (!emailV.valid) newErrors.email = emailV.message;
    const passV = validarPassword(form.password);
    if (!passV.valid) newErrors.password = passV.message;
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const authResult = await signUp(form.email, form.password);
      const userId = authResult?.user?.id;

      if (!userId) {
        throw new Error('No se pudo obtener el ID de usuario. Verifique que el correo no esté ya registrado.');
      }

      const { error: rpcError } = await supabase.rpc('register_new_company', {
        p_user_id: userId,
        p_razon_social: form.razon_social.trim(),
        p_nit: form.nit.trim(),
        p_direccion: form.direccion.trim(),
        p_telefono: form.telefono.trim(),
      });

      if (rpcError) {
        if (rpcError.message?.includes('NIT_DUPLICADO')) {
          throw new Error('El NIT ingresado ya está registrado en el sistema.');
        }
        throw new Error(rpcError.message || 'Error al crear la empresa.');
      }

      navigate('/dashboard');
    } catch (err) {
      setApiError(err.message || 'Error al registrar la empresa. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 520 }}>
        <div className="auth-card animate-slide-up">
          {/* ── Logo ────────────────────────────────────────────── */}
          <Link to="/landing" className="auth-logo" style={{ textDecoration: 'none' }}>
            <div className="auth-logo__icon">⏱️</div>
            <div className="auth-logo__title">ChronosWork</div>
            <div className="auth-logo__subtitle">Registro de Empresa Corporativa</div>
          </Link>

          {/* ── Indicador de pasos ──────────────────────────────── */}
          <div className="d-flex gap-1 mb-3">
            {[1, 2].map(s => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: step >= s
                    ? 'linear-gradient(90deg, var(--cw-accent), var(--cw-purple))'
                    : 'var(--border-medium)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>

          <p className="text-muted mb-3" style={{ fontSize: '0.8rem' }}>
            Paso {step} de 2 — {step === 1 ? 'Datos de la Empresa' : 'Credenciales de Acceso'}
          </p>

          {apiError && <div className="cw-alert cw-alert--error mb-3">{apiError}</div>}

          {/* ── Paso 1: Datos de la empresa ─────────────────────── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="cw-form-group">
                <label className="cw-label" htmlFor="razon_social">
                  Razón Social <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdBusiness} />
                  <input
                    id="razon_social"
                    name="razon_social"
                    type="text"
                    className={`cw-input pl-icon${errors.razon_social ? ' error' : ''}`}
                    placeholder="Empresa S.A.S."
                    value={form.razon_social}
                    onChange={handleChange}
                  />
                </div>
                {errors.razon_social && <span className="cw-input-error">{errors.razon_social}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="nit">
                  NIT <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdBadge} />
                  <input
                    id="nit"
                    name="nit"
                    type="text"
                    className={`cw-input pl-icon${errors.nit ? ' error' : ''}`}
                    placeholder="900123456-7"
                    value={form.nit}
                    onChange={handleChange}
                  />
                </div>
                {errors.nit && <span className="cw-input-error">{errors.nit}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="direccion">
                  Dirección <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdLocationOn} />
                  <input
                    id="direccion"
                    name="direccion"
                    type="text"
                    className={`cw-input pl-icon${errors.direccion ? ' error' : ''}`}
                    placeholder="Calle 123 # 45-67, Bogotá"
                    value={form.direccion}
                    onChange={handleChange}
                  />
                </div>
                {errors.direccion && <span className="cw-input-error">{errors.direccion}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="telefono">
                  Teléfono <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdPhone} />
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    className={`cw-input pl-icon${errors.telefono ? ' error' : ''}`}
                    placeholder="+57 300 123 4567"
                    value={form.telefono}
                    onChange={handleChange}
                  />
                </div>
                {errors.telefono && <span className="cw-input-error">{errors.telefono}</span>}
              </div>

              <button
                id="btn-next-step"
                type="button"
                onClick={handleNextStep}
                className="cw-btn cw-btn--primary cw-btn--lg"
                style={{ width: '100%' }}
              >
                Siguiente &rarr;
              </button>
            </div>
          )}

          {/* ── Paso 2: Credenciales ────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} id="register-form" className="animate-fade-in">
              <div className="cw-form-group">
                <label className="cw-label" htmlFor="email-reg">
                  Correo Corporativo del Administrador <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdMailOutline} />
                  <input
                    id="email-reg"
                    name="email"
                    type="email"
                    className={`cw-input pl-icon${errors.email ? ' error' : ''}`}
                    placeholder="admin@empresa.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                {errors.email && <span className="cw-input-error">{errors.email}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="password-reg">
                  Contraseña <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdLockOutline} />
                  <input
                    id="password-reg"
                    name="password"
                    type="password"
                    className={`cw-input pl-icon${errors.password ? ' error' : ''}`}
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
                {errors.password && <span className="cw-input-error">{errors.password}</span>}
                <PasswordStrengthMeter password={form.password} />
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="confirmPassword">
                  Confirmar Contraseña <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <InputIcon icon={MdLockOutline} />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    className={`cw-input pl-icon${errors.confirmPassword ? ' error' : ''}`}
                    placeholder="Repita la contraseña"
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                {errors.confirmPassword && <span className="cw-input-error">{errors.confirmPassword}</span>}
              </div>

              {/* Botones Atrás / Crear Cuenta */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="cw-btn cw-btn--secondary"
                  style={{ flex: 1 }}
                >
                  &larr; Atrás
                </button>
                <button
                  id="btn-register"
                  type="submit"
                  className="cw-btn cw-btn--primary"
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="cw-spinner cw-spinner--sm"></span> Registrando...</>
                  ) : (
                    'Crear Cuenta'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── Link a login ────────────────────────────────────── */}
          <div className="text-center mt-3">
            <span className="text-muted" style={{ fontSize: '0.82rem' }}>
              ¿Ya tienes cuenta?{' '}
            </span>
            <Link to="/login" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              Inicia sesión
            </Link>
          </div>

          {/* ── Footer ──────────────────────────────────────────── */}
          <div className="text-center mt-3 text-muted" style={{ fontSize: '0.75rem' }}>
            &copy; {new Date().getFullYear()} ChronosWork &middot; CST Colombia
          </div>
        </div>
      </div>
    </div>
  );
}
