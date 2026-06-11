import { useAuth } from '../context/AuthContext';
import { PLANES } from '../config/constants';
import { formatFecha } from '../core/dateUtils';
import { MdBusiness, MdVerified, MdInfo } from 'react-icons/md';

export default function ConfigPage() {
  const { user, tenant } = useAuth();
  const plan = PLANES[tenant?.plan] || PLANES.start;

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">⚙️ Configuración</h1>
          <p className="page-subtitle">Información de la empresa y configuración del sistema</p>
        </div>
      </div>

      <div className="cw-grid cw-grid--2">
        {/* Company Info */}
        <div className="cw-card">
          <div className="cw-card__header">
            <h3 className="cw-card__title"><MdBusiness style={{ marginRight: '0.5rem' }} />Datos de la Empresa</h3>
            <MdVerified style={{ color: 'var(--cw-success)', fontSize: '1.25rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Razón Social', value: tenant?.razon_social || '—' },
              { label: 'NIT', value: tenant?.nit || '—' },
              { label: 'Dirección', value: tenant?.direccion || '—' },
              { label: 'Teléfono', value: tenant?.telefono || '—' },
              { label: 'Administrador', value: user?.email || '—' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.625rem 0', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Info */}
        <div className="cw-card">
          <div className="cw-card__header">
            <h3 className="cw-card__title">📦 Plan de Suscripción</h3>
          </div>
          <div style={{
            padding: '1.25rem', marginBottom: '1.25rem',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(124,58,237,0.1))',
            border: '1px solid var(--border-accent)', borderRadius: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
              Plan Activo
            </div>
            <div style={{
              fontSize: '1.75rem', fontWeight: 900,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {plan.nombre}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {plan.descripcion}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {plan.features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--cw-success)' }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Legal Framework */}
        <div className="cw-card" style={{ gridColumn: '1 / -1' }}>
          <div className="cw-card__header">
            <h3 className="cw-card__title">⚖️ Marco Normativo Configurado</h3>
            <span className="cw-badge cw-badge--green">✓ Activo 2026</span>
          </div>
          <div className="cw-grid cw-grid--3">
            {[
              { title: 'Ley 2101 de 2021', desc: 'Jornada ordinaria máxima: 42 horas semanales', color: '#10b981' },
              { title: 'Ley 2466 de 2025', desc: 'Reforma laboral: bandas horarias y progresividad de recargos dominicales 2026', color: '#3b82f6' },
              { title: 'CST Colombia', desc: 'Código Sustantivo del Trabajo: límites de horas extra, recargos nocturnos y festivos', color: '#8b5cf6' },
            ].map(item => (
              <div key={item.title} style={{
                padding: '1rem', borderRadius: 10,
                background: `${item.color}0d`, border: `1px solid ${item.color}25`,
              }}>
                <div style={{ fontWeight: 700, color: item.color, marginBottom: '0.375rem', fontSize: '0.875rem' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
