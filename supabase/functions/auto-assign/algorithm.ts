// ============================================================
// Edge Function: auto-assign — Algoritmo de asignación de turnos
// Porte completo de generateAutomaticShifts.js v4.1 para Deno
// Incluye el bugfix de permiteDiaCubrirNoche
// ============================================================

import { format, addDays, getDay, getISOWeek } from "npm:date-fns@4";
import {
  LEGAL_DEFAULTS_CO, DEMAND_CURVE_DIURNA, DEMAND_CURVE_NOCTURNA,
  DEMAND_CURVE_FIN_SEMANA, CANONICAL_DAY_STARTS, isNightHour,
  resolveBreakPolicy,
} from "./labor-catalog.ts";
import { getLocalISOString, dateToStr, parseLocalDate } from "./date-utils.ts";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface Employee {
  id: string; nombre?: string; cargo?: string;
  valor_hora?: number; activo?: boolean;
  solo_nocturno?: boolean; solo_diurno?: boolean;
  jornada_preferida?: string; horas_semanales_contrato?: number;
  horas_nocturnas_max_semana?: number; horas_max_semana?: number;
  permite_partido?: boolean;
}

export interface ShiftTemplate {
  id: string; area_id?: string; nombre?: string;
  hora_inicio: string; hora_fin: string;
  hora_inicio_2?: string; hora_fin_2?: string;
  cruza_medianoche?: boolean; color?: string;
  shift_kind?: string; break_minutos?: number;
  split_break_minutos?: number;
  disponibilidad_recargo_porcentaje?: number;
}

export interface Absence {
  employee_id: string; fecha_inicio: string; fecha_fin: string;
  tipo?: string;
}

export interface DemandSlot {
  day_of_week: number; start_hour: number; end_hour: number;
  required_staff: number;
}

export interface AutoAssignParams {
  modoOperacion: string;
  employees: Employee[];
  templates: ShiftTemplate[];
  absences: Absence[];
  existingShifts: ExistingShift[];
  year: number; month: number;
  diasTrabajoArea: number[];
  diasToProcess?: Date[];
  demandSlots?: DemandSlot[];
  laborLimits?: Record<string, unknown>;
  nightShiftConfig?: NightConfig | null;
  patronRotativo?: unknown;
  estrategia?: string;
  minEmpleadosNoche?: number;
  nocheSoloDedicados?: boolean;
  permiteDiaCubrirNoche?: boolean;
  balancearCarga?: boolean;
  rotarSlots?: boolean;
  slotsPorHora?: number;
  snapMinutos?: number;
  minHorasTurnoOverride?: number | null;
  maxHorasTurnoOverride?: number | null;
  permiteExtras?: boolean;
  permitePartidos?: boolean;
  minEmpleadosDia?: number | null;
  maxEmpleadosDia?: number | null;
  horaInicioDia?: string;
  horaFinDia?: string | null;
  breakPolicy?: Record<string, unknown> | null;
}

interface NightConfig {
  enabled?: boolean; start?: string; end?: string;
  employeeIds?: string[];
}

interface ExistingShift {
  employee_id: string; start_time: string; end_time: string;
  periodo?: string; break_minutes?: number;
  template_id?: string; shift_kind?: string;
  bloque?: number; disponibilidad?: boolean;
  recargo_porcentaje?: number;
}

interface GeneratedShift {
  employee_id: string; start_time: string; end_time: string;
  periodo: string; shift_type: string;
  template_id?: string; break_minutes: number;
  shift_kind?: string; bloque?: number;
  disponibilidad?: boolean; recargo_porcentaje?: number;
  observaciones?: string;
  almuerzo_minutos?: number; breaks_15_count?: number;
  descansos?: { tipo: string; inicio: string | null; minutos: number }[];
}

type EmpClass = "NIGHT_ONLY" | "DAY_ONLY" | "MIXED" | "ANY";

// ─── Utilidades de cuadrícula ────────────────────────────────────────────────
function timeToSlot(hhmm: string, slotsPerHour = 4): number {
  if (!hhmm) return 0;
  const parts = String(hhmm).split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1] || "0", 10) || 0;
  return h * slotsPerHour + Math.floor(m / (60 / slotsPerHour));
}

