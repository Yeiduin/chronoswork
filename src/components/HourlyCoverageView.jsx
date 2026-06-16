import { useState, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { MdChevronLeft, MdChevronRight, MdPeople, MdAccessTime, MdWarning, MdCheckCircle } from 'react-icons/md';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = HOURS.map(h => `${String(h).padStart(2, '0')}:00`);

function getCoverageByHour(shifts, dateStr) {
  const coverage = new Array(24).fill(0);
  const empByHour = Array.from({ length: 24 }, () => []);

  shifts.forEach(s => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const sDate = format(start, 'yyyy-MM-dd');
    const eDate = format(end, 'yyyy-MM-dd');

    let startHour = 0, endHour = 24;
    if (sDate === dateStr && eDate === dateStr) {
      startHour = start.getHours();
      endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
    } else if (sDate === dateStr) {
      startHour = start.getHours();
      endHour = 24;
    } else if (eDate === dateStr) {
      startHour = 0;
      endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
    }

    for (let h = startHour; h < endHour; h++) {
      if (h >= 0 && h < 24) {
        coverage[h]++;
        empByHour[h].push(s.employee_id);
      }
    }
  });

  return { coverage, empByHour };
}

function getColorForCount(count, maxCount) {
  if (count === 0) return 'var(--cw-danger)';
  if (maxCount <= 0) return 'var(--cw-gray-500)';
  const ratio = count / maxCount;
  if (ratio >= 0.7) return 'var(--cw-success)';
  if (ratio >= 0.4) return 'var(--cw-warning)';
  return 'var(--cw-danger)';
}

