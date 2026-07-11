import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import { TIPOS_NOVEDAD, ABSENCE_CFG } from '../config/constants';
import { formatDuracionNovedad } from '../core/dateUtils';
import {
  MdCalendarMonth, MdEventBusy, MdCalculate,
  MdLogout, MdSchedule, MdAccessTime, MdChevronLeft, MdChevronRight,
  MdOutlineCalendarToday, MdAdd, MdClose
} from 'react-icons/md';

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 — HELPERS DE FECHA/HORA
//
// CONVENCIÓN CRÍTICA DE LA APP:
// Los timestamps se guardan como "YYYY-MM-DDTHH:MM:00Z" donde HH:MM es
// la HORA RELOJ de Colombia SIN conversión de zona.
// Ej: turno a las 08:00 → "2026-06-24T08:00:00Z"
//
// POR TANTO: para mostrar la hora correcta, se usa .slice(11,16) del
// string ISO directamente, NO toLocaleTimeString con timeZone.
// Usar toLocaleTimeString con 'America/Bogota' restaría 5h (error).
// ════════════════════════════════════════════════════════════════════════════

const TZ = 'America/Bogota';

/** Extrae la hora "reloj" de un ISO timestamp: "2026-06-24T08:30:00Z" → "08:30" */
function isoToClockTime(isoStr) {
  if (!isoStr) return '--:--';
  return String(isoStr).slice(11, 16); // "HH:MM"
}

/** Formatea hora como "08:30 AM" desde un ISO string (convención app: hora reloj directa) */
function formatTime(isoStr) {
  if (!isoStr) return '—';
  const [hStr, mStr] = isoToClockTime(isoStr).split(':');
  const h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

/** Devuelve "YYYY-MM-DD" del ISO string (parte de fecha, sin zona horaria) */
function isoToDateStr(isoStr) {
  if (!isoStr) return null;
  return String(isoStr).slice(0, 10);
}

/** Hoy como "YYYY-MM-DD" en Colombia */
function colTodayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

/** Mes actual como "YYYY-MM" en Colombia */
function colCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
}

/** Año actual en Colombia */
function colCurrentYear() {
  return parseInt(new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 4), 10);
}

/** Formatea fecha "YYYY-MM-DD" como "24 jun." */
function fmtShortDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** Formatea fecha como "lunes, 24 de junio" */
function fmtLongDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Nombre del día corto desde "YYYY-MM-DD": "lun." */
function fmtDayName(dateStr, long = false) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-CO', { weekday: long ? 'long' : 'short' });
}

/** Número del día desde "YYYY-MM-DD": 24 */
function dayNum(dateStr) {
  return parseInt(dateStr?.slice(8, 10) ?? '0', 10);
}

/** Calcula horas brutas entre dos ISO timestamps */
function brutHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = isoToClockTime(start).split(':').map(Number);
  const [eh, em] = isoToClockTime(end).split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // cruza medianoche
  return mins / 60;
}

/** Horas netas = brutas - almuerzo (en horas) */
function netHours(shift) {
  const brut = brutHours(shift.start_time, shift.end_time);
  return Math.max(0, brut - ((shift.break_minutes || 0) / 60));
}

function formatCurrency(val) {
  if (val == null) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(val);
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — CONSTANTES
// ════════════════════════════════════════════════════════════════════════════

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DIAS_SEMANA_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const SHIFT_CFG = {
  morning:   { label: 'Mañana',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   icon: '🌅' },
  afternoon: { label: 'Tarde',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   icon: '☀️' },
  night:     { label: 'Noche',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',   icon: '🌙' },
  custom:    { label: 'Turno',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   icon: '⚡' },
};

// Eliminado ABSENCE_CFG local, ahora se importa desde constants.js

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 — HELPERS DE SEMANA
// ════════════════════════════════════════════════════════════════════════════

/** Retorna "YYYY-MM-DD" del lunes de la semana que contiene dateStr */
function getMondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Dom ... 6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow; // ajustar a lunes
  date.setDate(date.getDate() + diff);
  return date.toLocaleDateString('sv-SE');
}

/** Genera array de 7 "YYYY-MM-DD" de lunes a domingo */
function getWeekDays(mondayStr) {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(y, m - 1, d + i);
    days.push(date.toLocaleDateString('sv-SE'));
  }
  return days;
}

/** Suma o resta N semanas a mondayStr */
function shiftWeek(mondayStr, n) {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + n * 7);
  return date.toLocaleDateString('sv-SE');
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — COMPONENTES INTERNOS
// ════════════════════════════════════════════════════════════════════════════

