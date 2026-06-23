import { useState, useEffect, useRef, useCallback } from 'react';
import { useDemandSlots } from '../hooks/useDemandSlots';
import { supabase } from '../config/supabaseClient';

// ── Constantes ────────────────────────────────────────────────────────────
const DIAS = [
  { value: 1, label: 'Lunes',     short: 'Lun' },
  { value: 2, label: 'Martes',    short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves',    short: 'Jue' },
  { value: 5, label: 'Viernes',   short: 'Vie' },
  { value: 6, label: 'Sábado',    short: 'Sáb' },
  { value: 7, label: 'Domingo',   short: 'Dom' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Colores por nivel de demanda
function levelColor(val, max) {
  const t = val / (max || 1);
  if (t <= 0)   return 'var(--bg-glass)';
  if (t < 0.25) return 'rgba(59,130,246,0.25)';
  if (t < 0.5)  return 'rgba(59,130,246,0.55)';
  if (t < 0.75) return 'rgba(245,158,11,0.7)';
  return 'rgba(239,68,68,0.8)';
}

function levelLabel(val, max) {
  const t = val / (max || 1);
  if (t <= 0)   return 'Sin cobertura';
  if (t < 0.25) return 'Baja demanda';
  if (t < 0.5)  return 'Demanda media';
  if (t < 0.75) return 'Alta demanda';
  return 'Pico máximo';
}

// ── Componente principal ──────────────────────────────────────────────────
/**
 * DemandCurveEditor
 * Editor tipo ecualizador para configurar curvas de demanda horaria por día.
 * Permite drag sobre las barras para ajustar el personal requerido.
 *
 * Props:
 *  area  — objeto del área con { id }
 */
export function DemandCurveEditor({ area, embedded }) {
  const { demandSlots, loading, bulkReplaceDaySlots, updateDemandSlotGroup, deleteDemandSlotGroup }
    = useDemandSlots(area.id);

  const [selectedDay, setSelectedDay]     = useState(1);
  const [applyToWeek, setApplyToWeek]     = useState(false);
  const [applyDays, setApplyDays]         = useState([1]);
  const [maxStaff, setMaxStaff]           = useState(10);
  const [isDragging, setIsDragging]       = useState(false);
  const [savingHour, setSavingHour]       = useState(null);
  const [toast, setToast]                 = useState(null);
  const [viewMode, setViewMode]           = useState('equalizer'); // 'equalizer' | 'week'
  const dragRef      = useRef(false);
  const pendingRef   = useRef({});  // hora → valor pendiente de guardar
  const draftRef     = useRef({});  // copia del draft sin dependencia reactiva
  const activeBarRef = useRef(null); // { hour, rect } de la barra activa durante drag

  // ── Local draft del día actual ────────────────────────────────────────
  // Mapa hora→personal para el día seleccionado
  const [draft, setDraft] = useState(() => Object.fromEntries(HOURS.map(h => [h, 0])));

  // Sincronizar draft desde BD
  useEffect(() => {
    const dayRows = demandSlots.filter(s => s.day_of_week === selectedDay);
    const newDraft = Object.fromEntries(HOURS.map(h => {
      const row = dayRows.find(r => r.start_hour <= h && r.end_hour > h);
      return [h, row ? row.required_staff : 0];
    }));
    draftRef.current = newDraft;
    setDraft(newDraft);
  }, [demandSlots, selectedDay]);

  // Actualizar maxStaff solo cuando NO hay drag
  useEffect(() => {
    if (dragRef.current) return;
    const allVals = demandSlots.map(s => s.required_staff);
    const localMax = Object.values(draft);
    const computed = Math.max(1, ...allVals, ...localMax, 5);
    setMaxStaff(Math.ceil(computed * 1.2));
  }, [demandSlots, draft]);

  // ── Mostrar toast ─────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Guardar la curva completa del día en BD ────────────────────────────
  const saveDraft = useCallback(async (draftToSave, days) => {
    if (!days || days.length === 0) return;
    try {
      // Comprimir horas consecutivas con mismo valor en franjas
      const segments = [];
      let segStart = 0;
      let segVal   = draftToSave[0] ?? 0;

      for (let h = 1; h <= 24; h++) {
        const val = h < 24 ? (draftToSave[h] ?? 0) : -1;
        if (val !== segVal) {
          if (segVal > 0) {
            segments.push({ start_hour: segStart, end_hour: h, required_staff: segVal });
          }
          segStart = h;
          segVal   = val;
        }
      }

      // Reemplazar todos los slots de los días indicados en una sola transacción
      await bulkReplaceDaySlots(days, segments);

      showToast(days.length > 1 ? `Curva guardada en ${days.length} días` : 'Curva guardada');
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }, [bulkReplaceDaySlots]);

  // ── Handlers del ecualizador ──────────────────────────────────────────
  const handleBarValue = useCallback((hour, clientY, rect) => {
    const pct = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const val = Math.round(pct * maxStaff);
    setDraft(prev => {
      const next = { ...prev, [hour]: val };
      draftRef.current = next; // mantener ref sincronizada sin causar re-render
      return next;
    });
    pendingRef.current[hour] = val;
  }, [maxStaff]);

  const handleMouseDown = useCallback((e, hour, barRef) => {
    e.preventDefault();
    dragRef.current = true;
    activeBarRef.current = { hour, ref: barRef };
    setIsDragging(true);
    if (barRef.current) handleBarValue(hour, e.clientY, barRef.current.getBoundingClientRect());
  }, [handleBarValue]);

  // Listener global de mousemove con passive:false para poder llamar preventDefault()
  // Esto evita que la página haga scroll mientras se arrastra una barra
  useEffect(() => {
    const onGlobalMove = (e) => {
      if (!dragRef.current) return;
      e.preventDefault(); // bloquear scroll de página durante drag
      const active = activeBarRef.current;
      if (active?.ref?.current) {
        handleBarValue(active.hour, e.clientY, active.ref.current.getBoundingClientRect());
      }
    };
    // passive: false es OBLIGATORIO para poder llamar preventDefault()
    window.addEventListener('mousemove', onGlobalMove, { passive: false });
    return () => window.removeEventListener('mousemove', onGlobalMove);
  }, [handleBarValue]);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setIsDragging(false);
    const daysToApply = applyToWeek
      ? DIAS.map(d => d.value)
      : applyDays;
    // Usar draftRef para no tener 'draft' como dependencia
    // (evita recrear el listener global en cada render del drag)
    saveDraft({ ...draftRef.current, ...pendingRef.current }, daysToApply);
    pendingRef.current = {};
  }, [applyDays, applyToWeek, saveDraft]);

  // Escuchar mouseup global para soltar el drag fuera del componente
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // ── Helpers de vista semanal ──────────────────────────────────────────
  const getSlotValue = (dayOfWeek, hour) => {
    const row = demandSlots.find(
      s => s.day_of_week === dayOfWeek && s.start_hour <= hour && s.end_hour > hour
    );
    return row ? row.required_staff : 0;
  };

  const globalMax = Math.max(1, ...demandSlots.map(s => s.required_staff), ...Object.values(draft));

  // ── UI ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      marginTop: embedded ? 0 : '1.5rem',
      borderTop: embedded ? 'none' : '1px solid var(--border-subtle)',
      paddingTop: embedded ? 0 : '1.25rem',
      fontFamily: 'var(--font-body, system-ui)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: embedded ? 'flex-end' : 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        {!embedded && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
            CURVA DE DEMANDA — ECUALIZADOR
          </div>
        )}
        {/* Tabs vista */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.2rem' }}>
          {[{ id: 'equalizer', label: '🎚 Por día' }, { id: 'week', label: '📅 Semana' }].map(t => (
            <button key={t.id} onClick={() => setViewMode(t.id)} style={{
              padding: '0.3rem 0.75rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', border: 'none',
              background: viewMode === t.id ? 'var(--cw-primary)' : 'transparent',
              color: viewMode === t.id ? '#fff' : 'var(--text-muted)',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Arrastra las barras para indicar cuántas personas necesitas en cada hora. El algoritmo usará esta curva para
        construir turnos automáticos — <strong>no necesitas configurar franjas horarias manualmente.</strong>
      </p>

      {/* ── Vista ecualizador ── */}
      {viewMode === 'equalizer' && (
        <>
          {/* Selector de días */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {DIAS.map(d => {
              const hasCurve = demandSlots.some(s => s.day_of_week === d.value);
              const isSel = selectedDay === d.value;
              return (
                <button key={d.value} onClick={() => {
                  setSelectedDay(d.value);
                  if (!applyToWeek) setApplyDays([d.value]);
                }} style={{
                  padding: '0.4rem 0.9rem', borderRadius: 20, cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: isSel ? 700 : 500, flexShrink: 0,
                  transition: 'all 0.15s',
                  background: isSel ? 'var(--cw-primary)' : hasCurve ? 'var(--bg-glass)' : 'transparent',
                  border: isSel ? '1px solid var(--cw-primary)' : hasCurve ? '1px solid var(--border-subtle)' : '1px dashed var(--border-medium)',
                  color: isSel ? '#fff' : hasCurve ? 'var(--text-primary)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                }}>
                  {d.short}
                  {hasCurve && !isSel && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cw-primary)', display: 'inline-block' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Opción aplicar a varios días */}
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={applyToWeek} onChange={e => setApplyToWeek(e.target.checked)} />
              Aplicar la misma curva a <strong>toda la semana</strong>
            </label>
            {!applyToWeek && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Copiar a:</span>
                {DIAS.map(d => {
                  const isSel = applyDays.includes(d.value);
                  return (
                    <button key={d.value} onClick={() => {
                      setApplyDays(prev =>
                        isSel && prev.length > 1
                          ? prev.filter(x => x !== d.value)
                          : [...new Set([...prev, d.value])].sort()
                      );
                    }} style={{
                      padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.12s',
                      border: `2px solid ${isSel ? 'var(--cw-primary)' : 'var(--border-subtle)'}`,
                      background: isSel ? 'var(--cw-primary)' : 'transparent',
                      color: isSel ? '#fff' : 'var(--text-muted)',
                    }}>{d.short}</button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ecualizador */}
          <div style={{ position: 'relative' }}>
            <div style={{
              opacity: loading ? 0.6 : 1,
              pointerEvents: loading ? 'none' : 'auto',
              transition: 'opacity 0.2s ease',
            }}>
              <EqualizerBars
                draft={draft}
                maxStaff={maxStaff}
                isDragging={isDragging}
                onMaxChange={setMaxStaff}
                onMouseDown={handleMouseDown}
              />
            </div>
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(8, 12, 26, 0.25)',
                backdropFilter: 'blur(1px)',
                borderRadius: 14,
                zIndex: 10,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="cw-spinner" />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cargando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Leyenda de colores */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Sin cobertura', bg: 'var(--bg-glass)' },
              { label: 'Baja',          bg: 'rgba(59,130,246,0.35)' },
              { label: 'Media',         bg: 'rgba(59,130,246,0.6)' },
              { label: 'Alta',          bg: 'rgba(245,158,11,0.75)' },
              { label: 'Pico',          bg: 'rgba(239,68,68,0.85)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: item.bg, border: '1px solid var(--border-subtle)' }} />
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Vista semanal (heatmap) ── */}
      {viewMode === 'week' && (
        <WeekHeatmap
          dias={DIAS}
          hours={HOURS}
          getSlotValue={getSlotValue}
          globalMax={globalMax}
          onCellClick={(day) => { setSelectedDay(day); setViewMode('equalizer'); setApplyDays([day]); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#fff', padding: '0.65rem 1.25rem', borderRadius: 10,
          fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Subcomponente: barras del ecualizador ──────────────────────────────────
function EqualizerBars({ draft, maxStaff, isDragging, onMaxChange, onMouseDown }) {
  const barRefs = useRef({});

  return (
    <div style={{
      background: 'var(--bg-glass)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      padding: '1.25rem 1rem 0.75rem',
      userSelect: 'none',
      cursor: isDragging ? 'ns-resize' : 'default',
    }}>
      {/* Control de escala */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Personal máximo en escala: <strong>{maxStaff}</strong>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[5, 10, 15, 20, 30, 50].map(v => (
            <button key={v} onClick={() => onMaxChange(v)} style={{
              padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem',
              fontWeight: maxStaff === v ? 700 : 400,
              border: `1px solid ${maxStaff === v ? 'var(--cw-primary)' : 'var(--border-subtle)'}`,
              background: maxStaff === v ? 'var(--cw-primary)' : 'transparent',
              color: maxStaff === v ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
            }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Barras */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(24, 1fr)',
        gap: '2px',
        height: 160,
        alignItems: 'end',
      }}>
        {HOURS.map(h => {
          const val = draft[h] ?? 0;
          const pct = maxStaff > 0 ? val / maxStaff : 0;
          const color = levelColor(val, maxStaff);

          if (!barRefs.current[h]) barRefs.current[h] = { current: null };

          return (
            <div
              key={h}
              ref={el => { if (!barRefs.current[h]) barRefs.current[h] = {}; barRefs.current[h].current = el; }}
              title={`${String(h).padStart(2,'0')}:00 — ${val} persona${val !== 1 ? 's' : ''}\n${levelLabel(val, maxStaff)}`}
              onMouseDown={e => onMouseDown(e, h, barRefs.current[h])}
              style={{
                height: '100%',
                position: 'relative',
                cursor: 'ns-resize',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              {/* Barra de valor */}
              <div style={{
                height: `${Math.max(3, pct * 100)}%`,
                background: color,
                borderRadius: '3px 3px 0 0',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: isDragging ? 'none' : 'height 0.15s ease, background 0.15s ease',
                minHeight: 3,
              }} />
              {/* Etiqueta de hora (cada 3 horas) */}
              {h % 3 === 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: -18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.6rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {String(h).padStart(2, '0')}h
                </div>
              )}
              {/* Valor encima de la barra (solo si tiene valor) */}
              {val > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: `calc(${Math.max(3, pct * 100)}% + 2px)`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  lineHeight: 1,
                }}>
                  {val}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spacer para etiquetas */}
      <div style={{ height: 22 }} />
    </div>
  );
}

// ── Subcomponente: heatmap semanal ────────────────────────────────────────
function WeekHeatmap({ dias, hours, getSlotValue, globalMax, onCellClick }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `48px repeat(${hours.length}, 1fr)`,
        gap: '1px',
        background: 'var(--border-subtle)',
        borderRadius: 10,
        overflow: 'hidden',
        minWidth: 600,
      }}>
        {/* Header horas */}
        <div style={{ background: 'var(--bg-secondary)', padding: '0.4rem', fontSize: '0.65rem', color: 'var(--text-muted)' }} />
        {hours.map(h => (
          <div key={h} style={{
            background: 'var(--bg-secondary)',
            padding: '0.3rem 0.1rem',
            textAlign: 'center',
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            fontWeight: h % 6 === 0 ? 700 : 400,
          }}>
            {h % 3 === 0 ? `${String(h).padStart(2,'0')}h` : ''}
          </div>
        ))}

        {/* Filas por día */}
        {dias.map(d => (
          <>
            <div key={`label-${d.value}`} style={{
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem 0.2rem',
            }} onClick={() => onCellClick(d.value)} title={`Editar ${d.label}`}>
              {d.short}
            </div>
            {hours.map(h => {
              const val = getSlotValue(d.value, h);
              const bg  = levelColor(val, globalMax);
              return (
                <div
                  key={`${d.value}-${h}`}
                  title={`${d.label} ${String(h).padStart(2,'0')}:00 — ${val} persona${val !== 1 ? 's' : ''}`}
                  onClick={() => onCellClick(d.value)}
                  style={{
                    background: bg,
                    cursor: 'pointer',
                    minHeight: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    color: val > globalMax * 0.6 ? '#fff' : 'transparent',
                    fontWeight: 700,
                    transition: 'opacity 0.1s',
                  }}
                >
                  {val > 0 ? val : ''}
                </div>
              );
            })}
          </>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        Haz clic en cualquier día para editarlo con el ecualizador.
      </p>
    </div>
  );
}
