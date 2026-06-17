// ============================================================
// ChronosWork — Generador de Turnos v4.1
// Rediseñado para soportar call centers 24/7 y cualquier
// empresa con demanda variable + jornada nocturna dedicada.
// ============================================================
// Cambios vs v4.0:
//  ✅ FASE 1 (noche) reescrita: pool nocturno con FALLBACK garantizado,
//     usa nightConfig.start/end (no hardcode), mide el déficit del día
//     correcto (noche de D + madrugada de D+1) y reparte la noche con un
//     greedy de bloques de duración variable (cubre el pico de madrugada
//     sin sobre-cubrir el valle).
//  ✅ Demanda nocturna real: buildDemandVector usa DEMAND_CURVE_NOCTURNA en
//     horas nocturnas y garantiza min-staff en 24/7.
//  ✅ Bug de zona horaria corregido (parseLocalDate, sin new Date('yyyy-mm-dd')).
//  ✅ `nocheSoloDedicados` ahora tiene efecto real.
//  ✅ Tope de horas nocturnas con horas nocturnas REALES (sin factor 0.7).
//  ✅ FASE 3 (templates) eficiente, sin reiniciar en day[0] cada vuelta.
//  ✅ FASE 4 (balanceo) compara horas SEMANALES correctamente.
//  ✅ Eliminado código muerto (no-op de NOCTURNO, rotarSlots documentado).
// ============================================================

import { format, addDays } from 'date-fns';
import {
  PATRONES_ROTATIVOS,
} from '../config/laborCatalog.js';

// ── Defaults legales Colombia (Ley 2101/2021 + Ley 2466/2025) ────────────
export const LEGAL_DEFAULTS_CO = {
  maxHorasSemanales:     42,
  minHorasTurno:          4,   // mínimo por turno (art. 161 CST)
  maxHorasTurno:          9,   // máximo razonable sin HE formales
  maxHorasDiarias:        9,   // tope diario por defecto (alineado con maxHorasTurno)
  minHorasEntreJornadas:  9,   // descanso mínimo entre jornadas
  diasDescansoSemana:     1,
};

// ── Constantes de horario nocturno (CST colombiano, Ley 2466/2025) ───────
// Trabajo nocturno: 19:00 → 06:00. La jornada DIURNA es 06:00 → 19:00.
const NOCTURNA_INICIO_H = 19; // 19:00 inclusive
const NOCTURNA_FIN_H    = 6;  // 06:00 exclusive

// ── Curvas de demanda por defecto (call center colombia 24/7) ───────────
// Solo se usan cuando el área NO tiene demandSlots configurados.
const DEMAND_CURVE_DIURNA = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 2,
  5: 4, 6: 6, 7: 8, 8: 9, 9: 9, 10: 8,
  11: 7, 12: 7, 13: 8, 14: 8, 15: 8, 16: 7,
  17: 6, 18: 5, 19: 3, 20: 2, 21: 1, 22: 1, 23: 1,
};
const DEMAND_CURVE_NOCTURNA = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 1, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2,
  12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2,
  18: 3, 19: 4, 20: 4, 21: 4, 22: 4, 23: 3,
};
const DEMAND_CURVE_FIN_SEMANA = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 6,
  12: 6, 13: 5, 14: 5, 15: 4, 16: 4, 17: 3,
  18: 3, 19: 2, 20: 2, 21: 1, 22: 1, 23: 1,
};

// ── Horarios canónicos de inicio (12+ opciones para variedad real) ────────
// Se usan en FASE 2 para generar horarios más realistas y variados.
// Cada entrada: [hora, minuto]. Cubre desde madrugada hasta noche.
const CANONICAL_DAY_STARTS = [
  [4, 0],  // 04:00 - muy temprano (panadería, aeropuerto)
  [5, 0],  // 05:00 - primer turno
  [5, 30], // 05:30
  [6, 0],  // 06:00 - entrada estándar mañana
  [6, 30], // 06:30
  [7, 0],  // 07:00
  [7, 30], // 07:30
  [8, 0],  // 08:00 - entrada oficina estándar
  [9, 0],  // 09:00 - mañana media
  [10, 0], // 10:00
  [11, 0], // 11:00
  [12, 0], // 12:00 - turno mediodía
  [13, 0], // 13:00
  [14, 0], // 14:00 - primer turno tarde
  [15, 0], // 15:00
  [15, 30],// 15:30
  [16, 0], // 16:00
  [17, 0], // 17:00
  [18, 0], // 18:00 - noche temprana
  [19, 0], // 19:00
  [20, 0], // 20:00
  [21, 0], // 21:00
  [22, 0], // 22:00 - turno nocturno
  [23, 0], // 23:00
];

// ── Utilidades de cuadrícula ─────────────────────────────────────────────
export function timeToSlot(hhmm, slotsPerHour = 4) {
  if (!hhmm) return 0;
  const parts = String(hhmm).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1] || '0', 10) || 0;
  return h * slotsPerHour + Math.floor(m / (60 / slotsPerHour));
}

