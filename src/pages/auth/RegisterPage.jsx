import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { validarEmail, validarPassword, validarNIT, validarNombre } from '../../core/validators';
import { MdBusiness, MdMailOutline, MdLockOutline, MdPhone, MdLocationOn, MdBadge } from 'react-icons/md';

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
      // 1. Registrar usuario en Supabase Auth
      const authResult = await signUp(form.email, form.password);
      const userId = authResult?.user?.id;

      if (!userId) {
        throw new Error('No se pudo obtener el ID de usuario. Verifique que el correo no esté ya registrado.');
      }

      // 2. Crear empresa + vincular usuario en una sola transacción segura (RPC)
      // La función register_new_company usa SECURITY DEFINER para evitar problemas de RLS
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_new_company', {
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

      // 3. Redirigir al dashboard
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
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo__icon">⏱️</div>
            <div className="auth-logo__title">ChronosWork</div>
            <div className="auth-logo__subtitle">Registro de Empresa Corporativa</div>
          </div>

          {/* Steps indicator */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[1, 2].map(s => (
              <div
                key={s}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: step >= s
                    ? 'linear-gradient(90deg, #2563eb, #7c3aed)'
                    : 'var(--border-medium)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Paso {step} de 2 — {step === 1 ? 'Datos de la Empresa' : 'Credenciales de Acceso'}
          </div>

          {apiError && <div className="cw-alert cw-alert--error">🚫 {apiError}</div>}

          {/* Step 1: Company Data */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="cw-form-group">
                <label className="cw-label" htmlFor="razon_social">
                  Razón Social <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <MdBusiness style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="razon_social" name="razon_social" type="text"
                    className={`cw-input${errors.razon_social ? ' error' : ''}`}
                    placeholder="Empresa S.A.S."
                    value={form.razon_social} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.razon_social && <span className="cw-input-error">⚠ {errors.razon_social}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="nit">NIT <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <MdBadge style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="nit" name="nit" type="text"
                    className={`cw-input${errors.nit ? ' error' : ''}`}
                    placeholder="900123456-7"
                    value={form.nit} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.nit && <span className="cw-input-error">⚠ {errors.nit}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="direccion">Dirección <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <MdLocationOn style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="direccion" name="direccion" type="text"
                    className={`cw-input${errors.direccion ? ' error' : ''}`}
                    placeholder="Calle 123 # 45-67, Bogotá"
                    value={form.direccion} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.direccion && <span className="cw-input-error">⚠ {errors.direccion}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="telefono">Teléfono <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <MdPhone style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="telefono" name="telefono" type="tel"
                    className={`cw-input${errors.telefono ? ' error' : ''}`}
                    placeholder="+57 300 123 4567"
                    value={form.telefono} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.telefono && <span className="cw-input-error">⚠ {errors.telefono}</span>}
              </div>

              <button id="btn-next-step" type="button" onClick={handleNextStep}
                className="cw-btn cw-btn--primary cw-btn--lg" style={{ width: '100%' }}>
                Continuar →
              </button>
            </div>
          )}

          {/* Step 2: Credentials */}
          {step === 2 && (
            <form onSubmit={handleSubmit} id="register-form" className="animate-fade-in">
              <div className="cw-form-group">
                <label className="cw-label" htmlFor="email-reg">
                  Correo Corporativo del Administrador <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <MdMailOutline style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="email-reg" name="email" type="email"
                    className={`cw-input${errors.email ? ' error' : ''}`}
                    placeholder="admin@empresa.com"
                    value={form.email} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.email && <span className="cw-input-error">⚠ {errors.email}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="password-reg">Contraseña <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <MdLockOutline style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="password-reg" name="password" type="password"
                    className={`cw-input${errors.password ? ' error' : ''}`}
                    placeholder="Mínimo 8 caracteres"
                    value={form.password} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.password && <span className="cw-input-error">⚠ {errors.password}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label" htmlFor="confirmPassword">Confirmar Contraseña <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <MdLockOutline style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input id="confirmPassword" name="confirmPassword" type="password"
                    className={`cw-input${errors.confirmPassword ? ' error' : ''}`}
                    placeholder="Repita la contraseña"
                    value={form.confirmPassword} onChange={handleChange}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {errors.confirmPassword && <span className="cw-input-error">⚠ {errors.confirmPassword}</span>}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setStep(1)} className="cw-btn cw-btn--secondary" style={{ flex: 1 }}>
                  ← Atrás
                </button>
                <button id="btn-register" type="submit" className="cw-btn cw-btn--primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Registrando...</> : '🚀 Crear Empresa'}
                </button>
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              ¿Ya tiene cuenta?{' '}
            </span>
            <Link to="/login" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
