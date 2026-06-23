import { useState } from 'react';
import { BREAK_POLICY_DEFAULTS_CO } from '../core/generateAutomaticShifts';
import { MdInfo, MdLock, MdEdit, MdAdd, MdDelete } from 'react-icons/md';

/**
 * BreakPolicyConfig
 * Panel para configurar la política de descansos del área: duración de breaks
 * y almuerzo, espaciado mínimo/máximo entre descansos, y las reglas de cuántos
 * breaks / si lleva almuerzo según la duración del turno.
 *
 * Props:
 *   value    — break_policy actual del área (puede ser null = defaults)
 *   onChange — callback(newPolicy | null) al guardar
 */
const ALMUERZO_OPCIONES = [30, 45, 60];

export function BreakPolicyConfig({ value, onChange }) {
  const base = { ...BREAK_POLICY_DEFAULTS_CO, ...(value || {}) };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(base);
  const [error, setError] = useState('');

  const isCustom = !!value && Object.keys(value || {}).length > 0;

  const openEditor = () => {
    setDraft({
      ...BREAK_POLICY_DEFAULTS_CO,
      ...(value || {}),
      reglas: (value?.reglas || BREAK_POLICY_DEFAULTS_CO.reglas).map(r => ({ ...r })),
    });
    setError('');
    setEditing(true);
  };

  const setField = (k, v) => setDraft(prev => ({ ...prev, [k]: v }));

  const setRegla = (i, k, v) => setDraft(prev => {
    const reglas = prev.reglas.map((r, idx) => idx === i ? { ...r, [k]: v } : r);
    return { ...prev, reglas };
  });
  const addRegla = () => setDraft(prev => ({
    ...prev, reglas: [...prev.reglas, { desdeHoras: 0, breaks: 1, almuerzo: false }],
  }));
  const removeRegla = (i) => setDraft(prev => ({
    ...prev, reglas: prev.reglas.filter((_, idx) => idx !== i),
  }));

  const validate = (d) => {
    if (!(d.breakMinutos > 0)) return 'La duración del break debe ser mayor a 0.';
    if (!ALMUERZO_OPCIONES.includes(Number(d.almuerzoMinutos))) return 'El almuerzo debe ser 30, 45 o 60 minutos.';
    if (!(d.gapMinHoras > 0)) return 'El espaciado mínimo debe ser mayor a 0.';
    if (!(d.gapMaxHoras >= d.gapMinHoras)) return 'El espaciado máximo debe ser ≥ al mínimo.';
    if (!Array.isArray(d.reglas) || d.reglas.length === 0) return 'Define al menos una regla por horas.';
    return '';
  };

  const handleSave = () => {
    const cleaned = {
      breakMinutos: Number(draft.breakMinutos),
      almuerzoMinutos: Number(draft.almuerzoMinutos),
      gapMinHoras: Number(draft.gapMinHoras),
      gapMaxHoras: Number(draft.gapMaxHoras),
      reglas: [...draft.reglas]
        .map(r => ({ desdeHoras: Number(r.desdeHoras) || 0, breaks: Math.max(0, parseInt(r.breaks, 10) || 0), almuerzo: !!r.almuerzo }))
        .sort((a, b) => a.desdeHoras - b.desdeHoras),
    };
    const err = validate(cleaned);
    if (err) { setError(err); return; }
    setError('');
    onChange(cleaned);
    setEditing(false);
  };

  const handleReset = () => {
    setDraft({ ...BREAK_POLICY_DEFAULTS_CO });
    onChange(null);
    setEditing(false);
  };

  const fieldStyle = {
    width: '100%', padding: '0.4rem 0.55rem', borderRadius: 8,
    border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: '0.85rem',
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
            POLÍTICA DE DESCANSOS
          </span>
          {isCustom ? (
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20,
              background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)',
            }}>Personalizado</span>
          ) : (
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 20,
              background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)',
            }}>
              <MdLock style={{ fontSize: '0.75rem', verticalAlign: 'middle', marginRight: 2 }} />
              Default Colombia
            </span>
          )}
        </div>
        <button onClick={() => (editing ? setEditing(false) : openEditor())} style={{
          padding: '0.35rem 0.85rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
          border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}>
          <MdEdit style={{ fontSize: '0.9rem' }} />{editing ? 'Cerrar' : 'Ajustar'}
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Define cómo el algoritmo programa los descansos: la duración de cada break y del almuerzo, el espaciado
        permitido y cuántos descansos lleva un turno según sus horas. Ajustable si cambian las leyes laborales.
      </p>

      {/* Resumen cerrado */}
      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {[
            { label: 'Duración del break', val: `${base.breakMinutos} min` },
            { label: 'Almuerzo', val: `${base.almuerzoMinutos} min` },
            { label: 'Espera mín.', val: `${base.gapMinHoras} h` },
            { label: 'Espera máx.', val: `${base.gapMaxHoras} h` },
          ].map(c => (
            <div key={c.label} style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0.6rem 0.75rem',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{c.label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.val}</div>
            </div>
          ))}
          <div style={{
            gridColumn: '1 / -1', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: '0.6rem 0.75rem',
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Reglas por horas de turno</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {[...base.reglas].sort((a, b) => a.desdeHoras - b.desdeHoras).map((r, i) => (
                <span key={i} style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 20,
                  background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                }}>
                  ≥{r.desdeHoras}h → {r.breaks} break{r.breaks !== 1 ? 's' : ''}{r.almuerzo ? ' + 🍴' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 12,
          padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <div style={{
            padding: '0.75rem', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: '0.5rem',
          }}>
            <MdInfo style={{ fontSize: '1.1rem', color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />
            <span>
              Los descansos se programan respetando el espaciado: el primero entre <strong>{draft.gapMinHoras}h y {draft.gapMaxHoras}h</strong> después
              de entrar, y los siguientes entre {draft.gapMinHoras}h y {draft.gapMaxHoras}h tras volver del anterior.
            </span>
          </div>

          {/* Duraciones y espaciado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>Break (min)</label>
              <input type="number" min={5} max={60} step={5} value={draft.breakMinutos}
                onChange={e => setField('breakMinutos', Number(e.target.value))} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>Almuerzo (min)</label>
              <select value={draft.almuerzoMinutos} onChange={e => setField('almuerzoMinutos', Number(e.target.value))} style={fieldStyle}>
                {ALMUERZO_OPCIONES.map(o => <option key={o} value={o}>{o} min</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>Espera mín. (h)</label>
              <input type="number" min={0.5} max={6} step={0.5} value={draft.gapMinHoras}
                onChange={e => setField('gapMinHoras', Number(e.target.value))} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>Espera máx. (h)</label>
              <input type="number" min={0.5} max={8} step={0.5} value={draft.gapMaxHoras}
                onChange={e => setField('gapMaxHoras', Number(e.target.value))} style={fieldStyle} />
            </div>
          </div>

          {/* Reglas por horas */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reglas por duración del turno</label>
              <button onClick={addRegla} style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.6rem', borderRadius: 8,
                fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)', color: 'var(--text-secondary)',
              }}><MdAdd /> Agregar regla</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, padding: '0 0.2rem' }}>
                <span>Desde (horas)</span><span>Nº de breaks</span><span>¿Almuerzo?</span><span></span>
              </div>
              {draft.reglas.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="number" min={0} max={24} step={0.5} value={r.desdeHoras}
                    onChange={e => setRegla(i, 'desdeHoras', Number(e.target.value))} style={fieldStyle} />
                  <input type="number" min={0} max={5} step={1} value={r.breaks}
                    onChange={e => setRegla(i, 'breaks', Number(e.target.value))} style={fieldStyle} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={!!r.almuerzo} onChange={e => setRegla(i, 'almuerzo', e.target.checked)} />
                    {r.almuerzo ? 'Sí' : 'No'}
                  </label>
                  <button onClick={() => removeRegla(i)} title="Quitar regla" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', borderRadius: 8,
                    cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'transparent', color: '#dc2626',
                  }}><MdDelete /></button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.4 }}>
              Se aplica la regla de mayor "Desde" que no supere las horas del turno. Ej: turno de 8h → toma la regla "Desde 8".
            </div>
          </div>

          {error && <div style={{ fontSize: '0.78rem', color: '#dc2626' }}>⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={handleReset} style={{
              padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)',
            }}>🔄 Restaurar default</button>
            <button onClick={handleSave} style={{
              padding: '0.5rem 1.25rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--cw-primary)', background: 'var(--cw-primary)', color: '#fff',
            }}>Guardar cambios</button>
          </div>
        </div>
      )}
    </div>
  );
}
