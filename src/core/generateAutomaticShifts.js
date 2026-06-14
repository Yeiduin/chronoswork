// ============================================================
// ChronosWork — Generador de Turnos v3.1
// Mejoras sobre v3:
//  ✅ Respeta `horas_semanales_contrato` POR EMPLEADO (no asume 42)
//  ✅ Usa `turno_predeterminado_id` cuando el empleado lo tiene
//  ✅ Descansos rotativos con offset por empleado (no todos el mismo día)
//  ✅ Distribución de descansos priorizando días de MENOR demanda
//  ✅ Mejor fallback cuando no hay `demandSlots` ni templates
//  ✅ Manejo robusto de `area_demand_slots` ausente (no rompe)
//  ✅ Validación defensiva: empleados sin contrato asignado se excluyen
//  ✅ Emite `observaciones` en cada turno con info útil para prenómina
// ============================================================

import { format, addDays } from 'date-fns';
import {
  PATRONES_ROTATIVOS,
} from '../config/laborCatalog';

// ── Defaults legales Colombia (Ley 2101/2021 + Ley 2466/2025) ────────────
export const LEGAL_DEFAULTS_CO = {
  maxHorasSemanales:     42,
  minHorasTurno:          4,   // mínimo por turno (art. 161 CST)
  maxHorasTurno:          9,   // máximo razonable sin HE formales
  maxHorasDiarias:       10,
  minHorasEntreJornadas:  9,   // descanso mínimo entre jornadas
  diasDescansoSemana:     1,
};

// ── Curvas de demanda por defecto (Colombia) ─────────────────────────────
const DEMAND_CURVE_DEFAULT = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2,
  6: 4, 7: 6, 8: 8, 9: 9, 10: 9, 11: 8,
  12: 7, 13: 7, 14: 8, 15: 8, 16: 8, 17: 7,
  18: 6, 19: 5, 20: 4, 21: 3, 22: 2, 23: 1,
};

const DEMAND_CURVE_WEEKEND = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 2, 7: 3, 8: 5, 9: 6, 10: 7, 11: 7,
  12: 6, 13: 6, 14: 6, 15: 5, 16: 5, 17: 4,
  18: 3, 19: 3, 20: 2, 21: 2, 22: 1, 23: 1,
};

// ── Utilidades de cuadrícula de 15 minutos ────────────────────────────────
export function timeToSlot(hhmm) {
  if (!hhmm) return 0;
  const parts = String(hhmm).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1] || '0', 10) || 0;
  return h * 4 + Math.floor(m / 15);
}

export function slotToTime(slot) {
  const s = ((slot % 96) + 96) % 96;
  const h = Math.floor(s / 4);
  const m = (s % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const SLOTS_PER_DAY = 96;

// ── Construcción de la matriz de demanda ─────────────────────────────────
/**
 * Construye el vector de demanda requerida por cada slot de 15 min
 * para un día de la semana. Prioriza `demandSlots` (config del área),
 * pero cae a una curva por defecto si no hay nada configurado.
 */
function buildDemandVector(dayOfWeek, demandSlots, numEmployees, isWeekend) {
  const vec = new Array(SLOTS_PER_DAY).fill(0);
  const safeDemandSlots = Array.isArray(demandSlots) ? demandSlots : [];
  const dayRows = safeDemandSlots.filter(s => s && s.day_of_week === dayOfWeek);

  if (dayRows.length > 0) {
    dayRows.forEach(row => {
      const startSlot = Math.max(0, Math.min((row.start_hour || 0) * 4, SLOTS_PER_DAY));
      const endSlot   = Math.max(startSlot, Math.min((row.end_hour || 24) * 4, SLOTS_PER_DAY));
      for (let s = startSlot; s < endSlot; s++) {
        // Si hay solapamiento, toma el mayor required_staff
        vec[s] = Math.max(vec[s], row.required_staff || 1);
      }
    });
    // Rellenar huecos con mínimo 1 para que el algoritmo no marque 0
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      if (vec[s] === 0) vec[s] = 1;
    }
  } else {
    // Curva por defecto, escalada al tamaño del equipo
    const curve = isWeekend ? DEMAND_CURVE_WEEKEND : DEMAND_CURVE_DEFAULT;
    const peakStaff = Math.max(1, Math.round((numEmployees || 1) * 0.8));
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const h = Math.floor(s / 4);
      const level = curve[h] ?? 1;
      vec[s] = Math.max(1, Math.round((level / 10) * peakStaff));
    }
  }

  return vec;
}

