import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import {
  MdPerson, MdCalendarMonth, MdEventBusy, MdCalculate,
  MdLogout, MdSchedule, MdAccessTime,
} from 'react-icons/md';

// ── Helpers de fecha/hora en zona Colombia (UTC-5) ────────────────────────────
// CRÍTICO: TODAS las operaciones de fecha usan 'America/Bogota' explícitamente.
// Los TIMESTAMPTZ de Supabase vienen en ISO 8601 UTC. Si usamos .slice(0,10)
// directamente, los turnos nocturnos que cruzan medianoche UTC aparecen
// en el día equivocado para Colombia.

const TZ = 'America/Bogota';

function colDateStr(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
}

function colMonthStr(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
}

function colTodayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function colCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
}

function colNow() {
  // Devuelve un Date que representa "ahora" en Colombia (sin pies ni cabeza de UTC)
  const s = new Date().toLocaleString('en-US', { timeZone: TZ });
  return new Date(s);
}

function colDateFromParts(year, month, day) {
  // month 1-12, day 1-31 → Date en mediodía Colombia
  const s = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`;
  return new Date(new Date(s).toLocaleString('en-US', { timeZone: TZ }));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ,
  });
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
  });
}

function formatTime(dtStr) {
  if (!dtStr) return '—';
  return new Date(dtStr).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ,
  });
}

function formatCurrency(val) {
  if (val == null) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(val);
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const SHIFT_LABELS = {
  morning:   { label: 'Mañana', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  afternoon: { label: 'Tarde',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  night:     { label: 'Noche',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  custom:    { label: 'Turno',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

const ABSENCE_LABELS = {
  vacaciones:  { label: 'Vacaciones',  color: '#22c55e', icon: '🏖️' },
  incapacidad: { label: 'Incapacidad', color: '#f59e0b', icon: '🏥' },
  licencia:    { label: 'Licencia',    color: '#3b82f6', icon: '📋' },
  suspension:  { label: 'Suspensión',  color: '#ef4444', icon: '⚠️' },
};

// ── Tarjeta de Turno ─────────────────────────────────────────────────────────
function ShiftCard({ shift }) {
  const nowCol   = colNow();
  const startD   = new Date(shift.start_time);
  const endD     = new Date(shift.end_time);
  const isActive = nowCol >= startD && nowCol <= endD;
  const isPast   = endD < nowCol;
  const isToday  = colDateStr(shift.start_time) === colTodayStr();

  const rawHours = (shift.end_time && shift.start_time)
    ? (endD - startD) / 3600000 : 0;
  const netHours = Math.max(0, rawHours - ((shift.break_minutes || 0) / 60));

  // Descansos detallados
  let breaks = [];
  try {
    if (shift.descansos) {
      breaks = typeof shift.descansos === 'string' ? JSON.parse(shift.descansos) : shift.descansos;
    }
  } catch { /* ok */ }

  const cfg = SHIFT_LABELS[shift.shift_type] || SHIFT_LABELS.custom;

  return (
    <div className="shift-card" style={{
      padding: '0.9rem 1.25rem',
      borderRadius: 12,
      border: `1px solid ${isActive ? 'rgba(34,197,94,0.4)' : 'var(--border-subtle)'}`,
      background: isActive
        ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))'
        : isToday
          ? 'linear-gradient(135deg, rgba(99,102,241,0.08), var(--surface-1))'
          : 'var(--surface-1)',
      position: 'relative', overflow: 'hidden',
      opacity: isPast ? 0.65 : 1,
    }}>
      {isActive && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: '0.68rem', fontWeight: 700, color: '#22c55e',
          background: 'rgba(34,197,94,0.15)', padding: '0.15rem 0.5rem',
          borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          EN CURSO
        </div>
      )}
      {isToday && !isActive && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: '0.68rem', fontWeight: 700, color: '#6366f1',
          background: 'rgba(99,102,241,0.12)', padding: '0.15rem 0.5rem', borderRadius: 999,
        }}>
          HOY
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: isActive ? 'rgba(34,197,94,0.15)' : 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActive ? '#22c55e' : 'var(--text-muted)', fontSize: '1.3rem',
        }}>
          <MdSchedule />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            {startD.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
            <MdAccessTime style={{ verticalAlign: 'middle' }} />
            {formatTime(shift.start_time)} → {formatTime(shift.end_time)}
            <span style={{
              fontSize: '0.65rem', color: cfg.color, background: cfg.bg,
              padding: '0.08rem 0.4rem', borderRadius: 4, fontWeight: 600,
            }}>
              {cfg.label}
            </span>
          </div>

          {/* Descansos del turno */}
          {breaks.length > 0 && (
            <div style={{
              marginTop: '0.45rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem',
            }}>
              {breaks.map((b, i) => (
                <span key={i} style={{
                  fontSize: '0.7rem', color: 'var(--text-muted)',
                  background: 'var(--bg-glass)', padding: '0.15rem 0.45rem', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                }}>
                  {b.tipo === 'ALMUERZO' ? '🍽️' : '☕'} {b.tipo === 'ALMUERZO' ? 'Almuerzo' : 'Break'}
                  {b.inicio ? ` ${b.inicio}` : ''} · {b.minutos}min
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ⏱ {netHours.toFixed(1)}h netas
            </span>
            {shift.recargo_porcentaje > 0 && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 600, color: '#f59e0b',
              }}>
                +{shift.recargo_porcentaje}% recargo
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini-calendario de turnos y descansos del mes ─────────────────────────────
function MonthlyShiftGrid({ shifts, absences, month, year }) {
  const todayStr = colTodayStr();
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

  // Mapa fecha Colombia → turnos del día
  const shiftsByColDate = useMemo(() => {
    const m = {};
    for (const s of shifts) {
      const d = colDateStr(s.start_time);
      if (d) { if (!m[d]) m[d] = []; m[d].push(s); }
    }
    return m;
  }, [shifts]);

  // Mapa fecha → ausencia
  const absByDate = useMemo(() => {
    const m = {};
    for (const a of absences) {
      const ini = new Date(a.fecha_inicio);
      const fin = new Date(a.fecha_fin);
      for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        m[d.toISOString().slice(0, 10)] = a;
      }
    }
    return m;
  }, [absences]);

  // Construir celdas
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Contar días trabajados y descansos
  let worked = 0, rest = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (shiftsByColDate[ds] || absByDate[ds]) worked++;
    else if (ds <= todayStr) rest++;
  }

  return (
    <div className="cw-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {MESES[month - 1]} {year}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {worked} {worked === 1 ? 'día trabajado' : 'días trabajados'}
          {rest > 0 && ` · ${rest} ${rest === 1 ? 'descanso' : 'descansos'}`}
        </span>
      </div>

      {/* Nombres de días */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2,
      }}>
        {DIAS_SEMANA_CORTO.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.62rem', fontWeight: 600,
            color: 'var(--text-muted)', padding: '0.25rem 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;

          const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayShifts = shiftsByColDate[ds];
          const absence = absByDate[ds];
          const isToday = ds === todayStr;
          const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0;

          let bg = 'var(--bg-glass)';
          let border = '1px solid transparent';
          let label = null;
          let labelColor = null;

          if (absence) {
            const ac = ABSENCE_LABELS[absence.tipo] || ABSENCE_LABELS.licencia;
            bg = ac.color + '18';
            border = `1px solid ${ac.color}44`;
            label = ac.icon;
            labelColor = ac.color;
          } else if (dayShifts && dayShifts.length > 0) {
            const sc = SHIFT_LABELS[dayShifts[0].shift_type] || SHIFT_LABELS.custom;
            bg = sc.bg;
            border = `1px solid ${sc.color}44`;
            labelColor = sc.color;
            if (dayShifts.length === 2) label = '×2';
          } else {
            bg = 'rgba(100,116,139,0.04)';
            border = '1px dashed rgba(100,116,139,0.12)';
          }

          return (
            <div
              key={ds}
              title={dayShifts ? dayShifts.map(s => `${formatTime(s.start_time)} → ${formatTime(s.end_time)}`).join(' | ') : (absence ? ABSENCE_LABELS[absence.tipo]?.label : 'Descanso')}
              className={`calendar-cell ${!dayShifts && !absence ? 'rest-day' : ''}`}
              style={{
                aspectRatio: '1', borderRadius: 5,
                background: bg, border: isToday ? '2px solid var(--primary)' : border,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--text-primary)' : labelColor || 'var(--text-muted)',
              }}
            >
              <span>{day}</span>
              {label && <span style={{ fontSize: '0.45rem', marginTop: 1 }}>{label}</span>}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
        {Object.entries(SHIFT_LABELS).slice(0, 3).map(([k, v]) => (
          <span key={k} style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: v.color, display: 'inline-block' }} />
            {v.label}
          </span>
        ))}
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, border: '1px dashed rgba(100,116,139,0.3)', display: 'inline-block' }} />
          Descanso
        </span>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EmployeeProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState('turnos');
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear]   = useState(new Date().getFullYear());

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_my_employee_profile');
      if (rpcError) throw rpcError;
      setProfile(data);
    } catch (err) {
      setError('No se pudo cargar tu perfil. Contacta a tu administrador.');
      console.error('[EmployeeProfile]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const employee = profile?.employee;
  const shifts   = profile?.shifts || [];
  const absences = profile?.absences || [];
  const resumenMes = profile?.resumen_mes || {};
  const resumenMesSig = profile?.resumen_mes_siguiente || {};

  // ── Datos calculados (TODOS con zona Colombia) ────────────────────────────
  const currentMonth = colCurrentMonth();
  const nowCol = colNow();

  // Turnos del mes actual (filtrados por fecha Colombia)
  const shiftsThisMonth = useMemo(() => shifts.filter(s => colMonthStr(s.start_time) === currentMonth), [shifts, currentMonth]);

  // Turnos del mes visible en calendario
  const calPeriodo = `${calYear}-${String(calMonth).padStart(2, '0')}`;
  const shiftsInCalMonth = useMemo(() => shifts.filter(s => colMonthStr(s.start_time) === calPeriodo), [shifts, calPeriodo]);

  // Próximos y pasados (todos)
  const upcomingShifts = useMemo(() =>
    shifts.filter(s => new Date(s.end_time) >= nowCol).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
  [shifts, nowCol]);

  const pastShifts = useMemo(() =>
    shifts.filter(s => new Date(s.end_time) < nowCol).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
  [shifts, nowCol]);

  // Pre-nómina
  const totalHorasNetas = shiftsThisMonth.reduce((acc, s) => {
    const h = ((new Date(s.end_time) - new Date(s.start_time)) / 3600000) - ((s.break_minutes || 0) / 60);
    return acc + Math.max(0, h);
  }, 0);
  const valorHora = employee?.valor_hora || 0;
  const totalEstimado = totalHorasNetas * valorHora;

  // Desglose semanal
  const weeklyBreakdown = useMemo(() => {
    const weeks = {};
    for (const s of shiftsThisMonth) {
      const dateStr = colDateStr(s.start_time);
      if (!dateStr) continue;
      const day = parseInt(dateStr.slice(8, 10), 10);
      const wk = Math.ceil(day / 7);
      const key = `Semana ${wk}`;
      if (!weeks[key]) weeks[key] = { horas: 0, turnos: 0, dias: new Set() };
      const h = Math.max(0, ((new Date(s.end_time) - new Date(s.start_time)) / 3600000) - ((s.break_minutes || 0) / 60));
      weeks[key].horas += h;
      weeks[key].turnos += 1;
      weeks[key].dias.add(dateStr);
    }
    return Object.entries(weeks).map(([k, v]) => ({ label: k, horas: v.horas, turnos: v.turnos, dias: v.dias.size }));
  }, [shiftsThisMonth]);

  // ── Navegación calendario ─────────────────────────────────────────────────
  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div className="cw-spinner"></div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando tu información...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cw-card" style={{ maxWidth: 400, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>😕</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="cw-btn cw-btn--primary" onClick={loadProfile}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%)',
        padding: '1.5rem 1.5rem 4rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: '30%', width: 150, height: 150,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '1.2rem' }}>⏱️</div>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              ChronosWork
            </span>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', cursor: 'pointer', padding: '0.4rem 0.9rem',
              borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              backdropFilter: 'blur(8px)',
            }}
          >
            <MdLogout /> Salir
          </button>
        </div>

        <div style={{ marginTop: '1.25rem', position: 'relative' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', marginBottom: '0.75rem',
            border: '2px solid rgba(255,255,255,0.3)',
          }}>
            <MdPerson style={{ color: 'white' }} />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white', marginBottom: '0.2rem' }}>
            {employee?.nombre || user?.email}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.1rem' }}>
            {employee?.cargo || 'Colaborador'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            C.C. {employee?.cedula}
          </div>
        </div>
      </div>

      {/* ── Cards de resumen ──────────────────────────────────────────────── */}
      <div style={{
        padding: '0 1.25rem', marginTop: -32, marginBottom: '1.5rem',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
        position: 'relative', zIndex: 2,
        maxWidth: 900, marginLeft: 'auto', marginRight: 'auto',
      }}>
        {[
          {
            label: 'Turnos este mes', value: shiftsThisMonth.length,
            sub: `${totalHorasNetas.toFixed(0)}h netas`, icon: <MdCalendarMonth />, color: '#3b82f6',
          },
          {
            label: 'Horas netas', value: totalHorasNetas.toFixed(1) + 'h',
            sub: `${shiftsThisMonth.length} turnos`, icon: <MdAccessTime />, color: '#6366f1',
          },
          {
            label: 'Estimado nómina', value: formatCurrency(totalEstimado),
            sub: valorHora > 0 ? `${formatCurrency(valorHora)}/h` : null,
            icon: <MdCalculate />, color: '#22c55e',
          },
        ].map(card => (
          <div key={card.label} className="cw-card stat-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${card.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', color: card.color, margin: '0 auto 0.5rem',
            }}>
              {card.icon}
            </div>
            <div style={{
              fontSize: card.value.length > 8 ? '0.9rem' : '1.2rem',
              fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1,
              marginBottom: '0.2rem', wordBreak: 'break-word',
            }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {card.label}
            </div>
            {card.sub && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.7, marginTop: '0.1rem' }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.25rem' }}>
        <div style={{
          display: 'flex', gap: '0.25rem', marginBottom: '1.25rem',
          background: 'var(--surface-1)', borderRadius: 10, padding: '0.25rem',
          border: '1px solid var(--border-subtle)',
        }}>
          {[
            { id: 'turnos',    label: 'Mis Turnos',    icon: <MdCalendarMonth /> },
            { id: 'novedades', label: 'Novedades',     icon: <MdEventBusy /> },
            { id: 'prenomina', label: 'Pre-nómina',    icon: <MdCalculate /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '0.5rem 0.5rem',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: MIS TURNOS
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'turnos' && (
          <div className="animate-fade-in">
            {/* Mini-calendario mensual con navegación */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button onClick={prevMonth} style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                width: 30, height: 30, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}>‹</button>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1, textAlign: 'center' }}>
                {MESES[calMonth - 1]} {calYear}
              </span>
              <button onClick={nextMonth} style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                width: 30, height: 30, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}>›</button>
            </div>
            <MonthlyShiftGrid
              shifts={shifts}
              absences={absences}
              month={calMonth}
              year={calYear}
            />

            {/* Lista de turnos del mes visible */}
            {shiftsInCalMonth.length > 0 && (
              <>
                <h3 style={{
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)',
                  marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Turnos en {MESES[calMonth - 1]} ({shiftsInCalMonth.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {shiftsInCalMonth.map(s => <ShiftCard key={s.id} shift={s} />)}
                </div>
              </>
            )}

            {shiftsInCalMonth.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <p style={{ fontWeight: 500 }}>Sin turnos en {MESES[calMonth - 1]}</p>
                <p style={{ fontSize: '0.78rem' }}>
                  {calPeriodo < currentMonth ? 'No se registraron turnos en este mes.' : 'Aún no se han programado turnos.'}
                </p>
              </div>
            )}

            {/* Próximos turnos (todos, sin límite) */}
            {upcomingShifts.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)',
                  marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Todos los próximos turnos ({upcomingShifts.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {upcomingShifts.map(s => <ShiftCard key={s.id} shift={s} />)}
                </div>
              </div>
            )}

            {shifts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <MdCalendarMonth style={{ fontSize: '3rem', opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 500 }}>Aún no tienes turnos asignados</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                  Cuando tu administrador programe tus turnos, aparecerán aquí.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: NOVEDADES
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'novedades' && (
          <div className="animate-fade-in">
            {absences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <MdEventBusy style={{ fontSize: '3rem', opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 500 }}>Sin novedades registradas</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                  No tienes vacaciones, incapacidades, licencias ni suspensiones.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {absences.map(a => {
                  const cfg = ABSENCE_LABELS[a.tipo] || { label: a.tipo, icon: '📌', color: '#6366f1' };
                  const dias = Math.ceil((new Date(a.fecha_fin) - new Date(a.fecha_inicio)) / 86400000) + 1;
                  const esActiva = colNow() >= new Date(a.fecha_inicio) && colNow() <= new Date(a.fecha_fin);
                  const esPasada = new Date(a.fecha_fin) < colNow();

                  return (
                    <div key={a.id} className="cw-card" style={{
                      padding: '1rem 1.25rem',
                      borderLeft: `3px solid ${cfg.color}`,
                      opacity: esPasada ? 0.7 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.3rem' }}>{cfg.icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                {cfg.label}
                              </span>
                              {esActiva && (
                                <span style={{
                                  fontSize: '0.62rem', fontWeight: 700, color: '#22c55e',
                                  background: 'rgba(34,197,94,0.15)', padding: '0.08rem 0.45rem', borderRadius: 999,
                                }}>VIGENTE</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {formatDate(a.fecha_inicio)} → {formatDate(a.fecha_fin)}
                              <span style={{ marginLeft: '0.4rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                ({dias} {dias === 1 ? 'día' : 'días'})
                              </span>
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600,
                          color: a.aprobada ? '#22c55e' : '#f59e0b',
                          background: a.aprobada ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                          padding: '0.2rem 0.6rem', borderRadius: 999, whiteSpace: 'nowrap',
                        }}>
                          {a.aprobada ? '✓ Aprobada' : '⏳ Pendiente'}
                        </span>
                      </div>
                      {a.observaciones && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginLeft: '2rem' }}>
                          {a.observaciones}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: PRE-NÓMINA
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'prenomina' && (
          <div className="animate-fade-in">
            <div className="cw-card" style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), var(--surface-1))',
              borderColor: 'rgba(99,102,241,0.2)',
              marginBottom: '1rem',
            }}>
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Estimado pre-nómina — {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: TZ })}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                {formatCurrency(totalEstimado)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span>⏱ {totalHorasNetas.toFixed(2)} horas netas</span>
                <span>💵 {formatCurrency(valorHora)}/hora</span>
                <span>📋 {shiftsThisMonth.length} turnos este mes</span>
              </div>
            </div>

            {/* Desglose semanal */}
            {weeklyBreakdown.length > 0 && (
              <div className="cw-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)',
                  marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Desglose semanal
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {weeklyBreakdown.map((w, i) => (
                    <div key={w.label} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.75rem', borderRadius: 8,
                      background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, color: '#6366f1',
                        background: 'rgba(99,102,241,0.12)', borderRadius: 6,
                        padding: '0.2rem 0.45rem',
                      }}>{i + 1}ª</span>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        {w.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {w.turnos} turnos · {w.dias}d
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', minWidth: '4rem', textAlign: 'right' }}>
                        {w.horas.toFixed(1)}h
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '5rem', textAlign: 'right' }}>
                        {formatCurrency(w.horas * valorHora)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mes siguiente */}
            {resumenMesSig?.total_turnos > 0 && (
              <div className="cw-card" style={{
                padding: '1rem 1.25rem', marginBottom: '1rem',
                borderLeft: '3px solid var(--primary)',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  📅 Proyectado siguiente mes
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {Number(resumenMesSig.total_horas_netas || 0).toFixed(1)}h programadas · {resumenMesSig.total_turnos} turnos
                </div>
              </div>
            )}

            <div className="cw-alert" style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              color: 'var(--text-secondary)', borderRadius: 10, padding: '0.75rem 1rem',
              fontSize: '0.78rem',
            }}>
              ℹ️ Este valor es un <strong>estimado de pre-nómina</strong> basado en tus horas netas del mes actual.
              No incluye recargos nocturnos, dominicales, ni deducciones. El valor final lo calcula el área de Gestión Humana.
            </div>

            {shiftsThisMonth.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                <MdCalculate style={{ fontSize: '2rem', opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
                <p>No hay turnos registrados en el mes actual</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Espacio final */}
      <div style={{ paddingBottom: '3rem' }} />
    </div>
  );
}