function slotToTime(slot: number, slotsPerHour = 4): string {
  const spd = 24 * slotsPerHour;
  const s = ((slot % spd) + spd) % spd;
  const h = Math.floor(s / slotsPerHour);
  const m = (s % slotsPerHour) * (60 / slotsPerHour);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getSlotsPerDay(sph = 4) { return 24 * sph; }

function classifyEmployee(emp: Employee): EmpClass {
  if (!emp) return "ANY";
  if (emp.solo_nocturno) return "NIGHT_ONLY";
  if (emp.solo_diurno) return "DAY_ONLY";
  switch (emp.jornada_preferida) {
    case "NOCTURNA": return "NIGHT_ONLY";
    case "DIURNA": return "DAY_ONLY";
    case "MIXTA": return "MIXED";
    default: return "ANY";
  }
}

function blockHours(block: { start_time: string; end_time: string; break_minutes?: number }): number {
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const raw = (end.getTime() - start.getTime()) / 3600000;
  return Math.max(0, raw - (block.break_minutes || 0) / 60);
}

function shiftHours(s: { start_time: string; end_time: string }): number {
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  return Math.max(0, (end.getTime() - start.getTime()) / 3600000);
}

function shiftNightHours(s: { start_time: string; end_time: string }): number {
  let total = 0;
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  let cursor = new Date(start);
  while (cursor < end) {
    const h = cursor.getHours();
    if (isNightHour(h)) total += 1 / 60;
    cursor = new Date(cursor.getTime() + 60000);
  }
  return total;
}

// ─── Vector de demanda ───────────────────────────────────────────────────────
function buildDemandVector(
  dayOfWeek: number, demandSlots: DemandSlot[],
  numEmployees: number, isWeekend: boolean, slotsPerHour = 4
): number[] {
  const spd = getSlotsPerDay(slotsPerHour);
  const vec = new Array(spd).fill(0);
  const dayRows = demandSlots.filter(s => s && s.day_of_week === dayOfWeek);

  if (dayRows.length > 0) {
    dayRows.forEach(row => {
      const ss = Math.max(0, Math.min((row.start_hour || 0) * slotsPerHour, spd));
      const es = Math.max(ss, Math.min((row.end_hour || 24) * slotsPerHour, spd));
      for (let s = ss; s < es; s++) vec[s] = Math.max(vec[s], row.required_staff || 1);
    });
  } else {
    const dayCurve = isWeekend ? DEMAND_CURVE_FIN_SEMANA : DEMAND_CURVE_DIURNA;
    const peakStaff = Math.max(1, Math.round((numEmployees || 1) * 0.8));
    for (let s = 0; s < spd; s++) {
      const h = Math.floor(s / slotsPerHour);
      const level = isNightHour(h) ? (DEMAND_CURVE_NOCTURNA[h] ?? 1) : (dayCurve[h] ?? 1);
      vec[s] = Math.max(1, Math.round((level / 10) * peakStaff));
    }
  }
  return vec;
}

// ─── Expandir templates a turnos ─────────────────────────────────────────────
function expandTemplateToShifts(tpl: ShiftTemplate, dateStr: string, nextDayStr: string): GeneratedShift[] {
  if (!tpl) return [];
  const kind = tpl.shift_kind || "STANDARD";

  if (kind === "PARTIDO" && tpl.hora_inicio_2 && tpl.hora_fin_2) {
    return [
      {
        employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
        end_time: getLocalISOString(dateStr, tpl.hora_fin),
        periodo: dateStr.slice(0, 7), shift_type: "custom",
        template_id: tpl.id, break_minutes: tpl.split_break_minutos || 60,
        shift_kind: kind, bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
      },
      {
        employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio_2),
        end_time: getLocalISOString(dateStr, tpl.hora_fin_2),
        periodo: dateStr.slice(0, 7), shift_type: "custom",
        template_id: tpl.id, break_minutes: 0,
        shift_kind: kind, bloque: 2, disponibilidad: false, recargo_porcentaje: 0,
      },
    ];
  }

  if (kind === "DISPONIBILIDAD") {
    return [{
      employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
      end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
      periodo: dateStr.slice(0, 7), shift_type: "custom",
      template_id: tpl.id, break_minutes: 0,
      shift_kind: kind, bloque: 1, disponibilidad: true,
      recargo_porcentaje: tpl.disponibilidad_recargo_porcentaje || 0,
    }];
  }

  return [{
    employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
    end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
    periodo: dateStr.slice(0, 7), shift_type: "custom",
    template_id: tpl.id, break_minutes: tpl.break_minutos || 0,
    shift_kind: kind, bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
  }];
}

// ─── Generar descansos ───────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