// ── Breaks Timeline ───────────────────────────────────────────────────────────
function BreaksTimeline({ descansos, breakMinutes }) {
  let breaks = [];
  try {
    breaks = typeof descansos === 'string' ? JSON.parse(descansos) : (descansos || []);
  } catch { /**/ }

  if (breaks.length === 0 && !breakMinutes) return null;

  return (
    <div className="emp-breaks-row">
      {breaks.map((b, i) => {
        const isLunch = b.tipo === 'ALMUERZO';
        return (
          <span key={i} className={`emp-break-pill ${isLunch ? 'emp-break-pill--lunch' : ''}`}>
            {isLunch ? '🍽️' : '☕'}
            <span>{isLunch ? 'Almuerzo' : 'Break'}</span>
            {b.inicio && <span className="emp-break-time">{b.inicio}</span>}
            <span className="emp-break-mins">{b.minutos ?? breakMinutes}min</span>
          </span>
        );
      })}
      {breaks.length === 0 && breakMinutes > 0 && (
        <span className="emp-break-pill emp-break-pill--lunch">
          🍽️ <span>Almuerzo</span>
          <span className="emp-break-mins">{breakMinutes}min</span>
        </span>
      )}
    </div>
  );
}

// ── ShiftCard ─────────────────────────────────────────────────────────────────
function ShiftCard({ shift, compact = false }) {
  const today   = colTodayStr();
  const dateStr = isoToDateStr(shift.start_time);
  const isToday  = dateStr === today;

  // "EN CURSO": comparar horas reloj (convención app: hora ISO = hora reloj Colombia)
  const nowClk  = new Date().toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const startClk = isoToClockTime(shift.start_time);
  const endClk   = isoToClockTime(shift.end_time);
  const isActive = isToday && nowClk >= startClk && nowClk <= endClk;
  const isPast   = dateStr < today || (isToday && nowClk > endClk);

  const cfg = SHIFT_CFG[shift.shift_type] || SHIFT_CFG.custom;
  const net = netHours(shift);

  if (compact) {
    return (
      <div className={`emp-shift-compact ${isActive ? 'emp-shift-compact--active' : ''} ${isPast ? 'emp-shift-compact--past' : ''}`}
        style={{ borderColor: isActive ? '#22c55e44' : `${cfg.color}33` }}>
        <span className="emp-shift-compact__icon">{cfg.icon}</span>
        <div className="emp-shift-compact__body">
          <span className="emp-shift-compact__time">
            {formatTime(shift.start_time)} → {formatTime(shift.end_time)}
          </span>
          <span className="emp-shift-compact__net">{net.toFixed(1)}h netas</span>
        </div>
        {isActive && <span className="emp-active-dot" />}
      </div>
    );
  }

  return (
    <div className={`emp-shift-card ${isActive ? 'emp-shift-card--active' : ''} ${isPast ? 'emp-shift-card--past' : ''}`}>
      {/* Estado badge */}
      {isActive && (
        <div className="emp-shift-card__badge emp-shift-card__badge--active">
          <span className="emp-pulse-dot" /> EN CURSO
        </div>
      )}
      {isToday && !isActive && (
        <div className="emp-shift-card__badge emp-shift-card__badge--today">HOY</div>
      )}
      {!isToday && !isPast && dateStr > today && (
        <div className="emp-shift-card__badge emp-shift-card__badge--upcoming">PRÓXIMO</div>
      )}

      <div className="emp-shift-card__inner">
        {/* Ícono tipo turno */}
        <div className="emp-shift-card__icon-wrap" style={{ background: `${cfg.color}1a`, color: cfg.color }}>
          <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
        </div>

        <div className="emp-shift-card__content">
          {/* Fecha */}
          <div className="emp-shift-card__date">
            {fmtLongDate(dateStr)}
          </div>

          {/* Horario */}
          <div className="emp-shift-card__hours">
            <MdAccessTime />
            <span>{formatTime(shift.start_time)}</span>
            <span className="emp-shift-card__arrow">→</span>
            <span>{formatTime(shift.end_time)}</span>
            <span className="emp-shift-type-tag" style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
          </div>

          {/* Descansos */}
          <BreaksTimeline descansos={shift.descansos} breakMinutes={shift.break_minutes} />

          {/* Métricas */}
          <div className="emp-shift-card__meta">
            <span>⏱ {net.toFixed(1)}h netas</span>
            {shift.recargo_porcentaje > 0 && (
              <span className="emp-shift-card__recargo">+{shift.recargo_porcentaje}% recargo</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WeekView ──────────────────────────────────────────────────────────────────
function WeekView({ shifts, absences, weekMonday, onPrev, onNext, onGoToday }) {
  const today    = colTodayStr();
  const weekDays = getWeekDays(weekMonday);

  // Índice fecha → turnos
  const shiftsByDate = useMemo(() => {
    const m = {};
    for (const s of shifts) {
      const d = isoToDateStr(s.start_time);
      if (d) { if (!m[d]) m[d] = []; m[d].push(s); }
    }
    return m;
  }, [shifts]);

  // Índice fecha → ausencia
  const absByDate = useMemo(() => {
    const m = {};
    for (const a of absences) {
      const ini = a.fecha_inicio; // DATE campo
      const fin = a.fecha_fin;
      // Generar días intermedios
      const [iy, im, id] = ini.split('-').map(Number);
      const [fy, fm, fd] = fin.split('-').map(Number);
      const startD = new Date(iy, im - 1, id);
      const endD   = new Date(fy, fm - 1, fd);
      for (let dt = new Date(startD); dt <= endD; dt.setDate(dt.getDate() + 1)) {
        m[dt.toLocaleDateString('sv-SE')] = a;
      }
    }
    return m;
  }, [absences]);

  const weekStart = weekDays[0];
  const weekEnd   = weekDays[6];

  // Total horas semana
  const totalWeekHours = weekDays.reduce((acc, d) => {
    const dayShifts = shiftsByDate[d] || [];
    return acc + dayShifts.reduce((a, s) => a + netHours(s), 0);
  }, 0);

  return (
    <div className="emp-week-section">
      {/* Cabecera semana */}
      <div className="emp-week-header">
        <div className="emp-week-header__left">
          <h2 className="emp-week-title">
            <MdCalendarMonth style={{ color: 'var(--cw-accent)', fontSize: '1.3rem' }} />
            Semana actual
          </h2>
          <span className="emp-week-range">
            {fmtShortDate(weekStart)} — {fmtShortDate(weekEnd)}
          </span>
        </div>
        <div className="emp-week-header__right">
          {totalWeekHours > 0 && (
            <span className="emp-week-total-badge">
              ⏱ {totalWeekHours.toFixed(1)}h esta semana
            </span>
          )}
          <button className="emp-nav-btn" onClick={onPrev} title="Semana anterior">
            <MdChevronLeft />
          </button>
          <button className="emp-nav-btn emp-nav-btn--today" onClick={onGoToday} title="Hoy">
            Hoy
          </button>
          <button className="emp-nav-btn" onClick={onNext} title="Próxima semana">
            <MdChevronRight />
          </button>
        </div>
      </div>

      {/* Grid 7 días */}
      <div className="emp-week-grid">
        {weekDays.map((dateStr) => {
          const dayShifts = shiftsByDate[dateStr] || [];
          const absence   = absByDate[dateStr];
          const isToday   = dateStr === today;
          const dow       = new Date(...dateStr.split('-').map((n,i)=>i===1?n-1:n)).getDay();
          const isWeekend = dow === 0 || dow === 6;

          return (
            <div
              key={dateStr}
              className={[
                'emp-day-card',
                isToday   ? 'emp-day-card--today'   : '',
                isWeekend ? 'emp-day-card--weekend' : '',
                dayShifts.length > 0 ? 'emp-day-card--has-shift' : '',
                absence ? 'emp-day-card--absence' : '',
                (!dayShifts.length && !absence && dateStr < today) ? 'emp-day-card--rest' : '',
              ].join(' ')}
            >
              {/* Cabecera del día */}
              <div className="emp-day-card__header">
                <span className="emp-day-card__dow">{DIAS_SEMANA[dow]}</span>
                <span className="emp-day-card__num">{dayNum(dateStr)}</span>
                {isToday && <span className="emp-day-card__today-dot" />}
              </div>

              {/* Contenido */}
              <div className="emp-day-card__body">
                {absence && (() => {
                  const ac = ABSENCE_CFG[absence.tipo] || { icon: '📌', color: '#6366f1', label: absence.tipo };
                  return (
                    <div className="emp-day-absence" style={{ color: ac.color }}>
                      <span>{ac.icon}</span>
                      <span>{ac.label}</span>
                    </div>
                  );
                })()}

                {!absence && dayShifts.length === 0 && (
                  <div className="emp-day-empty">
                    {dateStr < today ? (
                      <span className="emp-day-rest-label">Descanso</span>
                    ) : (
                      <span className="emp-day-free-label">Libre</span>
                    )}
                  </div>
                )}

                {!absence && dayShifts.map((s, i) => (
                  <ShiftCard key={i} shift={s} compact />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MonthCalendar ─────────────────────────────────────────────────────────────
function MonthCalendar({ shifts, absences, month, year }) {
  const today = colTodayStr();
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

  const shiftsByDate = useMemo(() => {
    const m = {};
    for (const s of shifts) {
      const d = isoToDateStr(s.start_time);
      if (d) { if (!m[d]) m[d] = []; m[d].push(s); }
    }
    return m;
  }, [shifts]);

  const absByDate = useMemo(() => {
    const m = {};
    for (const a of absences) {
      const [iy, im, id] = a.fecha_inicio.split('-').map(Number);
      const [fy, fm, fd] = a.fecha_fin.split('-').map(Number);
      for (let dt = new Date(iy, im-1, id); dt <= new Date(fy, fm-1, fd); dt.setDate(dt.getDate()+1)) {
        m[dt.toLocaleDateString('sv-SE')] = a;
      }
    }
    return m;
  }, [absences]);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  let worked = 0, rest = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${monthStr}-${String(d).padStart(2, '0')}`;
    if (shiftsByDate[ds] || absByDate[ds]) worked++;
    else if (ds < today) rest++;
  }

  return (
    <div className="emp-month-cal">
      <div className="emp-month-cal__stats">
        <span>📅 {worked} días con turno</span>
        {rest > 0 && <span>😴 {rest} días de descanso</span>}
      </div>

      {/* Cabeceras días */}
      <div className="emp-cal-grid emp-cal-grid--header">
        {DIAS_SEMANA.map(d => <div key={d} className="emp-cal-dow">{d}</div>)}
      </div>

      {/* Celdas */}
      <div className="emp-cal-grid">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="emp-cal-cell emp-cal-cell--empty" />;

          const ds = `${monthStr}-${String(day).padStart(2, '0')}`;
          const dayShifts = shiftsByDate[ds] || [];
          const absence   = absByDate[ds];
          const isToday   = ds === today;
          const dow       = new Date(year, month - 1, day).getDay();
          const isWeekend = dow === 0 || dow === 6;

          let dotColor = null;
          let cellClass = 'emp-cal-cell';
          let titleTip  = 'Descanso';

          if (absence) {
            const ac = ABSENCE_CFG[absence.tipo] || { color: '#6366f1' };
            dotColor = ac.color;
            cellClass += ' emp-cal-cell--absence';
            titleTip = ABSENCE_CFG[absence.tipo]?.label || absence.tipo;
          } else if (dayShifts.length > 0) {
            const sc = SHIFT_CFG[dayShifts[0].shift_type] || SHIFT_CFG.custom;
            dotColor = sc.color;
            cellClass += ' emp-cal-cell--shift';
            titleTip = dayShifts.map(s => `${formatTime(s.start_time)}→${formatTime(s.end_time)}`).join(' | ');
          } else if (isWeekend) {
            cellClass += ' emp-cal-cell--weekend';
          } else if (ds < today) {
            cellClass += ' emp-cal-cell--rest';
          }
          if (isToday) cellClass += ' emp-cal-cell--today';

          return (
            <div key={ds} className={cellClass} title={titleTip}>
              <span className="emp-cal-cell__num">{day}</span>
              {dotColor && (
                <span className="emp-cal-cell__dot" style={{ background: dotColor }} />
              )}
              {dayShifts.length > 1 && (
                <span className="emp-cal-cell__multi">×{dayShifts.length}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="emp-cal-legend">
        {Object.entries(SHIFT_CFG).slice(0,3).map(([k,v]) => (
          <span key={k} className="emp-cal-legend__item">
            <span style={{ background: v.color }} className="emp-cal-legend__dot" />
            {v.label}
          </span>
        ))}
        <span className="emp-cal-legend__item">
          <span className="emp-cal-legend__dot emp-cal-legend__dot--rest" />
          Descanso
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 5 — PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export default function EmployeeProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState('semana');

  // Novedades Modal
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ 
    tipo: 'vacaciones', 
    por_horas: false,
    fecha_inicio: '', 
    fecha_fin: '', 
    hora_inicio: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: '' 
  });
  const [soporteFile, setSoporteFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestAbsence = async (e) => {
    e.preventDefault();
    if (absenceForm.por_horas) {
      if (!absenceForm.hora_inicio || !absenceForm.hora_fin) {
        alert('Debe especificar la hora de inicio y fin.');
        return;
      }
      if (absenceForm.hora_inicio >= absenceForm.hora_fin) {
        alert('La hora de fin debe ser posterior a la de inicio.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let soporte_url = null;

      // Si hay un archivo seleccionado, subirlo primero
      if (soporteFile) {
        // Validar tamaño (5MB máx)
        if (soporteFile.size > 5 * 1024 * 1024) {
          throw new Error('El archivo supera el tamaño máximo permitido de 5MB.');
        }

        const fileExt = soporteFile.name.split('.').pop();
        const fileName = `${employee.id}_${Date.now()}.${fileExt}`;
        const filePath = `${employee.tenant_id}/${fileName}`; // Organizar por tenant

        const { error: uploadError } = await supabase.storage
          .from('documentos_soporte')
          .upload(filePath, soporteFile);

        if (uploadError) throw new Error('Error al subir el documento: ' + uploadError.message);

        // Obtener URL pública (asumiendo que el bucket lo permite, o guardamos el path)
        const { data: publicUrlData } = supabase.storage
          .from('documentos_soporte')
          .getPublicUrl(filePath);

        soporte_url = publicUrlData.publicUrl;
      }

      const dataToSave = {
        tenant_id: employee.tenant_id,
        employee_id: employee.id,
        tipo: absenceForm.tipo,
        por_horas: absenceForm.por_horas,
        fecha_inicio: absenceForm.fecha_inicio,
        fecha_fin: absenceForm.por_horas ? absenceForm.fecha_inicio : absenceForm.fecha_fin,
        hora_inicio: absenceForm.por_horas ? absenceForm.hora_inicio : null,
        hora_fin: absenceForm.por_horas ? absenceForm.hora_fin : null,
        estado: 'pendiente',
        aprobada: false, // fallback 
        observaciones: absenceForm.observaciones,
        soporte_url: soporte_url
      };
      const { error } = await supabase.from('absences').insert(dataToSave);
      if (error) throw error;
      setShowAbsenceModal(false);
      setAbsenceForm({ tipo: 'vacaciones', por_horas: false, fecha_inicio: '', fecha_fin: '', hora_inicio: '', hora_fin: '', observaciones: '' });
      setSoporteFile(null);
      loadProfile();
    } catch (err) {
      alert('Error al solicitar novedad: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Semana (navegación)
  const [currentMonday, setCurrentMonday] = useState(() => getMondayOf(colTodayStr()));

  // Calendario mensual
  const today        = colTodayStr();
  const [calMonth, setCalMonth] = useState(parseInt(today.slice(5, 7), 10));
  const [calYear,  setCalYear]  = useState(parseInt(today.slice(0, 4), 10));

  // ── Carga de datos ────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_my_employee_profile');
      if (rpcError) throw rpcError;
      setProfile(data);
    } catch (err) {
      setError('No se pudo cargar tu perfil. Contacta a tu administrador.');
      logger.error('EmployeeProfilePage', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  // ── Datos derivados ───────────────────────────────────────────────────────
  const employee    = profile?.employee    || {};
  const shifts      = profile?.shifts      || [];
  const absences    = profile?.absences    || [];
  const resMes      = profile?.resumen_mes || {};
  const resMesSig   = profile?.resumen_mes_siguiente || {};
  const resSemana   = profile?.resumen_semana_actual || {};

  const currentMonth = colCurrentMonth();

  const shiftsThisMonth = useMemo(() =>
    shifts.filter(s => isoToDateStr(s.start_time)?.slice(0, 7) === currentMonth),
  [shifts, currentMonth]);

  const calPeriodo = `${calYear}-${String(calMonth).padStart(2, '0')}`;
  const shiftsInCalMonth = useMemo(() =>
    shifts.filter(s => isoToDateStr(s.start_time)?.slice(0, 7) === calPeriodo)
          .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  [shifts, calPeriodo]);

  // Pre-nómina
  const totalHorasNetas = shiftsThisMonth.reduce((acc, s) => acc + netHours(s), 0);
  const valorHora       = employee?.valor_hora || 0;
  const totalEstimado   = totalHorasNetas * valorHora;

  // Desglose semanal del mes actual
  const weeklyBreakdown = useMemo(() => {
    const weeks = {};
    for (const s of shiftsThisMonth) {
      const ds = isoToDateStr(s.start_time);
      if (!ds) continue;
      const d  = parseInt(ds.slice(8, 10), 10);
      const wk = Math.ceil(d / 7);
      const key = `Semana ${wk}`;
      if (!weeks[key]) weeks[key] = { horas: 0, turnos: 0, dias: new Set() };
      weeks[key].horas  += netHours(s);
      weeks[key].turnos += 1;
      weeks[key].dias.add(ds);
    }
    return Object.entries(weeks).map(([k, v]) => ({
      label: k, horas: v.horas, turnos: v.turnos, dias: v.dias.size,
    }));
  }, [shiftsThisMonth]);

  // Iniciales del empleado
  const initials = useMemo(() => {
    const n = employee?.nombre || user?.email || '';
    return n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
  }, [employee, user]);

  // ── Navegación calendario ─────────────────────────────────────────────────
  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  // Años disponibles (año anterior, actual, siguiente)
  const currentYear = colCurrentYear();
  const availableYears = [currentYear - 1, currentYear, currentYear + 1];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="emp-loading-screen">
        <div className="emp-loading-logo">⏱️</div>
        <div className="cw-spinner" />
        <span>Cargando tu información...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="emp-error-screen">
        <div className="cw-card" style={{ maxWidth: 380, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>😕</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="cw-btn cw-btn--primary" onClick={loadProfile}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="emp-shell">
      {/* ════════════════════════════════════════════════════════
          HEADER HERO
          ════════════════════════════════════════════════════════ */}
      <header className="emp-hero">
        {/* Decoraciones */}
        <div className="emp-hero__orb emp-hero__orb--1" />
        <div className="emp-hero__orb emp-hero__orb--2" />
        <div className="emp-hero__orb emp-hero__orb--3" />

        {/* Top bar */}
        <div className="emp-hero__topbar">
          <Link to="/landing" className="emp-hero__brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="emp-hero__brand-icon">⏱️</span>
            <span className="emp-hero__brand-name">ChronosWork</span>
          </Link>
          <button className="emp-signout-btn" onClick={handleSignOut}>
            <MdLogout /> Salir
          </button>
        </div>

        {/* Perfil */}
        <div className="emp-hero__profile">
          <div className="emp-avatar">{initials}</div>
          <div className="emp-hero__profile-info">
            <h1 className="emp-hero__name">{employee?.nombre || user?.email}</h1>
            <div className="emp-hero__cargo">{employee?.cargo || 'Colaborador'}</div>
            {employee?.cedula && (
              <div className="emp-hero__cedula">C.C. {employee.cedula}</div>
            )}
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="emp-hero__stats">
          <div className="emp-hero__stat">
            <span className="emp-hero__stat-val">{resSemana?.total_turnos ?? 0}</span>
            <span className="emp-hero__stat-label">Turnos semana</span>
          </div>
          <div className="emp-hero__stat-divider" />
          <div className="emp-hero__stat">
            <span className="emp-hero__stat-val">
              {Number(resSemana?.total_horas_netas ?? 0).toFixed(1)}h
            </span>
            <span className="emp-hero__stat-label">Horas semana</span>
          </div>
          <div className="emp-hero__stat-divider" />
          <div className="emp-hero__stat">
            <span className="emp-hero__stat-val">{shiftsThisMonth.length}</span>
            <span className="emp-hero__stat-label">Turnos mes</span>
          </div>
          <div className="emp-hero__stat-divider" />
          <div className="emp-hero__stat">
            <span className="emp-hero__stat-val">{totalHorasNetas.toFixed(0)}h</span>
            <span className="emp-hero__stat-label">Horas mes</span>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          NAVEGACIÓN DE TABS
          ════════════════════════════════════════════════════════ */}
      <div className="emp-tabs-bar">
        <div className="emp-tabs">
          {[
            { id: 'semana',    label: 'Esta Semana',  icon: <MdOutlineCalendarToday /> },
            { id: 'turnos',    label: 'Mis Turnos',   icon: <MdCalendarMonth /> },
            { id: 'novedades', label: 'Novedades',    icon: <MdEventBusy /> },
            { id: 'prenomina', label: 'Pre-nómina',   icon: <MdCalculate /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`emp-tab ${activeTab === tab.id ? 'emp-tab--active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'semana' && resSemana?.total_turnos > 0 && (
                <span className="emp-tab__badge">{resSemana.total_turnos}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CONTENIDO PRINCIPAL
          ════════════════════════════════════════════════════════ */}
      <main className="emp-main">

        {/* ──────────────────────────────────────────────────────
            TAB: ESTA SEMANA
            ────────────────────────────────────────────────────── */}
        {activeTab === 'semana' && (
          <div className="emp-tab-content animate-fade-in">
            <WeekView
              shifts={shifts}
              absences={absences}
              weekMonday={currentMonday}
              onPrev={() => setCurrentMonday(m => shiftWeek(m, -1))}
              onNext={() => setCurrentMonday(m => shiftWeek(m, +1))}
              onGoToday={() => setCurrentMonday(getMondayOf(colTodayStr()))}
            />

            {/* Turnos de la semana en detalle */}
            {(() => {
              const weekDays = getWeekDays(currentMonday);
              const weekShifts = shifts.filter(s => weekDays.includes(isoToDateStr(s.start_time)));
              if (weekShifts.length === 0) return (
                <div className="emp-empty-state">
                  <MdCalendarMonth style={{ fontSize: '3rem', opacity: 0.2 }} />
                  <p>Sin turnos esta semana</p>
                  <span>Cuando tu administrador programe turnos aparecerán aquí</span>
                </div>
              );
              return (
                <div className="emp-shifts-list">
                  <div className="emp-section-title">
                    <MdSchedule />
                    Detalle de turnos — Semana del {fmtShortDate(currentMonday)} al {fmtShortDate(weekDays[6])}
                  </div>
                  {weekShifts
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map(s => <ShiftCard key={s.id} shift={s} />)}
                </div>
              );
            })()}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            TAB: MIS TURNOS (Calendario + lista mensual)
            ────────────────────────────────────────────────────── */}
        {activeTab === 'turnos' && (
          <div className="emp-tab-content animate-fade-in">
            {/* Selector Mes + Año */}
            <div className="emp-month-nav">
              <button className="emp-nav-btn" onClick={prevMonth}><MdChevronLeft /></button>

              <div className="emp-month-nav__center">
                <select
                  className="emp-month-select"
                  value={calMonth}
                  onChange={e => setCalMonth(Number(e.target.value))}
                >
                  {MESES.map((m, i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>

                <select
                  className="emp-year-select"
                  value={calYear}
                  onChange={e => setCalYear(Number(e.target.value))}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button className="emp-nav-btn" onClick={nextMonth}><MdChevronRight /></button>
            </div>

            {/* Calendariomensual */}
            <div className="cw-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
              <MonthCalendar
                shifts={shifts}
                absences={absences}
                month={calMonth}
                year={calYear}
              />
            </div>

            {/* Lista de turnos del mes */}
            {shiftsInCalMonth.length > 0 ? (
              <>
                <div className="emp-section-title">
                  <MdSchedule />
                  Turnos en {MESES[calMonth - 1]} {calYear} ({shiftsInCalMonth.length})
                </div>
                <div className="emp-shifts-list">
                  {shiftsInCalMonth.map(s => <ShiftCard key={s.id} shift={s} />)}
                </div>
              </>
            ) : (
              <div className="emp-empty-state">
                <MdCalendarMonth style={{ fontSize: '3rem', opacity: 0.2 }} />
                <p>Sin turnos en {MESES[calMonth - 1]} {calYear}</p>
                <span>
                  {calPeriodo < currentMonth
                    ? 'No se registraron turnos en este período.'
                    : 'Aún no se han programado turnos para este período.'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            TAB: NOVEDADES
            ────────────────────────────────────────────────────── */}
        {activeTab === 'novedades' && (
          <div className="emp-tab-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Mis Novedades</h3>
              <button 
                className="cw-btn cw-btn--primary cw-btn--sm" 
                onClick={() => setShowAbsenceModal(true)}
              >
                <MdAdd style={{ fontSize: '1.25rem', marginRight: '0.25rem' }} /> Solicitar Novedad
              </button>
            </div>
            {absences.length === 0 ? (
              <div className="emp-empty-state">
                <MdEventBusy style={{ fontSize: '3rem', opacity: 0.2 }} />
                <p>Sin novedades registradas</p>
                <span>No tienes vacaciones, incapacidades, licencias ni suspensiones.</span>
              </div>
            ) : (
              <div className="emp-shifts-list">
                {absences.map(a => {
                  const cfg = ABSENCE_CFG[a.tipo] || { label: a.tipo, icon: '📌', color: '#6366f1' };
                  const dias = Math.ceil((new Date(a.fecha_fin) - new Date(a.fecha_inicio)) / 86400000) + 1;
                  const nowStr = today;
                  const esActiva = nowStr >= a.fecha_inicio && nowStr <= a.fecha_fin;
                  const esPasada = a.fecha_fin < nowStr;

                  return (
                    <div
                      key={a.id}
                      className="emp-absence-card"
                      style={{ borderLeftColor: cfg.color, opacity: esPasada ? 0.75 : 1 }}
                    >
                      <div className="emp-absence-card__icon">{cfg.icon}</div>
                      <div className="emp-absence-card__body">
                        <div className="emp-absence-card__header">
                          <span className="emp-absence-card__tipo">{cfg.label}</span>
                          {esActiva && <span className="emp-badge emp-badge--active">VIGENTE</span>}
                          {esPasada && <span className="emp-badge emp-badge--past">Finalizada</span>}
                        </div>
                        <div className="emp-absence-card__dates">
                          {a.por_horas ? (
                            <>
                              {a.fecha_inicio} | {a.hora_inicio?.slice(0, 5)} a {a.hora_fin?.slice(0, 5)}
                              <span className="emp-absence-card__dias" style={{ marginLeft: '0.5rem' }}>({formatDuracionNovedad(a)})</span>
                            </>
                          ) : (
                            <>
                              {a.fecha_inicio} → {a.fecha_fin}
                              <span className="emp-absence-card__dias" style={{ marginLeft: '0.5rem' }}>({formatDuracionNovedad(a)})</span>
                            </>
                          )}
                        </div>
                        {a.observaciones && (
                          <p className="emp-absence-card__obs">{a.observaciones}</p>
                        )}
                      </div>
                      <span
                        className="emp-absence-card__status"
                        style={{
                          color: (a.estado === 'aprobada' || a.aprobada) ? '#22c55e' : a.estado === 'rechazada' ? '#ef4444' : '#f59e0b',
                          background: (a.estado === 'aprobada' || a.aprobada) ? 'rgba(34,197,94,0.1)' : a.estado === 'rechazada' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        }}
                      >
                        {(a.estado === 'aprobada' || a.aprobada) ? '✓ Aprobada' : a.estado === 'rechazada' ? '❌ Rechazada' : '⏳ Pendiente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            TAB: PRE-NÓMINA
            ────────────────────────────────────────────────────── */}
        {activeTab === 'prenomina' && (
          <div className="emp-tab-content animate-fade-in">
            {/* Card principal */}
            <div className="emp-prenomina-hero">
              <div className="emp-prenomina-hero__label">
                Estimado pre-nómina — {MESES[parseInt(today.slice(5,7),10) - 1]} {today.slice(0,4)}
              </div>
              <div className="emp-prenomina-hero__value">
                {formatCurrency(totalEstimado)}
              </div>
              <div className="emp-prenomina-hero__meta">
                <span>⏱ {totalHorasNetas.toFixed(2)} horas netas</span>
                <span>💵 {formatCurrency(valorHora)}/hora</span>
                <span>📋 {shiftsThisMonth.length} turnos</span>
              </div>
            </div>

            {/* Desglose semanal */}
            {weeklyBreakdown.length > 0 && (
              <div className="cw-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div className="emp-section-title" style={{ marginBottom: '0.85rem' }}>
                  <MdCalendarMonth /> Desglose semanal
                </div>
                <div className="emp-weekly-breakdown">
                  {weeklyBreakdown.map((w, i) => (
                    <div key={w.label} className="emp-week-row">
                      <span className="emp-week-row__num">{i + 1}ª</span>
                      <span className="emp-week-row__label">{w.label}</span>
                      <span className="emp-week-row__meta">{w.turnos} turnos · {w.dias}d</span>
                      <span className="emp-week-row__hours">{w.horas.toFixed(1)}h</span>
                      <span className="emp-week-row__value">{formatCurrency(w.horas * valorHora)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mes siguiente */}
            {resMesSig?.total_turnos > 0 && (
              <div className="cw-card emp-next-month-card">
                <div>📅 Proyectado mes siguiente</div>
                <div>
                  {Number(resMesSig.total_horas_netas || 0).toFixed(1)}h programadas
                  · {resMesSig.total_turnos} turnos
                </div>
              </div>
            )}

            {/* Aviso */}
            <div className="emp-alert-info">
              ℹ️ Este valor es un <strong>estimado de pre-nómina</strong> basado en horas netas del mes actual.
              No incluye recargos nocturnos, dominicales, ni deducciones. El valor final lo calcula Gestión Humana.
            </div>

            {shiftsThisMonth.length === 0 && (
              <div className="emp-empty-state">
                <MdCalculate style={{ fontSize: '2rem', opacity: 0.2 }} />
                <p>No hay turnos registrados en el mes actual</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom padding */}
      <div style={{ paddingBottom: '2rem' }} />

      {/* Modal de Solicitud de Novedad */}
      {showAbsenceModal && (
        <div className="cw-modal-overlay">
          <div className="cw-modal animate-fade-in" style={{ maxWidth: '400px' }}>
            <div className="cw-modal__header">
              <h3>Solicitar Novedad</h3>
              <button className="cw-modal__close" onClick={() => setShowAbsenceModal(false)}>
                <MdClose />
              </button>
            </div>
            <div className="cw-modal__body">
              <form id="absence-form" onSubmit={handleRequestAbsence} className="cw-form">
                <div className="cw-form-group">
                  <label>Tipo de Novedad</label>
                  <select
                    className="cw-input"
                    value={absenceForm.tipo}
                    onChange={e => setAbsenceForm({ ...absenceForm, tipo: e.target.value })}
                    required
                  >
                    {TIPOS_NOVEDAD.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="cw-form-group">
                  <label>Modalidad de Novedad</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="radio" name="por_horas" checked={!absenceForm.por_horas} onChange={() => setAbsenceForm({...absenceForm, por_horas: false, hora_inicio: '', hora_fin: ''})} />
                      Por días completos
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="radio" name="por_horas" checked={absenceForm.por_horas} onChange={() => setAbsenceForm({...absenceForm, por_horas: true, fecha_fin: ''})} />
                      Por horas
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="cw-form-group" style={absenceForm.por_horas ? { gridColumn: '1 / -1' } : {}}>
                    <label>{absenceForm.por_horas ? 'Fecha de la Novedad' : 'Fecha Inicio'}</label>
                    <input
                      type="date"
                      className="cw-input"
                      value={absenceForm.fecha_inicio}
                      onChange={e => setAbsenceForm({ ...absenceForm, fecha_inicio: e.target.value })}
                      required
                      min={today}
                    />
                  </div>
                  
                  {!absenceForm.por_horas ? (
                    <div className="cw-form-group">
                      <label>Fecha Fin</label>
                      <input
                        type="date"
                        className="cw-input"
                        value={absenceForm.fecha_fin}
                        onChange={e => setAbsenceForm({ ...absenceForm, fecha_fin: e.target.value })}
                        required
                        min={absenceForm.fecha_inicio || today}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="cw-form-group">
                        <label>Hora Inicio</label>
                        <input
                          type="time"
                          className="cw-input"
                          value={absenceForm.hora_inicio}
                          onChange={e => setAbsenceForm({ ...absenceForm, hora_inicio: e.target.value })}
                          required
                        />
                      </div>
                      <div className="cw-form-group">
                        <label>Hora Fin</label>
                        <input
                          type="time"
                          className="cw-input"
                          value={absenceForm.hora_fin}
                          onChange={e => setAbsenceForm({ ...absenceForm, hora_fin: e.target.value })}
                          required
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="cw-form-group">
                  <label>Observaciones / Motivo {absenceForm.tipo === 'otro' && <span style={{color: 'var(--cw-danger)'}}>* (Requerido)</span>}</label>
                  <textarea
                    className="cw-input"
                    value={absenceForm.observaciones}
                    onChange={e => setAbsenceForm({ ...absenceForm, observaciones: e.target.value })}
                    rows={3}
                    placeholder={absenceForm.tipo === 'otro' ? 'Especifica el tipo de novedad detalladamente...' : 'Describe brevemente el motivo...'}
                    required={absenceForm.tipo === 'otro'}
                  ></textarea>
                </div>

                <div className="cw-form-group">
                  <label>Documento Soporte (Opcional)</label>
                  <input
                    type="file"
                    className="cw-input"
                    style={{ padding: '0.4rem' }}
                    accept=".pdf,image/png,image/jpeg,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={e => setSoporteFile(e.target.files[0])}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Soporta PDF, JPG, PNG o Word (Max. 5MB)
                  </div>
                </div>
              </form>
            </div>
            <div className="cw-modal__footer">
              <button type="button" className="cw-btn cw-btn--secondary" onClick={() => setShowAbsenceModal(false)}>
                Cancelar
              </button>
              <button type="submit" form="absence-form" className="cw-btn cw-btn--primary" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