export function HourlyCoverageView({ shifts, employees, selectedDate: initialDate, demandSlots }) {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [expandedHour, setExpandedHour] = useState(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

  const { coverage, empByHour } = useMemo(
    () => getCoverageByHour(shifts, dateStr),
    [shifts, dateStr]
  );

  const maxCount = Math.max(...coverage, 1);
  const totalEmployees = employees.length;

  const dayDemandSlots = useMemo(() => {
    if (!demandSlots?.length) return null;
    return demandSlots
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_hour - b.start_hour);
  }, [demandSlots, dayOfWeek]);

  const getDemandForHour = (hour) => {
    if (!dayDemandSlots) return null;
    const slot = dayDemandSlots.find(s => hour >= s.start_hour && hour < s.end_hour);
    return slot?.required_staff || null;
  };

  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach(e => { map[e.id] = e; });
    return map;
  }, [employees]);

  const goPrevDay = () => setSelectedDate(d => subDays(d, 1));
  const goNextDay = () => setSelectedDate(d => addDays(d, 1));
  const goToday = () => setSelectedDate(new Date());

  return (
    <div className="cw-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
            <MdAccessTime style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
            Cobertura por Hora
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-glass)', borderRadius: 8, padding: '0.2rem', border: '1px solid var(--border-medium)' }}>
            <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={goPrevDay} style={{ border: 'none', background: 'transparent' }}>
              <MdChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', padding: '0 0.5rem', minWidth: 130, textAlign: 'center' }}>
              {format(selectedDate, 'EEEE, d MMM yyyy', { locale: { formatLong: { date: () => '' }, localize: { month: (n) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][n], day: (n) => ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][n] } } })}
            </span>
            <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={goNextDay} style={{ border: 'none', background: 'transparent' }}>
              <MdChevronRight size={18} />
            </button>
          </div>
          <button className="cw-btn cw-btn--ghost" onClick={goToday} style={{ fontSize: '0.78rem' }}>Hoy</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}>
            <MdPeople style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Empleados:</span>
            <strong style={{ color: 'var(--cw-accent)' }}>{totalEmployees}</strong>
          </div>
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}>
            <MdAccessTime style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Turnos:</span>
            <strong style={{ color: 'var(--cw-accent)' }}>{shifts.filter(s => format(new Date(s.start_time), 'yyyy-MM-dd') === dateStr).length}</strong>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '60px 1fr',
        gap: '2px', fontSize: '0.82rem',
        maxHeight: '520px', overflowY: 'auto',
      }}>
        <div style={{
          fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.4rem 0.5rem',
          position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2,
        }}>Hora</div>
        <div style={{
          fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.4rem 0.5rem',
          position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2,
        }}>Colaboradores trabajando</div>

        {HOURS.map(hour => {
          const count = coverage[hour];
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const barColor = getColorForCount(count, maxCount);
          const demand = getDemandForHour(hour);
          const isExpanded = expandedHour === hour;

          return (
            <>
              <div key={`label-${hour}`} style={{
                padding: '0.5rem 0.5rem',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.78rem',
                color: count === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                background: hour % 2 === 0 ? 'var(--bg-glass)' : 'transparent',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
              }}
                onClick={() => setExpandedHour(isExpanded ? null : hour)}
              >
                {HOUR_LABELS[hour]}
                {demand !== null && (
                  <span style={{ fontSize: '0.6rem', color: 'var(--cw-purple)', fontWeight: 500 }}>
                    (req {demand})
                  </span>
                )}
              </div>
              <div key={`bar-${hour}`} style={{
                padding: '0.5rem 0.75rem',
                background: hour % 2 === 0 ? 'var(--bg-glass)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
              }}
                onClick={() => setExpandedHour(isExpanded ? null : hour)}
              >
                <div style={{
                  flex: 1, height: 24,
                  background: 'var(--bg-primary)',
                  borderRadius: 6, overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: 6,
                    opacity: count > 0 ? 0.85 : 0.3,
                    transition: 'width 0.4s ease',
                    display: 'flex', alignItems: 'center',
                    paddingLeft: count > 0 ? '0.5rem' : 0,
                  }}>
                    {count > 0 && (
                      <span style={{
                        color: '#fff', fontWeight: 800, fontSize: '0.78rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        whiteSpace: 'nowrap',
                      }}>
                        {count} {count === 1 ? 'colaborador' : 'colaboradores'}
                      </span>
                    )}
                  </div>
                </div>
                {count === 0 && (
                  <MdWarning style={{ color: 'var(--cw-warning)', flexShrink: 0 }} title="Sin cobertura" />
                )}
                {demand !== null && count < demand && (
                  <MdWarning style={{ color: 'var(--cw-danger)', flexShrink: 0 }} title={`Déficit: faltan ${demand - count}`} />
                )}
                {demand !== null && count >= demand && (
                  <MdCheckCircle style={{ color: 'var(--cw-success)', flexShrink: 0 }} title="Cobertura completa" />
                )}
              </div>
              {isExpanded && (
                <>
                  <div style={{ gridColumn: '1 / -1', padding: '0 0.75rem 0.75rem 0.75rem', background: 'var(--bg-glass)' }}>
                    {empByHour[hour].length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                        No hay colaboradores trabajando a esta hora.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem 0' }}>
                        {[...new Set(empByHour[hour])].map(empId => {
                          const emp = employeeMap[empId];
                          if (!emp) return null;
                          return (
                            <div key={empId} style={{
                              background: 'var(--bg-primary)',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 6,
                              fontSize: '0.78rem',
                              fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                            }}>
                              {emp.solo_nocturno && <span style={{ fontSize: '0.65rem' }}>🌙</span>}
                              {emp.solo_diurno && <span style={{ fontSize: '0.65rem' }}>☀️</span>}
                              {emp.jornada_preferida === 'MIXTA' && <span style={{ fontSize: '0.65rem' }}>🌓</span>}
                              {emp.nombre}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          );
        })}
      </div>

      {dayDemandSlots && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span><span style={{ color: 'var(--cw-purple)' }}>◆</span> Demanda configurada (requerimiento por hora)</span>
          <span><MdCheckCircle style={{ color: 'var(--cw-success)', verticalAlign: 'middle' }} /> Cobertura completa</span>
          <span><MdWarning style={{ color: 'var(--cw-danger)', verticalAlign: 'middle' }} /> Déficit de personal</span>
          <span><MdWarning style={{ color: 'var(--cw-warning)', verticalAlign: 'middle' }} /> Sin cobertura</span>
        </div>
      )}

      {!dayDemandSlots && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--cw-success)', marginRight: '0.25rem', verticalAlign: 'middle' }} />
          Alta cobertura (≥70%)
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--cw-warning)', marginRight: '0.25rem', verticalAlign: 'middle' }} />
          Cobertura media (40-70%)
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--cw-danger)', marginRight: '0.25rem', verticalAlign: 'middle' }} />
          Baja o sin cobertura (&lt;40%)
        </div>
      )}
    </div>
  );
}