function buildDescansos(
  startHHMM: string, grossMin: number,
  breakPolicy: Record<string, unknown> | null,
  opts?: { soloBreaks?: boolean }
): { descansos: { tipo: string; inicio: string | null; minutos: number }[]; almuerzoMin: number; breaksCount: number; breakMinutes: number } {
  const bp = resolveBreakPolicy(breakPolicy);
  const horas = grossMin / 60;
  const reglas = [...(bp.reglas || [])].sort((a, b) => (a.desdeHoras || 0) - (b.desdeHoras || 0));

  let reglaElegida: typeof reglas[0] | null = null;
  reglas.forEach(r => { if (horas >= (r.desdeHoras || 0)) reglaElegida = r; });
  if (!reglaElegida) {
    return { descansos: [], almuerzoMin: 0, breaksCount: 0, breakMinutes: 0 };
  }

  const breaks15 = reglaElegida.breaks || 0;
  const tieneAlmuerzo = opts?.soloBreaks ? false : (reglaElegida.almuerzo || false);
  const almuerzoMin = tieneAlmuerzo ? bp.almuerzoMinutos : 0;
  const breakMin = bp.breakMinutos;

  const [startH, startM] = startHHMM.split(":").map(Number);
  const startTotalMin = startH * 60 + startM;
  const totalBreakTime = almuerzoMin + breaks15 * breakMin;
  const netMin = grossMin - totalBreakTime;

  const descansos: { tipo: string; inicio: string | null; minutos: number }[] = [];
  const gapMinMin = bp.gapMinHoras * 60;
  const gapMaxMin = bp.gapMaxHoras * 60;

  const startTime = (mins: number) => {
    const total = startTotalMin + mins;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${pad2(h)}:${pad2(m)}`;
  };

  if (tieneAlmuerzo) {
    const almPos = Math.min(gapMaxMin, Math.max(gapMinMin, netMin * 0.4));
    descansos.push({ tipo: "ALMUERZO", inicio: startTime(almPos), minutos: almuerzoMin });
  }

  for (let i = 0; i < breaks15; i++) {
    const segmentMin = netMin / (breaks15 + 1);
    const pos = (i + 1) * segmentMin + (i * breakMin) + (tieneAlmuerzo ? almuerzoMin : 0);
    descansos.push({ tipo: "BREAK", inicio: startTime(pos), minutos: breakMin });
  }

  descansos.sort((a, b) => {
    const ta = a.inicio ? a.inicio.split(":").map(Number)[0] * 60 + a.inicio.split(":").map(Number)[1] : 0;
    const tb = b.inicio ? b.inicio.split(":").map(Number)[0] * 60 + b.inicio.split(":").map(Number)[1] : 0;
    return ta - tb;
  });

  return { descansos, almuerzoMin: tieneAlmuerzo ? almuerzoMin : 0, breaksCount: breaks15, breakMinutes: breakMin };
}

// ─── ALGORITMO PRINCIPAL ─────────────────────────────────────────────────────
export function generateAutomaticShifts(params: AutoAssignParams): { shifts: GeneratedShift[]; warnings: string[] } {
  const {
    modoOperacion = "OFICINA", employees = [], templates = [],
    absences = [], existingShifts: existing = [], year, month,
    diasTrabajoArea = [1, 2, 3, 4, 5],
    diasToProcess: inputDias, demandSlots = [],
    nightShiftConfig: nightConfigRaw, estrategia = "COVERAGE_FIRST",
    minEmpleadosNoche = 1, nocheSoloDedicados = true,
    permiteDiaCubrirNoche = false, balancearCarga = true, rotarSlots = false,
    slotsPorHora = 4, snapMinutos = 15,
    minHorasTurnoOverride, maxHorasTurnoOverride,
    permiteExtras = false, permitePartidos = false,
    minEmpleadosDia, maxEmpleadosDia,
    horaInicioDia = "04:00", horaFinDia, breakPolicy: bp,
  } = params;

  const warnings: string[] = [];
  const generatedShifts: GeneratedShift[] = [];
  const is247 = modoOperacion === "24_7" || modoOperacion === "24_7_NIGHT_SPLIT";
  const slotsPerDay = getSlotsPerDay(slotsPorHora);
  const minHoras = minHorasTurnoOverride ?? LEGAL_DEFAULTS_CO.minHorasTurno;
  const maxHoras = maxHorasTurnoOverride ?? LEGAL_DEFAULTS_CO.maxHorasTurno;
  const maxDiarias = LEGAL_DEFAULTS_CO.maxHorasDiarias;
  const maxSemanales = LEGAL_DEFAULTS_CO.maxHorasSemanales;
  const minEntreJornadas = LEGAL_DEFAULTS_CO.minHorasEntreJornadas;
  const snapSlots = Math.max(1, Math.round((snapMinutos / 60) * slotsPorHora));

  const minEmpDia = minEmpleadosDia ?? null;
  const maxEmpDia = maxEmpleadosDia ?? null;

  // ─── Construir días ────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month, 0).getDate();
  const rawDays: Date[] = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));
  let processDays = rawDays;
  if (inputDias && inputDias.length > 0) {
    processDays = inputDias.filter(d => d.getFullYear() === year && d.getMonth() === month - 1);
  }

  const dayList = processDays.map(d => ({
    date: d, dateStr: dateToStr(d),
    dayOfWeek: getDay(d) === 0 ? 7 : getDay(d), // 1=Lun, 7=Dom
    dateObj: parseLocalDate(dateToStr(d)),
  }));
  const validDays = dayList.filter(d => diasTrabajoArea.includes(d.dayOfWeek));
  const diasSinCobertura: string[] = [];

  // ─── Clasificar empleados ──────────────────────────────────────────────────
  const empByClass: Record<EmpClass, Employee[]> = { NIGHT_ONLY: [], DAY_ONLY: [], MIXED: [], ANY: [] };
  const activeEmployees = employees.filter(e => e.activo !== false);
  activeEmployees.forEach(e => { empByClass[classifyEmployee(e)].push(e); });

  // ─── Configuración nocturna ────────────────────────────────────────────────
  const nightConfig = is247 ? {
    enabled: true, start: nightConfigRaw?.start || "22:00", end: nightConfigRaw?.end || "06:00",
    minStaff: minEmpleadosNoche || 1, employeeIds: nightConfigRaw?.employeeIds || [],
    soloDedicados: !!nocheSoloDedicados, permiteDiaCubrir: !!permiteDiaCubrirNoche,
  } : null;

  // ─── Absences map ──────────────────────────────────────────────────────────
  const absenceMap = new Map<string, Absence[]>();
  absences.forEach(a => { const k = a.employee_id; if (!absenceMap.has(k)) absenceMap.set(k, []); absenceMap.get(k)!.push(a); });

  const hasAbsence = (empId: string, dateStr: string) => {
    const list = absenceMap.get(empId);
    if (!list) return false;
    return list.some(a => dateStr >= a.fecha_inicio && dateStr <= a.fecha_fin);
  };

  // ─── Inicializar cobertura y demanda ───────────────────────────────────────
  const covMap = new Map<string, { s: number; e: number }[]>();
  const demMap = new Map<string, number[]>();
  const getDemandVecFor = (d: Date) => {
    const k = dateToStr(d);
    if (!demMap.has(k)) {
      const dow = getDay(d) === 0 ? 7 : getDay(d);
      const isWeekend = dow === 6 || dow === 7;
      demMap.set(k, buildDemandVector(dow, demandSlots, activeEmployees.length, isWeekend, slotsPorHora));
    }
    return demMap.get(k)!;
  };
  const getCoverageVector = (dateStr: string) => {
    const vec = new Array(slotsPerDay).fill(0);
    (covMap.get(dateStr) || []).forEach(b => {
      for (let s = b.s; s < b.e; s++) vec[s] = (vec[s] || 0) + 1;
    });
    return vec;
  };
  const addCoverage = (dateStr: string, startSlot: number, endSlot: number) => {
    if (!covMap.has(dateStr)) covMap.set(dateStr, []);
    covMap.get(dateStr)!.push({ s: startSlot, e: endSlot });
  };

  // ─── Construir turnos existentes ───────────────────────────────────────────
  const weeklyHours = new Map<string, number>();
  const getWeeklyHours = (empId: string, refDate: Date): number => {
    const weekStart = new Date(refDate);
    const dow = getDay(weekStart); weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    const wk = `${dateToStr(weekStart)}`;
    if (!weeklyHours.has(`${empId}_${wk}`)) {
      let total = 0;
      generatedShifts.filter(s => s.employee_id === empId).forEach(s => { total += shiftHours(s); });
      existing.filter(s => s.employee_id === empId).forEach(s => {
        const sd = dateToStr(new Date(s.start_time));
        if (sd >= dateToStr(weekStart) && sd <= dateToStr(weekEnd)) total += shiftHours(s);
      });
      weeklyHours.set(`${empId}_${wk}`, total);
    }
    return weeklyHours.get(`${empId}_${wk}`)!;
  };

  existing.forEach(s => {
    const dateStr = dateToStr(new Date(s.start_time));
    const startSlot = timeToSlot(new Date(s.start_time).toISOString().slice(11, 16), slotsPorHora);
    let endSlot = timeToSlot(new Date(s.end_time).toISOString().slice(11, 16), slotsPorHora);
    if (dateToStr(new Date(s.end_time)) !== dateStr) endSlot += slotsPerDay;
    addCoverage(dateStr, startSlot, endSlot);
  });

  const dayHours = new Map<string, number>();
  const getDayHours = (empId: string, dateStr: string) => dayHours.get(`${empId}_${dateStr}`) || 0;

  const employeeEligible = (emp: Employee, opts: {
    startDateStr: string; startTimeStr: string; shiftHrs: number;
    nightHrs: number; entersNight: boolean;
  }): boolean => {
    if (hasAbsence(emp.id, opts.startDateStr)) return false;
    if (emp.solo_diurno && opts.entersNight) return false;
    if (emp.solo_nocturno && !opts.entersNight) return false;
    if (opts.shiftHrs < minHoras || opts.shiftHrs > maxHoras) return false;
    if ((getDayHours(emp.id, opts.startDateStr) + opts.shiftHrs) > maxDiarias) return false;

    const refDate = new Date(opts.startDateStr);
    if ((getWeeklyHours(emp.id, refDate) + opts.shiftHrs) > (emp.horas_max_semana || maxSemanales)) return false;
    if (emp.horas_nocturnas_max_semana && opts.nightHrs > 0) {
      let nightSoFar = 0;
      generatedShifts.filter(s => s.employee_id === emp.id).forEach(s => { nightSoFar += shiftNightHours(s); });
      if (nightSoFar + opts.nightHrs > emp.horas_nocturnas_max_semana) return false;
    }

    // Descanso entre jornadas
    const empShifts = [...generatedShifts.filter(s => s.employee_id === emp.id), ...existing.filter(s => s.employee_id === emp.id)]
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const newStart = new Date(`${opts.startDateStr}T${opts.startTimeStr}:00`);
    for (const s of empShifts) {
      const sEnd = new Date(s.end_time);
      const gap = (newStart.getTime() - sEnd.getTime()) / 3600000;
      if (gap > 0 && gap < minEntreJornadas) return false;
    }
    return true;
  };

  // ─── Construir pool de templates ───────────────────────────────────────────
  const allTplShifts: GeneratedShift[] = [];
  const tplByDay = new Map<string, GeneratedShift[]>();
  dayList.forEach(day => {
    const nextDay = addDays(day.date, 1);
    const nextStr = dateToStr(nextDay);
    const dayTpls: GeneratedShift[] = [];
    templates.forEach(t => {
      expandTemplateToShifts(t, day.dateStr, nextStr).forEach(ts => dayTpls.push(ts));
    });
    tplByDay.set(day.dateStr, dayTpls);
    allTplShifts.push(...dayTpls);
  });

  // ─── FASE 0: Asignar descansos ─────────────────────────────────────────────
  const daysWithSlots = new Map<string, boolean>();
  dayList.forEach(d => daysWithSlots.set(d.dateStr, false));

  // ─── FASE 1: Cobertura NOCTURNA ────────────────────────────────────────────
  if (nightConfig) {
    const nightPool: Employee[] = [];
    if (nightConfig.employeeIds?.length) {
      employees.forEach(e => { if (nightConfig.employeeIds.includes(e.id) && !nightPool.includes(e)) nightPool.push(e); });
    }
    const dedicados = [...empByClass.NIGHT_ONLY, ...empByClass.MIXED];
    dedicados.forEach(e => { if (!nightPool.includes(e)) nightPool.push(e); });
    const baseInsuficiente = nightPool.length < nightConfig.minStaff || nightPool.length === 0;

    // BUGFIX: No colar ANY si soloDedicados=true Y permiteDiaCubrir=false
    if (nightConfig.permiteDiaCubrir || !nightConfig.soloDedicados) {
      empByClass.ANY.forEach(e => { if (!nightPool.includes(e)) nightPool.push(e); });
    } else if (baseInsuficiente) {
      warnings.push(`Pool nocturno insuficiente (${nightPool.length} de ${nightConfig.minStaff} requeridos) con 'solo dedicados' activado. Asignando con el personal disponible.`);
    }
    if (nightPool.length === 0) {
      warnings.push("No hay empleados habilitados para la noche en esta área 24/7.");
    }

    const nightStartSlot = timeToSlot(nightConfig.start, slotsPorHora);
    const nightEndSlot = timeToSlot(nightConfig.end, slotsPorHora);
    const nightEndRaw = nightEndSlot + (nightEndSlot <= nightStartSlot ? slotsPerDay : 0);
    const nightEndExt = nightEndSlot + slotsPerDay;
    const minSlots = Math.round(minHoras * slotsPorHora);

    const placeOneNightBlock = (day: typeof dayList[0]) => {
      const dNext = addDays(day.date, 1);
      const dNextStr = dateToStr(dNext);
      const demD = getDemandVecFor(day.date);
      const demN = getDemandVecFor(dNext);
      const covD = getCoverageVector(day.dateStr);
      const covN = getCoverageVector(dNextStr);

      let best: { start: number; end: number; score: number } | null = null;
      for (let start = nightStartSlot; start + minSlots <= nightEndExt; start += snapSlots) {
        for (let end = start + minSlots; end <= Math.min(start + Math.round(maxHoras * slotsPorHora), nightEndExt); end += snapSlots) {
          const leftInDay = Math.min(end, slotsPerDay) - start;
          const rightInDay2 = Math.max(0, end - slotsPerDay);
          let totalDef = 0;
          for (let s = start; s < end; s++) {
            const onNext = s >= slotsPerDay;
            const ls = onNext ? s - slotsPerDay : s;
            const dem = Math.max((onNext ? demN : demD)[ls] || 0, nightConfig.minStaff);
            const cov = (onNext ? covN : covD)[ls] || 0;
            totalDef += Math.max(0, dem - cov - (s >= start ? 1 : 0));
          }
          const score = totalDef + Math.abs(leftInDay - rightInDay2) * 0.1;
          if (!best || score < best.score) best = { start, end, score };
        }
      }
      if (!best) return false;
      const candidate = [...nightPool].sort(() => Math.random() - 0.5)[0];
      if (!candidate) return false;

      const startOnNext = best.start >= slotsPerDay;
      const hhmm = slotToTime(best.start % slotsPerDay, slotsPorHora);
      const startIso = getLocalISOString(startOnNext ? dNextStr : day.dateStr, hhmm);
      const endSlot = best.end;
      const onNext = endSlot > slotsPerDay;
      const endIso = getLocalISOString(onNext ? dNextStr : day.dateStr, slotToTime(endSlot % slotsPerDay, slotsPorHora));

      const tpl = templates.find(t => t.shift_kind === "NOCTURNO");
      const res = buildDescansos(hhmm, (best.end - best.start) * (60 / slotsPorHora), bp);
      generatedShifts.push({
        employee_id: candidate.id, start_time: startIso, end_time: endIso,
        periodo: day.dateStr.slice(0, 7), shift_type: "custom",
        template_id: tpl?.id, break_minutes: res.almuerzoMin,
        shift_kind: "NOCTURNO", bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
        almuerzo_minutos: res.almuerzoMin, breaks_15_count: res.breaksCount,
        descansos: res.descansos,
      });
      addCoverage(day.dateStr, best.start, Math.min(best.end, slotsPerDay));
      if (best.end > slotsPerDay) addCoverage(dNextStr, 0, best.end - slotsPerDay);
      dayHours.set(`${candidate.id}_${day.dateStr}`, (getDayHours(candidate.id, day.dateStr) || 0) + shiftHours(generatedShifts[generatedShifts.length - 1]));
      return true;
    };

    validDays.forEach(day => { if (nightPool.length > 0) placeOneNightBlock(day); });
  }

  // ─── FASE 2: Cobertura DIURNA (slots canónicos) ───────────────────────────
  const dayPool = [...empByClass.DAY_ONLY, ...empByClass.MIXED, ...empByClass.ANY];

  validDays.forEach(day => {
    // Verificar piso mínimo de empleados por día
    if (minEmpDia != null && dayPool.length < minEmpDia) {
      diasSinCobertura.push(day.dateStr + " (piso mínimo)");
      return;
    }

    const demVec = getDemandVecFor(day.date);
    const covVec = getCoverageVector(day.dateStr);

    // Calcular headcount objetivo
    const peakDemand = Math.max(...demVec);
    const hcObj = maxEmpDia ? Math.min(peakDemand, maxEmpDia) : peakDemand;

    for (let attempt = 0; attempt < hcObj * 3; attempt++) {
      if (dayPool.length === 0) break;
      const currentCov = getCoverageVector(day.dateStr);
      const hasDeficit = demVec.some((d, i) => d > (currentCov[i] || 0));
      if (!hasDeficit && (maxEmpDia == null || getCoverageVector(day.dateStr).reduce((a, v) => a + (v > 0 ? 1 : 0), 0) >= maxEmpDia)) break;

      // Elegir hora de inicio canónica con más déficit
      let bestStart: number | null = null;
      let bestDef = 0;
      for (const [h, m] of CANONICAL_DAY_STARTS) {
        const slot = h * slotsPorHora + Math.floor(m / (60 / slotsPorHora));
        for (let dur = Math.round(minHoras * slotsPorHora); dur <= Math.round(maxHoras * slotsPorHora); dur += snapSlots) {
          const end = slot + dur;
          if (end > slotsPerDay) continue;
          let def = 0;
          for (let s = slot; s < Math.min(end, slotsPerDay); s++) {
            def += Math.max(0, (demVec[s] || 0) - (currentCov[s] || 0));
          }
          if (def > bestDef) { bestDef = def; bestStart = slot; }
        }
      }
      if (!bestStart || bestDef <= 0) break;

      const slot = bestStart;
      let bestDur = 0;
      let bestScore = -1;
      for (let dur = Math.round(minHoras * slotsPorHora); dur <= Math.round(maxHoras * slotsPorHora); dur += snapSlots) {
        if (slot + dur > slotsPerDay) continue;
        let covered = 0;
        for (let s = slot; s < slot + dur; s++) covered += Math.max(0, demVec[s] - (currentCov[s] || 0));
        const score = covered - dur * 0.1;
        if (score > bestScore) { bestScore = score; bestDur = dur; }
      }
      if (bestDur === 0) break;

      const hhmm = slotToTime(slot, slotsPorHora);
      const startIso = getLocalISOString(day.dateStr, hhmm);
      const endIso = getLocalISOString(day.dateStr, slotToTime(slot + bestDur, slotsPorHora));
      const shiftHrs = (bestDur / slotsPorHora);
      const entersNight = isNightHour(Math.floor(slot / slotsPorHora)) || isNightHour(Math.floor((slot + bestDur - 1) / slotsPorHora));
      const nightHrs = entersNight ? shiftNightHours({ start_time: startIso, end_time: endIso }) : 0;

      const candidate = [...dayPool].sort(() => Math.random() - 0.5).find(e =>
        employeeEligible(e, { startDateStr: day.dateStr, startTimeStr: hhmm, startDateObj: day.dateObj, shiftHrs, nightHrs, entersNight })
      );
      if (!candidate) continue;

      const res = buildDescansos(hhmm, bestDur * (60 / slotsPorHora), bp);
      generatedShifts.push({
        employee_id: candidate.id, start_time: startIso, end_time: endIso,
        periodo: day.dateStr.slice(0, 7), shift_type: "custom",
        break_minutes: res.almuerzoMin, almuerzo_minutos: res.almuerzoMin,
        breaks_15_count: res.breaksCount, descansos: res.descansos,
      });
      addCoverage(day.dateStr, slot, slot + bestDur);
      dayHours.set(`${candidate.id}_${day.dateStr}`, (getDayHours(candidate.id, day.dateStr) || 0) + shiftHrs);
    }
  });

  // ─── FASE 3: Templates ─────────────────────────────────────────────────────
  if (templates.length > 0) {
    validDays.forEach(day => {
      const dayTpls = tplByDay.get(day.dateStr) || [];
      dayTpls.forEach(tplShift => {
        const covVec = getCoverageVector(day.dateStr);
        const demVec = getDemandVecFor(day.date);
        const tplStartSlot = timeToSlot(tplShift.start_time.slice(11, 16), slotsPorHora);
        const tplEndSlot = (tplShift.end_time.includes("T") ? timeToSlot(tplShift.end_time.slice(11, 16), slotsPorHora) : 0);
        const actualEnd = tplEndSlot <= tplStartSlot ? tplEndSlot + slotsPerDay : tplEndSlot;

        let deficit = 0;
        for (let s = tplStartSlot; s < Math.min(actualEnd, slotsPerDay); s++) deficit += Math.max(0, (demVec[s] || 0) - (covVec[s] || 0));
        if (deficit === 0) return;

        const shiftHrs = blockHours(tplShift);
        const hhmm = tplShift.start_time.slice(11, 16);
        const entersNight = isNightHour(Math.floor(tplStartSlot / slotsPorHora));
        const nightHrs = entersNight ? shiftNightHours(tplShift) : 0;

        const candidate = [...dayPool].sort(() => Math.random() - 0.5).find(e =>
          employeeEligible(e, { startDateStr: day.dateStr, startTimeStr: hhmm, startDateObj: day.dateObj, shiftHrs, nightHrs, entersNight })
        );
        if (!candidate) return;

        const tpl = templates.find(t => t.id === tplShift.template_id);
        const res = buildDescansos(hhmm, shiftHrs * 60, bp);
        generatedShifts.push({
          ...tplShift, employee_id: candidate.id,
          break_minutes: res.almuerzoMin, almuerzo_minutos: res.almuerzoMin,
          breaks_15_count: res.breaksCount, descansos: res.descansos,
        });
        addCoverage(day.dateStr, tplStartSlot, Math.min(actualEnd, slotsPerDay));
        dayHours.set(`${candidate.id}_${day.dateStr}`, (getDayHours(candidate.id, day.dateStr) || 0) + shiftHrs);
      });
    });
  }

  // ─── FASE 4: Balanceo de carga semanal ─────────────────────────────────────
  if (balancearCarga) {
    const weeks = new Map<string, string[]>();
    dayList.forEach(d => {
      const wk = `${year}-W${String(getISOWeek(d.date)).padStart(2, "0")}`;
      if (!weeks.has(wk)) weeks.set(wk, []);
      weeks.get(wk)!.push(d.dateStr);
    });

    weeks.forEach((wDays, weekKey) => {
      const empInWeek = [...new Set(generatedShifts.filter(s => wDays.some(d => s.start_time.startsWith(d))).map(s => s.employee_id))];
      if (empInWeek.length <= 1) return;

      const refDate = new Date(wDays[0]);
      const avg = empInWeek.reduce((a, id) => a + getWeeklyHours(id, refDate), 0) / empInWeek.length;
      const maxDiff = 4;

      for (let pass = 0; pass < 5; pass++) {
        let huboCambio = false;
        const sorted = [...empInWeek].sort((a, b) => getWeeklyHours(b, refDate) - getWeeklyHours(a, refDate));
        const sobre = sorted.find(id => getWeeklyHours(id, refDate) > avg + maxDiff);

        if (sobre) {
          const empSobre = employees.find(e => e.id === sobre)!;
          const turnosSobre = generatedShifts.filter(s => s.employee_id === sobre && wDays.some(d => s.start_time.startsWith(d)));
          for (const turno of turnosSobre) {
            const turnoHrs = shiftHours(turno);
            const turnoDateStr = turno.start_time.slice(0, 10);
            const turnoStartStr = turno.start_time.slice(11, 16);
            const tEndStr = turno.end_time.slice(11, 16);
            const tCrosses = turno.end_time.slice(0, 10) !== turnoDateStr;
            const tStartSlot = timeToSlot(turnoStartStr, slotsPorHora);
            const nightEndRaw = nightConfig ? (timeToSlot(nightConfig.end, slotsPorHora) + slotsPerDay) : 0;
            const nightStartSlot = nightConfig ? timeToSlot(nightConfig.start, slotsPorHora) : 0;
            const tEndSlot = (tCrosses ? slotsPerDay : 0) + timeToSlot(tEndStr, slotsPorHora);
            const turnoEntersNight = nightConfig ? (tStartSlot < nightEndRaw || tEndSlot > nightStartSlot) : false;

            const subcargados = empInWeek
              .filter(id => id !== sobre && getWeeklyHours(id, refDate) < avg - 1)
              .sort((a, b) => getWeeklyHours(a, refDate) - getWeeklyHours(b, refDate));

            let receptor: Employee | null = null;
            for (const id of subcargados) {
              const e = employees.find(emp => emp.id === id);
              if (!e) continue;
              if (!employeeEligible(e, { startDateStr: turnoDateStr, startTimeStr: turnoStartStr, startDateObj: new Date(turno.start_time), shiftHrs: turnoHrs, nightHrs: shiftNightHours(turno), entersNight: turnoEntersNight })) continue;
              receptor = e; break;
            }
            if (receptor) {
              turno.employee_id = receptor.id;
              turno.observaciones = (turno.observaciones || "") + ` [Rebalanceado desde ${empSobre.nombre || empSobre.id} → ${receptor.nombre || receptor.id}]`;
              huboCambio = true;
              break;
            }
          }
          if (huboCambio) break;
        }
        if (!huboCambio) break;
      }

      const horasFinales = empInWeek.map(id => ({ id, h: getWeeklyHours(id, refDate) })).filter(x => x.h > 0);
      if (horasFinales.length === 0) return;
      const avgFinal = horasFinales.reduce((a, x) => a + x.h, 0) / horasFinales.length;
      horasFinales.filter(x => x.h > avgFinal + maxDiff).forEach(x => {
        const emp = employees.find(e => e.id === x.id);
        warnings.push(`Semana ${weekKey} · ${emp?.nombre || "Empleado"}: ${x.h.toFixed(1)}h (media ${avgFinal.toFixed(1)}h) — desbalance residual.`);
      });
    });
  }

  // ─── Advertencias de cobertura ─────────────────────────────────────────────
  validDays.forEach(day => {
    if (diasSinCobertura.includes(day.dateStr)) return;
    const covVec = getCoverageVector(day.dateStr);
    const demVec = getDemandVecFor(day.date);
    let totalDef = 0;
    for (let s = 0; s < slotsPerDay; s++) totalDef += Math.max(0, demVec[s] - covVec[s]);
    if (totalDef > 0) warnings.push(`${day.dateStr}: déficit de ${Math.round(totalDef / slotsPorHora)} horas-persona sin cubrir.`);
  });

  activeEmployees.forEach(emp => {
    if (!generatedShifts.some(s => s.employee_id === emp.id)) {
      warnings.push(`${emp.nombre || "Empleado"}: sin turnos asignados en el período.`);
    }
  });

  return { shifts: generatedShifts, warnings };
}
