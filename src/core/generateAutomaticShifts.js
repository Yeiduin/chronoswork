import { format, addDays } from 'date-fns';

// ============================================================
// ChronosWork — Algoritmo de Generación Automática de Turnos v2
// Sin dependencia de plantillas (templates opcionales)
// Slots de 15 minutos, curva de demanda, CST Colombia 2026
// ============================================================

// ── Defaults legales Colombia (Ley 2101/2021 + Ley 2466/2025) ──────────────
export const LEGAL_DEFAULTS_CO = {
  maxHorasSemanales:     42,
  minHorasTurno:          4,   // mínimo por turno (art. 161 CST)
  maxHorasTurno:          9,   // máximo razonable sin HE formales
  maxHorasDiarias:       10,
  minHorasEntreJornadas:  9,   // descanso mínimo entre jornadas
  diasDescansoSemana:     1,
};

// ── Curva de demanda default Colombia ─────────────────────────────────────
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
  const [h, m] = hhmm.split(':').map(Number);
  return h * 4 + Math.floor(m / 15);
}

export function slotToTime(slot) {
  const h = Math.floor(slot / 4);
  const m = (slot % 4) * 15;
  return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const SLOTS_PER_DAY = 96;

// ── Construcción de la matriz de demanda ──────────────────────────────────
function buildDemandVector(dayOfWeek, demandSlots, numEmployees, isWeekend) {
  const vec = new Array(SLOTS_PER_DAY).fill(0);
  const dayRows = demandSlots.filter(s => s.day_of_week === dayOfWeek);

  if (dayRows.length > 0) {
    dayRows.forEach(row => {
      const startSlot = row.start_hour * 4;
      const endSlot   = Math.min(row.end_hour * 4, SLOTS_PER_DAY);
      for (let s = startSlot; s < endSlot; s++) {
        vec[s] = row.required_staff;
      }
    });
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      if (vec[s] === 0) vec[s] = 1;
    }
  } else {
    const curve = isWeekend ? DEMAND_CURVE_WEEKEND : DEMAND_CURVE_DEFAULT;
    const peakStaff = Math.max(1, Math.round(numEmployees * 0.8));
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const h = Math.floor(s / 4);
      const level = curve[h] ?? 1;
      vec[s] = Math.max(1, Math.round((level / 10) * peakStaff));
    }
  }

  return vec;
}