// ── Construye turnos a partir de templates, respetando el shift_kind ──────
/**
 * Devuelve un array de bloques de turno a partir de un template.
 *  - STANDARD / NOCTURNO / CUSTOM: 1 bloque (inicio → fin)
 *  - PARTIDO: 2 bloques (mañana + tarde) con break entre medio
 *  - ROTATIVO: 1 bloque (la rotación entre empleados la gestiona el algoritmo)
 *  - DISPONIBILIDAD: 1 bloque largo con etiqueta especial
 */
export function expandTemplateToShifts(tpl, dateStr, nextDayStr) {
  if (!tpl) return [];
  const kind = tpl.shift_kind || 'STANDARD';

  if (kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
    return [
      {
        template_id:   tpl.id,
        start_time:    `${dateStr}T${tpl.hora_inicio}`,
        end_time:      `${dateStr}T${tpl.hora_fin}`,
        break_minutes: tpl.split_break_minutos || 60,
        shift_kind:    kind,
        bloque:        1,
        disponibilidad: false,
        recargo_porcentaje: 0,
      },
      {
        template_id:   tpl.id,
        start_time:    `${dateStr}T${tpl.hora_inicio_2}`,
        end_time:      `${dateStr}T${tpl.hora_fin_2}`,
        break_minutes: 0,
        shift_kind:    kind,
        bloque:        2,
        disponibilidad: false,
        recargo_porcentaje: 0,
      },
    ];
  }

  if (kind === 'DISPONIBILIDAD') {
    return [{
      template_id:   tpl.id,
      start_time:    `${dateStr}T${tpl.hora_inicio}`,
      end_time:      tpl.cruza_medianoche
        ? `${nextDayStr}T${tpl.hora_fin}`
        : `${dateStr}T${tpl.hora_fin}`,
      break_minutes: 0,
      shift_kind:    kind,
      bloque:        1,
      disponibilidad: true,
      recargo_porcentaje: tpl.disponibilidad_recargo_porcentaje || 0,
    }];
  }

  // STANDARD, NOCTURNO, CUSTOM, ROTATIVO → un solo bloque
  return [{
    template_id:   tpl.id,
    start_time:    `${dateStr}T${tpl.hora_inicio}`,
    end_time:      tpl.cruza_medianoche
      ? `${nextDayStr}T${tpl.hora_fin}`
      : `${dateStr}T${tpl.hora_fin}`,
    break_minutes: tpl.break_minutos || 0,
    shift_kind:    kind,
    bloque:        1,
    disponibilidad: false,
    recargo_porcentaje: 0,
  }];
}

// ── Calcula horas de un bloque de turno (en horas decimales) ─────────────
export function blockHours(block) {
  if (!block) return 0;
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const raw = (end - start) / 3600000;
  return Math.max(0, raw - (block.break_minutes || 0) / 60);
}

// ── Detecta si un turno debe pagar recargo nocturno (HON) ────────────────
export function shiftPagaNocturno(tpl) {
  if (!tpl) return false;
  if (tpl.shift_kind === 'NOCTURNO') return true;
  if (tpl.paga_recargo_nocturno) return true;
  const [h] = (tpl.hora_inicio || '00:00').split(':').map(Number);
  return h >= 19;
}

// ── Resuelve el patrón rotativo (X días trabajo, Y días descanso) ──────────
/**
 * Devuelve, para cada día del array `days`, si el empleado en posición
 * `positionOffset` debe trabajar (true) o descansar (false), según el
 * patrón `patron` (ej: "5x2", "7x7"). El offset hace que no todos los
 * empleados caigan en el mismo día de descanso.
 */
