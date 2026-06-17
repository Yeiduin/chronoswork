import { useState, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { MdChevronLeft, MdChevronRight, MdPeople, MdAccessTime, MdWarning, MdCheckCircle, MdTrendingUp } from 'react-icons/md';

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
    } else if (sDate < dateStr && eDate > dateStr) {
      startHour = 0;
      endHour = 24;
    } else {
      return;
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

export function HourlyCoverageView({ shifts, employees, selectedDate: initialDate, demandSlots, areas = [], selectedAreaId = 'all' }) {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [expandedHour, setExpandedHour] = useState(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

  // 1. Filtrar turnos para que coincidan EXACTAMENTE con los empleados seleccionados (por área)
  const filteredShifts = useMemo(() => {
    const empIds = new Set(employees.map(e => e.id));
    return shifts.filter(s => empIds.has(s.employee_id));
  }, [shifts, employees]);

  // 2. Calcular cobertura
  const { coverage, empByHour } = useMemo(
    () => getCoverageByHour(filteredShifts, dateStr),
    [filteredShifts, dateStr]
  );

  // 3. Calcular demanda para este día
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

  // 4. Calcular KPIs
  let totalManHours = 0;
  let deficitHoursCount = 0;
  let maxStaff = 0;
  let peakHour = 0;
  let maxChartValue = 1;

  HOURS.forEach(hour => {
    const count = coverage[hour];
    const demand = getDemandForHour(hour);
    
    totalManHours += count;
    
    if (demand !== null && count < demand) {
      deficitHoursCount++;
    }
    
    if (count > maxStaff) {
      maxStaff = count;
      peakHour = hour;
    }
    
    const maxVal = Math.max(count, demand || 0);
    if (maxVal > maxChartValue) {
      maxChartValue = maxVal;
    }
  });

  // Para darle un poco de "aire" al tope del gráfico
  maxChartValue = Math.ceil(maxChartValue * 1.15);

  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach(e => { map[e.id] = e; });
    return map;
  }, [employees]);

  const getEmployeeArea = (empId) => {
    if (!areas.length) return null;
    return areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId));
  };

  const selectedArea = areas.find(a => a.id === selectedAreaId);

  const goPrevDay = () => setSelectedDate(d => subDays(d, 1));
  const goNextDay = () => setSelectedDate(d => addDays(d, 1));
  const goToday = () => setSelectedDate(new Date());

  const getBarColor = (count, demand) => {
    if (demand !== null) {
      if (count === 0) return 'var(--cw-danger)';
      if (count < demand) return 'var(--cw-warning)';
      return 'var(--cw-success)';
    } else {
      if (count === 0) return 'var(--border-subtle)';
      return 'var(--cw-accent)';
    }
  };

  return (
    <div className="cw-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER Y NAVEGACIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Dashboard de Cobertura {selectedArea ? `· ${selectedArea.nombre}` : '· Toda la Empresa'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-glass)', borderRadius: 8, padding: '0.2rem', border: '1px solid var(--border-medium)' }}>
            <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={goPrevDay} style={{ border: 'none', background: 'transparent' }}>
              <MdChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0 0.5rem', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>
              {format(selectedDate, 'EEEE, d MMM', { locale: { formatLong: { date: () => '' }, localize: { month: (n) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][n], day: (n) => ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][n] } } })}
            </span>
            <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={goNextDay} style={{ border: 'none', background: 'transparent' }}>
              <MdChevronRight size={20} />
            </button>
          </div>
          <button className="cw-btn cw-btn--secondary" onClick={goToday} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Hoy</button>
        </div>
      </div>

      {/* KPIs SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            <MdAccessTime />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Horas Programadas</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalManHours} <span style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)'}}>h/hombre</span></div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: deficitHoursCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: deficitHoursCount > 0 ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            {deficitHoursCount > 0 ? <MdWarning /> : <MdCheckCircle />}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Horas con Déficit</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: deficitHoursCount > 0 ? '#fca5a5' : 'var(--text-primary)' }}>{deficitHoursCount} <span style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)'}}>horas</span></div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            <MdTrendingUp />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pico de Personal</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{maxStaff} <span style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)'}}>colabs a las {HOUR_LABELS[peakHour]}</span></div>
          </div>
        </div>
      </div>

      {/* GRÁFICO VERTICAL */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        borderRadius: 16, 
        padding: '1.5rem 1rem 1rem 1rem',
        border: '1px solid var(--border-subtle)',
        position: 'relative'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(24, 1fr)', 
          gap: '4px', 
          height: '220px', 
          alignItems: 'flex-end',
          position: 'relative',
          borderBottom: '2px solid var(--border-medium)'
        }}>
          
          {/* Líneas guía de fondo */}
          {[0.25, 0.5, 0.75, 1].map(ratio => {
            const val = Math.round(maxChartValue * ratio);
            if (val === 0) return null;
            return (
              <div key={ratio} style={{ 
                position: 'absolute', 
                bottom: `${(val / maxChartValue) * 100}%`, 
                left: 0, right: 0, 
                borderBottom: '1px dashed var(--border-subtle)', 
                zIndex: 0,
                pointerEvents: 'none'
              }}>
                <span style={{ position: 'absolute', left: '-10px', top: '-8px', fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0 4px', transform: 'translateX(-100%)' }}>
                  {val}
                </span>
              </div>
            );
          })}

          {/* Barras por hora */}
          {HOURS.map(hour => {
            const count = coverage[hour];
            const demand = getDemandForHour(hour);
            const isExpanded = expandedHour === hour;
            
            const heightPct = (count / maxChartValue) * 100;
            const demandHeightPct = demand !== null ? (demand / maxChartValue) * 100 : null;
            const barColor = getBarColor(count, demand);

            return (
              <div key={hour} 
                onClick={() => setExpandedHour(isExpanded ? null : hour)}
                style={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'flex-end', 
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1,
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--bg-glass)' : 'transparent',
                  borderRadius: '6px 6px 0 0',
                  transition: 'background 0.2s',
                }}
                title={`Hora: ${HOUR_LABELS[hour]}\nProgramados: ${count}${demand !== null ? `\nRequeridos: ${demand}` : ''}`}
              >
                {/* Etiqueta flotante de cantidad en la barra */}
                {count > 0 && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: `${heightPct}%`, 
                    marginBottom: '4px',
                    fontSize: '0.7rem', 
                    fontWeight: 800, 
                    color: isExpanded ? 'var(--text-primary)' : 'var(--text-muted)',
                    transition: 'color 0.2s'
                  }}>
                    {count}
                  </div>
                )}

                {/* Marcador de Demanda (línea) */}
                {demand !== null && (
                  <div style={{
                    position: 'absolute',
                    bottom: `${demandHeightPct}%`,
                    left: '10%',
                    right: '10%',
                    height: '3px',
                    background: 'var(--cw-purple)',
                    borderRadius: '2px',
                    zIndex: 3,
                    boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                  }} />
                )}

                {/* Barra Principal */}
                <div style={{ 
                  width: '70%', 
                  height: `${heightPct}%`, 
                  background: barColor, 
                  borderRadius: '4px 4px 0 0',
                  opacity: isExpanded ? 1 : 0.85,
                  transition: 'height 0.4s ease, opacity 0.2s',
                  position: 'relative',
                  zIndex: 2,
                  boxShadow: count > 0 && demand !== null && count < demand ? 'inset 0 0 0 1px rgba(239,68,68,0.5)' : 'none'
                }} />

              </div>
            );
          })}
        </div>
        
        {/* Eje X (Etiquetas de Horas) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '4px', marginTop: '0.5rem' }}>
          {HOURS.map(hour => (
             <div key={hour} style={{ 
               textAlign: 'center', 
               fontSize: '0.65rem', 
               color: expandedHour === hour ? 'var(--cw-accent)' : 'var(--text-muted)',
               fontWeight: expandedHour === hour ? 800 : 600,
               transition: 'color 0.2s'
             }}>
               {String(hour).padStart(2, '0')}
             </div>
          ))}
        </div>
      </div>

      {/* LEYENDA */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>
        {dayDemandSlots ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 14, height: 3, background: 'var(--cw-purple)', borderRadius: 2 }} /> Personal Requerido (Demanda)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 10, height: 10, background: 'var(--cw-success)', borderRadius: 2 }} /> Cobertura Completa</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 10, height: 10, background: 'var(--cw-warning)', borderRadius: 2 }} /> Déficit (Bajo Requerimiento)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 10, height: 10, background: 'var(--cw-danger)', borderRadius: 2 }} /> Sin Cobertura (0)</span>
          </>
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 10, height: 10, background: 'var(--cw-accent)', borderRadius: 2 }} /> Personal Programado</span>
            <span>ℹ️ No hay curva de demanda configurada para este día.</span>
          </>
        )}
      </div>

      {/* DETALLE EXPANDIDO */}
      {expandedHour !== null && (
        <div className="animate-fade-in" style={{ 
          background: 'var(--bg-glass)', 
          border: '1px solid var(--border-medium)', 
          borderRadius: 12, 
          padding: '1.25rem',
          marginTop: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Detalle a las {HOUR_LABELS[expandedHour]}
            </h4>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {empByHour[expandedHour].length} colaboradores trabajando
            </div>
          </div>
          
          {empByHour[expandedHour].length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <MdWarning size={24} style={{ display: 'block', margin: '0 auto 0.5rem auto', color: 'var(--border-subtle)' }} />
              Nadie está programado para trabajar en este horario.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {[...new Set(empByHour[expandedHour])].map(empId => {
                const emp = employeeMap[empId];
                if (!emp) return null;
                const empArea = selectedAreaId === 'all' ? getEmployeeArea(emp.id) : null;
                return (
                  <div key={empId} style={{
                    background: 'var(--bg-primary)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    border: empArea ? `1px solid ${empArea.color}40` : '1px solid var(--border-subtle)'
                  }}>
                    {empArea && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: empArea.color, flexShrink: 0 }} title={empArea.nombre} />
                    )}
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {emp.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {emp.solo_nocturno && <span title="Prefiere Noche" style={{ fontSize: '0.75rem' }}>🌙</span>}
                      {emp.solo_diurno && <span title="Prefiere Día" style={{ fontSize: '0.75rem' }}>☀️</span>}
                      {emp.jornada_preferida === 'MIXTA' && <span title="Turno Mixto" style={{ fontSize: '0.75rem' }}>🌓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
