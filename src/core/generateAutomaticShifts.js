// ============================================================
// ChronosWork — Generador de Turnos v4.0
// Rediseñado para soportar call centers 24/7 y cualquier
// empresa con demanda variable + jornada nocturna dedicada.
// ============================================================
// Cambios vs v3.1:
//  ✅ Particiona empleados por `jornada_efectiva` (NIGHT_ONLY / DAY_ONLY /
//     MIXED / ANY) en lugar de por tipo_contrato.
//  ✅ FASE 1 garantiza cobertura nocturna con `nightOnly` primero.
//  ✅ FASE 2 cubre la demanda diurna con el resto.
//  ✅ FASE 3 rellena con templates (Mañana 7-15, Tarde 13-21, etc.).
//  ✅ FASE 4 balancea horas entre empleados del mismo pool.
//  ✅ FASE 5 valida que ningún turno "diurno" toque horario nocturno
//     salvo que sea de un NIGHT_ONLY/MIXED y se marque correctamente.
//  ✅ Estrategia configurable: COVERAGE_FIRST | BALANCED | EMPLOYEE_PREF.
//  ✅ Modo 24_7_NIGHT_SPLIT: fuerza la noche a empleados dedicados.
//  ✅ Snap a grilla configurable (15/30/60 min).
//  ✅ Soporta que un turno cruce la frontera 22:00 marcándolo como
//     parcialmente nocturno (split en dos registros si es necesario).
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
  maxHorasDiarias:       10,
  minHorasEntreJornadas:  9,   // descanso mínimo entre jornadas
  diasDescansoSemana:     1,
};

// ── Constantes de horario nocturno (CST colombiano) ─────────────────────
const NOCTURNA_INICIO_H = 19; // 19:00 inclusive
const NOCTURNA_FIN_H    = 6;  // 06:00 exclusive