export function slotToTime(slot, slotsPerHour = 4) {
  const slotsPerDay = 24 * slotsPerHour;
  const s = ((slot % slotsPerDay) + slotsPerDay) % slotsPerDay;
  const h = Math.floor(s / slotsPerHour);
  const m = (s % slotsPerHour) * (60 / slotsPerHour);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getSlotsPerDay(slotsPerHour = 4) {
  return 24 * slotsPerHour;
}

export function isNightHour(h) {
  return h >= NOCTURNA_INICIO_H || h < NOCTURNA_FIN_H;
}

// ── Parser de fecha LOCAL (evita el desfase UTC de new Date('yyyy-mm-dd')) ─
function parseLocalDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// ── Clasificación efectiva del empleado ──────────────────────────────────
/**
 * Devuelve una de: 'NIGHT_ONLY' | 'DAY_ONLY' | 'MIXED' | 'ANY'
 * En orden de prioridad: solo_* > jornada_preferida explícita.
 */
export function classifyEmployee(emp) {
  if (!emp) return 'ANY';
  if (emp.solo_nocturno) return 'NIGHT_ONLY';
  if (emp.solo_diurno)   return 'DAY_ONLY';
  switch (emp.jornada_preferida) {
    case 'NOCTURNA': return 'NIGHT_ONLY';
    case 'DIURNA':   return 'DAY_ONLY';
    case 'MIXTA':    return 'MIXED';
    default:         return 'ANY';
  }
}

// ── Construcción del vector de demanda ───────────────────────────────────
/**
 * Construye el vector de demanda requerida por cada slot para un día.
 * Prioriza `demandSlots` (config del área). Si no hay, usa curva default
 * (diurna/nocturna/fin de semana según la hora y el día).
 */
function buildDemandVector(dayOfWeek, demandSlots, numEmployees, isWeekend, slotsPerHour = 4) {
  const slotsPerDay = getSlotsPerDay(slotsPerHour);
  const vec = new Array(slotsPerDay).fill(0);
  const safeDemandSlots = Array.isArray(demandSlots) ? demandSlots : [];
  const dayRows = safeDemandSlots.filter(s => s && s.day_of_week === dayOfWeek);

  if (dayRows.length > 0) {
    dayRows.forEach(row => {
      const startSlot = Math.max(0, Math.min((row.start_hour || 0) * slotsPerHour, slotsPerDay));
      const endSlot   = Math.max(startSlot, Math.min((row.end_hour || 24) * slotsPerHour, slotsPerDay));
      for (let s = startSlot; s < endSlot; s++) {
        vec[s] = Math.max(vec[s], row.required_staff || 1);
      }
    });
  } else {
    const dayCurve = isWeekend ? DEMAND_CURVE_FIN_SEMANA : DEMAND_CURVE_DIURNA;
    const peakStaff = Math.max(1, Math.round((numEmployees || 1) * 0.8));
    for (let s = 0; s < slotsPerDay; s++) {
      const h = Math.floor(s / slotsPerHour);
      // En horas nocturnas usamos la curva nocturna (antes nunca se usaba).
      const level = isNightHour(h)
        ? (DEMAND_CURVE_NOCTURNA[h] ?? 1)
        : (dayCurve[h] ?? 1);
      vec[s] = Math.max(1, Math.round((level / 10) * peakStaff));
    }
  }
  return vec;
}

// ── Construye turnos a partir de templates, respetando el shift_kind ──────
export function expandTemplateToShifts(tpl, dateStr, nextDayStr) {
  if (!tpl) return [];
  const kind = tpl.shift_kind || 'STANDARD';

  if (kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
    return [
      {
        template_id: tpl.id,
        start_time: `${dateStr}T${tpl.hora_inicio}`,
        end_time: `${dateStr}T${tpl.hora_fin}`,
        break_minutes: tpl.split_break_minutos || 60,
        shift_kind: kind, bloque: 1, disponibilidad: false,
        recargo_porcentaje: 0,
      },
      {
        template_id: tpl.id,
        start_time: `${dateStr}T${tpl.hora_inicio_2}`,
        end_time: `${dateStr}T${tpl.hora_fin_2}`,
        break_minutes: 0,
        shift_kind: kind, bloque: 2, disponibilidad: false,
        recargo_porcentaje: 0,
      },
    ];
  }

  if (kind === 'DISPONIBILIDAD') {
    return [{
      template_id: tpl.id,
      start_time: `${dateStr}T${tpl.hora_inicio}`,
      end_time: tpl.cruza_medianoche
        ? `${nextDayStr}T${tpl.hora_fin}`
        : `${dateStr}T${tpl.hora_fin}`,
      break_minutes: 0,
      shift_kind: kind, bloque: 1, disponibilidad: true,
      recargo_porcentaje: tpl.disponibilidad_recargo_porcentaje || 0,
    }];
  }

  return [{
    template_id: tpl.id,
    start_time: `${dateStr}T${tpl.hora_inicio}`,
    end_time: tpl.cruza_medianoche
      ? `${nextDayStr}T${tpl.hora_fin}`
      : `${dateStr}T${tpl.hora_fin}`,
    break_minutes: tpl.break_minutos || 0,
    shift_kind: kind, bloque: 1, disponibilidad: false,
    recargo_porcentaje: 0,
  }];
}

export function blockHours(block) {
  if (!block) return 0;
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const raw = (end - start) / 3600000;
  return Math.max(0, raw - (block.break_minutes || 0) / 60);
}

export function shiftPagaNocturno(tpl) {
  if (!tpl) return false;
  if (tpl.shift_kind === 'NOCTURNO') return true;
  if (tpl.paga_recargo_nocturno) return true;
  const [h] = (tpl.hora_inicio || '00:00').split(':').map(Number);
  return h >= NOCTURNA_INICIO_H;
}

export function buildRotativeSchedule({ days, patron, positionOffset = 0 }) {
  const def = PATRONES_ROTATIVOS.find(p => p.value === patron) || PATRONES_ROTATIVOS[3];
  const cycleLen = def.diasTrabajo + def.diasDescanso;
  if (cycleLen <= 0) return days.map(d => ({ date: d, works: true }));
  const cycle = [];
  for (let i = 0; i < def.diasTrabajo; i++) cycle.push(true);
  for (let i = 0; i < def.diasDescanso; i++) cycle.push(false);
  return days.map((d, idx) => {
    const cyclePos = ((idx + positionOffset) % cycleLen + cycleLen) % cycleLen;
    return { date: d, works: cycle[cyclePos] };
  });
}

// ── Helpers de fecha/hora ────────────────────────────────────────────────
function dateToStr(d) {
  return format(d, 'yyyy-MM-dd');
}

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function nombreDia(dateObj) {
  return DIAS_ES[dateObj.getDay()] || '';
}

// ── FUNCIÓN PRINCIPAL DE GENERACIÓN ──────────────────────────────────────
/**
 * @param {Object} params  (ver README V4_ALGORITHM_UPGRADE.md)
 * @returns {{ shifts: Array, warnings: Array }}
 */
export function generateAutomaticShifts({
  employees,
  templates = [],
  absences = [],
  existingShifts = [],
  year,
  month,
  diasTrabajoArea = [1, 2, 3, 4, 5],
  diasToProcess = [],
  demandSlots = [],
  modoOperacion = 'OFICINA',
  laborLimits = {},
  nightShiftConfig = null,
  patronRotativo = null,
  // ── v4 nuevos parámetros ──
  estrategia = 'COVERAGE_FIRST',
  minEmpleadosNoche = 1,
  nocheSoloDedicados = true,
  permiteDiaCubrirNoche = false,
  balancearCarga = true,
  rotarSlots = false,
  slotsPorHora = 4,
  snapMinutos = 15,
  minHorasTurnoOverride = null,
  maxHorasTurnoOverride = null,
  permiteExtras = false,
  permitePartidos = false,
  // ── v5 nuevos parámetros: headcount objetivo por día ──
  minEmpleadosDia = null,   // piso: si no se alcanza, el día se deja vacío y se avisa
  maxEmpleadosDia = null,   // techo + objetivo de personas distintas/día (incluye noche)
  horaInicioDia = '04:00',  // hora a la que puede empezar el primer turno diurno
}) {
  const generatedShifts = [];
  const warnings = [];

  // ── Validaciones tempranas ───────────────────────────────────────────
  if (!Array.isArray(employees) || employees.length === 0) {
    return { shifts: [], warnings: ['No hay empleados en el área.'] };
  }

  // ── Resolver configuración de jornada nocturna ───────────────────────
  const is24x7 = (modoOperacion === '24_7' || modoOperacion === '24_7_NIGHT_SPLIT');
  const nightConfig = is24x7
    ? {
        start: (nightShiftConfig?.start) || '22:00',
        end:   (nightShiftConfig?.end)   || '06:00',
        minStaff: Math.max(1, parseInt(minEmpleadosNoche, 10) || 1),
        soloDedicados: !!nocheSoloDedicados,
        permiteDiaCubrir: !!permiteDiaCubrirNoche,
        employeeIds: nightShiftConfig?.employeeIds || [],
      }
    : null;

  // ── Snap a grilla ────────────────────────────────────────────────────
  const snapSlots = Math.max(1, Math.round(snapMinutos / (60 / slotsPorHora)));

  // ── Defaults legales + overrides ─────────────────────────────────────
  const limits = {
    ...LEGAL_DEFAULTS_CO,
    ...laborLimits,
    minHorasTurno: minHorasTurnoOverride ?? laborLimits.minHorasTurno ?? LEGAL_DEFAULTS_CO.minHorasTurno,
    maxHorasTurno: maxHorasTurnoOverride ?? laborLimits.maxHorasTurno ?? LEGAL_DEFAULTS_CO.maxHorasTurno,
  };

  const periodoStr = `${year}-${String(month).padStart(2, '0')}`;
  const slotsPerDay = getSlotsPerDay(slotsPorHora);
  const minSlots = Math.max(1, Math.round(limits.minHorasTurno * slotsPorHora));
  const maxSlots = Math.max(minSlots, Math.round(limits.maxHorasTurno * slotsPorHora));

  // ── v5: Headcount objetivo por día ───────────────────────────────────
  // minDia = piso (si no se alcanza, el día se deja vacío y se avisa).
  // maxDia = techo y objetivo (cuántas personas distintas queremos por día).
  // objetivoNoche = personas distintas reservadas a la franja nocturna.
  const parseHeadcount = (v) => {
    const n = parseInt(v, 10);
    return (!isNaN(n) && n > 0) ? n : null;
  };
  const minDia = parseHeadcount(minEmpleadosDia);
  const maxDia = parseHeadcount(maxEmpleadosDia);
  const objetivoNoche = nightConfig ? Math.max(0, nightConfig.minStaff || 0) : 0;
  // Objetivo de personas DIURNAS = techo del día menos las de la noche.
  const objetivoDia = maxDia != null ? Math.max(0, maxDia - objetivoNoche) : null;
  const usaHeadcount = maxDia != null; // si hay techo, usamos la curva como FORMA

  // ── v5: Hora a la que arranca el día (default 04:00, configurable) ────
  const dayStartSlot = Math.max(
    0,
    Math.min(timeToSlot(horaInicioDia || '04:00', slotsPorHora), slotsPerDay - minSlots)
  );

  // ── Días laborables del mes a procesar ───────────────────────────────
  const days = (Array.isArray(diasToProcess) ? diasToProcess : [])
    .map(d => ({
      date: d,
      dateStr: dateToStr(d),
      dayOfWeek: d.getDay() === 0 ? 7 : d.getDay(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }))
    .filter(d => diasTrabajoArea.includes(d.dayOfWeek));

  if (days.length === 0) {
    return { shifts: [], warnings: ['No hay días hábiles en el rango seleccionado. Ajusta los días laborables del área.'] };
  }

  // ── Particionar empleados por jornada efectiva ───────────────────────
  const empByClass = { NIGHT_ONLY: [], DAY_ONLY: [], MIXED: [], ANY: [] };
  employees.forEach(emp => { empByClass[classifyEmployee(emp)].push(emp); });

  // ── Configuración de slots nocturnos ────────────────────────────────
  let nightStartSlot = null, nightEndRaw = null;
  if (nightConfig) {
    nightStartSlot = timeToSlot(nightConfig.start, slotsPorHora); // ej 22:00 -> 88
    nightEndRaw    = timeToSlot(nightConfig.end,   slotsPorHora); // ej 06:00 -> 24
  }
  // Fin de la ventana nocturna en coordenadas "extendidas" (puede pasar
  // de medianoche): ej 22:00 (88) → 06:00 del día siguiente (96+24 = 120).
  const nightEndExt = nightConfig ? slotsPerDay + nightEndRaw : null;

  const safeAbsences = Array.isArray(absences) ? absences : [];
  const safeExisting = Array.isArray(existingShifts) ? existingShifts : [];

  // ── Helpers de validación ────────────────────────────────────────────
  const isBlocked = (empId, dateStr) =>
    safeAbsences.some(a =>
      a.employee_id === empId &&
      a.fecha_inicio <= dateStr &&
      a.fecha_fin >= dateStr
    );

  const hasShiftOnDay = (empId, dateStr) =>
    [...safeExisting, ...generatedShifts].some(
      s => s.employee_id === empId && String(s.start_time).startsWith(dateStr)
    );

  // Horas extra legales permitidas (CST: máx. 12h extra/semana) si el área
  // habilita horas extra; si no, tope estricto en la jornada ordinaria.
  const extrasSemana = permiteExtras ? 12 : 0;
  const getMaxHoursFor = (emp) => {
    let base;
    if (emp.horas_max_semana && emp.horas_max_semana > 0) base = emp.horas_max_semana;
    else {
      const h = parseInt(emp?.horas_semanales_contrato, 10);
      base = (!isNaN(h) && h > 0 && h <= 60) ? h : limits.maxHorasSemanales;
    }
    return base + extrasSemana;
  };

  const getMaxDailyHours = (emp) => {
    if (emp.horas_max_diarias && emp.horas_max_diarias > 0) return parseFloat(emp.horas_max_diarias);
    return limits.maxHorasDiarias;
  };

  const getMaxNightHours = (emp) => {
    if (emp.horas_nocturnas_max_semana && emp.horas_nocturnas_max_semana > 0)
      return parseInt(emp.horas_nocturnas_max_semana, 10);
    return Infinity;
  };

  const shiftHours = (s) => {
    const hrs = (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
    return Math.max(0, hrs - (s.break_minutes || 0) / 60);
  };

  // Horas nocturnas reales (>=19:00 o <06:00) de un turno
  const shiftNightHours = (s) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    let total = 0;
    let cur = new Date(start);
    while (cur < end) {
      const nextHour = new Date(cur);
      nextHour.setMinutes(60, 0, 0);
      const sliceEnd = nextHour > end ? end : nextHour;
      if (isNightHour(cur.getHours())) total += (sliceEnd - cur) / 3600000;
      cur = nextHour;
    }
    return total;
  };

  const weekBounds = (dateObj) => {
    const d = new Date(dateObj);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };

  const getWeeklyHours = (empId, date) => {
    const { monday, sunday } = weekBounds(date);
    return [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .reduce((acc, s) => {
        const sDate = new Date(s.start_time);
        return (sDate >= monday && sDate <= sunday) ? acc + shiftHours(s) : acc;
      }, 0);
  };

  const getWeeklyNightHours = (empId, date) => {
    const { monday, sunday } = weekBounds(date);
    return [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .reduce((acc, s) => {
        const sDate = new Date(s.start_time);
        return (sDate >= monday && sDate <= sunday) ? acc + shiftNightHours(s) : acc;
      }, 0);
  };

  const getDailyHours = (empId, dateStr) =>
    [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId && String(s.start_time).startsWith(dateStr))
      .reduce((acc, s) => acc + shiftHours(s), 0);

  const getLastShiftEndTime = (empId, dateStr) => {
    const prevStr = dateToStr(addDays(parseLocalDate(dateStr), -1)); // ← fix zona horaria
    const prevShifts = [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId && String(s.start_time).startsWith(prevStr));
    if (!prevShifts.length) return null;
    return prevShifts.reduce((latest, s) =>
      new Date(s.end_time) > new Date(latest.end_time) ? s : latest
    ).end_time;
  };

  // ── Cobertura actual por slots de un día ─────────────────────────────
  const getCoverageVector = (dateStr) => {
    const vec = new Array(slotsPerDay).fill(0);
    [...safeExisting, ...generatedShifts].forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const sDateStr = String(s.start_time).split('T')[0];
      const eStr = dateToStr(new Date(s.end_time));
      if (sDateStr === dateStr) {
        const startSlot = timeToSlot(String(s.start_time).split('T')[1].substring(0, 5), slotsPorHora);
        const endSlot = eStr !== dateStr
          ? slotsPerDay
          : timeToSlot(String(s.end_time).split('T')[1].substring(0, 5), slotsPorHora);
        for (let sl = startSlot; sl < Math.min(endSlot, slotsPerDay); sl++) vec[sl]++;
      } else if (eStr === dateStr && sDateStr !== dateStr) {
        const endSlot = timeToSlot(String(s.end_time).split('T')[1].substring(0, 5), slotsPorHora);
        for (let sl = 0; sl < endSlot; sl++) vec[sl]++;
      }
    });
    return vec;
  };

  // ── v5: Turno "típico" en slots (para traducir personas↔person-slots) ──
  // Asumimos que cada persona trabaja una jornada cercana a 8h (acotada por
  // los topes legales). Sirve para repartir el headcount objetivo entre horas.
  const typicalShiftSlots = Math.max(
    minSlots,
    Math.min(maxSlots, Math.round(8 * slotsPorHora))
  );

  // Ventana diurna efectiva (donde aplica el headcount objetivo del día).
  const dayWindowStartGlobal = dayStartSlot;
  const dayWindowEndGlobal = nightConfig ? nightStartSlot : slotsPerDay;

  // ── Cache de demanda CRUDA (curva tal cual, antes de escalar a headcount) ─
  const rawDemandCache = {};
  const getRawDemandVecFor = (dateObj) => {
    const ds = dateToStr(dateObj);
    if (rawDemandCache[ds]) return rawDemandCache[ds];
    const dow = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
    const isWk = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const raw = buildDemandVector(dow, demandSlots, employees.length, isWk, slotsPorHora);
    rawDemandCache[ds] = raw;
    return raw;
  };

  // Suma de la FORMA diurna cruda de un día (person-slots que pide la curva).
  const rawDayShapeSum = (dateObj) => {
    const raw = getRawDemandVecFor(dateObj);
    let s = 0;
    for (let i = dayWindowStartGlobal; i < dayWindowEndGlobal; i++) s += raw[i];
    return s;
  };

  // v5: Escala GLOBAL para headcount. El día de MAYOR demanda cruda alcanza el
  // objetivo (objetivoDia personas); los demás días reciben personal en
  // proporción a SU demanda. Así un día con la mitad de demanda recibe ~la
  // mitad de gente (preserva diferencias entre días, p.ej. fines de semana),
  // y el pico nunca supera el techo. Si la curva es plana entre días, todos
  // los días reciben el mismo objetivo.
  let headcountScale = null;
  if (usaHeadcount && objetivoDia > 0) {
    let peakShape = 0;
    for (const day of days) peakShape = Math.max(peakShape, rawDayShapeSum(day.date));
    if (peakShape > 0) headcountScale = (objetivoDia * typicalShiftSlots) / peakShape;
  }

  // ── Cache de demanda EFECTIVA por fecha (escalada si hay headcount) ─────
  const demandVecCache = {};
  const getDemandVecFor = (dateObj) => {
    const ds = dateToStr(dateObj);
    if (demandVecCache[ds]) return demandVecCache[ds];
    const raw = getRawDemandVecFor(dateObj);

    // Sin headcount objetivo → curva absoluta (comportamiento clásico).
    if (!usaHeadcount || headcountScale == null) {
      // objetivoDia === 0 ⇒ todo el día va a la noche; vaciar la franja diurna.
      if (usaHeadcount && objetivoDia === 0) {
        const z = raw.slice();
        for (let s = dayWindowStartGlobal; s < dayWindowEndGlobal; s++) z[s] = 0;
        demandVecCache[ds] = z;
        return z;
      }
      demandVecCache[ds] = raw;
      return raw;
    }

    // Con headcount: curva como FORMA, escalada por el factor global.
    const v = raw.slice();
    for (let s = dayWindowStartGlobal; s < dayWindowEndGlobal; s++) {
      v[s] = Math.max(0, Math.round(raw[s] * headcountScale));
    }
    demandVecCache[ds] = v;
    return v;
  };

  // ── v5: Peso de demanda total de un día (para ordenar días por prioridad) ─
  const dayDemandWeight = (dateObj) => {
    const vec = getDemandVecFor(dateObj);
    let sum = 0;
    for (let s = 0; s < slotsPerDay; s++) {
      const h = Math.floor(s / slotsPorHora);
      const floor = (nightConfig && isNightHour(h)) ? objetivoNoche : 0;
      sum += Math.max(vec[s] || 0, floor);
    }
    return sum;
  };

  // ── v5: Personas DISTINTAS ya programadas en un día (para el techo maxDia) ─
  const distinctPeopleOnDay = (dateStr) => {
    const ids = new Set();
    [...safeExisting, ...generatedShifts].forEach(s => {
      if (String(s.start_time).startsWith(dateStr)) ids.add(s.employee_id);
    });
    return ids.size;
  };

  // ── Eligibilidad por jornada ─────────────────────────────────────────
  const canWorkNight = (emp) => {
    const cls = classifyEmployee(emp);
    if (cls === 'NIGHT_ONLY' || cls === 'MIXED') return true;
    if (cls === 'DAY_ONLY') return false;
    return nightConfig?.permiteDiaCubrir ?? false; // ANY
  };
  const canWorkDay = (emp) => classifyEmployee(emp) !== 'NIGHT_ONLY';

  // ── FASE 0: Asignar descansos ────────────────────────────────────────
  const restDays = new Set();
  const restsPerDay = {};
  const restsNightPerDay = {};
  // Pool dedicado a la noche (para no dejar la franja nocturna sin gente).
  const dedicadosNoche = new Set([...empByClass.NIGHT_ONLY, ...empByClass.MIXED].map(e => e.id));
  const dedicadosCount = dedicadosNoche.size;
  const minNoche = nightConfig ? nightConfig.minStaff : 0;

  employees.forEach((emp, empIdx) => {
    const esDedicadoNoche = dedicadosNoche.has(emp.id);
    const patronDef = patronRotativo ? PATRONES_ROTATIVOS.find(p => p.value === patronRotativo) : null;
    const requiredRests = patronDef
      ? (patronDef.diasDescanso || 1)
      : (emp.dias_descanso_fijos?.length
          ? emp.dias_descanso_fijos.length
          : (emp.dias_descanso_semana || limits.diasDescansoSemana));
    const cycleLen = patronDef ? ((patronDef.diasTrabajo || 5) + (patronDef.diasDescanso || 2)) : 0;

    const weeks = {};
    days.forEach(day => {
      const { monday } = weekBounds(day.date);
      const weekKey = dateToStr(monday);
      (weeks[weekKey] ||= []).push(day);
    });

    Object.values(weeks).forEach((weekDays, weekIdx) => {
      // No asignar descansos en semanas-borde demasiado cortas: dejarían
      // días sin nadie (artefacto típico al inicio/fin del rango).
      if (weekDays.length <= requiredRests) return;
      // Cap por día: nunca dejar que descanse más de ~1/3 del personal el
      // mismo día (preserva cobertura, incluida la noche).
      const restCap = Math.max(1, Math.floor(employees.length / 3));
      // Tope de descansos de dedicados-noche por día: siempre dejar minStaff.
      const restCapNoche = Math.max(0, dedicadosCount - Math.max(1, minNoche));
      const offset = patronRotativo ? empIdx % (cycleLen || 1) : (weekIdx + empIdx) % 7;
      const sortedByDemand = [...weekDays].sort((a, b) => {
        const sumA = getDemandVecFor(a.date).reduce((s, v) => s + v, 0);
        const sumB = getDemandVecFor(b.date).reduce((s, v) => s + v, 0);
        if (sumA !== sumB) return sumA - sumB;
        return (restsPerDay[a.dateStr] || 0) - (restsPerDay[b.dateStr] || 0);
      });
      // Rotar la preferencia por empleado (offset) para repartir los descansos
      // entre distintos días y no apilar a todos en el mismo día de baja demanda.
      const sorted = sortedByDemand.map((_, i) => sortedByDemand[(i + offset) % sortedByDemand.length]);

      let assigned = 0;
      for (const day of sorted) {
        if (assigned >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue;
        if ((restsPerDay[day.dateStr] || 0) >= restCap) continue;
        if (esDedicadoNoche && (restsNightPerDay[day.dateStr] || 0) >= restCapNoche) continue;
        if (emp.dias_descanso_fijos?.length && !emp.dias_descanso_fijos.includes(day.dayOfWeek)) continue;
        if (patronRotativo && cycleLen > 0) {
          const dayIdx = days.findIndex(d => d.dateStr === day.dateStr);
          if (dayIdx >= 0) {
            const cyclePos = ((dayIdx + offset) % cycleLen + cycleLen) % cycleLen;
            const offThreshold = patronDef ? patronDef.diasTrabajo : cycleLen / 2;
            if (cyclePos < offThreshold) continue;
          }
        }
        restDays.add(`${emp.id}_${day.dateStr}`);
        restsPerDay[day.dateStr] = (restsPerDay[day.dateStr] || 0) + 1;
        if (esDedicadoNoche) restsNightPerDay[day.dateStr] = (restsNightPerDay[day.dateStr] || 0) + 1;
        assigned++;
      }
    });
  });

  // ── Helper genérico: ¿el empleado puede tomar este turno? ────────────
  // `entersNight` = el turno entra en la JORNADA NOCTURNA DEDICADA (la ventana
  // configurada, ej. 22:00-06:00), NO el simple recargo legal desde las 19:00.
  // Así un empleado "solo diurno" SÍ puede cubrir la tarde-noche (19:00-22:00,
  // que paga recargo) y solo la noche dedicada queda reservada al personal
  // nocturno. `nightHrs` (horas con recargo nocturno, desde 19:00) se usa aparte
  // para el tope de horas nocturnas y para marcar el turno como NOCTURNO.
  const employeeEligible = (emp, { startDateStr, startDateObj, startTimeStr, shiftHrs, nightHrs, entersNight }) => {
    if (entersNight && !canWorkNight(emp)) return false;
    if (!entersNight && !canWorkDay(emp)) return false;
    if (isBlocked(emp.id, startDateStr)) return false;
    if (restDays.has(`${emp.id}_${startDateStr}`)) return false;
    if (hasShiftOnDay(emp.id, startDateStr)) return false;
    if (getWeeklyHours(emp.id, startDateObj) + shiftHrs > getMaxHoursFor(emp)) return false;
    if (getDailyHours(emp.id, startDateStr) + shiftHrs > getMaxDailyHours(emp)) return false;
    if (nightHrs > 0 && getWeeklyNightHours(emp.id, startDateObj) + nightHrs > getMaxNightHours(emp)) return false;
    const lastEnd = getLastShiftEndTime(emp.id, startDateStr);
    if (lastEnd) {
      const gapHrs = (new Date(`${startDateStr}T${startTimeStr}`) - new Date(lastEnd)) / 3600000;
      if (gapHrs < limits.minHorasEntreJornadas) return false;
    }
    return true;
  };

  // Hash determinista (sin Math.random) para rotar asignaciones de slot.
  const slotHash = (id, key) => {
    let x = 0;
    const str = `${id}|${key}`;
    for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
    return x;
  };

  const pickCandidate = (pool, ctx, startDateObj) => {
    const candidates = pool.filter(emp => employeeEligible(emp, ctx));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      if (estrategia === 'EMPLOYEE_PREF') {
        if (a.solo_nocturno !== b.solo_nocturno) return a.solo_nocturno ? -1 : 1;
        if (a.solo_diurno !== b.solo_diurno) return a.solo_diurno ? -1 : 1;
      }
      // Reparto equitativo: el de menos horas semanales primero.
      const wa = getWeeklyHours(a.id, startDateObj);
      const wb = getWeeklyHours(b.id, startDateObj);
      if (Math.abs(wa - wb) > 0.01) return wa - wb;
      // Empate: si rotarSlots, variar quién toma cada franja (no siempre el
      // mismo); si no, orden estable.
      if (rotarSlots && ctx?.startTimeStr) {
        return slotHash(a.id, ctx.startTimeStr) - slotHash(b.id, ctx.startTimeStr);
      }
      return 0;
    });
    return candidates[0];
  };

  // ── FASE 1: Cobertura NOCTURNA (ventana nightStart → nightEnd) ───────
  // Greedy de bloques nocturnos de duración variable. Cubre el valle y el
  // pico de madrugada con el MENOR número de personas, garantizando minStaff.
  if (nightConfig) {
    // Pool nocturno: prioridad a lista explícita del área, luego
    // dedicados (NIGHT_ONLY + MIXED). Fallback a ANY si no son
    // suficientes o si el área NO exige dedicados (para no dejar la noche
    // descubierta en 24/7).
    const nightPool = [];
    if (nightConfig.employeeIds?.length) {
      employees.forEach(e => {
        if (nightConfig.employeeIds.includes(e.id) && !nightPool.includes(e)) nightPool.push(e);
      });
    }
    const dedicados = [...empByClass.NIGHT_ONLY, ...empByClass.MIXED];
    dedicados.forEach(e => { if (!nightPool.includes(e)) nightPool.push(e); });
    const baseInsuficiente = nightPool.length < nightConfig.minStaff || nightPool.length === 0;
    if (nightConfig.permiteDiaCubrir || !nightConfig.soloDedicados || baseInsuficiente) {
      empByClass.ANY.forEach(e => { if (!nightPool.includes(e)) nightPool.push(e); });
    }
    // Si NADIE puede cubrir la noche (todos marcados solo diurno), avisar de
    // forma accionable: es una operación 24/7 sin personal nocturno posible.
    if (nightPool.length === 0) {
      warnings.push(
        'No hay empleados habilitados para la noche en esta área 24/7. ' +
        'Marca al menos a algunos como "Nocturna" o "Cualquiera" (jornada preferida) en Personal, ' +
        'o activa "permitir que diurnos cubran la noche" en el área.'
      );
    }

    // Coloca UN bloque nocturno óptimo para `day`. Devuelve true si lo logró.
    const placeOneNightBlock = (day) => {
      const dNextObj = addDays(day.date, 1);
      const dNextStr = dateToStr(dNextObj);
      const demD = getDemandVecFor(day.date);
      const demN = getDemandVecFor(dNextObj);
      const covD = getCoverageVector(day.dateStr);
      const covN = getCoverageVector(dNextStr);
      const nightVal = (i) => {
        const onNext = i >= slotsPerDay;
        const localSlot = i - (onNext ? slotsPerDay : 0);
        const dem = Math.max((onNext ? demN : demD)[localSlot] || 0, nightConfig.minStaff);
        const cov = (onNext ? covN : covD)[localSlot] || 0;
        return { dem, cov, def: Math.max(0, dem - cov) };
      };

      let best = null;
      for (let start = nightStartSlot; start + minSlots <= nightEndExt; start += snapSlots) {
        const tope = Math.min(start + maxSlots, nightEndExt);
        let dur = minSlots;
        for (let s = start + minSlots; s < tope; s += snapSlots) {
          let d = 0;
          for (let k = 0; k < snapSlots && (s + k) < tope; k++) d += nightVal(s + k).def;
          if (d > 0) dur = (s - start) + snapSlots;
        }
        dur = Math.max(minSlots, Math.min(dur, nightEndExt - start, maxSlots));

        let score = 0;
        for (let s = start; s < start + dur; s++) {
          const v = nightVal(s);
          score += v.def;
          if (v.cov >= v.dem) score -= 0.3;
        }
        if (!best || score > best.score) best = { start, dur, score };
      }
      if (!best || best.score <= 0) return false;

      const startOnNext = best.start >= slotsPerDay;
      const startDateObj = startOnNext ? dNextObj : day.date;
      const startDateStr = startOnNext ? dNextStr : day.dateStr;
      const startTimeStr = slotToTime(best.start % slotsPerDay, slotsPorHora);
      const endExt = best.start + best.dur;
      const endDateStr = endExt >= slotsPerDay ? dNextStr : day.dateStr;
      const endTimeStr = slotToTime(endExt % slotsPerDay, slotsPorHora);
      const shiftHrs = best.dur / slotsPorHora;

      // v5: Techo de personas/día. No superar maxEmpleadosDia en el día donde
      // se contabiliza al trabajador (su fecha de inicio).
      if (maxDia != null && distinctPeopleOnDay(startDateStr) >= maxDia) return false;

      const proposed = { start_time: `${startDateStr}T${startTimeStr}`, end_time: `${endDateStr}T${endTimeStr}` };
      const nightHrs = shiftNightHours(proposed);

      const candidate = pickCandidate(nightPool, {
        startDateStr, startDateObj, startTimeStr, shiftHrs, nightHrs, entersNight: true,
      }, startDateObj);
      if (!candidate) return false;

      generatedShifts.push({
        employee_id: candidate.id,
        template_id: null,
        start_time: proposed.start_time,
        end_time: proposed.end_time,
        shift_type: 'night',
        periodo: periodoStr,
        break_minutes: 0,
        shift_kind: 'NOCTURNO',
        bloque: 1,
        disponibilidad: false,
        recargo_porcentaje: 0,
        observaciones: `Auto-asignado v4.1 · Turno nocturno ${startTimeStr}-${endTimeStr} (cobertura 24/7)`,
      });
      return true;
    };

    // v5: Cobertura nocturna BREADTH-FIRST por demanda. En cada vuelta
    // colocamos a lo sumo 1 bloque por noche, recorriendo los días de MAYOR a
    // MENOR demanda. Así garantizamos el PISO nocturno (minStaff) en TODAS las
    // noches antes de saturar una sola — la noche es un mínimo que no debe
    // concentrarse. Si la capacidad se agota, las noches de MENOR demanda son
    // las que quedan descubiertas (mismo criterio que el día).
    const nightDaysSorted = [...days].sort((a, b) => dayDemandWeight(b.date) - dayDemandWeight(a.date));
    let progress = true;
    let rounds = 0;
    const MAX_ROUNDS = 60;
    while (progress && rounds < MAX_ROUNDS) {
      progress = false;
      rounds++;
      for (const day of nightDaysSorted) {
        if (placeOneNightBlock(day)) progress = true;
      }
    }

    // Advertencias de cobertura nocturna por día.
    for (const day of days) {
      const dNextStr = dateToStr(addDays(day.date, 1));
      const demD = getDemandVecFor(day.date);
      const demN = getDemandVecFor(addDays(day.date, 1));
      const covDfin = getCoverageVector(day.dateStr);
      const covNfin = getCoverageVector(dNextStr);
      let nightDeficit = 0;
      for (let i = nightStartSlot; i < nightEndExt; i++) {
        const onNext = i >= slotsPerDay;
        const localSlot = i - (onNext ? slotsPerDay : 0);
        const dem = Math.max((onNext ? demN : demD)[localSlot] || 0, nightConfig.minStaff);
        const cov = (onNext ? covNfin : covDfin)[localSlot] || 0;
        nightDeficit += Math.max(0, dem - cov);
      }
      if (nightDeficit > 0) {
        warnings.push(`${day.dateStr}: cobertura nocturna incompleta (faltan ~${Math.round(nightDeficit / slotsPorHora)} horas-persona). Pool nocturno insuficiente.`);
      }
    }
  }

  // ── FASE 2: Cobertura DIURNA (horaInicioDia → nightStart, o jornada oficina) ─
  if (modoOperacion === 'OFICINA' || is24x7) {
    const dayPool = [...empByClass.DAY_ONLY, ...empByClass.MIXED, ...empByClass.ANY];

    // Demanda efectiva diurna: en 24/7 garantizamos al menos 1 en la ventana diurna.
    const dayMinFloor = is24x7 ? 1 : 0;
    // v5: la ventana diurna arranca en horaInicioDia (default 04:00, configurable).
    const dayWindowStart = dayStartSlot;
    const dayWindowEnd = nightConfig ? nightStartSlot : slotsPerDay;

    // v5: BREADTH-FIRST por demanda. En cada vuelta añadimos a lo sumo 1 turno
    // por día, recorriendo los días de MAYOR a MENOR demanda. Reparte la
    // capacidad finita (acotada por topes semanales) de forma eficiente y, si
    // escasea, sirve primero a los días de mayor demanda. Los días que igual
    // queden por debajo del piso (minEmpleadosDia) se vacían por completo en la
    // FASE 3.5 → política "mejor un día entero vacío que muchos días con huecos".
    const daysSorted = [...days].sort((a, b) => dayDemandWeight(b.date) - dayDemandWeight(a.date));

    let changed = true;
    let iterations = 0;
    const MAX_ITER = days.length * 45 + 10;

    while (changed && iterations < MAX_ITER) {
      changed = false;
      iterations++;

      for (const day of daysSorted) {
          // v5: no superar el techo de personas distintas/día.
          if (maxDia != null && distinctPeopleOnDay(day.dateStr) >= maxDia) continue;
          const demVec = getDemandVecFor(day.date);
          const covVec = getCoverageVector(day.dateStr);
          const effDem = (s) => Math.max(demVec[s] || 0, (s >= dayWindowStart && s < dayWindowEnd) ? dayMinFloor : 0);
          const defVec = new Array(slotsPerDay).fill(0);
          for (let s = dayWindowStart; s < dayWindowEnd; s++) defVec[s] = Math.max(0, effDem(s) - covVec[s]);
          const totalDeficit = defVec.reduce((s, v) => s + v, 0);
          if (totalDeficit === 0) continue;

          // ── v4.2: Puntuar STARTS CANÓNICOS primero (variedad de horarios) ──
          // Convertir los starts canónicos a slots y priorizar los que tienen
          // mayor déficit. Esto genera 12+ horarios distintos vs el bucle
          // exhaustivo que producía siempre los mismos 4 horarios.
          const earlyDeficit = defVec.slice(dayWindowStart, 9 * slotsPorHora).reduce((a, b) => a + b, 0);
          const lateDeficit = defVec.slice(Math.max(dayWindowStart, 13 * slotsPorHora), dayWindowEnd).reduce((a, b) => a + b, 0);

          // Candidatos: primero los starts canónicos dentro de la ventana diurna.
          const canonicalSlots = CANONICAL_DAY_STARTS
            .map(([h, m]) => h * slotsPorHora + Math.floor(m / (60 / slotsPorHora)))
            .filter(s => s >= dayWindowStart && s <= dayWindowEnd - minSlots);

          // También incluir el bucle de snapSlots como fallback
          // para no perder granularidad en áreas con demanda muy específica.
          const allCandidateStarts = new Set(canonicalSlots);
          for (let s = dayWindowStart; s <= dayWindowEnd - minSlots; s += snapSlots) {
            allCandidateStarts.add(s);
          }

          const scored = [];
          for (const start of allCandidateStarts) {
            const tope = Math.min(start + maxSlots, dayWindowEnd);
            let score = 0;
            for (let s = start; s < tope; s++) {
              score += defVec[s];
              if (covVec[s] >= effDem(s)) score -= 0.3;
            }
            // Bonus por start canónico (preferir horarios naturales sobre snapSlots intermedios)
            if (canonicalSlots.includes(start)) score += 0.5;
            if (start < 9 * slotsPorHora && earlyDeficit > 0) score += earlyDeficit * 0.5;
            if (start >= 16 * slotsPorHora && lateDeficit > 0) score += lateDeficit * 0.5;
            if (score > 0) scored.push({ start, score });
          }
          scored.sort((a, b) => b.score - a.score);

          // Colocar en el mejor start FACTIBLE. No romper al primero sin
          // candidato: probar los siguientes y, si el turno toca la franja
          // nocturna y no hay quien la cubra, truncarlo al borde (solo-diurno).
          const nightStartLegal = dayWindowEnd;
          let placed = false;
          for (const { start } of scored) {
            const tope = Math.min(start + maxSlots, dayWindowEnd);
            let duration = minSlots;
            for (let s = start + minSlots; s < tope; s += snapSlots) {
              let def = 0;
              for (let k = 0; k < snapSlots && (s + k) < tope; k++) def += defVec[s + k];
              if (def > 0) duration = s - start + snapSlots;
            }
            duration = Math.max(minSlots, Math.min(duration, tope - start));

            const variants = [duration];
            if (start + duration > nightStartLegal && start < nightStartLegal && (nightStartLegal - start) >= minSlots) {
              variants.push(nightStartLegal - start); // versión que NO toca la noche
            }

            for (const dur of variants) {
              const startTimeStr = slotToTime(start, slotsPorHora);
              const endTimeStr = slotToTime(start + dur, slotsPorHora);
              const shiftHrs = dur / slotsPorHora;
              const proposed = {
                start_time: `${day.dateStr}T${startTimeStr}`,
                end_time: `${day.dateStr}T${endTimeStr}`,
              };
              const nightHrs = shiftNightHours(proposed);
              // ¿El turno entra en la jornada nocturna DEDICADA (ventana
              // configurada)? Si solo toca el recargo (19:00-nightStart), NO la
              // entra → un diurno puede cubrir la tarde-noche. Cálculo por slots
              // (sin Date) para evitar desfases de zona horaria.
              const entersNight = nightConfig
                ? (start < nightEndRaw || (start + dur) > nightStartSlot)
                : false;
              const candidate = pickCandidate(dayPool, {
                startDateStr: day.dateStr, startDateObj: day.date, startTimeStr,
                shiftHrs, nightHrs, entersNight,
              }, day.date);
              if (!candidate) continue;

              generatedShifts.push({
                employee_id: candidate.id,
                template_id: null,
                start_time: proposed.start_time,
                end_time: proposed.end_time,
                shift_type: 'custom',
                periodo: periodoStr,
                break_minutes: shiftHrs >= 6 ? 30 : 0,
                shift_kind: nightHrs > 0 ? 'NOCTURNO' : 'STANDARD',
                bloque: 1,
                disponibilidad: false,
                recargo_porcentaje: 0,
                observaciones: `Auto-asignado v5 · Slot ${startTimeStr}-${endTimeStr}${nightHrs > 0 ? ' (con recargo nocturno)' : ''} · ${estrategia}`,
              });
              changed = true;
              placed = true;
              break;
            }
            if (placed) break;
          }
          // Si no se pudo colocar nada en este día, seguimos con el siguiente.
      }
    }
  }

  // ── FASE 3: Refill con templates (PARTIDO, ROTATIVO, etc.) ───────────
  if (Array.isArray(templates) && templates.length > 0) {
    let tplChanged = true;
    let tplIter = 0;
    const MAX_TPL_ITER = employees.length * days.length + 10;
    while (tplChanged && tplIter < MAX_TPL_ITER) {
      tplChanged = false;
      tplIter++;
      for (const day of days) {
        for (const tpl of templates) {
          if (!tpl.hora_inicio || !tpl.hora_fin) continue;
          if (tpl.shift_kind === 'PARTIDO' && !permitePartidos) continue;

          const covVec = getCoverageVector(day.dateStr);
          const demVec = getDemandVecFor(day.date);
          const tplStart = timeToSlot(tpl.hora_inicio, slotsPorHora);
          // FIX: calcular correctamente el end slot para templates que cruzan medianoche
          const tplEnd = tpl.cruza_medianoche
            ? slotsPerDay + timeToSlot(tpl.hora_fin, slotsPorHora)
            : timeToSlot(tpl.hora_fin, slotsPorHora);

          let totalDeficit = 0;
          for (let s = tplStart; s < tplEnd && s < slotsPerDay; s++) {
            const slotIdx = s >= slotsPerDay ? s - slotsPerDay : s;
            totalDeficit += Math.max(0, demVec[slotIdx] - covVec[slotIdx]);
          }
          if (tpl.shift_kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            const t2s = timeToSlot(tpl.hora_inicio_2, slotsPorHora);
            const t2e = timeToSlot(tpl.hora_fin_2, slotsPorHora);
            for (let s = t2s; s < t2e; s++) totalDeficit += Math.max(0, demVec[s] - covVec[s]);
          }
          if (totalDeficit <= 0) continue;

          // Calcular horas del template considerando cruce de medianoche
          let tplHrs;
          if (tpl.cruza_medianoche) {
            tplHrs = ((slotsPerDay - tplStart) + timeToSlot(tpl.hora_fin, slotsPorHora)) / slotsPorHora;
          } else {
            tplHrs = (tplEnd - tplStart) / slotsPorHora;
          }
          if (tpl.shift_kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            tplHrs += (timeToSlot(tpl.hora_fin_2, slotsPorHora) - timeToSlot(tpl.hora_inicio_2, slotsPorHora)) / slotsPorHora;
          }
          if (tplHrs < limits.minHorasTurno) continue;

          const nextDay = dateToStr(addDays(day.date, 1));
          const blocks = expandTemplateToShifts(tpl, day.dateStr, nextDay);
          const nightHrs = blocks.reduce((a, b) => a + shiftNightHours(b), 0);
          // ¿La plantilla entra en la jornada nocturna DEDICADA? (no solo recargo)
          const tplEntersNight = nightConfig
            ? (tplStart < nightEndRaw || tplEnd > nightStartSlot)
            : false;

          const candidate = pickCandidate(employees, {
            startDateStr: day.dateStr, startDateObj: day.date,
            startTimeStr: tpl.hora_inicio, shiftHrs: tplHrs, nightHrs,
            entersNight: tplEntersNight,
          }, day.date);
          if (!candidate) continue;

          blocks.forEach(b => {
            generatedShifts.push({
              employee_id: candidate.id,
              template_id: tpl.id,
              start_time: b.start_time,
              end_time: b.end_time,
              shift_type: 'custom',
              periodo: periodoStr,
              break_minutes: b.break_minutes,
              shift_kind: b.shift_kind,
              bloque: b.bloque,
              disponibilidad: b.disponibilidad,
              recargo_porcentaje: b.recargo_porcentaje,
              observaciones: `Auto-asignado v4.1 · ${tpl.nombre} (${tpl.shift_kind})`,
            });
          });
          tplChanged = true;
        }
      }
    }
  }

  // ── FASE 3.5 (v5): Aplicar el PISO de personas/día (minEmpleadosDia) ──
  // Política del usuario: preferir un día COMPLETAMENTE vacío a varios días
  // con huecos. Si un día no alcanza el piso mínimo de personas, se vacía por
  // completo (sus turnos generados se quitan, liberando capacidad) y se avisa
  // con el nombre del día. Procesamos de MENOR a MAYOR demanda: los días flojos
  // se sacrifican primero, protegiendo los días de mayor demanda.
  const diasSinCobertura = [];
  if (minDia != null) {
    const daysByDemandAsc = [...days].sort((a, b) => dayDemandWeight(a.date) - dayDemandWeight(b.date));
    let huboVaciado = true;
    let pases = 0;
    while (huboVaciado && pases < days.length + 1) {
      huboVaciado = false;
      pases++;
      for (const day of daysByDemandAsc) {
        if (diasSinCobertura.includes(day.dateStr)) continue;
        const personas = distinctPeopleOnDay(day.dateStr);
        if (personas > 0 && personas < minDia) {
          for (let i = generatedShifts.length - 1; i >= 0; i--) {
            if (String(generatedShifts[i].start_time).startsWith(day.dateStr)) {
              generatedShifts.splice(i, 1);
            }
          }
          diasSinCobertura.push(day.dateStr);
          warnings.push(
            `${day.dateStr} (${nombreDia(day.date)}): sin trabajadores disponibles — ` +
            `no se alcanza el mínimo de ${minDia} personas (solo ${personas}). ` +
            `Día dejado sin cubrir para priorizar los días de mayor demanda.`
          );
          huboVaciado = true;
        }
      }
    }
  }

  // ── FASE 4: Balanceo de carga SEMANAL (reasignación real) ────────────
  // v4.2: En lugar de solo advertir, intenta MOVER turnos de empleados
  // sobrecargados a empleados subcargados compatibles. Si no puede mover,
  // emite advertencia como antes.
  if (balancearCarga && generatedShifts.length > 0) {
    const maxDiff = 4;      // tolerancia en horas sobre la media semanal
    const MAX_REBALANCE_PASSES = 3; // máx intentos de rebalanceo por semana

    const weekKeys = new Set();
    days.forEach(day => weekKeys.add(dateToStr(weekBounds(day.date).monday)));

    weekKeys.forEach(weekKey => {
      const refDate = parseLocalDate(weekKey);
      const { monday, sunday } = weekBounds(refDate);

      for (let pass = 0; pass < MAX_REBALANCE_PASSES; pass++) {
        const horasPorEmp = employees
          .map(emp => ({ emp, h: getWeeklyHours(emp.id, refDate) }))
          .filter(x => x.h > 0)
          .sort((a, b) => b.h - a.h); // mayor a menor

        if (horasPorEmp.length < 2) break;
        const avg = horasPorEmp.reduce((a, x) => a + x.h, 0) / horasPorEmp.length;

        const sobrecargados = horasPorEmp.filter(x => x.h > avg + maxDiff);
        if (sobrecargados.length === 0) break; // ya balanceado

        let huboCambio = false;

        for (const { emp: empSobre } of sobrecargados) {
          // Buscar turnos generados de este empleado en esta semana
          const turnosSobre = generatedShifts.filter(s => {
            if (s.employee_id !== empSobre.id) return false;
            const sd = new Date(s.start_time);
            return sd >= monday && sd <= sunday;
          });

          for (const turno of turnosSobre) {
            // Calcular horas del turno
            const turnoHrs = shiftHours(turno);
            const turnoDateStr = String(turno.start_time).slice(0, 10);
            const turnoStartStr = String(turno.start_time).slice(11, 16);
            // ¿El turno entra en la jornada nocturna DEDICADA? (no solo recargo)
            const tEndStr = String(turno.end_time).slice(11, 16);
            const tCrosses = String(turno.end_time).slice(0, 10) !== turnoDateStr;
            const tStartSlot = timeToSlot(turnoStartStr, slotsPorHora);
            const tEndSlot = (tCrosses ? slotsPerDay : 0) + timeToSlot(tEndStr, slotsPorHora);
            const turnoEntersNight = nightConfig
              ? (tStartSlot < nightEndRaw || tEndSlot > nightStartSlot)
              : false;

            // Buscar receptor: empleado con menos horas, que pueda hacer este turno
            const subcargados = employees
              .filter(e => e.id !== empSobre.id)
              .map(e => ({ e, h: getWeeklyHours(e.id, refDate) }))
              .filter(({ h }) => h < avg - 1) // solo si realmente tiene menos horas
              .sort((a, b) => a.h - b.h);    // menor primero

            let receptor = null;
            for (const { e } of subcargados) {
              // Verificar que el receptor pueda hacer este turno
              if (!employeeEligible(e, {
                startDateStr: turnoDateStr,
                startDateObj: new Date(turno.start_time),
                startTimeStr: turnoStartStr,
                shiftHrs: turnoHrs,
                nightHrs: shiftNightHours(turno),
                entersNight: turnoEntersNight,
              })) continue;
              receptor = e;
              break;
            }

            if (receptor) {
              // Reasignar: cambiar employee_id del turno generado
              turno.employee_id = receptor.id;
              turno.observaciones = (turno.observaciones || '') +
                ` [Rebalanceado desde ${empSobre.nombre || empSobre.id} → ${receptor.nombre || receptor.id}]`;
              huboCambio = true;
              break; // un turno por empleado por pase, para no sobrecorregir
            }
          }
          if (huboCambio) break; // reiniciar el pase con nuevas horas calculadas
        }

        if (!huboCambio) break; // no hubo progreso, salir
      }

      // Advertir los casos que NO se pudieron rebalancear
      const horasFinales = employees
        .map(emp => ({ emp, h: getWeeklyHours(emp.id, refDate) }))
        .filter(x => x.h > 0);
      if (horasFinales.length === 0) return;
      const avgFinal = horasFinales.reduce((a, x) => a + x.h, 0) / horasFinales.length;
      horasFinales
        .filter(x => x.h > avgFinal + maxDiff)
        .forEach(x => {
          warnings.push(
            `Semana ${weekKey} · ${x.emp.nombre || 'Empleado'}: ${x.h.toFixed(1)}h ` +
            `(media ${avgFinal.toFixed(1)}h) — desbalance residual tras rebalanceo automático.`
          );
        });
    });
  }

  // ── Advertencias finales de cobertura ────────────────────────────────
  // Los días vaciados a propósito por el piso (minEmpleadosDia) ya tienen su
  // aviso "sin trabajadores disponibles"; no repetir el déficit horario.
  days.forEach(day => {
    if (diasSinCobertura.includes(day.dateStr)) return;
    const covVec = getCoverageVector(day.dateStr);
    const demVec = getDemandVecFor(day.date);
    let totalDef = 0;
    for (let s = 0; s < slotsPerDay; s++) totalDef += Math.max(0, demVec[s] - covVec[s]);
    if (totalDef > 0) {
      warnings.push(`${day.dateStr}: déficit de ${Math.round(totalDef / slotsPorHora)} horas-persona sin cubrir.`);
    }
  });

  employees.forEach(emp => {
    if (!generatedShifts.some(s => s.employee_id === emp.id)) {
      warnings.push(`${emp.nombre || 'Empleado'}: sin turnos asignados en el período.`);
    }
  });

  return { shifts: generatedShifts, warnings };
}