// ── Función principal ─────────────────────────────────────────────────────
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
  coberturaMinimaDiaria = 1,
  coberturaMaximaDiaria = 99,
  laborLimits = {},
}) {
  const generatedShifts = [];
  const warnings = [];

  if (!employees || employees.length === 0) {
    return { shifts: [], warnings: ['No hay empleados en el área.'] };
  }

  const limits = { ...LEGAL_DEFAULTS_CO, ...laborLimits };
  const periodoStr = `${year}-${String(month).padStart(2, '0')}`;

  const days = diasToProcess
    .map(d => ({
      date: d,
      dateStr: format(d, 'yyyy-MM-dd'),
      dayOfWeek: d.getDay() === 0 ? 7 : d.getDay(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }))
    .filter(d => diasTrabajoArea.includes(d.dayOfWeek));

  if (days.length === 0) {
    return { shifts: [], warnings: ['No hay días hábiles en el rango seleccionado.'] };
  }

  const empFijos    = employees.filter(e => e.tipo_contrato === 'SALARIO_FIJO');
  const empPorHoras = employees.filter(e => e.tipo_contrato !== 'SALARIO_FIJO');

  // ── Helpers ────────────────────────────────────────────────────────────
  const isBlocked = (empId, dateStr) =>
    absences.some(a =>
      a.employee_id === empId &&
      a.fecha_inicio <= dateStr &&
      a.fecha_fin >= dateStr
    );

  const hasShiftOnDay = (empId, dateStr) =>
    existingShifts.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr)) ||
    generatedShifts.some(s => s.employee_id === empId && s.start_time.startsWith(dateStr));

  const getWeeklyHours = (empId, date) => {
    const d = new Date(date);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    let totalHrs = 0;
    [...existingShifts, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .forEach(s => {
        const sDate = new Date(s.start_time);
        if (sDate >= monday && sDate <= sunday) {
          const eDate = new Date(s.end_time);
          let hrs = (eDate - sDate) / 3600000;
          if (s.break_minutes) hrs -= s.break_minutes / 60;
          totalHrs += hrs;
        }
      });
    return totalHrs;
  };

  const getDailyHours = (empId, dateStr) => {
    let totalHrs = 0;
    [...existingShifts, ...generatedShifts]
      .filter(s => s.employee_id === empId && s.start_time.startsWith(dateStr))
      .forEach(s => {
        totalHrs += (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
      });
    return totalHrs;
  };

  const getLastShiftEndTime = (empId, dateStr) => {
    const d = new Date(dateStr);
    const prevStr = format(new Date(d.getTime() - 86400000), 'yyyy-MM-dd');
    const prevShifts = [...existingShifts, ...generatedShifts]
      .filter(s => s.employee_id === empId && s.start_time.startsWith(prevStr));
    if (!prevShifts.length) return null;
    return prevShifts.reduce((latest, s) =>
      new Date(s.end_time) > new Date(latest.end_time) ? s : latest
    ).end_time;
  };

  // ── FASE A: Cobertura actual por slots ────────────────────────────────
  const getCoverageVector = (dateStr) => {
    const vec = new Array(SLOTS_PER_DAY).fill(0);
    const allShifts = [...existingShifts, ...generatedShifts];
    allShifts.forEach(s => {
      const sDateStr = s.start_time.split('T')[0];
      const eDate = new Date(s.end_time);
      const eStr  = format(eDate, 'yyyy-MM-dd');
      if (sDateStr === dateStr) {
        const startSlot = timeToSlot(s.start_time.split('T')[1].substring(0, 5));
        const endSlot   = eStr !== dateStr
          ? SLOTS_PER_DAY
          : timeToSlot(s.end_time.split('T')[1].substring(0, 5));
        for (let sl = startSlot; sl < Math.min(endSlot, SLOTS_PER_DAY); sl++) vec[sl]++;
      } else if (eStr === dateStr && sDateStr !== dateStr) {
        const endSlot = timeToSlot(s.end_time.split('T')[1].substring(0, 5));
        for (let sl = 0; sl < endSlot; sl++) vec[sl]++;
      }
    });
    return vec;
  };

  // ── FASE B: Fijos con template predeterminado ─────────────────────────
  if (templates.length > 0) {
    empFijos.forEach(emp => {
      if (!emp.turno_predeterminado_id) return;
      const tpl = templates.find(t => t.id === emp.turno_predeterminado_id);
      if (!tpl) return;
      days.forEach(day => {
        if (isBlocked(emp.id, day.dateStr) || hasShiftOnDay(emp.id, day.dateStr)) return;
        const nextDay = format(addDays(day.date, 1), 'yyyy-MM-dd');
        generatedShifts.push({
          employee_id:  emp.id,
          template_id:  tpl.id,
          start_time:   `${day.dateStr}T${tpl.hora_inicio}`,
          end_time:     tpl.cruza_medianoche
            ? `${nextDay}T${tpl.hora_fin}`
            : `${day.dateStr}T${tpl.hora_fin}`,
          shift_type:   'custom',
          periodo:      periodoStr,
          break_minutes: 0,
        });
      });
    });
  }

  // ── FASE C: Asignación de descansos ───────────────────────────────────
  const weeks = {};
  days.forEach(day => {
    const d = new Date(day.date);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    const weekKey = format(monday, 'yyyy-MM-dd');
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(day);
  });

  const restDays = new Set();
  const restsPerDay = {};

  empPorHoras.forEach(emp => {
    const requiredRests = emp.dias_descanso_semana || limits.diasDescansoSemana;
    Object.values(weeks).forEach(weekDays => {
      const sorted = [...weekDays].sort((a, b) => {
        const sumA = buildDemandVector(a.dayOfWeek, demandSlots, employees.length, a.isWeekend)
          .reduce((s, v) => s + v, 0);
        const sumB = buildDemandVector(b.dayOfWeek, demandSlots, employees.length, b.isWeekend)
          .reduce((s, v) => s + v, 0);
        if (sumA !== sumB) return sumA - sumB;
        return (restsPerDay[a.dateStr] || 0) - (restsPerDay[b.dateStr] || 0);
      });
      let assigned = 0;
      for (const day of sorted) {
        if (assigned >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue;
        restDays.add(`${emp.id}_${day.dateStr}`);
        restsPerDay[day.dateStr] = (restsPerDay[day.dateStr] || 0) + 1;
        assigned++;
      }
    });
  });

  // ── FASE D: Generación dinámica por demanda — slots de 15 min ─────────
  let changed = true;
  let iterations = 0;
  const MAX_ITER = employees.length * days.length * 4;

  while (changed && iterations < MAX_ITER) {
    changed = false;
    iterations++;

    // Ordenar días por mayor déficit total
    const daysSorted = [...days].sort((a, b) => {
      const demA = buildDemandVector(a.dayOfWeek, demandSlots, employees.length, a.isWeekend);
      const covA = getCoverageVector(a.dateStr);
      const defA = demA.reduce((s, d, i) => s + Math.max(0, d - covA[i]), 0);
      const demB = buildDemandVector(b.dayOfWeek, demandSlots, employees.length, b.isWeekend);
      const covB = getCoverageVector(b.dateStr);
      const defB = demB.reduce((s, d, i) => s + Math.max(0, d - covB[i]), 0);
      return defB - defA;
    });

    for (const day of daysSorted) {
      const demVec = buildDemandVector(day.dayOfWeek, demandSlots, employees.length, day.isWeekend);
      const covVec = getCoverageVector(day.dateStr);
      const defVec = demVec.map((d, i) => Math.max(0, d - covVec[i]));
      const totalDeficit = defVec.reduce((s, v) => s + v, 0);
      if (totalDeficit === 0) continue;

      const minSlots = limits.minHorasTurno * 4;
      const maxSlots = limits.maxHorasTurno * 4;

      // Ventana deslizante: encontrar inicio de mayor déficit acumulado
      let bestStartSlot = -1;
      let bestScore = -1;

      for (let start = 0; start <= SLOTS_PER_DAY - minSlots; start++) {
        let score = 0;
        for (let s = start; s < Math.min(start + maxSlots, SLOTS_PER_DAY); s++) {
          score += defVec[s];
          if (covVec[s] >= demVec[s]) score -= 0.5; // penalizar sobertura
        }
        if (score > bestScore) {
          bestScore = score;
          bestStartSlot = start;
        }
      }

      if (bestStartSlot === -1 || bestScore <= 0) continue;

      // Calcular duración óptima: extender mientras hay déficit
      let duration = minSlots;
      for (let s = bestStartSlot + minSlots; s < Math.min(bestStartSlot + maxSlots, SLOTS_PER_DAY); s++) {
        if (defVec[s] > 0) duration = s - bestStartSlot + 1;
      }
      // Redondear a múltiplo de 4 slots = 1 hora (para horas limpias)
      duration = Math.max(minSlots, Math.ceil(duration / 4) * 4);
      duration = Math.min(duration, maxSlots);

      const shiftEndSlot = Math.min(bestStartSlot + duration, SLOTS_PER_DAY);
      const shiftHours   = (shiftEndSlot - bestStartSlot) / 4;
      const startTimeStr = slotToTime(bestStartSlot);
      const endTimeStr   = slotToTime(shiftEndSlot % SLOTS_PER_DAY);
      const crossesMidnight = shiftEndSlot >= SLOTS_PER_DAY;

      // Buscar empleado con menos horas semanales que cumpla todos los requisitos
      const candidate = [...empPorHoras]
        .filter(emp => {
          if (isBlocked(emp.id, day.dateStr)) return false;
          if (restDays.has(`${emp.id}_${day.dateStr}`)) return false;
          if (hasShiftOnDay(emp.id, day.dateStr)) return false;
          const weekHrs = getWeeklyHours(emp.id, day.date);
          if (weekHrs + shiftHours > limits.maxHorasSemanales) return false;
          if (getDailyHours(emp.id, day.dateStr) + shiftHours > limits.maxHorasDiarias) return false;
          const lastEnd = getLastShiftEndTime(emp.id, day.dateStr);
          if (lastEnd) {
            const gapHrs = (new Date(`${day.dateStr}T${startTimeStr}`) - new Date(lastEnd)) / 3600000;
            if (gapHrs < limits.minHorasEntreJornadas) return false;
          }
          return true;
        })
        .sort((a, b) => getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date))[0];

      if (!candidate) continue;

      const nextDayStr = format(addDays(day.date, 1), 'yyyy-MM-dd');
      generatedShifts.push({
        employee_id:  candidate.id,
        template_id:  null,
        start_time:   `${day.dateStr}T${startTimeStr}`,
        end_time:     `${crossesMidnight ? nextDayStr : day.dateStr}T${endTimeStr}`,
        shift_type:   'custom',
        periodo:      periodoStr,
        break_minutes: shiftHours >= 6 ? 30 : 0,
      });

      changed = true;
      break; // recalcular cobertura
    }
  }

  // ── FASE E: Relleno con templates si existen ──────────────────────────
  if (templates.length > 0) {
    let tplChanged = true;
    let tplIter = 0;
    while (tplChanged && tplIter < employees.length * days.length) {
      tplChanged = false;
      tplIter++;
      for (const day of days) {
        for (const tpl of templates) {
          const covVec = getCoverageVector(day.dateStr);
          const demVec = buildDemandVector(day.dayOfWeek, demandSlots, employees.length, day.isWeekend);
          const tplStart = timeToSlot(tpl.hora_inicio);
          const tplEnd   = tpl.cruza_medianoche ? SLOTS_PER_DAY : timeToSlot(tpl.hora_fin);
          const deficit  = demVec.slice(tplStart, tplEnd)
            .reduce((s, d, i) => s + Math.max(0, d - covVec[tplStart + i]), 0);
          if (deficit <= 0) continue;
          const tplHrs = (tplEnd - tplStart) / 4;
          const candidate = [...empPorHoras]
            .filter(e =>
              !isBlocked(e.id, day.dateStr) &&
              !restDays.has(`${e.id}_${day.dateStr}`) &&
              !hasShiftOnDay(e.id, day.dateStr) &&
              getWeeklyHours(e.id, day.date) + tplHrs <= limits.maxHorasSemanales
            )
            .sort((a, b) => getWeeklyHours(a.id, day.date) - getWeeklyHours(b.id, day.date))[0];
          if (!candidate) continue;
          const nextDay = format(addDays(day.date, 1), 'yyyy-MM-dd');
          generatedShifts.push({
            employee_id:  candidate.id,
            template_id:  tpl.id,
            start_time:   `${day.dateStr}T${tpl.hora_inicio}`,
            end_time:     tpl.cruza_medianoche
              ? `${nextDay}T${tpl.hora_fin}`
              : `${day.dateStr}T${tpl.hora_fin}`,
            shift_type:   'custom',
            periodo:      periodoStr,
            break_minutes: tplHrs >= 6 ? 30 : 0,
          });
          tplChanged = true;
          break;
        }
        if (tplChanged) break;
      }
    }
  }

  // ── Advertencias finales ───────────────────────────────────────────────
  days.forEach(day => {
    const covVec = getCoverageVector(day.dateStr);
    const demVec = buildDemandVector(day.dayOfWeek, demandSlots, employees.length, day.isWeekend);
    const totalDef = demVec.reduce((s, d, i) => s + Math.max(0, d - covVec[i]), 0);
    if (totalDef > 0) {
      warnings.push(`${day.dateStr}: déficit de ${Math.round(totalDef / 4)} horas-persona sin cubrir. Considera más personal.`);
    }
  });

  empPorHoras.forEach(emp => {
    if (!generatedShifts.some(s => s.employee_id === emp.id)) {
      warnings.push(`${emp.nombre || 'Empleado'}: sin turnos asignados (verifica novedades y límites de horas).`);
    }
  });

  return { shifts: generatedShifts, warnings };
}