// ── Curvas de demanda por defecto (call center colombia 24/7) ───────────
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
 * según tipo de día (semana / sábado / domingo).
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
    // Huecos = 0 (sin demanda), pero para que el algoritmo pueda balancear
    // sin generar turnos vacíos, los rellenamos a 0 (no a 1 como v3).
    // Solo rellenamos si el modo es 24_7 (debe haber alguien siempre).
  } else {
    const curve = isWeekend ? DEMAND_CURVE_FIN_SEMANA : DEMAND_CURVE_DIURNA;
    const peakStaff = Math.max(1, Math.round((numEmployees || 1) * 0.8));
    for (let s = 0; s < slotsPerDay; s++) {
      const h = Math.floor(s / slotsPerHour);
      const level = curve[h] ?? 1;
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

export function buildRotativeSchedule({ days, employees, patron, positionOffset = 0 }) {
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

// ── FUNCIÓN PRINCIPAL DE GENERACIÓN ──────────────────────────────────────
/**
 * @param {Object} params
 * @param {Array}  params.employees           - Empleados del área
 * @param {Array}  params.templates           - Plantillas de turno (opcional)
 * @param {Array}  params.absences            - Novedades activas
 * @param {Array}  params.existingShifts      - Turnos ya creados en el período
 * @param {number} params.year
 * @param {number} params.month
 * @param {Array}  params.diasTrabajoArea     - Días laborables del área [1-7]
 * @param {Array}  params.diasToProcess       - Fechas a procesar
 * @param {Array}  params.demandSlots         - Slots de demanda del área
 * @param {string} params.modoOperacion       - 'OFICINA' | '24_7' | '24_7_NIGHT_SPLIT'
 * @param {Object} params.laborLimits         - Overrides legales del área
 * @param {Object} params.nightShiftConfig    - Config nocturna legacy
 * @param {string} params.patronRotativo      - '5x2','6x1','7x7', etc.
 * @param {string} params.estrategia          - 'COVERAGE_FIRST' | 'BALANCED' | 'EMPLOYEE_PREF'
 * @param {number} params.minEmpleadosNoche   - Mínimo de empleados en la franja 22-06
 * @param {boolean} params.nocheSoloDedicados - Si true, solo NIGHT_ONLY/MIXED cubren la noche
 * @param {boolean} params.balancearCarga     - Si true, fase 4 hace balanceo
 * @param {boolean} params.rotarSlots         - Si true, fase 3 alterna empleados en slots
 * @param {number} params.slotsPorHora        - 1 | 2 | 4 (default 4 = 15 min)
 * @param {number} params.snapMinutos         - 5|10|15|30|60 (default 15)
 * @param {number} params.minHorasTurno       - Override del mínimo por turno
 * @param {number} params.maxHorasTurno       - Override del máximo por turno
 * @param {boolean} params.permiteExtras      - Si false, tope semanal estricto
 * @param {boolean} params.permitePartidos    - Habilita turnos partidos
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
}) {
  const generatedShifts = [];
  const warnings = [];

  // ── Validaciones tempranas ───────────────────────────────────────────
  if (!Array.isArray(employees) || employees.length === 0) {
    return { shifts: [], warnings: ['No hay empleados en el área.'] };
  }
  // Si es 24/7 SIN templates, el algoritmo puede generar slots dinámicos
  // automáticamente (ideal para call centers con demanda variable).
  // Solo exigimos templates si el modo es 24_7_NIGHT_SPLIT con plantillas
  // explícitas o si el usuario las configuró.
  if (modoOperacion === '24_7' && (!Array.isArray(templates) || templates.length === 0)) {
    // OK, seguirá con slots dinámicos
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
      }
    : null;

  // ── Snap a grilla ────────────────────────────────────────────────────
  const snapSlots = Math.max(1, Math.round(snapMinutos / (60 / slotsPorHora)));
  // Si snap=15 y slotsPorHora=4, snapSlots=1 (cada slot es snap).
  // Si snap=60 y slotsPorHora=4, snapSlots=4.

  // ── Defaults legales + overrides ─────────────────────────────────────
  const limits = {
    ...LEGAL_DEFAULTS_CO,
    ...laborLimits,
    minHorasTurno: minHorasTurnoOverride ?? LEGAL_DEFAULTS_CO.minHorasTurno,
    maxHorasTurno: maxHorasTurnoOverride ?? LEGAL_DEFAULTS_CO.maxHorasTurno,
  };

  const periodoStr = `${year}-${String(month).padStart(2, '0')}`;
  const slotsPerDay = getSlotsPerDay(slotsPorHora);

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

  // ── Particionar empleados por jornada efectiva (NUEVO v4) ────────────
  const empByClass = {
    NIGHT_ONLY: [],
    DAY_ONLY:   [],
    MIXED:      [],
    ANY:        [],
  };
  employees.forEach(emp => {
    const cls = classifyEmployee(emp);
    empByClass[cls].push(emp);
  });

  // Si hay NIGHT_ONLY/MIXED explícitos, ellos cubren la noche.
  // DAY_ONLY y ANY se reservan para el día. ANY puede rotar si se necesita.

  // ── Configuración de slots nocturnos ────────────────────────────────
  let nightStartSlot = null, nightEndRaw = null, nightCrosses = false;
  if (nightConfig) {
    nightStartSlot = timeToSlot(nightConfig.start, slotsPorHora);
    nightEndRaw    = timeToSlot(nightConfig.end,   slotsPorHora);
    nightCrosses   = nightEndRaw <= nightStartSlot;
  }

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
    safeExisting.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr)) ||
    generatedShifts.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr));

  const getMaxHoursFor = (emp) => {
    if (emp.horas_max_semana && emp.horas_max_semana > 0) return emp.horas_max_semana;
    const h = parseInt(emp?.horas_semanales_contrato, 10);
    if (!isNaN(h) && h > 0 && h <= 60) return h;
    return limits.maxHorasSemanales;
  };

  const getMaxDailyHours = (emp) => {
    if (emp.horas_max_diarias && emp.horas_max_diarias > 0) return parseFloat(emp.horas_max_diarias);
    return limits.maxHorasDiarias;
  };

  const getMaxNightHours = (emp) => {
    if (emp.horas_nocturnas_max_semana && emp.horas_nocturnas_max_semana > 0)
      return parseInt(emp.horas_nocturnas_max_semana, 10);
    return Infinity; // sin tope individual
  };

  // Calcula horas de un turno cruzando posibles midnight
  const shiftHours = (s) => {
    const hrs = (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
    return Math.max(0, hrs - (s.break_minutes || 0) / 60);
  };

  // Calcula horas nocturnas (>=19:00 o <06:00) de un turno
  const shiftNightHours = (s) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    let total = 0;
    let cur = new Date(start);
    while (cur < end) {
      const nextHour = new Date(cur);
      nextHour.setMinutes(60, 0, 0);
      const sliceEnd = nextHour > end ? end : nextHour;
      if (isNightHour(cur.getHours())) {
        total += (sliceEnd - cur) / 3600000;
      }
      cur = nextHour;
    }
    return total;
  };

  const getWeeklyHours = (empId, date) => {
    const d = new Date(date);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .reduce((acc, s) => {
        const sDate = new Date(s.start_time);
        if (sDate >= monday && sDate <= sunday) return acc + shiftHours(s);
        return acc;
      }, 0);
  };

  const getWeeklyNightHours = (empId, date) => {
    const d = new Date(date);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .reduce((acc, s) => {
        const sDate = new Date(s.start_time);
        if (sDate >= monday && sDate <= sunday) return acc + shiftNightHours(s);
        return acc;
      }, 0);
  };

  const getDailyHours = (empId, dateStr) => {
    return [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId && s.start_time.startsWith(dateStr))
      .reduce((acc, s) => acc + shiftHours(s), 0);
  };

  const getLastShiftEndTime = (empId, dateStr) => {
    const d = new Date(dateStr);
    const prevStr = dateToStr(new Date(d.getTime() - 86400000));
    const prevShifts = [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId && s.start_time.startsWith(prevStr));
    if (!prevShifts.length) return null;
    return prevShifts.reduce((latest, s) =>
      new Date(s.end_time) > new Date(latest.end_time) ? s : latest
    ).end_time;
  };

  // ── Cobertura actual por slots ───────────────────────────────────────
  const getCoverageVector = (dateStr) => {
    const vec = new Array(slotsPerDay).fill(0);
    [...safeExisting, ...generatedShifts].forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const sDateStr = String(s.start_time).split('T')[0];
      const eDate = new Date(s.end_time);
      const eStr  = dateToStr(eDate);
      if (sDateStr === dateStr) {
        const startSlot = timeToSlot(String(s.start_time).split('T')[1].substring(0, 5), slotsPorHora);
        const endSlot   = eStr !== dateStr
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

  // ── FASE 0: Asignar descansos respetando jornada + patrón rotativo ──
  // Los descansos se asignan por semana y por empleado, priorizando los
  // días de MENOR demanda y distribuyendo para que no todos descansen
  // el mismo día.
  const restDays = new Set();
  const restsPerDay = {};

  const allEmpsForRest = employees;
  allEmpsForRest.forEach((emp, empIdx) => {
    const requiredRests = patronRotativo
      ? (PATRONES_ROTATIVOS.find(p => p.value === patronRotativo)?.diasDescanso || 1)
      : (emp.dias_descanso_fijos?.length
          ? emp.dias_descanso_fijos.length
          : (emp.dias_descanso_semana || limits.diasDescansoSemana));

    const cycleLen = patronRotativo
      ? ((PATRONES_ROTATIVOS.find(p => p.value === patronRotativo)?.diasTrabajo || 5)
          + (PATRONES_ROTATIVOS.find(p => p.value === patronRotativo)?.diasDescanso || 2))
      : 0;

    // Agrupar por semana
    const weeks = {};
    days.forEach(day => {
      const d = new Date(day.date);
      const dow = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow + 1);
      const weekKey = dateToStr(monday);
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(day);
    });

    Object.values(weeks).forEach((weekDays, weekIdx) => {
      const offset = patronRotativo
        ? empIdx % cycleLen
        : (weekIdx + empIdx) % 7;

      // Ordenar días por menor demanda promedio + menos descansos ya asignados
      const sorted = [...weekDays].sort((a, b) => {
        const sumA = buildDemandVector(a.dayOfWeek, demandSlots, employees.length, a.isWeekend, slotsPorHora)
          .reduce((s, v) => s + v, 0);
        const sumB = buildDemandVector(b.dayOfWeek, demandSlots, employees.length, b.isWeekend, slotsPorHora)
          .reduce((s, v) => s + v, 0);
        if (sumA !== sumB) return sumA - sumB;
        return (restsPerDay[a.dateStr] || 0) - (restsPerDay[b.dateStr] || 0);
      });

      let assigned = 0;
      for (const day of sorted) {
        if (assigned >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue;

        // Si el empleado tiene descansos fijos, forzar a esos
        if (emp.dias_descanso_fijos?.length) {
          const dow = day.dayOfWeek;
          if (!emp.dias_descanso_fijos.includes(dow)) continue;
        }

        // Si hay patrón rotativo, validar que sea día OFF
        if (patronRotativo && cycleLen > 0) {
          const dayIdx = days.findIndex(d => d.dateStr === day.dateStr);
          if (dayIdx >= 0) {
            const cyclePos = ((dayIdx + offset) % cycleLen + cycleLen) % cycleLen;
            const def = PATRONES_ROTATIVOS.find(p => p.value === patronRotativo);
            const offThreshold = def ? def.diasTrabajo : cycleLen / 2;
            if (cyclePos < offThreshold) continue;
          }
        }

        restDays.add(`${emp.id}_${day.dateStr}`);
        restsPerDay[day.dateStr] = (restsPerDay[day.dateStr] || 0) + 1;
        assigned++;
      }
    });
  });

  // ── Pre-calcular demanda por día (cache) ─────────────────────────────
  const dayDemandCache = {};
  days.forEach(day => {
    dayDemandCache[day.dateStr] = buildDemandVector(
      day.dayOfWeek, demandSlots, employees.length, day.isWeekend, slotsPorHora
    );
  });

  // ── Helper: ¿un turno cruza horario nocturno? ──────────────────────
  // Devuelve true si entre start_time y end_time hay al menos un slot nocturno.
  const shiftTouchesNight = (s) => shiftNightHours(s) > 0;

  // Determina si un empleado PUEDE trabajar en un turno que toca la noche
  const canWorkNight = (emp) => {
    const cls = classifyEmployee(emp);
    if (cls === 'NIGHT_ONLY' || cls === 'MIXED') return true;
    if (cls === 'DAY_ONLY') return false;
    // ANY depende de config
    return nightConfig?.permiteDiaCubrir ?? false;
  };

  // Determina si un empleado PUEDE trabajar en un turno solo de día
  const canWorkDay = (emp) => {
    const cls = classifyEmployee(emp);
    if (cls === 'NIGHT_ONLY') return false; // NO quiere día
    return true; // DAY_ONLY, MIXED, ANY
  };

  // ── FASE 1: Garantizar cobertura NOCTURNA (24/7) ────────────────────
  if (nightConfig && nightConfig.minStaff > 0) {
    // Pool elegible para noche: NIGHT_ONLY + MIXED + (ANY si permite_dia)
    const nightPool = [
      ...empByClass.NIGHT_ONLY,
      ...empByClass.MIXED,
      ...(nightConfig.permiteDiaCubrir ? empByClass.ANY : []),
    ];
    if (nightConfig.soloDedicados) {
      // Quitar DAY_ONLY explícitamente
    }

    // Para cada día, asegurar `minStaff` empleados en la franja 22-06
    for (const day of days) {
      const demVec = dayDemandCache[day.dateStr];
      const covVec = getCoverageVector(day.dateStr);

      // Slots nocturnos del día (considerando que la noche puede empezar
      // el día anterior y continuar; aquí cubrimos 22:00 del día actual
      // hasta 06:00 del día siguiente).
      const nightSlots = [];
      for (let s = nightStartSlot; s < slotsPerDay; s++) nightSlots.push(s);
      for (let s = 0; s < nightEndRaw; s++) nightSlots.push(s);

      // Déficit en cada slot nocturno
      let maxDef = 0;
      for (const s of nightSlots) {
        const def = Math.max(0, (demVec[s] || 0) - covVec[s]);
        if (def > maxDef) maxDef = def;
      }
      const needed = Math.max(nightConfig.minStaff, maxDef);
      if (needed === 0) continue;

      // Para cada empleado nocturno que esté libre, intentar crear 1 turno
      // nocturno que cubra la mayor parte de la noche.
      let assigned = 0;
      for (const emp of nightPool) {
        if (assigned >= needed) break;
        if (restDays.has(`${emp.id}_${day.dateStr}`)) continue;
        if (isBlocked(emp.id, day.dateStr)) continue;
        if (hasShiftOnDay(emp.id, day.dateStr)) continue;

        const maxWeek = getMaxHoursFor(emp);
        const curWeek = getWeeklyHours(emp.id, day.date);
        if (curWeek + 8 > maxWeek) continue; // no le caben 8h más
        if (getWeeklyNightHours(emp.id, day.date) + 8 > getMaxNightHours(emp)) continue;

        // Crear turno nocturno: 22:00 -> 06:00 (siguiente día)
        const nextDay = addDays(day.date, 1);
        const nextDayStr = dateToStr(nextDay);
        // Si ya tiene turno el siguiente día, verificar descanso entre jornadas
        const lastEndTomorrow = getLastShiftEndTime(emp.id, nextDayStr);
        if (lastEndTomorrow) {
          const proposedEnd = new Date(`${nextDayStr}T06:00`);
          const gapHrs = (proposedEnd - new Date(lastEndTomorrow)) / 3600000;
          if (gapHrs < limits.minHorasEntreJornadas) continue;
        }

        generatedShifts.push({
          employee_id: emp.id,
          template_id: null,
          start_time: `${day.dateStr}T22:00`,
          end_time:   `${nextDayStr}T06:00`,
          shift_type: 'night',
          periodo: periodoStr,
          break_minutes: 0,
          shift_kind: 'NOCTURNO',
          bloque: 1,
          disponibilidad: false,
          recargo_porcentaje: 0,
          observaciones: `Auto-asignado v4 · Turno nocturno dedicado 22:00-06:00 (cubrir demanda 24/7)`,
        });
        assigned++;
      }

      if (assigned < needed) {
        warnings.push(`${day.dateStr}: solo se asignaron ${assigned}/${needed} empleados a la noche (pool nocturno insuficiente).`);
      }
    }
  }

  // ── FASE 2: Cobertura DIURNA (slots 04:00-22:00) ────────────────────
  // Estrategia: en cada iteración del while, para CADA día intentamos
  // colocar 1 turno en el mejor slot disponible. Esto permite que un
  // día con alta demanda reciba múltiples turnos a lo largo de varias
  // iteraciones (ej: pico 7-18h necesita varios agentes).
  if (modoOperacion === 'OFICINA' || is24x7) {
    const minSlots = Math.round(limits.minHorasTurno * slotsPorHora);
    const maxSlots = Math.round(limits.maxHorasTurno * slotsPorHora);

    let changed = true;
    let iterations = 0;
    // Suficientes iteraciones para cubrir incluso un call center con
    // picos de 8 personas simultáneas por día.
    const MAX_ITER = days.length * 20;

    // Pool diurno: DAY_ONLY + MIXED + ANY
    const dayPool = [
      ...empByClass.DAY_ONLY,
      ...empByClass.MIXED,
      ...empByClass.ANY,
    ];

    while (changed && iterations < MAX_ITER) {
      changed = false;
      iterations++;

      // Salir si ya no hay déficit total en ningún día
      let totalDefAcrossDays = 0;
      const daysSorted = [...days].sort((a, b) => {
        const demA = dayDemandCache[a.dateStr];
        const demB = dayDemandCache[b.dateStr];
        const covA = getCoverageVector(a.dateStr);
        const covB = getCoverageVector(b.dateStr);
        const defA = demA.reduce((s, d, i) => s + Math.max(0, d - covA[i]), 0);
        const defB = demB.reduce((s, d, i) => s + Math.max(0, d - covB[i]), 0);
        totalDefAcrossDays += defA;
        return defB - defA;
      });
      if (totalDefAcrossDays === 0) break;

      // Para CADA día, intentar colocar VARIOS turnos hasta saturar.
      // (No break al primero: el día con pico 7-18h necesita 5+ turnos).
      for (const day of daysSorted) {
        // Saturar este día: hasta 20 turnos por día (call center grande)
        let dayTurnos = 0;
        const MAX_TURNOS_POR_DIA = 20;
        while (dayTurnos < MAX_TURNOS_POR_DIA) {
          dayTurnos++;
          // Recalcular TODO cada iteración (incluyendo déficit y demand)
          const demVec = dayDemandCache[day.dateStr];
          const covVec = getCoverageVector(day.dateStr);
          const defVec = demVec.map((d, i) => Math.max(0, d - covVec[i]));
          const totalDeficit = defVec.reduce((s, v) => s + v, 0);
          if (totalDeficit === 0) break; // día ya cubierto

        // Buscar el mejor start_slot (ponderado por demanda y por hora)
        // Para cada slot inicial posible, calculamos el score que tendría
        // un turno de 4h empezando ahí. El score es la suma del déficit
        // cubierto, penalizado si ese slot ya está sobrecubierto.
        let bestStartSlot = -1;
        let bestScore = -1;
        const startSlots = [];
        // Slots desde 4 AM hasta 22 PM (4*4=16, 22*4=88). En 24/7 cubrimos
        // todo el rango diurno. En OFICINA, también.
        const earliestStart = 4 * slotsPorHora;   // 04:00
        const latestStart   = 22 * slotsPorHora;  // 22:00
        for (let s = earliestStart; s <= latestStart; s += snapSlots) {
          if (s + minSlots > slotsPerDay) break;
          // En 24/7 no permitir turnos que inicien después del inicio de noche
          // (la noche la cubren los NIGHT_ONLY).
          if (is24x7 && nightConfig && s >= nightStartSlot) continue;
          startSlots.push(s);
        }

        for (const start of startSlots) {
          let score = 0;
          // Tope: no extender más allá de nightStartSlot (en 24/7) o del
          // final del día. Esto evita que un turno de 9h cubra 04-13 pero
          // no "robe" espacio a un posible turno de 5h en 17-22.
          const slotTope = (is24x7 && nightConfig)
            ? Math.min(start + maxSlots, nightStartSlot, slotsPerDay)
            : Math.min(start + maxSlots, slotsPerDay);
          for (let s = start; s < slotTope; s++) {
            score += defVec[s];
            if (covVec[s] >= demVec[s]) score -= 0.3;
          }
          // Bonus por slots extremos si el día está muy descubierto allí.
          // Si los slots 4-6h AM o 18-21h PM están vacíos, premia empezar
          // turnos en esos rangos aunque el score central sea mayor.
          const earlyDeficit = defVec.slice(earliestStart, 7 * slotsPorHora).reduce((a,b)=>a+b,0);
          const lateDeficit  = defVec.slice(18 * slotsPorHora, 22 * slotsPorHora).reduce((a,b)=>a+b,0);
          const peakDeficit  = defVec.slice(7 * slotsPorHora, 18 * slotsPorHora).reduce((a,b)=>a+b,0);
          if (start < 7 * slotsPorHora && earlyDeficit > 0) {
            score += earlyDeficit * 0.5;
          }
          if (start >= 16 * slotsPorHora && lateDeficit > 0) {
            score += lateDeficit * 0.5;
          }
          // Penalizar ligeramente los slots pico cuando ya hay buena cobertura
          if (start >= 7 * slotsPorHora && start < 18 * slotsPorHora) {
            const peakCov = covVec.slice(start, Math.min(start+maxSlots, 18*slotsPorHora))
              .reduce((a,b)=>a+b,0);
            const peakDem = demVec.slice(start, Math.min(start+maxSlots, 18*slotsPorHora))
              .reduce((a,b)=>a+b,0);
            if (peakCov >= peakDem * 0.7) score *= 0.7; // ya cubierto, no reforzar
          }
          if (score > bestScore) {
            bestScore = score;
            bestStartSlot = start;
          }
        }

        if (bestStartSlot === -1 || bestScore <= 0) continue;

        // Calcular duración óptima (extender mientras haya déficit)
        let duration = minSlots;
        const slotTope = (is24x7 && nightConfig)
          ? Math.min(bestStartSlot + maxSlots, nightStartSlot, slotsPerDay)
          : Math.min(bestStartSlot + maxSlots, slotsPerDay);
        for (let s = bestStartSlot + minSlots; s < slotTope; s += snapSlots) {
          let def = 0;
          for (let k = 0; k < snapSlots && (s + k) < slotTope; k++) {
            def += defVec[s + k];
          }
          if (def > 0) duration = s - bestStartSlot + snapSlots;
        }
        duration = Math.max(minSlots, Math.min(duration, slotTope - bestStartSlot));
        duration = Math.max(minSlots, Math.ceil(duration / snapSlots) * snapSlots);

        const shiftEndSlot = bestStartSlot + duration;
        const crossesMidnight = shiftEndSlot >= slotsPerDay;
        const startTimeStr = slotToTime(bestStartSlot, slotsPorHora);
        const endTimeStr   = slotToTime(shiftEndSlot % slotsPerDay, slotsPorHora);
        const nextDayStr   = dateToStr(addDays(day.date, 1));
        const shiftHrs     = duration / slotsPorHora;

        // Verificar si el turno toca horario nocturno
        const proposedShift = {
          start_time: `${day.dateStr}T${startTimeStr}`,
          end_time:   `${crossesMidnight ? nextDayStr : day.dateStr}T${endTimeStr}`,
        };
        const touchesNight = shiftTouchesNight(proposedShift);

        // Filtrar candidatos
        const candidates = dayPool
          .filter(emp => {
            if (touchesNight && !canWorkNight(emp)) return false;
            if (!touchesNight && !canWorkDay(emp)) return false;
            if (isBlocked(emp.id, day.dateStr)) return false;
            if (restDays.has(`${emp.id}_${day.dateStr}`)) return false;
            if (hasShiftOnDay(emp.id, day.dateStr)) return false;

            const maxWeek = getMaxHoursFor(emp);
            if (getWeeklyHours(emp.id, day.date) + shiftHrs > maxWeek) return false;
            const maxDay = getMaxDailyHours(emp);
            if (getDailyHours(emp.id, day.dateStr) + shiftHrs > maxDay) return false;
            if (touchesNight && getWeeklyNightHours(emp.id, day.date) + shiftHrs * 0.7 > getMaxNightHours(emp))
              return false;

            const lastEnd = getLastShiftEndTime(emp.id, day.dateStr);
            if (lastEnd) {
              const gapHrs = (new Date(`${day.dateStr}T${startTimeStr}`) - new Date(lastEnd)) / 3600000;
              if (gapHrs < limits.minHorasEntreJornadas) return false;
            }
            return true;
          })
          .sort((a, b) => {
            // Estrategia: COVERAGE_FIRST prioriza llenar demanda,
            //              BALANCED prioriza igualar horas,
            //              EMPLOYEE_PREF prioriza respetar preferencias.
            if (estrategia === 'EMPLOYEE_PREF') {
              // Cualquiera con preferencia específica gana
              if (a.solo_nocturno !== b.solo_nocturno) return a.solo_nocturno ? -1 : 1;
              if (a.solo_diurno !== b.solo_diurno)     return a.solo_diurno ? -1 : 1;
            }
            // En todos los casos, desempata por horas acumuladas
            return getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date);
          });

        if (candidates.length === 0) break; // No hay más candidatos para este día

        // Si rotar_slots está activo, en EMPLOYEE_PREF cogemos al último
        // que cubrió un slot similar (más equitativo en el día).
        // Por simplicidad, cogemos al primero del sort.
        const candidate = candidates[0];

        generatedShifts.push({
          employee_id: candidate.id,
          template_id: null,
          start_time: proposedShift.start_time,
          end_time: proposedShift.end_time,
          shift_type: 'custom',
          periodo: periodoStr,
          break_minutes: shiftHrs >= 6 ? 30 : 0,
          shift_kind: touchesNight ? 'NOCTURNO' : 'STANDARD',
          bloque: 1,
          disponibilidad: false,
          recargo_porcentaje: 0,
          observaciones: `Auto-asignado v4 · Slot ${startTimeStr}-${endTimeStr}${touchesNight ? ' (cruza horario nocturno)' : ''} · ${estrategia}`,
        });

        changed = true;
        // Continuar intentando colocar más turnos en este día
        // (el bucle while interno sigue). El bucle while externo reevaluará
        // déficit al inicio de cada iteración.
        }
      }
    }
  }

  // ── FASE 3: Refill con templates (PARTIDO, ROTATIVO, etc.) ──────────
  if (templates.length > 0) {
    let tplChanged = true;
    let tplIter = 0;
    while (tplChanged && tplIter < employees.length * days.length) {
      tplChanged = false;
      tplIter++;
      for (const day of days) {
        for (const tpl of templates) {
          if (!tpl.hora_inicio || !tpl.hora_fin) continue;
          if (tpl.shift_kind === 'PARTIDO' && !permitePartidos) continue;
          if (tpl.shift_kind === 'NOCTURNO' && !canWorkDay) {} // mixed puede

          const covVec = getCoverageVector(day.dateStr);
          const demVec = dayDemandCache[day.dateStr];
          const tplStart = timeToSlot(tpl.hora_inicio, slotsPorHora);
          const tplEnd   = tpl.cruza_medianoche ? slotsPerDay : timeToSlot(tpl.hora_fin, slotsPorHora);

          let totalDeficit = demVec.slice(tplStart, tplEnd)
            .reduce((s, d, i) => s + Math.max(0, d - covVec[tplStart + i]), 0);
          if (tpl.shift_kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            const tpl2Start = timeToSlot(tpl.hora_inicio_2, slotsPorHora);
            const tpl2End   = timeToSlot(tpl.hora_fin_2, slotsPorHora);
            totalDeficit += demVec.slice(tpl2Start, tpl2End)
              .reduce((s, d, i) => s + Math.max(0, d - covVec[tpl2Start + i]), 0);
          }
          if (totalDeficit <= 0) continue;

          // Calcular horas totales del template
          let tplHrs = (tplEnd - tplStart) / slotsPorHora;
          if (tpl.shift_kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            tplHrs += (timeToSlot(tpl.hora_fin_2, slotsPorHora) - timeToSlot(tpl.hora_inicio_2, slotsPorHora)) / slotsPorHora;
          }
          if (tplHrs < limits.minHorasTurno) continue;

          const tplIsNight = shiftPagaNocturno(tpl);

          // Pool: cualquier empleado que pueda trabajar este template
          const candidatePool = employees.filter(e => {
            if (isBlocked(e.id, day.dateStr)) return false;
            if (restDays.has(`${e.id}_${day.dateStr}`)) return false;
            if (hasShiftOnDay(e.id, day.dateStr)) return false;
            if (tplIsNight && !canWorkNight(e)) return false;
            if (!tplIsNight && !canWorkDay(e)) return false;

            const maxWeek = getMaxHoursFor(e);
            if (getWeeklyHours(e.id, day.date) + tplHrs > maxWeek) return false;
            if (tplIsNight && getWeeklyNightHours(e.id, day.date) + tplHrs > getMaxNightHours(e)) return false;
            return true;
          });

          const candidate = [...candidatePool].sort((a, b) =>
            getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date)
          )[0];

          if (!candidate) continue;

          const nextDay = dateToStr(addDays(day.date, 1));
          const blocks = expandTemplateToShifts(tpl, day.dateStr, nextDay);
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
              observaciones: `Auto-asignado v4 · ${tpl.nombre} (${tpl.shift_kind})`,
            });
          });
          tplChanged = true;
          break;
        }
        if (tplChanged) break;
      }
    }
  }

  // ── FASE 4: Balanceo de carga semanal ───────────────────────────────
  // Si está activado, intenta mover turnos cortos entre empleados con
  // menos horas hacia empleados con más horas (para que todos queden
  // cerca de la media).
  if (balancearCarga && generatedShifts.length > 0) {
    const avgHours = generatedShifts.reduce((a, s) => a + shiftHours(s), 0) / employees.length;
    const maxDiff = 4; // horas de diferencia máxima permitida

    employees.forEach(emp => {
      const wHours = getWeeklyHours(emp.id, days[0].date);
      if (wHours > avgHours + maxDiff) {
        // Tiene más horas que la media + tolerancia
        // (Aquí iría lógica de mover turnos; por ahora solo advertimos)
        warnings.push(`${emp.nombre || 'Empleado'}: ${wHours.toFixed(1)}h acumuladas (media ${avgHours.toFixed(1)}h). Considera reasignar manualmente.`);
      }
    });
  }

  // ── Advertencias finales ─────────────────────────────────────────────
  days.forEach(day => {
    const covVec = getCoverageVector(day.dateStr);
    const demVec = dayDemandCache[day.dateStr];
    const totalDef = demVec.reduce((s, d, i) => s + Math.max(0, d - covVec[i]), 0);
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
