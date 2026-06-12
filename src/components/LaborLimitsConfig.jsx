import { useState } from 'react';
import { LEGAL_DEFAULTS_CO } from '../core/generateAutomaticShifts';
import { MdInfo, MdLock, MdEdit, MdWarning, MdCheckCircle } from 'react-icons/md';

/**
 * LaborLimitsConfig
 * Panel para configurar los límites legales de jornada laboral por área.
 * Los valores por defecto corresponden a la legislación colombiana vigente.
 *
 * Props:
 *   value    — objeto actual de laborLimits (puede ser null/undefined)
 *   onChange — callback(newLimits) llamado al guardar
 */
export function LaborLimitsConfig({ value, onChange }) {
  const current = { ...LEGAL_DEFAULTS_CO, ...(value || {}) };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(current);
  const [errors, setErrors]   = useState({});

  const isCustomized = Object.keys(LEGAL_DEFAULTS_CO).some(
    k => (value || {})[k] !== undefined && (value || {})[k] !== LEGAL_DEFAULTS_CO[k]
  );

  const fieldDefs = [
    {
      key: 'maxHorasSemanales',
      label: 'Máx. horas por semana',
      legal: 42,
      legalLabel: 'Ley 2101/2021',
      min: 1,
      max: 48,
      unit: 'h',
      help: 'El máximo semanal ordinario. En Colombia es 42h (reducible en 2026). No puede superar 48h.',
    },
    {
      key: 'minHorasTurno',
      label: 'Mín. horas por turno',
      legal: 4,
      legalLabel: 'Art. 161 CST',
      min: 1,
      max: 8,
      unit: 'h',
      help: 'Duración mínima de un turno. La ley exige mínimo 4 horas continuas.',
    },
    {
      key: 'maxHorasTurno',
      label: 'Máx. horas por turno',
      legal: 9,
      legalLabel: 'CST + convenios',
      min: 4,
      max: 12,
      unit: 'h',
      help: 'Máximo de horas por turno sin generar horas extras. Incluye el tiempo de descanso.',
    },
    {
      key: 'maxHorasDiarias',
      label: 'Máx. horas diarias (inc. extras)',
      legal: 10,
      legalLabel: 'CST Art. 167',
      min: 4,
      max: 14,
      unit: 'h',
      help: 'Máximo de horas totales que puede trabajar un empleado en un día, sumando ordinarias y extras.',
    },
    {
      key: 'minHorasEntreJornadas',
      label: 'Descanso mínimo entre jornadas',
      legal: 9,
      legalLabel: 'CST Art. 34',
      min: 6,
      max: 24,
      unit: 'h',
      help: 'Horas mínimas de descanso entre el final de un turno y el inicio del siguiente.',
    },
    {
      key: 'diasDescansoSemana',
      label: 'Días de descanso por semana',
      legal: 1,
      legalLabel: 'CST Art. 172',
      min: 1,
      max: 3,
      unit: 'día(s)',
      help: 'Cantidad de días de descanso obligatorios por semana para empleados por horas.',
    },
  ];

  const validate = (vals) => {
    const e = {};
    if (vals.maxHorasSemanales > 48) e.maxHorasSemanales = 'No puede superar 48h (límite CST)';
    if (vals.maxHorasSemanales < vals.minHorasTurno) e.maxHorasSemanales = 'Debe ser mayor al mínimo por turno';
    if (vals.minHorasTurno < 4) e.minHorasTurno = 'La ley exige mínimo 4h por turno';
    if (vals.maxHorasTurno < vals.minHorasTurno) e.maxHorasTurno = 'Debe ser mayor o igual al mínimo';
    if (vals.maxHorasDiarias < vals.maxHorasTurno) e.maxHorasDiarias = 'Debe ser mayor o igual al máx. por turno';
    if (vals.minHorasEntreJornadas < 6) e.minHorasEntreJornadas = 'Mínimo 6h entre jornadas por seguridad';
    return e;
  };

  const handleSave = () => {
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onChange(draft);
    setEditing(false);
  };

  const handleReset = () => {
    setDraft({ ...LEGAL_DEFAULTS_CO });
    onChange(null); // null = "usar defaults"
    setEditing(false);
  };

  return (
    <div style={{
      marginTop: '1.5rem',
      borderTop: '1px solid var(--border-subtle)',
      paddingTop: '1.25rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
            LÍMITES DE JORNADA LABORAL
          </span>
          {isCustomized && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem',
              borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#d97706',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
              Personalizado
            </span>
          )}
          {!isCustomized && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
              borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#059669',
              border: '1px solid rgba(16,185,129,0.25)',
            }}>
              <MdLock style={{ fontSize: '0.75rem', verticalAlign: 'middle', marginRight: 2 }} />
              Ley Colombia
            </span>
          )}
        </div>
        <button
          onClick={() => { setEditing(!editing); setDraft({ ...LEGAL_DEFAULTS_CO, ...(value || {}) }); }}
          style={{
            padding: '0.35rem 0.85rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--border-subtle)',
            background: 'var(--bg-glass)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}>
          <MdEdit style={{ fontSize: '0.9rem' }} />
          {editing ? 'Cerrar' : 'Ajustar'}
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        El algoritmo respeta estos límites al construir los turnos. Los valores predeterminados cumplen la legislación
        colombiana vigente; puedes ajustarlos según las necesidades de tu empresa <strong>sin incumplir la ley</strong>
        (el sistema te avisará si intentas hacerlo).
      </p>

      {/* Resumen compacto cuando está cerrado */}
      {!editing && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
        }}>
          {fieldDefs.map(f => (
            <div key={f.key} style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '0.6rem 0.75rem',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem', lineHeight: 1.3 }}>
                {f.label}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {current[f.key]} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{f.unit}</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Legal: {f.legal}{f.unit}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel de edición */}
      {editing && (
        <div style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          {/* Aviso */}
          <div style={{
            padding: '0.75rem', background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8,
            fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
            display: 'flex', gap: '0.5rem',
          }}>
            <MdInfo style={{ fontSize: '1.1rem', color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />
            <span>
              Puedes reducir jornadas (ej. 36h/semana) o aumentar descansos, pero no puedes superar los
              máximos legales. El sistema marcará en rojo los valores inválidos.
            </span>
          </div>

          {fieldDefs.map(f => (
            <div key={f.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {f.label}
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Legal: <strong>{f.legal} {f.unit}</strong> ({f.legalLabel})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={1}
                  value={draft[f.key]}
                  onChange={e => {
                    setDraft(prev => ({ ...prev, [f.key]: Number(e.target.value) }));
                    setErrors(prev => ({ ...prev, [f.key]: undefined }));
                  }}
                  style={{ flex: 1, accentColor: errors[f.key] ? '#dc2626' : 'var(--cw-primary)' }}
                />
                <div style={{
                  minWidth: 52, textAlign: 'center',
                  fontWeight: 700, fontSize: '1rem',
                  color: errors[f.key] ? '#dc2626' : 'var(--text-primary)',
                }}>
                  {draft[f.key]}<span style={{ fontSize: '0.72rem', fontWeight: 400 }}> {f.unit}</span>
                </div>
                {/* Indicador comparativo */}
                <div style={{ minWidth: 24, display: 'flex', alignItems: 'center' }}>
                  {draft[f.key] < f.legal
                    ? <MdCheckCircle style={{ color: '#059669', fontSize: '1.1rem' }} title="Más beneficioso para el trabajador" />
                    : draft[f.key] === f.legal
                    ? <MdLock style={{ color: 'var(--text-muted)', fontSize: '1rem' }} title="Valor legal" />
                    : <MdWarning style={{ color: '#d97706', fontSize: '1.1rem' }} title="Supera el mínimo legal — verificar" />
                  }
                </div>
              </div>
              {errors[f.key] && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.3rem' }}>
                  ⚠️ {errors[f.key]}
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', lineHeight: 1.4 }}>
                {f.help}
              </div>
            </div>
          ))}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={handleReset} style={{
              padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-muted)',
            }}>
              🔄 Restaurar ley
            </button>
            <button onClick={handleSave} style={{
              padding: '0.5rem 1.25rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
              cursor: 'pointer', border: '1px solid var(--cw-primary)',
              background: 'var(--cw-primary)', color: '#fff',
            }}>
              Guardar cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