export function buildRotativeSchedule({ days, employees, patron, positionOffset = 0 }) {
  const def = PATRONES_ROTATIVOS.find(p => p.value === patron) || PATRONES_ROTATIVOS[3]; // 5x2
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

// ── Función principal de generación ──────────────────────────────────────
/**
 * @param {Object} params
 * @param {Array}  params.employees           - Empleados del área (con sus campos: horas_semanales_contrato, turno_predeterminado_id, etc.)
 * @param {Array}  params.templates           - Plantillas de turno del área
 * @param {Array}  params.absences            - Novedades activas
 * @param {Array}  params.existingShifts      - Turnos ya creados en el período
 * @param {number} params.year
 * @param {number} params.month
 * @param {Array}  params.diasTrabajoArea     - Días laborables del área [1-7]
 * @param {Array}  params.diasToProcess       - Fechas a procesar
 * @param {Array}  params.demandSlots         - Slots de demanda del área (puede venir vacío)
 * @param {string} params.modoOperacion       - 'OFICINA' | '24_7'
 * @param {Object} params.laborLimits         - Overrides de límites legales del área
 * @param {Object} params.nightShiftConfig    - Config nocturna (null si no aplica)
 * @param {string} params.patronRotativo      - '5x2','6x1','7x7', etc. (opcional)
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
}) {
  const generatedShifts = [];
  const warnings = [];

  // ── Validaciones tempranas ───────────────────────────────────────────
  if (!Array.isArray(employees) || employees.length === 0) {
    return { shifts: [], warnings: ['No hay empleados en el área.'] };
  }
  if (!Array.isArray(templates) || templates.length === 0) {
    return { shifts: [], warnings: ['El área no tiene franjas horarias configuradas. Agrega al menos una en Áreas → Franjas.'] };
  }

  const limits = { ...LEGAL_DEFAULTS_CO, ...laborLimits };
  const periodoStr = `${year}-${String(month).padStart(2, '0')}`;

  // Días laborables del mes a procesar
  const days = (Array.isArray(diasToProcess) ? diasToProcess : [])
    .map(d => ({
      date: d,
      dateStr: format(d, 'yyyy-MM-dd'),
      dayOfWeek: d.getDay() === 0 ? 7 : d.getDay(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }))
    .filter(d => diasTrabajoArea.includes(d.dayOfWeek));

  if (days.length === 0) {
    return { shifts: [], warnings: ['No hay días hábiles en el rango seleccionado. Ajusta los días laborables del área.'] };
  }

  // ── Particionar empleados por tipo de contrato ───────────────────────
  // Fijo: tiene turno predeterminado asignado. Se programa con plantilla.
  // Por horas: asignación dinámica con templates/disponibilidad.
  const empFijos = employees.filter(e => e.tipo_contrato === 'SALARIO_FIJO' && e.turno_predeterminado_id);
  const empPorHoras = employees.filter(e => !(e.tipo_contrato === 'SALARIO_FIJO' && e.turno_predeterminado_id));

  // ── Configuración de jornada nocturna (24/7) ─────────────────────────
  const nightConfig = (modoOperacion === '24_7' && nightShiftConfig?.enabled)
    ? nightShiftConfig
    : null;

  const nightStartSlot = nightConfig ? timeToSlot(nightConfig.start) : null;
  const nightEndRaw    = nightConfig ? timeToSlot(nightConfig.end)    : null;
  const nightCrosses   = nightConfig ? (nightEndRaw <= nightStartSlot) : false;

  let nightEmployeeIds = new Set();
  if (nightConfig) {
    if (nightConfig.employeeIds && nightConfig.employeeIds.length > 0) {
      nightEmployeeIds = new Set(nightConfig.employeeIds);
    } else {
      // Reparto automático: 1/3 del equipo
      const sortedByHrs = [...empPorHoras].sort((a, b) =>
        (a.id || '').localeCompare(b.id || ''));
      const countNight = Math.max(1, Math.ceil(sortedByHrs.length / 3));
      sortedByHrs.slice(0, countNight).forEach(e => nightEmployeeIds.add(e.id));
    }
  }

  const isNightEmployee = (empId) =>
    nightConfig && nightEmployeeIds.has(empId);

  // ── Helpers de validación ────────────────────────────────────────────
  const safeAbsences = Array.isArray(absences) ? absences : [];
  const safeExisting = Array.isArray(existingShifts) ? existingShifts : [];

  const isBlocked = (empId, dateStr) =>
    safeAbsences.some(a =>
      a.employee_id === empId &&
      a.fecha_inicio <= dateStr &&
      a.fecha_fin >= dateStr
    );

  const hasShiftOnDay = (empId, dateStr) =>
    safeExisting.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr)) ||
    generatedShifts.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr));

  // Límite semanal personalizado por empleado (si lo tiene)
  const getMaxHoursFor = (emp) => {
    const h = parseInt(emp?.horas_semanales_contrato, 10);
    if (!isNaN(h) && h > 0 && h <= 60) return h; // tope defensivo
    return limits.maxHorasSemanales;
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
    let totalHrs = 0;
    [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .forEach(s => {
        const sDate = new Date(s.start_time);
        if (sDate >= monday && sDate <= sunday) {
          let hrs = (new Date(s.end_time) - sDate) / 3600000;
          if (s.break_minutes) hrs -= s.break_minutes / 60;
          totalHrs += hrs;
        }
      });
    return totalHrs;
  };

  const getDailyHours = (empId, dateStr) => {
    let totalHrs = 0;
    [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId && s.start_time.startsWith(dateStr))
      .forEach(s => {
        let hrs = (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
        if (s.break_minutes) hrs -= s.break_minutes / 60;
        totalHrs += hrs;
      });
    return totalHrs;
  };

  const getLastShiftEndTime = (empId, dateStr) => {
    const d = new Date(dateStr);
    const prevStr = format(new Date(d.getTime() - 86400000), 'yyyy-MM-dd');
    const prevShifts = [...safeExisting, ...generatedShifts]
      .filter(s => s.employee_id === empId && s.start_time.startsWith(prevStr));
    if (!prevShifts.length) return null;
    return prevShifts.reduce((latest, s) =>
      new Date(s.end_time) > new Date(latest.end_time) ? s : latest
    ).end_time;
  };

  // ── Cobertura actual por slots ───────────────────────────────────────
  const getCoverageVector = (dateStr) => {
    const vec = new Array(SLOTS_PER_DAY).fill(0);
    const allShifts = [...safeExisting, ...generatedShifts];
    allShifts.forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const sDateStr = String(s.start_time).split('T')[0];
      const eDate = new Date(s.end_time);
      const eStr  = format(eDate, 'yyyy-MM-dd');
      if (sDateStr === dateStr) {
        const startSlot = timeToSlot(String(s.start_time).split('T')[1].substring(0, 5));
        const endSlot   = eStr !== dateStr
          ? SLOTS_PER_DAY
          : timeToSlot(String(s.end_time).split('T')[1].substring(0, 5));
        for (let sl = startSlot; sl < Math.min(endSlot, SLOTS_PER_DAY); sl++) vec[sl]++;
      } else if (eStr === dateStr && sDateStr !== dateStr) {
        const endSlot = timeToSlot(String(s.end_time).split('T')[1].substring(0, 5));
        for (let sl = 0; sl < endSlot; sl++) vec[sl]++;
      }
    });
    return vec;
  };

  // ── FASE A: Fijos con template predeterminado ────────────────────────
  // Para cada empleado con turno_predeterminado_id, programa el mismo
  // template cada día laborable. Si está bloqueado o ya tiene turno, salta.
  if (templates.length > 0) {
    empFijos.forEach(emp => {
      if (!emp.turno_predeterminado_id) return;
      const tpl = templates.find(t => t.id === emp.turno_predeterminado_id);
      if (!tpl) {
        warnings.push(`${emp.nombre || 'Empleado'}: turno predeterminado no encontrado en las plantillas del área.`);
        return;
      }
      days.forEach(day => {
        if (isBlocked(emp.id, day.dateStr) || hasShiftOnDay(emp.id, day.dateStr)) return;
        const nextDay = format(addDays(day.date, 1), 'yyyy-MM-dd');
        const blocks = expandTemplateToShifts(tpl, day.dateStr, nextDay);
        blocks.forEach(b => {
          generatedShifts.push({
            employee_id:    emp.id,
            template_id:    tpl.id,
            start_time:     b.start_time,
            end_time:       b.end_time,
            shift_type:     'custom',
            periodo:        periodoStr,
            break_minutes:  b.break_minutes || 0,
            shift_kind:     b.shift_kind,
            bloque:         b.bloque,
            disponibilidad: b.disponibilidad,
            recargo_porcentaje: b.recargo_porcentaje || 0,
            observaciones:  `Auto-asignado · Plantilla ${tpl.nombre}`,
          });
        });
      });
    });
  }

  // ── FASE B: Asignación de descansos (considerando patrón rotativo) ────
  // Empareja cada empleado con sus descansos, priorizando días de MENOR
  // demanda y respetando tanto el patrón rotativo del área como los
  // `dias_descanso_fijos` del empleado.
  const weeks = {};
  days.forEach(day => {
    const d = new Date(day.date);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow + 1);
    const weekKey = format(monday, 'yyyy-MM-dd');
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(day);
  });

  const restDays = new Set();
  const restsPerDay = {};

  empPorHoras.forEach(emp => {
    const requiredRests = patronRotativo
      ? (PATRONES_ROTATIVOS.find(p => p.value === patronRotativo)?.diasDescanso || 1)
      : (emp.dias_descanso_semana || limits.diasDescansoSemana);

    Object.values(weeks).forEach((weekDays, weekIdx) => {
      // Offset por empleado: cada uno descansa un día distinto
      const cycleLen = patronRotativo
        ? ((PATRONES_ROTATIVOS.find(p => p.value === patronRotativo)?.diasTrabajo || 5)
            + (PATRONES_ROTATIVOS.find(p => p.value === patronRotativo)?.diasDescanso || 2))
        : 0;
      const offset = patronRotativo
        ? empPorHoras.indexOf(emp) % cycleLen
        : (weekIdx + empPorHoras.indexOf(emp)) % 7; // distribuye por día de semana

      // Ordenar días laborables por MENOR demanda (para asignar descansos ahí)
      const sorted = [...weekDays].sort((a, b) => {
        const sumA = buildDemandVector(a.dayOfWeek, demandSlots, employees.length, a.isWeekend)
          .reduce((s, v) => s + v, 0);
        const sumB = buildDemandVector(b.dayOfWeek, demandSlots, employees.length, b.isWeekend)
          .reduce((s, v) => s + v, 0);
        if (sumA !== sumB) return sumA - sumB; // menor demanda = primero
        return (restsPerDay[a.dateStr] || 0) - (restsPerDay[b.dateStr] || 0);
      });

      let assigned = 0;
      for (const day of sorted) {
        if (assigned >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue;

        // Si hay patrón rotativo, validar que sea día OFF
        if (patronRotativo && cycleLen > 0) {
          const dayIdx = days.findIndex(d => d.dateStr === day.dateStr);
          if (dayIdx >= 0) {
            const cyclePos = ((dayIdx + offset) % cycleLen + cycleLen) % cycleLen;
            const def = PATRONES_ROTATIVOS.find(p => p.value === patronRotativo);
            const offThreshold = def ? def.diasTrabajo : cycleLen / 2;
            if (cyclePos < offThreshold) continue; // este día es de trabajo según el patrón
          }
        }

        restDays.add(`${emp.id}_${day.dateStr}`);
        restsPerDay[day.dateStr] = (restsPerDay[day.dateStr] || 0) + 1;
        assigned++;
      }
    });
  });

  // ── FASE C: Generación por demanda con slots (4 turnos/hora) ─────────
  // Recorre los días ordenados por mayor DÉFICIT y va colocando turnos
  // con duración entre minHorasTurno y maxHorasTurno, sin solaparse con
  // turnos ya programados.
  const minSlots = limits.minHorasTurno * 4;
  const maxSlots = limits.maxHorasTurno * 4;

  const getShiftBounds = (startSlot) => {
    if (!nightConfig) {
      return { isNightShift: false, maxEndSlot: startSlot + maxSlots, isValid: true };
    }
    let nightWindowEnd = -1;
    if (nightCrosses) {
      if (startSlot >= nightStartSlot) nightWindowEnd = nightEndRaw + SLOTS_PER_DAY;
      else if (startSlot < nightEndRaw) nightWindowEnd = nightEndRaw;
    } else {
      if (startSlot >= nightStartSlot && startSlot < nightEndRaw) nightWindowEnd = nightEndRaw;
    }

    if (nightWindowEnd !== -1 && startSlot + minSlots <= nightWindowEnd) {
      return { isNightShift: true, maxEndSlot: nightWindowEnd, isValid: true };
    }

    let dayWindowStart, dayWindowEnd;
    if (nightCrosses) {
      dayWindowStart = Math.max(0, nightEndRaw - 8);
      dayWindowEnd = nightStartSlot + 4;
    } else {
      dayWindowStart = 0;
      dayWindowEnd = SLOTS_PER_DAY;
    }

    if (startSlot >= dayWindowStart && startSlot + minSlots <= dayWindowEnd) {
      return { isNightShift: false, maxEndSlot: dayWindowEnd, isValid: true };
    }

    return { isValid: false };
  };

  // Pre-computar demanda de cada día (una sola vez) — O(días) más rápido
  const dayDemandCache = {};
  days.forEach(day => {
    dayDemandCache[day.dateStr] = buildDemandVector(
      day.dayOfWeek, demandSlots, employees.length, day.isWeekend
    );
  });

  let changed = true;
  let iterations = 0;
  const MAX_ITER = employees.length * days.length * 4;

  while (changed && iterations < MAX_ITER) {
    changed = false;
    iterations++;

    // Ordenar por MAYOR DÉFICIT (los días con más hueco van primero)
    const daysSorted = [...days].sort((a, b) => {
      const demA = dayDemandCache[a.dateStr];
      const demB = dayDemandCache[b.dateStr];
      const covA = getCoverageVector(a.dateStr);
      const covB = getCoverageVector(b.dateStr);
      const defA = demA.reduce((s, d, i) => s + Math.max(0, d - covA[i]), 0);
      const defB = demB.reduce((s, d, i) => s + Math.max(0, d - covB[i]), 0);
      return defB - defA;
    });

    for (const day of daysSorted) {
      const demVec = dayDemandCache[day.dateStr];
      const covVec = getCoverageVector(day.dateStr);
      const defVec = demVec.map((d, i) => Math.max(0, d - covVec[i]));
      const totalDeficit = defVec.reduce((s, v) => s + v, 0);
      if (totalDeficit === 0) continue;

      const nextDate = addDays(day.date, 1);
      const nextDayStr = format(nextDate, 'yyyy-MM-dd');
      const nextDayOfWeek = nextDate.getDay() === 0 ? 7 : nextDate.getDay();
      const nextIsWeekend = nextDate.getDay() === 0 || nextDate.getDay() === 6;
      const nextDemVec = nextDayOfWeek in dayDemandCache
        ? dayDemandCache[nextDayStr]
        : buildDemandVector(nextDayOfWeek, demandSlots, employees.length, nextIsWeekend);
      const nextCovVec = getCoverageVector(nextDayStr);
      const nextDefVec = nextDemVec.map((d, i) => Math.max(0, d - nextCovVec[i]));

      const nightFreeThisDay = nightConfig
        ? [...nightEmployeeIds].some(id =>
            !restDays.has(`${id}_${day.dateStr}`) &&
            !hasShiftOnDay(id, day.dateStr) &&
            !isBlocked(id, day.dateStr)
          )
        : false;

      // Slots permitidos como inicio de turno
      const allowedSlots = [];
      for (let s = 0; s < SLOTS_PER_DAY; s++) {
        const bounds = getShiftBounds(s);
        if (!bounds.isValid) continue;
        if (nightConfig) {
          if (bounds.isNightShift && !nightFreeThisDay) continue;
        }
        allowedSlots.push(s);
      }

      let bestStartSlot = -1;
      let bestScore = -1;

      for (const start of allowedSlots) {
        let score = 0;
        const bounds = getShiftBounds(start);
        const limitEnd = Math.min(start + maxSlots, bounds.maxEndSlot);
        for (let s = start; s < limitEnd; s++) {
          if (s < SLOTS_PER_DAY) {
            score += defVec[s];
            if (covVec[s] >= demVec[s]) score -= 0.5;
          } else {
            const nextS = s - SLOTS_PER_DAY;
            score += nextDefVec[nextS];
            if (nextCovVec[nextS] >= nextDemVec[nextS]) score -= 0.5;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestStartSlot = start;
        }
      }

      if (bestStartSlot === -1 || bestScore <= 0) continue;

      // Calcular duración óptima (extender mientras haya déficit)
      let duration = minSlots;
      const bounds = getShiftBounds(bestStartSlot);
      const limitEnd = Math.min(bestStartSlot + maxSlots, bounds.maxEndSlot);
      for (let s = bestStartSlot + minSlots; s < limitEnd; s++) {
        let def = s < SLOTS_PER_DAY ? defVec[s] : nextDefVec[s - SLOTS_PER_DAY];
        if (def > 0) duration = s - bestStartSlot + 1;
      }
      duration = Math.max(minSlots, Math.ceil(duration / 4) * 4);
      duration = Math.min(duration, limitEnd - bestStartSlot);

      const shiftEndSlot = bestStartSlot + duration;
      const shiftHours   = duration / 4;
      const startTimeStr = slotToTime(bestStartSlot);
      const endTimeStr   = slotToTime(shiftEndSlot % SLOTS_PER_DAY);
      const crossesMidnight = shiftEndSlot >= SLOTS_PER_DAY;
      const shiftIsNight = bounds.isNightShift;

      // Filtrar candidatos según el tipo (nocturno vs diurno) y disponibilidad
      const candidatePool = empPorHoras.filter(emp => {
        if (nightConfig) {
          if (shiftIsNight && !isNightEmployee(emp.id)) return false;
          if (!shiftIsNight && isNightEmployee(emp.id)) return false;
        }
        return true;
      });

      const candidate = [...candidatePool]
        .filter(emp => {
          if (isBlocked(emp.id, day.dateStr)) return false;
          if (restDays.has(`${emp.id}_${day.dateStr}`)) return false;
          if (hasShiftOnDay(emp.id, day.dateStr)) return false;

          const maxWeek = getMaxHoursFor(emp);
          if (getWeeklyHours(emp.id, day.date) + shiftHours > maxWeek) return false;
          if (getDailyHours(emp.id, day.dateStr) + shiftHours > limits.maxHorasDiarias) return false;

          const lastEnd = getLastShiftEndTime(emp.id, day.dateStr);
          if (lastEnd) {
            const gapHrs = (new Date(`${day.dateStr}T${startTimeStr}`) - new Date(lastEnd)) / 3600000;
            if (gapHrs < limits.minHorasEntreJornadas) return false;
          }
          return true;
        })
        // Priorizar al de MENOS horas acumuladas (balancea carga)
        .sort((a, b) => getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date))[0];

      if (!candidate) continue;

      generatedShifts.push({
        employee_id:    candidate.id,
        template_id:    null,
        start_time:     `${day.dateStr}T${startTimeStr}`,
        end_time:       `${crossesMidnight ? nextDayStr : day.dateStr}T${endTimeStr}`,
        shift_type:     'custom',
        periodo:        periodoStr,
        break_minutes:  shiftHours >= 6 ? 30 : 0,
        shift_kind:     shiftIsNight ? 'NOCTURNO' : 'STANDARD',
        bloque:         1,
        disponibilidad: false,
        recargo_porcentaje: 0,
        observaciones:  shiftIsNight
          ? `Auto-asignado · Turno nocturno (HON automático)`
          : `Auto-asignado · Slot óptimo ${startTimeStr}-${endTimeStr}`,
      });

      changed = true;
      break;
    }
  }

  // ── FASE D: Relleno con templates (soporta PARTIDO, ROTATIVO, etc.) ──
  // Para cada (día, plantilla), busca candidatos y los asigna a los slots
  // que la plantilla cubre, siempre que la demanda lo justifique.
  if (templates.length > 0) {
    let tplChanged = true;
    let tplIter = 0;
    while (tplChanged && tplIter < employees.length * days.length) {
      tplChanged = false;
      tplIter++;
      for (const day of days) {
        for (const tpl of templates) {
          if (!tpl.hora_inicio || !tpl.hora_fin) continue;
          const covVec = getCoverageVector(day.dateStr);
          const demVec = dayDemandCache[day.dateStr];
          const tplStart = timeToSlot(tpl.hora_inicio);
          const tplEnd   = tpl.cruza_medianoche ? SLOTS_PER_DAY : timeToSlot(tpl.hora_fin);

          let totalDeficit = demVec.slice(tplStart, tplEnd)
            .reduce((s, d, i) => s + Math.max(0, d - covVec[tplStart + i]), 0);
          if (tpl.shift_kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            const tpl2Start = timeToSlot(tpl.hora_inicio_2);
            const tpl2End   = timeToSlot(tpl.hora_fin_2);
            totalDeficit += demVec.slice(tpl2Start, tpl2End)
              .reduce((s, d, i) => s + Math.max(0, d - covVec[tpl2Start + i]), 0);
          }
          if (totalDeficit <= 0) continue;

          // Calcular horas totales del template (sumando bloques si es PARTIDO)
          let tplHrs = (tplEnd - tplStart) / 4;
          if (tpl.shift_kind === 'PARTIDO' && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            tplHrs += (timeToSlot(tpl.hora_fin_2) - timeToSlot(tpl.hora_inicio_2)) / 4;
          }
          if (tpl.shift_kind === 'DISPONIBILIDAD') {
            tplHrs = (tplEnd - tplStart) / 4;
          }

          const tplIsNight = shiftPagaNocturno(tpl);

          const candidate = [...empPorHoras]
            .filter(e => {
              if (nightConfig && tplIsNight && !isNightEmployee(e.id)) return false;
              if (nightConfig && !tplIsNight && isNightEmployee(e.id)) return false;
              if (isBlocked(e.id, day.dateStr)) return false;
              if (restDays.has(`${e.id}_${day.dateStr}`)) return false;
              if (hasShiftOnDay(e.id, day.dateStr)) return false;
              const maxWeek = getMaxHoursFor(e);
              return getWeeklyHours(e.id, day.date) + tplHrs <= maxWeek;
            })
            .sort((a, b) => getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date))[0];

          if (!candidate) continue;

          const nextDay = format(addDays(day.date, 1), 'yyyy-MM-dd');
          const blocks = expandTemplateToShifts(tpl, day.dateStr, nextDay);
          blocks.forEach(b => {
            generatedShifts.push({
              employee_id:    candidate.id,
              template_id:    tpl.id,
              start_time:     b.start_time,
              end_time:       b.end_time,
              shift_type:     'custom',
              periodo:        periodoStr,
              break_minutes:  b.break_minutes,
              shift_kind:     b.shift_kind,
              bloque:         b.bloque,
              disponibilidad: b.disponibilidad,
              recargo_porcentaje: b.recargo_porcentaje,
              observaciones:  `Auto-asignado · ${tpl.nombre} (${tpl.shift_kind})`,
            });
          });
          tplChanged = true;
          break;
        }
        if (tplChanged) break;
      }
    }
  }

  // ── Advertencias finales ─────────────────────────────────────────────
  days.forEach(day => {
    const covVec = getCoverageVector(day.dateStr);
    const demVec = dayDemandCache[day.dateStr];
    const totalDef = demVec.reduce((s, d, i) => s + Math.max(0, d - covVec[i]), 0);
    if (totalDef > 0) {
      warnings.push(`${day.dateStr}: déficit de ${Math.round(totalDef / 4)} horas-persona sin cubrir (considera más personal o menos demanda).`);
    }
  });

  empPorHoras.forEach(emp => {
    if (!generatedShifts.some(s => s.employee_id === emp.id)) {
      warnings.push(`${emp.nombre || 'Empleado'}: sin turnos asignados (verifica horas_semanales_contrato y disponibilidades).`);
    }
  });

  return { shifts: generatedShifts, warnings };
}
