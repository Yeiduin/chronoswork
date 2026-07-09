import { useState, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { toISODay } from '../core/dateUtils';
import {
  MdChevronLeft, MdChevronRight, MdPeople, MdAccessTime, MdWarning,
  MdCheckCircle, MdTrendingUp, MdViewWeek, MdToday, MdBarChart,
} from 'react-icons/md';

// ============================================================
// ChronosWork — Vista de Análisis de Cobertura
// ------------------------------------------------------------
// Dos modos:
//  • SEMANA: mapa de calor (días × horas) + comparativa por área.
//  • DÍA:    curva horaria detallada de un día + detalle por hora.
// Responde: ¿cuántos asesores hay por área, por semana y por hora?
// ============================================================

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = HOURS.map(h => `${String(h).padStart(2, '0')}:00`);
const DOW_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtDay = (d) => `${DOW_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()}`;
const fmtRange = (a, b) => `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
const isoDay = (d) => format(d, 'yyyy-MM-dd');

// Lunes de la semana que contiene `date`.
function mondayOf(date) {
  const d = new Date(date);
  const dow = toISODay(d);
  return subDays(d, dow - 1);
}

// Horas que un turno cubre dentro de un día concreto (para el conteo por hora).
// IMPORTANTE: la hora se lee del STRING (hora "de reloj" tal cual se guardó),
// igual que la rejilla de programación (start_time.slice(11,16)). Usar
// new Date().getHours() aplicaría conversión de zona horaria y desplazaría las
// horas (p.ej. un turno 13:00 guardado en UTC aparecería a las 08:00).
function getCoverageByHour(shifts, dateStr) {
  const coverage = new Array(24).fill(0);
  const empByHour = Array.from({ length: 24 }, () => []);

  shifts.forEach(s => {
    if (!s.start_time || !s.end_time) return;
    const st = String(s.start_time);
    const et = String(s.end_time);
    const sDate = st.slice(0, 10);
    const eDate = et.slice(0, 10);
    const sH = parseInt(st.slice(11, 13), 10) || 0;
    const eH = parseInt(et.slice(11, 13), 10) || 0;
    const eM = parseInt(et.slice(14, 16), 10) || 0;

    let startHour, endHour;
    if (sDate === dateStr && eDate === dateStr) {
      startHour = sH;
      endHour = eH + (eM > 0 ? 1 : 0);
    } else if (sDate === dateStr) {
      startHour = sH;
      endHour = 24;
    } else if (eDate === dateStr) {
      startHour = 0;
      endHour = eH + (eM > 0 ? 1 : 0);
    } else if (sDate < dateStr && eDate > dateStr) {
      startHour = 0;
      endHour = 24;
    } else {
      return;
    }

    for (let h = startHour; h < endHour; h++) {
      if (h >= 0 && h < 24) { coverage[h]++; empByHour[h].push(s.employee_id); }
    }
  });

  return { coverage, empByHour };
}

// Demanda total requerida para un (díaSemana, hora) sumando todos los slots
// del scope (un área = sus slots; "todas" = suma de todas las áreas).
function makeDemandLookup(demandSlots) {
  const byDow = {};
  (demandSlots || []).forEach(s => {
    (byDow[s.day_of_week] ||= []).push(s);
  });
  return (dow, hour) => {
    const rows = byDow[dow];
    if (!rows || !rows.length) return null;
    let total = 0; let has = false;
    rows.forEach(r => {
      if (hour >= r.start_hour && hour < r.end_hour) { total += (r.required_staff || 0); has = true; }
    });
    return has ? total : 0;
  };
}

// Color de celda según cobertura vs demanda (o intensidad si no hay demanda).
function cellStyle(count, demand, maxCount) {
  if (demand != null && demand > 0) {
    if (count === 0) return { bg: 'rgba(239,68,68,0.92)', fg: '#fff' };
    if (count < demand) return { bg: 'rgba(245,158,11,0.90)', fg: '#1a1206' };
    return { bg: 'rgba(16,185,129,0.88)', fg: '#04241a' };
  }
  if (count === 0) return { bg: 'rgba(255,255,255,0.035)', fg: 'var(--text-muted)' };
  const t = Math.min(1, count / (maxCount || 1));
  return { bg: `rgba(59,130,246,${(0.18 + t * 0.72).toFixed(2)})`, fg: t > 0.45 ? '#fff' : 'var(--text-secondary)' };
}

export function HourlyCoverageView({ shifts, employees, demandSlots, areas = [], selectedAreaId = 'all' }) {
  // Arrancar en la fecha del primer turno cargado (si hay), si no hoy.
  const [selectedDate, setSelectedDate] = useState(() => {
    const first = (shifts || []).find(s => s.start_time);
    return first ? new Date(first.start_time) : new Date();
  });
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'day'
  const [expandedHour, setExpandedHour] = useState(null);

  const selectedArea = areas.find(a => a.id === selectedAreaId) || null;
  const employeeMap = useMemo(() => {
    const m = {}; employees.forEach(e => { m[e.id] = e; }); return m;
  }, [employees]);

  // Turnos del scope (área seleccionada → sus empleados).
  const scopedShifts = useMemo(() => {
    const ids = new Set(employees.map(e => e.id));
    return shifts.filter(s => ids.has(s.employee_id));
  }, [shifts, employees]);

  const demandAt = useMemo(() => makeDemandLookup(demandSlots), [demandSlots]);

  // ── Días de la semana actual (lun→dom) ───────────────────────────────
  const weekStart = useMemo(() => mondayOf(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = weekDays[6];

  // ── Matriz de cobertura de la semana [día][hora] ─────────────────────
  const weekMatrix = useMemo(() => weekDays.map(d => {
    const { coverage, empByHour } = getCoverageByHour(scopedShifts, isoDay(d));
    return { date: d, coverage, empByHour };
  }), [weekDays, scopedShifts]);

  const maxCellCount = useMemo(() => {
    let m = 1;
    weekMatrix.forEach(row => row.coverage.forEach(c => { if (c > m) m = c; }));
    return m;
  }, [weekMatrix]);

  // ── KPIs de la semana ────────────────────────────────────────────────
  const weekKpis = useMemo(() => {
    const empSet = new Set();
    let manHours = 0, deficitCells = 0, peak = 0, peakLabel = '';
    let requiredTotal = 0, coveredTotal = 0, hasDemand = false;

    weekMatrix.forEach((row) => {
      const dow = toISODay(row.date);
      row.coverage.forEach((count, h) => {
        manHours += count;
        if (count > peak) { peak = count; peakLabel = `${fmtDay(row.date)} ${HOUR_LABELS[h]}`; }
        const dem = demandAt(dow, h);
        if (dem != null) {
          hasDemand = true;
          requiredTotal += dem;
          coveredTotal += Math.min(count, dem);
          if (count < dem) deficitCells++;
        }
        row.empByHour[h].forEach(id => empSet.add(id));
      });
    });

    const coveragePct = hasDemand && requiredTotal > 0
      ? Math.round((coveredTotal / requiredTotal) * 100) : null;
    return { asesores: empSet.size, manHours, deficitCells, peak, peakLabel, coveragePct, hasDemand };
  }, [weekMatrix, demandAt]);

  // ── Comparativa por ÁREA (modo "todas") o por DÍA (área concreta) ─────
  const areaBreakdown = useMemo(() => {
    if (selectedAreaId !== 'all') return null;
    // Filtro por semana basado en STRINGS de fecha (sin conversión de zona
    // horaria), coherente con cómo se asignan los turnos a cada día.
    const wS = isoDay(weekStart);
    const wE = isoDay(weekEnd);
    const inWeek = (s) => {
      const sd = String(s.start_time).slice(0, 10);
      const ed = String(s.end_time).slice(0, 10);
      return sd <= wE && ed >= wS;
    };
    const rows = areas.map(area => {
      const ids = new Set((area.area_employees || []).map(ae => ae.employee_id));
      const aShifts = shifts.filter(s => ids.has(s.employee_id) && inWeek(s));
      const empSet = new Set(aShifts.map(s => s.employee_id));
      const aDemand = makeDemandLookup(area.area_demand_slots || []);
      let manHours = 0, required = 0, covered = 0, deficit = 0, hasDem = false;
      weekDays.forEach(d => {
        const { coverage } = getCoverageByHour(aShifts, isoDay(d));
        const dow = toISODay(d);
        coverage.forEach((count, h) => {
          manHours += count;
          const dem = aDemand(dow, h);
          if (dem != null) { hasDem = true; required += dem; covered += Math.min(count, dem); if (count < dem) deficit++; }
        });
      });
      return {
        id: area.id, nombre: area.nombre, color: area.color || '#3b82f6',
        asesores: empSet.size, manHours, deficit,
        coveragePct: hasDem && required > 0 ? Math.round((covered / required) * 100) : null,
      };
    }).filter(r => r.asesores > 0 || r.manHours > 0);
    rows.sort((a, b) => b.asesores - a.asesores || b.manHours - a.manHours);
    return rows;
  }, [selectedAreaId, areas, shifts, weekStart, weekEnd, weekDays]);

  const perDayBreakdown = useMemo(() => {
    if (selectedAreaId === 'all') return null;
    return weekMatrix.map(row => {
      const dow = toISODay(row.date);
      const empSet = new Set();
      let manHours = 0, required = 0, covered = 0, hasDem = false;
      row.coverage.forEach((count, h) => {
        manHours += count;
        row.empByHour[h].forEach(id => empSet.add(id));
        const dem = demandAt(dow, h);
        if (dem != null) { hasDem = true; required += dem; covered += Math.min(count, dem); }
      });
      return {
        date: row.date, asesores: empSet.size, manHours,
        coveragePct: hasDem && required > 0 ? Math.round((covered / required) * 100) : null,
      };
    });
  }, [selectedAreaId, weekMatrix, demandAt]);

  const maxAreaAsesores = Math.max(1, ...(areaBreakdown || []).map(r => r.asesores));

  // ── Datos del modo DÍA ───────────────────────────────────────────────
  const dayStr = isoDay(selectedDate);
  const dayOfWeek = toISODay(selectedDate);
  const dayCov = useMemo(() => getCoverageByHour(scopedShifts, dayStr), [scopedShifts, dayStr]);
  const dayMaxChart = useMemo(() => {
    let m = 1;
    HOURS.forEach(h => {
      const dem = demandAt(dayOfWeek, h) || 0;
      m = Math.max(m, dayCov.coverage[h], dem);
    });
    return Math.ceil(m * 1.15);
  }, [dayCov, demandAt, dayOfWeek]);

  // ── Navegación ───────────────────────────────────────────────────────
  const step = viewMode === 'week' ? 7 : 1;
  const goPrev = () => setSelectedDate(d => subDays(d, step));
  const goNext = () => setSelectedDate(d => addDays(d, step));
  const goToday = () => setSelectedDate(new Date());

  const openDayHour = (date, hour) => {
    setSelectedDate(date);
    setExpandedHour(hour);
    setViewMode('day');
  };

  // ── Helpers de presentación ──────────────────────────────────────────
  const pctColor = (pct) => pct == null ? 'var(--text-muted)'
    : pct >= 100 ? 'var(--cw-success)' : pct >= 80 ? 'var(--cw-warning)' : 'var(--cw-danger)';

  const segBtn = (active) => ({
    border: 'none', cursor: 'pointer', padding: '0.4rem 0.85rem', borderRadius: 7,
    fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem',
    background: active ? 'var(--cw-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s',
  });

  return (
    <div className="cw-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Análisis de Cobertura
          </h3>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {selectedArea ? selectedArea.nombre : 'Todas las áreas'} · asesores por día y por hora
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Toggle Semana/Día */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-glass)', borderRadius: 9, padding: 3, border: '1px solid var(--border-medium)' }}>
            <button style={segBtn(viewMode === 'week')} onClick={() => setViewMode('week')}><MdViewWeek size={16} /> Semana</button>
            <button style={segBtn(viewMode === 'day')} onClick={() => setViewMode('day')}><MdBarChart size={16} /> Día</button>
          </div>

          {/* Navegador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-glass)', borderRadius: 9, padding: 3, border: '1px solid var(--border-medium)' }}>
            <button className="cw-btn cw-btn--icon" onClick={goPrev} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}><MdChevronLeft size={20} /></button>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', padding: '0 0.4rem', minWidth: 150, textAlign: 'center', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {viewMode === 'week' ? fmtRange(weekStart, weekEnd) : `${DOW_SHORT[(selectedDate.getDay() + 6) % 7]} ${selectedDate.getDate()} ${MESES[selectedDate.getMonth()]}`}
            </span>
            <button className="cw-btn cw-btn--icon" onClick={goNext} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}><MdChevronRight size={20} /></button>
          </div>
          <button className="cw-btn cw-btn--secondary" onClick={goToday} style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MdToday size={15} /> Hoy</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
        <KpiCard icon={<MdPeople />} tint="#3b82f6" label="Asesores únicos (semana)" value={weekKpis.asesores} unit="personas" />
        <KpiCard icon={<MdAccessTime />} tint="#a855f7" label="Horas-hombre (semana)" value={weekKpis.manHours} unit="h/persona" />
        <KpiCard
          icon={weekKpis.coveragePct == null ? <MdTrendingUp /> : weekKpis.coveragePct >= 100 ? <MdCheckCircle /> : <MdWarning />}
          tint={weekKpis.coveragePct == null ? '#64748b' : pctColor(weekKpis.coveragePct)}
          label="Cobertura vs demanda"
          value={weekKpis.coveragePct == null ? '—' : `${weekKpis.coveragePct}%`}
          unit={weekKpis.coveragePct == null ? 'sin curva de demanda' : `${weekKpis.deficitCells} h con déficit`}
          valueColor={weekKpis.coveragePct == null ? undefined : pctColor(weekKpis.coveragePct)}
        />
        <KpiCard icon={<MdTrendingUp />} tint="#10b981" label="Pico de personal" value={weekKpis.peak} unit={weekKpis.peakLabel || '—'} />
      </div>

      {viewMode === 'week' ? (
        <>
          {/* ── MAPA DE CALOR (días × horas) ── */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '1rem 1rem 0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Asesores programados por hora</span>
              <Legend hasDemand={weekKpis.hasDemand} />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                {/* Cabecera de horas */}
                <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(24, 1fr)`, gap: 3, marginBottom: 3 }}>
                  <div />
                  {HOURS.map(h => (
                    <div key={h} style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {h % 2 === 0 ? String(h).padStart(2, '0') : ''}
                    </div>
                  ))}
                </div>

                {/* Filas por día */}
                {weekMatrix.map((row) => {
                  const dow = toISODay(row.date);
                  const isToday = isoDay(row.date) === isoDay(new Date());
                  return (
                    <div key={isoDay(row.date)} style={{ display: 'grid', gridTemplateColumns: `64px repeat(24, 1fr)`, gap: 3, marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: isToday ? 'var(--cw-accent)' : 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {fmtDay(row.date)}
                      </div>
                      {HOURS.map(h => {
                        const count = row.coverage[h];
                        const dem = demandAt(dow, h);
                        const st = cellStyle(count, dem, maxCellCount);
                        return (
                          <div
                            key={h}
                            onClick={() => openDayHour(row.date, h)}
                            title={`${fmtDay(row.date)} ${HOUR_LABELS[h]}\nProgramados: ${count}${dem != null ? `\nRequeridos: ${dem}` : ''}`}
                            style={{
                              height: 30, borderRadius: 5, background: st.bg, color: st.fg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                              transition: 'transform 0.1s', userSelect: 'none',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.outline = '1px solid var(--cw-accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.outline = 'none'; }}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
              💡 Haz clic en cualquier celda para ver el detalle de ese día y hora.
            </div>
          </div>

          {/* ── PANEL POR ÁREA / POR DÍA ── */}
          {selectedAreaId === 'all' ? (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>Comparativa por área (esta semana)</div>
              {(!areaBreakdown || areaBreakdown.length === 0) ? (
                <EmptyMini text="No hay asesores programados esta semana." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {areaBreakdown.map(a => (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</span>
                      </div>
                      <div style={{ position: 'relative', height: 22, background: 'var(--bg-glass)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${(a.asesores / maxAreaAsesores) * 100}%`, background: `linear-gradient(90deg, ${a.color}cc, ${a.color}88)`, borderRadius: 6, transition: 'width 0.4s' }} />
                        <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#fff' }}>
                          {a.asesores} asesores
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.72rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{a.manHours} h</span>
                        <span style={{ fontWeight: 800, color: pctColor(a.coveragePct), minWidth: 42, textAlign: 'right' }}>
                          {a.coveragePct == null ? '—' : `${a.coveragePct}%`}
                        </span>
                        {a.deficit > 0 && (
                          <span title="Horas con déficit" style={{ color: 'var(--cw-danger)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <MdWarning size={13} />{a.deficit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>Resumen por día — {selectedArea?.nombre}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.6rem' }}>
                {perDayBreakdown.map(d => {
                  const isToday = isoDay(d.date) === isoDay(new Date());
                  return (
                    <div key={isoDay(d.date)} onClick={() => { setSelectedDate(d.date); setViewMode('day'); }}
                      style={{ background: 'var(--bg-glass)', borderRadius: 10, padding: '0.6rem 0.4rem', textAlign: 'center', cursor: 'pointer', border: isToday ? '1px solid var(--cw-accent)' : '1px solid transparent' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 }}>{fmtDay(d.date)}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{d.asesores}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>asesores</div>
                      <div style={{ marginTop: 5, fontSize: '0.66rem', fontWeight: 700, color: pctColor(d.coveragePct) }}>
                        {d.coveragePct == null ? `${d.manHours} h` : `${d.coveragePct}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── MODO DÍA: curva horaria ── */
        <DayChart
          coverage={dayCov.coverage}
          empByHour={dayCov.empByHour}
          demandAt={(h) => demandAt(dayOfWeek, h)}
          maxChartValue={dayMaxChart}
          expandedHour={expandedHour}
          setExpandedHour={setExpandedHour}
          employeeMap={employeeMap}
          areas={areas}
          selectedAreaId={selectedAreaId}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────

function KpiCard({ icon, tint, label, value, unit, valueColor }) {
  return (
    <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: valueColor || 'var(--text-primary)', lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit}</div>
      </div>
    </div>
  );
}

function Legend({ hasDemand }) {
  const item = (color, label) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> {label}
    </span>
  );
  return (
    <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
      {hasDemand ? (
        <>
          {item('rgba(16,185,129,0.88)', 'Cubierto')}
          {item('rgba(245,158,11,0.90)', 'Déficit')}
          {item('rgba(239,68,68,0.92)', 'Sin cobertura')}
        </>
      ) : (
        <>
          {item('rgba(59,130,246,0.85)', 'Más personal')}
          {item('rgba(255,255,255,0.06)', 'Menos / nadie')}
        </>
      )}
    </div>
  );
}

function EmptyMini({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
      <MdWarning size={22} style={{ display: 'block', margin: '0 auto 0.4rem', color: 'var(--border-subtle)' }} />
      {text}
    </div>
  );
}

function DayChart({ coverage, empByHour, demandAt, maxChartValue, expandedHour, setExpandedHour, employeeMap, areas, selectedAreaId }) {
  const getEmployeeArea = (empId) => areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId));
  const barColor = (count, demand) => {
    if (demand != null) {
      if (count === 0) return 'var(--cw-danger)';
      if (count < demand) return 'var(--cw-warning)';
      return 'var(--cw-success)';
    }
    return count === 0 ? 'var(--border-subtle)' : 'var(--cw-accent)';
  };

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '1.5rem 1rem 1rem', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 4, height: 220, alignItems: 'flex-end', position: 'relative', borderBottom: '2px solid var(--border-medium)' }}>
          {[0.25, 0.5, 0.75, 1].map(ratio => {
            const val = Math.round(maxChartValue * ratio);
            if (val === 0) return null;
            return (
              <div key={ratio} style={{ position: 'absolute', bottom: `${(val / maxChartValue) * 100}%`, left: 0, right: 0, borderBottom: '1px dashed var(--border-subtle)', zIndex: 0, pointerEvents: 'none' }}>
                <span style={{ position: 'absolute', left: -10, top: -8, fontSize: '0.62rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0 4px', transform: 'translateX(-100%)' }}>{val}</span>
              </div>
            );
          })}
          {HOURS.map(hour => {
            const count = coverage[hour];
            const demand = demandAt(hour);
            const isExp = expandedHour === hour;
            const heightPct = (count / maxChartValue) * 100;
            const demandPct = demand != null ? (demand / maxChartValue) * 100 : null;
            return (
              <div key={hour} onClick={() => setExpandedHour(isExp ? null : hour)}
                title={`${HOUR_LABELS[hour]}\nProgramados: ${count}${demand != null ? `\nRequeridos: ${demand}` : ''}`}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', zIndex: 1, cursor: 'pointer', background: isExp ? 'var(--bg-glass)' : 'transparent', borderRadius: '6px 6px 0 0' }}>
                {count > 0 && (
                  <div style={{ position: 'absolute', bottom: `${heightPct}%`, marginBottom: 4, fontSize: '0.68rem', fontWeight: 800, color: isExp ? 'var(--text-primary)' : 'var(--text-muted)' }}>{count}</div>
                )}
                {demand != null && (
                  <div style={{ position: 'absolute', bottom: `${demandPct}%`, left: '10%', right: '10%', height: 3, background: 'var(--cw-purple)', borderRadius: 2, zIndex: 3, boxShadow: '0 0 4px rgba(0,0,0,0.5)' }} />
                )}
                <div style={{ width: '70%', height: `${heightPct}%`, background: barColor(count, demand), borderRadius: '4px 4px 0 0', opacity: isExp ? 1 : 0.85, transition: 'height 0.4s ease, opacity 0.2s', zIndex: 2 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 4, marginTop: '0.5rem' }}>
          {HOURS.map(hour => (
            <div key={hour} style={{ textAlign: 'center', fontSize: '0.62rem', color: expandedHour === hour ? 'var(--cw-accent)' : 'var(--text-muted)', fontWeight: expandedHour === hour ? 800 : 600 }}>
              {String(hour).padStart(2, '0')}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.85rem' }}><Legend hasDemand={demandAt(12) != null || HOURS.some(h => demandAt(h) != null)} /></div>
      </div>

      {expandedHour !== null && (
        <div className="animate-fade-in" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Detalle a las {HOUR_LABELS[expandedHour]}</h4>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{new Set(empByHour[expandedHour]).size} colaboradores</div>
          </div>
          {empByHour[expandedHour].length === 0 ? (
            <EmptyMini text="Nadie está programado en este horario." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.7rem' }}>
              {[...new Set(empByHour[expandedHour])].map(empId => {
                const emp = employeeMap[empId];
                if (!emp) return null;
                const empArea = selectedAreaId === 'all' ? getEmployeeArea(emp.id) : null;
                return (
                  <div key={empId} style={{ background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', border: empArea ? `1px solid ${empArea.color}40` : '1px solid var(--border-subtle)' }}>
                    {empArea && <div style={{ width: 10, height: 10, borderRadius: '50%', background: empArea.color, flexShrink: 0 }} title={empArea.nombre} />}
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{emp.nombre}</div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {emp.solo_nocturno && <span title="Prefiere noche" style={{ fontSize: '0.75rem' }}>🌙</span>}
                      {emp.solo_diurno && <span title="Prefiere día" style={{ fontSize: '0.75rem' }}>☀️</span>}
                      {emp.jornada_preferida === 'MIXTA' && <span title="Turno mixto" style={{ fontSize: '0.75rem' }}>🌓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
