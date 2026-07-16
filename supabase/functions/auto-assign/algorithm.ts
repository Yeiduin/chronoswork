// ============================================================
// Edge Function: auto-assign — Algoritmo de asignación de turnos
// Porte completo de generateAutomaticShifts.js v4.1 para Deno
// Incluye v6: skills, preferencias, domingos, embarazo, equidad
// ============================================================

import { format, addDays, getDay, getISOWeek } from "npm:date-fns@4";
import {
  LEGAL_DEFAULTS_CO, DEMAND_CURVE_DIURNA, DEMAND_CURVE_NOCTURNA,
  DEMAND_CURVE_FIN_SEMANA, CANONICAL_DAY_STARTS, isNightHour,
  resolveBreakPolicy, BreakRule,
} from "./labor-catalog.ts";
import { getLocalISOString, dateToStr, parseLocalDate } from "./date-utils.ts";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface Employee {
  id: string; nombre?: string; cargo?: string;
  valor_hora?: number; activo?: boolean;
  solo_nocturno?: boolean; solo_diurno?: boolean;
  jornada_preferida?: string; horas_semanales_contrato?: number;
  horas_nocturnas_max_semana?: number; horas_max_semana?: number;
  horas_max_diarias?: number;
  permite_partido?: boolean;
  dias_descanso_semana?: number;
  dias_descanso_fijos?: number[];
  // v6: Nuevos campos
  skills?: string[];
  seniority?: number;
  fecha_ingreso?: string;
  max_domingos_mes?: number;
  embarazada?: boolean;
  preferencias_horario?: Array<{
    day_of_week: number;
    start_hour: string;
    end_hour: string;
    available: boolean;
  }>;
}

export interface ShiftTemplate {
  id: string; area_id?: string; nombre?: string;
  hora_inicio: string; hora_fin: string;
  hora_inicio_2?: string; hora_fin_2?: string;
  cruza_medianoche?: boolean; color?: string;
  shift_kind?: string; break_minutos?: number;
  split_break_minutos?: number;
  disponibilidad_recargo_porcentaje?: number;
  paga_recargo_nocturno?: boolean;
}

export interface Absence {
  employee_id: string; fecha_inicio: string; fecha_fin: string;
  tipo?: string;
}

export interface DemandSlot {
  day_of_week: number; start_hour: number; end_hour: number;
  required_staff: number;
}

export interface DemandException {
  date: string;
  slots: Array<{ start_hour: number; end_hour: number; required_staff: number }>;
}

export interface EmployeePreference {
  employee_id: string;
  day_of_week: number;
  start_hour: string;
  end_hour: string;
  available: boolean;
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
  // v6: Nuevos parámetros
  requiredSkills?: string[];
  demandExceptions?: DemandException[];
  employeePreferences?: EmployeePreference[];
  maxDomingosMes?: number;
  consecutividadHorario?: boolean;
  equidadFinSemana?: boolean;
  pesoSeniority?: boolean;
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

function timeToMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ─── Vector de demanda ───────────────────────────────────────────────────────
function buildDemandVector(
  dayOfWeek: number, demandSlots: DemandSlot[],
  numEmployees: number, isWeekend: boolean, slotsPerHour = 4,
  demandException: DemandException | null = null
): number[] {
  const spd = getSlotsPerDay(slotsPerHour);
  const vec = new Array(spd).fill(0);

  // v6: Prioridad 1 — excepción de demanda por fecha específica
  if (demandException && Array.isArray(demandException.slots) && demandException.slots.length > 0) {
    demandException.slots.forEach(row => {
      const ss = Math.max(0, Math.min((row.start_hour || 0) * slotsPerHour, spd));
      const es = Math.max(ss, Math.min((row.end_hour || 24) * slotsPerHour, spd));
      for (let s = ss; s < es; s++) vec[s] = Math.max(vec[s], row.required_staff || 1);
    });
    return vec;
  }

  // Prioridad 2 — config del área por día de la semana
  const safeDemandSlots = Array.isArray(demandSlots) ? demandSlots : [];
  const dayRows = safeDemandSlots.filter(s => s && s.day_of_week === dayOfWeek);

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

  // SPLIT_LARGO: como PARTIDO pero con gap largo (retail, restaurante)
  if (kind === "SPLIT_LARGO" && tpl.hora_inicio_2 && tpl.hora_fin_2) {
    return [
      {
        employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
        end_time: getLocalISOString(dateStr, tpl.hora_fin),
        periodo: dateStr.slice(0, 7), shift_type: "custom",
        template_id: tpl.id, break_minutes: 0,
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

  // ON_CALL_REMOTO: como DISPONIBILIDAD pero marcado como remoto
  if (kind === "ON_CALL_REMOTO") {
    return [{
      employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
      end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
      periodo: dateStr.slice(0, 7), shift_type: "custom",
      template_id: tpl.id, break_minutes: 0,
      shift_kind: kind, bloque: 1, disponibilidad: true,
      recargo_porcentaje: tpl.disponibilidad_recargo_porcentaje || 0,
    }];
  }

  // DOBLE: turno de 16h+ con descanso largo interno
  if (kind === "DOBLE") {
    const blocks: GeneratedShift[] = [{
      employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
      end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
      periodo: dateStr.slice(0, 7), shift_type: "custom",
      template_id: tpl.id, break_minutes: tpl.break_minutos || 240,
      shift_kind: kind, bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
    }];
    if (tpl.hora_inicio_2 && tpl.hora_fin_2) {
      blocks.push({
        employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio_2),
        end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin_2) : getLocalISOString(dateStr, tpl.hora_fin_2),
        periodo: dateStr.slice(0, 7), shift_type: "custom",
        template_id: tpl.id, break_minutes: 0,
        shift_kind: kind, bloque: 2, disponibilidad: false, recargo_porcentaje: 0,
      });
    }
    return blocks;
  }

  // REFUERZO: standby presencial, sin franja fija
  if (kind === "REFUERZO") {
    return [{
      employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
      end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
      periodo: dateStr.slice(0, 7), shift_type: "custom",
      template_id: tpl.id, break_minutes: 0,
      shift_kind: kind, bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
    }];
  }

  // FLEXIBLE: el empleado elige dentro de una ventana
  if (kind === "FLEXIBLE") {
    return [{
      employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
      end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
      periodo: dateStr.slice(0, 7), shift_type: "custom",
      template_id: tpl.id, break_minutes: tpl.break_minutos || 0,
      shift_kind: kind, bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
    }];
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

  // STANDARD, NOCTURNO, ROTATIVO, CUSTOM y cualquier otro tipo
  return [{
    employee_id: "", start_time: getLocalISOString(dateStr, tpl.hora_inicio),
    end_time: tpl.cruza_medianoche ? getLocalISOString(nextDayStr, tpl.hora_fin) : getLocalISOString(dateStr, tpl.hora_fin),
    periodo: dateStr.slice(0, 7), shift_type: "custom",
    template_id: tpl.id, break_minutes: tpl.break_minutos || 0,
    shift_kind: kind, bloque: 1, disponibilidad: false, recargo_porcentaje: 0,
  }];
}

// ─── shiftPagaNocturno ───────────────────────────────────────────────────────
function shiftPagaNocturno(tpl: ShiftTemplate | null | undefined): boolean {
  if (!tpl) return false;
  if (tpl.shift_kind === "NOCTURNO" || tpl.shift_kind === "DOBLE") return true;
  if (tpl.shift_kind === "ON_CALL_REMOTO" || tpl.shift_kind === "DISPONIBILIDAD") return false;
  if (tpl.paga_recargo_nocturno) return true;
  const [h] = (tpl.hora_inicio || "00:00").split(":").map(Number);
  return h >= 19; // NOCTURNA_INICIO_H
}

// ─── Generar descansos ───────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

function buildDescansos(
  startHHMM: string, grossMin: number,
  breakPolicy: Record<string, unknown> | null | undefined,
  opts?: { soloBreaks?: boolean }
): { descansos: { tipo: string; inicio: string | null; minutos: number }[]; almuerzoMin: number; breaksCount: number; breakMinutes: number } {
  const bp = resolveBreakPolicy(breakPolicy ?? null);
  const horas = grossMin / 60;
  const reglas = (bp.reglas as BreakRule[] || []).slice().sort((a, b) => (a.desdeHoras || 0) - (b.desdeHoras || 0));

  let reglaElegida: BreakRule | null = null;
  for (const r of reglas) { if (horas >= (r.desdeHoras || 0)) reglaElegida = r; }
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
    // v6: Nuevos parámetros
    requiredSkills = [],
    demandExceptions = [],
    employeePreferences = [],
    maxDomingosMes = 2,
    consecutividadHorario = true,
    equidadFinSemana = true,
    pesoSeniority = false,
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
  const minSlots = Math.round(minHoras * slotsPorHora);
  const maxSlots = Math.round(maxHoras * slotsPorHora);
  const periodoStr = `${year}-${String(month).padStart(2, "0")}`;

  let minEmpDia: number | null = minEmpleadosDia ?? null;
  let maxEmpDia: number | null = maxEmpleadosDia ?? null;

  // ─── v6: Skills requeridos ─────────────────────────────────────────────────
  const safeRequiredSkills = Array.isArray(requiredSkills) ? requiredSkills.filter(s => s && String(s).trim()) : [];

  const hasRequiredSkills = (emp: Employee): boolean => {
    if (safeRequiredSkills.length === 0) return true;
    const empSkills = Array.isArray(emp.skills) ? emp.skills.map(s => String(s).toLowerCase().trim()) : [];
    return safeRequiredSkills.every(req => empSkills.includes(String(req).toLowerCase().trim()));
  };

  // ─── v6: Preferencias granulares ───────────────────────────────────────────
  const safePreferences = Array.isArray(employeePreferences) ? employeePreferences : [];

  const respectsPreferences = (
    empId: string, dayOfWeek: number,
    startTimeStr: string, endTimeStr: string, crossesMidnight: boolean
  ): boolean => {
    if (safePreferences.length === 0) return true;
    const prefs = safePreferences.filter(p => p.employee_id === empId && p.day_of_week === dayOfWeek);
    if (prefs.length === 0) return true;
    const startMin = timeToMinutes(startTimeStr);
    const endMin = crossesMidnight ? timeToMinutes(endTimeStr) + 1440 : timeToMinutes(endTimeStr);
    for (const pref of prefs) {
      if (pref.available === false) {
        const prefStart = timeToMinutes(pref.start_hour);
        const prefEnd = pref.end_hour === "00:00" || pref.end_hour === "24:00"
          ? 1440 : timeToMinutes(pref.end_hour);
        if (startMin < prefEnd && endMin > prefStart) return false;
      }
    }
    return true;
  };

  // ─── v6: Conteo de domingos ────────────────────────────────────────────────
  const domingoCount: Record<string, number> = {};
  [...existing].forEach(s => {
    if (!s.start_time) return;
    const d = new Date(s.start_time);
    if (d.getDay() === 0) {
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const key = `${s.employee_id}_${monthKey}`;
      domingoCount[key] = (domingoCount[key] || 0) + 1;
    }
  });

  const getDomingosMes = (empId: string, dateObj: Date): number => {
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    let count = domingoCount[`${empId}_${monthKey}`] || 0;
    generatedShifts.forEach(s => {
      if (s.employee_id === empId && s.start_time) {
        const d = new Date(s.start_time);
        if (d.getDay() === 0) {
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (mk === monthKey) count++;
        }
      }
    });
    return count;
  };

  const getMaxDomingos = (emp: Employee): number => {
    if (emp.max_domingos_mes != null && emp.max_domingos_mes >= 0) return emp.max_domingos_mes;
    return maxDomingosMes ?? LEGAL_DEFAULTS_CO.maxDomingosMes;
  };

  // ─── v6: Consecutividad de horario ─────────────────────────────────────────
  const lastStartTime: Record<string, { time: string; date: string }> = {};
  [...existing].forEach(s => {
    if (!s.start_time) return;
    const st = String(s.start_time).slice(11, 16);
    const d = String(s.start_time).slice(0, 10);
    if (!lastStartTime[s.employee_id] || d > lastStartTime[s.employee_id].date) {
      lastStartTime[s.employee_id] = { time: st, date: d };
    }
  });

  const getConsecutividadDiff = (empId: string, startTimeStr: string, dateStr: string): number => {
    let bestDiff = Infinity;
    const last = lastStartTime[empId];
    if (last) {
      const lastDate = parseLocalDate(last.date);
      const currDate = parseLocalDate(dateStr);
      const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays === 1) {
        bestDiff = Math.abs(timeToMinutes(startTimeStr) - timeToMinutes(last.time));
      }
    }
    const prevDateStr = dateToStr(addDays(parseLocalDate(dateStr), -1));
    generatedShifts.forEach(s => {
      if (s.employee_id !== empId || !s.start_time) return;
      if (String(s.start_time).slice(0, 10) === prevDateStr) {
        const prevStart = String(s.start_time).slice(11, 16);
        const diff = Math.abs(timeToMinutes(startTimeStr) - timeToMinutes(prevStart));
        if (diff < bestDiff) bestDiff = diff;
      }
    });
    return bestDiff;
  };

  // ─── v6: Equidad de fines de semana ────────────────────────────────────────
  const weekendCount: Record<string, number> = {};
  [...existing].forEach(s => {
    if (!s.start_time) return;
    const d = new Date(s.start_time);
    if (d.getDay() === 0 || d.getDay() === 6) {
      const weekKey = dateToStr(weekBounds(d).monday);
      const key = `${s.employee_id}_${weekKey}`;
      weekendCount[key] = (weekendCount[key] || 0) + 1;
    }
  });

  const getWeekendCount = (empId: string): number => {
    let count = 0;
    for (const [key, val] of Object.entries(weekendCount)) {
      if (key.startsWith(`${empId}_`)) count += val;
    }
    generatedShifts.forEach(s => {
      if (s.employee_id === empId && s.start_time) {
        const d = new Date(s.start_time);
        if (d.getDay() === 0 || d.getDay() === 6) count++;
      }
    });
    return count;
  };

  // ─── v6: Seniority ─────────────────────────────────────────────────────────
  const getSeniorityScore = (emp: Employee): number => {
    if (emp.seniority != null && emp.seniority > 0) return Math.min(10, emp.seniority);
    if (emp.fecha_ingreso) {
      const ingreso = parseLocalDate(emp.fecha_ingreso);
      const years = (Date.now() - ingreso.getTime()) / (365.25 * 86400000);
      return Math.min(10, Math.max(0, years));
    }
    return 0;
  };

  // ─── v6: Demanda por fecha específica ──────────────────────────────────────
  const safeDemandExceptions = Array.isArray(demandExceptions) ? demandExceptions : [];

  const findDemandException = (dateStr: string): DemandException | null => {
    return safeDemandExceptions.find(e => e.date === dateStr) || null;
  };

  // ─── Construir días ────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month, 0).getDate();
  const rawDays: Date[] = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));
  let processDays = rawDays;
  if (inputDias && inputDias.length > 0) {
    processDays = inputDias.filter(d => d.getFullYear() === year && d.getMonth() === month - 1);
  }

  const dayList = processDays.map(d => ({
    date: d, dateStr: dateToStr(d),
    dayOfWeek: getDay(d) === 0 ? 7 : getDay(d),
    dateObj: parseLocalDate(dateToStr(d)),
  }));
  const validDays = dayList.filter(d => diasTrabajoArea.includes(d.dayOfWeek));
  const diasSinCobertura: string[] = [];

  // ─── Clasificar empleados ──────────────────────────────────────────────────
  const empByClass: Record<EmpClass, Employee[]> = { NIGHT_ONLY: [], DAY_ONLY: [], MIXED: [], ANY: [] };
  const activeEmployees = employees.filter(e => e.activo !== false);
  activeEmployees.forEach(e => { empByClass[classifyEmployee(e)].push(e); });

  // ── v5.1: OFICINA automático ──
  // Solo setear maxEmpDia (techo) = total empleados. NO setear minEmpDia
  // porque la FASE 3.5 (piso de personas/día) vacía el día completo si
  // no se alcanza el mínimo — y en OFICINA con descansos rotativos L-V,
  // cualquier día donde alguien descansa queda por debajo del piso y
  // se borran todos sus turnos.
  if (modoOperacion === "OFICINA" && maxEmpDia == null) {
    const officeWorkers = activeEmployees.length;
    if (officeWorkers > 0) {
      maxEmpDia = officeWorkers;
      // minEmpDia se deja como estaba (null si el usuario no lo configuró)
    }
  }

  // ─── Configuración nocturna ────────────────────────────────────────────────
  const nightConfig = is247 ? {
    enabled: true, start: nightConfigRaw?.start || "22:00", end: nightConfigRaw?.end || "06:00",
    minStaff: minEmpleadosNoche || 1, employeeIds: nightConfigRaw?.employeeIds || [],
    soloDedicados: !!nocheSoloDedicados, permiteDiaCubrir: !!permiteDiaCubrirNoche,
  } : null;

  const nightStartSlot = nightConfig ? timeToSlot(nightConfig.start, slotsPorHora) : null;
  const nightEndRaw = nightConfig ? timeToSlot(nightConfig.end, slotsPorHora) : null;
  const nightEndExt = nightConfig ? slotsPerDay + nightEndRaw! : null;

  // ─── Absences map ──────────────────────────────────────────────────────────
  const absenceMap = new Map<string, Absence[]>();
  absences.forEach(a => { const k = a.employee_id; if (!absenceMap.has(k)) absenceMap.set(k, []); absenceMap.get(k)!.push(a); });

  const hasAbsence = (empId: string, dateStr: string) => {
    const list = absenceMap.get(empId);
    if (!list) return false;
    return list.some(a => dateStr >= a.fecha_inicio && dateStr <= a.fecha_fin);
  };

  // ─── Helpers de validación ─────────────────────────────────────────────────
  const isBlocked = (empId: string, dateStr: string) =>
    absences.some(a => a.employee_id === empId && a.fecha_inicio <= dateStr && a.fecha_fin >= dateStr);

  const hasShiftOnDay = (empId: string, dateStr: string) =>
    [...existing, ...generatedShifts].some(s => s.employee_id === empId && String(s.start_time).startsWith(dateStr));

  const extrasSemana = permiteExtras ? 12 : 0;

  const getMaxHoursFor = (emp: Employee): number => {
    let base: number;
    if (emp.horas_max_semana && emp.horas_max_semana > 0) base = emp.horas_max_semana;
    else {
      const h = parseInt(String(emp?.horas_semanales_contrato), 10);
      base = (!isNaN(h) && h > 0 && h <= 60) ? h : maxSemanales;
    }
    return base + extrasSemana;
  };

  const getMaxDailyHours = (emp: Employee): number => {
    if (emp.horas_max_diarias && emp.horas_max_diarias > 0) return parseFloat(String(emp.horas_max_diarias));
    return maxDiarias;
  };

  const getMaxNightHours = (emp: Employee): number => {
    if (emp.horas_nocturnas_max_semana && emp.horas_nocturnas_max_semana > 0)
      return parseInt(String(emp.horas_nocturnas_max_semana), 10);
    return Infinity;
  };

  function weekBounds(dateObj: Date): { monday: Date; sunday: Date } {
    const d = new Date(dateObj);
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dow + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }

  const getWeeklyHours = (empId: string, date: Date): number => {
    const { monday, sunday } = weekBounds(date);
    return [...existing, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .reduce((acc, s) => {
        const sDate = new Date(s.start_time);
        return (sDate >= monday && sDate <= sunday) ? acc + shiftHours(s) : acc;
      }, 0);
  };

  const getWeeklyNightHours = (empId: string, date: Date): number => {
    const { monday, sunday } = weekBounds(date);
    return [...existing, ...generatedShifts]
      .filter(s => s.employee_id === empId)
      .reduce((acc, s) => {
        const sDate = new Date(s.start_time);
        return (sDate >= monday && sDate <= sunday) ? acc + shiftNightHours(s) : acc;
      }, 0);
  };

  const getDailyHours = (empId: string, dateStr: string) =>
    [...existing, ...generatedShifts]
      .filter(s => s.employee_id === empId && String(s.start_time).startsWith(dateStr))
      .reduce((acc, s) => acc + shiftHours(s), 0);

  const getLastShiftEndTime = (empId: string, dateStr: string): string | null => {
    const prevStr = dateToStr(addDays(parseLocalDate(dateStr), -1));
    const prevShifts = [...existing, ...generatedShifts]
      .filter(s => s.employee_id === empId && String(s.start_time).startsWith(prevStr));
    if (!prevShifts.length) return null;
    return prevShifts.reduce((latest, s) =>
      new Date(s.end_time) > new Date(latest.end_time) ? s : latest
    ).end_time;
  };

  // ─── Inicializar cobertura y demanda ───────────────────────────────────────
  const covMap = new Map<string, { s: number; e: number }[]>();
  const demMap = new Map<string, number[]>();
  const rawDemandCache = new Map<string, number[]>();
  const demandVecCache = new Map<string, number[]>();

  const getCoverageVector = (dateStr: string): number[] => {
    const vec = new Array(slotsPerDay).fill(0);
    [...existing, ...generatedShifts].forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const sDateStr = String(s.start_time).split("T")[0];
      const eStr = dateToStr(new Date(s.end_time));
      if (sDateStr === dateStr) {
        const startSlot = timeToSlot(String(s.start_time).split("T")[1].substring(0, 5), slotsPorHora);
        const endSlot = eStr !== dateStr
          ? slotsPerDay
          : timeToSlot(String(s.end_time).split("T")[1].substring(0, 5), slotsPorHora);
        for (let sl = startSlot; sl < Math.min(endSlot, slotsPerDay); sl++) vec[sl]++;
      } else if (eStr === dateStr && sDateStr !== dateStr) {
        const endSlot = timeToSlot(String(s.end_time).split("T")[1].substring(0, 5), slotsPorHora);
        for (let sl = 0; sl < endSlot; sl++) vec[sl]++;
      }
    });
    return vec;
  };

  const addCoverage = (dateStr: string, startSlot: number, endSlot: number) => {
    if (!covMap.has(dateStr)) covMap.set(dateStr, []);
    covMap.get(dateStr)!.push({ s: startSlot, e: endSlot });
  };

  const getRawDemandVecFor = (dateObj: Date): number[] => {
    const ds = dateToStr(dateObj);
    if (rawDemandCache.has(ds)) return rawDemandCache.get(ds)!;
    const dow = getDay(dateObj) === 0 ? 7 : getDay(dateObj);
    const isWk = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const exception = findDemandException(ds);
    const raw = buildDemandVector(dow, demandSlots, employees.length, isWk, slotsPorHora, exception);
    rawDemandCache.set(ds, raw);
    return raw;
  };

  // ── v5: Headcount ──────────────────────────────────────────────────────────
  const typicalShiftSlots = Math.max(minSlots, Math.min(maxSlots, Math.round(8 * slotsPorHora)));
  const dayStartSlot = Math.max(0, Math.min(timeToSlot(horaInicioDia || "04:00", slotsPorHora), slotsPerDay - minSlots));

  let dayEndSlotCfg = slotsPerDay;
  if (horaFinDia != null && String(horaFinDia).trim() !== "") {
    const raw = timeToSlot(horaFinDia, slotsPorHora);
    dayEndSlotCfg = raw <= 0 ? slotsPerDay : Math.min(raw, slotsPerDay);
  }
  dayEndSlotCfg = Math.max(dayEndSlotCfg, dayStartSlot + minSlots);

  const dayWindowStartGlobal = dayStartSlot;
  const dayWindowEndGlobal = nightConfig ? nightStartSlot! : dayEndSlotCfg;

  const rawDayShapeSum = (dateObj: Date): number => {
    const raw = getRawDemandVecFor(dateObj);
    let s = 0;
    for (let i = dayWindowStartGlobal; i < dayWindowEndGlobal; i++) s += raw[i];
    return s;
  };

  const objetivoNoche = nightConfig ? Math.max(0, nightConfig.minStaff || 0) : 0;
  let objetivoDia = maxEmpDia != null ? Math.max(0, maxEmpDia - objetivoNoche) : null;
  const usaHeadcount = maxEmpDia != null;

  let headcountScale: number | null = null;
  if (usaHeadcount && objetivoDia! > 0) {
    let peakShape = 0;
    for (const day of validDays) peakShape = Math.max(peakShape, rawDayShapeSum(day.date));
    if (peakShape > 0) headcountScale = (objetivoDia! * typicalShiftSlots) / peakShape;
  }

  const getDemandVecFor = (dateObj: Date): number[] => {
    const ds = dateToStr(dateObj);
    if (demandVecCache.has(ds)) return demandVecCache.get(ds)!;
    const raw = getRawDemandVecFor(dateObj);
    if (!usaHeadcount || headcountScale == null) {
      if (usaHeadcount && objetivoDia === 0) {
        const z = raw.slice();
        for (let s = dayWindowStartGlobal; s < dayWindowEndGlobal; s++) z[s] = 0;
        demandVecCache.set(ds, z);
        return z;
      }
      demandVecCache.set(ds, raw);
      return raw;
    }
    const v = raw.slice();
    for (let s = dayWindowStartGlobal; s < dayWindowEndGlobal; s++) {
      v[s] = Math.max(0, Math.round(raw[s] * headcountScale));
    }
    demandVecCache.set(ds, v);
    return v;
  };

  const dayDemandWeight = (dateObj: Date): number => {
    const vec = getDemandVecFor(dateObj);
    let sum = 0;
    for (let s = 0; s < slotsPerDay; s++) {
      const h = Math.floor(s / slotsPorHora);
      const floor = (nightConfig && isNightHour(h)) ? objetivoNoche : 0;
      sum += Math.max(vec[s] || 0, floor);
    }
    return sum;
  };

  const distinctPeopleOnDay = (dateStr: string): number => {
    const ids = new Set<string>();
    [...existing, ...generatedShifts].forEach(s => {
      if (String(s.start_time).startsWith(dateStr)) ids.add(s.employee_id);
    });
    return ids.size;
  };

  const canWorkNight = (emp: Employee): boolean => {
    const cls = classifyEmployee(emp);
    if (cls === "NIGHT_ONLY" || cls === "MIXED") return true;
    if (cls === "DAY_ONLY") return false;
    return nightConfig?.permiteDiaCubrir ?? false;
  };

  const canWorkDay = (emp: Employee): boolean => classifyEmployee(emp) !== "NIGHT_ONLY";

  // ─── employeeEligible ──────────────────────────────────────────────────────
  const employeeEligible = (
    emp: Employee,
    ctx: {
      startDateStr: string; startDateObj: Date; startTimeStr: string;
      endTimeStr?: string; shiftHrs: number; nightHrs: number; entersNight: boolean;
    }
  ): boolean => {
    // v6: Skills requeridos
    if (!hasRequiredSkills(emp)) return false;
    if (ctx.entersNight && !canWorkNight(emp)) return false;
    if (!ctx.entersNight && !canWorkDay(emp)) return false;
    // v6: Embarazo — no nocturno, no >8h/día
    if (emp.embarazada) {
      if (ctx.nightHrs > 0) return false;
      if (ctx.shiftHrs > 8) return false;
    }
    // BUGFIX: nocturno dedicado solo turnos que empiecen en ventana nocturna
    if (canWorkDay(emp) === false && nightConfig) {
      const startH = parseInt(ctx.startTimeStr.split(":")[0], 10);
      const nightStartH = parseInt(nightConfig.start.split(":")[0], 10);
      const nightEndH = parseInt(nightConfig.end.split(":")[0], 10);
      const inNightWindow = startH >= nightStartH || startH < nightEndH;
      if (!inNightWindow) return false;
    }
    if (isBlocked(emp.id, ctx.startDateStr)) return false;
    if (hasShiftOnDay(emp.id, ctx.startDateStr)) return false;
    // v6: Preferencias granulares de horario
    const crossesMidnight = !!(ctx.endTimeStr && ctx.startTimeStr && timeToMinutes(ctx.endTimeStr) <= timeToMinutes(ctx.startTimeStr));
    if (!respectsPreferences(emp.id, ctx.startDateObj.getDay() === 0 ? 7 : ctx.startDateObj.getDay(), ctx.startTimeStr, ctx.endTimeStr || "23:59", crossesMidnight)) return false;
    // v6: Máximo de domingos por mes
    if (ctx.startDateObj.getDay() === 0) {
      if (getDomingosMes(emp.id, ctx.startDateObj) >= getMaxDomingos(emp)) return false;
    }
    if (getWeeklyHours(emp.id, ctx.startDateObj) + ctx.shiftHrs > getMaxHoursFor(emp)) return false;
    if (getDailyHours(emp.id, ctx.startDateStr) + ctx.shiftHrs > getMaxDailyHours(emp)) return false;
    if (ctx.nightHrs > 0 && getWeeklyNightHours(emp.id, ctx.startDateObj) + ctx.nightHrs > getMaxNightHours(emp)) return false;
    const lastEnd = getLastShiftEndTime(emp.id, ctx.startDateStr);
    if (lastEnd) {
      const gapHrs = (new Date(`${ctx.startDateStr}T${ctx.startTimeStr}`).getTime() - new Date(lastEnd).getTime()) / 3600000;
      if (gapHrs < minEntreJornadas) return false;
    }
    return true;
  };

  // ─── pickCandidate ─────────────────────────────────────────────────────────
  const slotHash = (id: string, key: string): number => {
    let x = 0;
    const str = `${id}|${key}`;
    for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
    return x;
  };

  const pickCandidate = (
    pool: Employee[],
    ctx: {
      startDateStr: string; startDateObj: Date; startTimeStr: string;
      endTimeStr?: string; shiftHrs: number; nightHrs: number; entersNight: boolean;
    },
    startDateObj: Date
  ): Employee | null => {
    const candidates = pool.filter(emp => employeeEligible(emp, ctx));
    if (candidates.length === 0) return null;
    const isWeekendDay = startDateObj.getDay() === 0 || startDateObj.getDay() === 6;
    candidates.sort((a, b) => {
      if (estrategia === "EMPLOYEE_PREF") {
        if (a.solo_nocturno !== b.solo_nocturno) return a.solo_nocturno ? -1 : 1;
        if (a.solo_diurno !== b.solo_diurno) return a.solo_diurno ? -1 : 1;
      }
      // v6: Equidad de fines de semana
      if (equidadFinSemana && isWeekendDay) {
        const weA = getWeekendCount(a.id);
        const weB = getWeekendCount(b.id);
        if (weA !== weB) return weA - weB;
      }
      const wa = getWeeklyHours(a.id, startDateObj);
      const wb = getWeeklyHours(b.id, startDateObj);
      if (Math.abs(wa - wb) > 0.01) return wa - wb;
      // v6: Consecutividad de horario
      if (consecutividadHorario && ctx?.startTimeStr && ctx?.startDateStr) {
        const diffA = getConsecutividadDiff(a.id, ctx.startTimeStr, ctx.startDateStr);
        const diffB = getConsecutividadDiff(b.id, ctx.startTimeStr, ctx.startDateStr);
        if (diffA !== diffB) return diffA - diffB;
      }
      // v6: Seniority
      if (pesoSeniority) {
        const senA = getSeniorityScore(a);
        const senB = getSeniorityScore(b);
        if (Math.abs(senA - senB) > 0.1) return senB - senA;
      }
      if (rotarSlots && ctx?.startTimeStr) {
        return slotHash(a.id, ctx.startTimeStr) - slotHash(b.id, ctx.startTimeStr);
      }
      return 0;
    });
    return candidates[0];
  };

  // ─── Construir turnos existentes ───────────────────────────────────────────
  existing.forEach(s => {
    const dateStr = dateToStr(new Date(s.start_time));
    const startSlot = timeToSlot(new Date(s.start_time).toISOString().slice(11, 16), slotsPorHora);
    let endSlot = timeToSlot(new Date(s.end_time).toISOString().slice(11, 16), slotsPorHora);
    if (dateToStr(new Date(s.end_time)) !== dateStr) endSlot += slotsPerDay;
    addCoverage(dateStr, startSlot, endSlot);
  });

  // ─── Construir pool de templates ───────────────────────────────────────────
  const tplByDay = new Map<string, GeneratedShift[]>();
  dayList.forEach(day => {
    const nextDay = addDays(day.date, 1);
    const nextStr = dateToStr(nextDay);
    const dayTpls: GeneratedShift[] = [];
    templates.forEach(t => {
      expandTemplateToShifts(t, day.dateStr, nextStr).forEach(ts => dayTpls.push(ts));
    });
    tplByDay.set(day.dateStr, dayTpls);
  });

  // ─── FASE 0: Asignar descansos ─────────────────────────────────────────────
  const restDays = new Set<string>();
  const restsPerDay: Record<string, number> = {};
  const restsNightPerDay: Record<string, number> = {};
  const dedicadosNoche = new Set([...empByClass.NIGHT_ONLY, ...empByClass.MIXED].map(e => e.id));
  const dedicadosCount = dedicadosNoche.size;
  const minNoche = nightConfig ? nightConfig.minStaff : 0;

  activeEmployees.forEach((emp, empIdx) => {
    const esDedicadoNoche = dedicadosNoche.has(emp.id);
    const requiredRests = emp.dias_descanso_fijos?.length
      ? emp.dias_descanso_fijos.length
      : (emp.dias_descanso_semana || LEGAL_DEFAULTS_CO.diasDescansoSemana);

    const weeks: Record<string, typeof dayList> = {};
    validDays.forEach(day => {
      const { monday } = weekBounds(day.date);
      const weekKey = dateToStr(monday);
      (weeks[weekKey] ||= []).push(day);
    });

    Object.values(weeks).forEach((weekDays) => {
      if (weekDays.length <= requiredRests) return;
      const restCap = Math.max(1, Math.floor(activeEmployees.length / 3));
      const restCapNoche = Math.max(0, dedicadosCount - Math.max(1, minNoche));

      const sortedByDemand = [...weekDays].sort((a, b) => {
        // v6: Priorizar domingos como descanso para empleados cerca del límite
        const domA = a.date.getDay() === 0 ? getDomingosMes(emp.id, a.date) : -1;
        const domB = b.date.getDay() === 0 ? getDomingosMes(emp.id, b.date) : -1;
        const maxDom = getMaxDomingos(emp);
        if (domA >= 0 && domB >= 0) {
          if (domA !== domB) return domB - domA;
        } else if (domA >= 0 && domA >= maxDom - 1) {
          return -1;
        } else if (domB >= 0 && domB >= maxDom - 1) {
          return 1;
        }
        const sumA = getDemandVecFor(a.date).reduce((s, v) => s + v, 0);
        const sumB = getDemandVecFor(b.date).reduce((s, v) => s + v, 0);
        if (sumA !== sumB) return sumA - sumB;
        return (restsPerDay[a.dateStr] || 0) - (restsPerDay[b.dateStr] || 0);
      });

      const offset = empIdx % 7;
      const sorted = sortedByDemand.map((_, i) => sortedByDemand[(i + offset) % sortedByDemand.length]);

      let assigned = 0;
      for (const day of sorted) {
        if (assigned >= requiredRests) break;
        if (isBlocked(emp.id, day.dateStr)) continue;
        if ((restsPerDay[day.dateStr] || 0) >= restCap) continue;
        if (esDedicadoNoche && (restsNightPerDay[day.dateStr] || 0) >= restCapNoche) continue;
        if (emp.dias_descanso_fijos?.length && !emp.dias_descanso_fijos.includes(day.dayOfWeek)) continue;
        restDays.add(`${emp.id}_${day.dateStr}`);
        restsPerDay[day.dateStr] = (restsPerDay[day.dateStr] || 0) + 1;
        if (esDedicadoNoche) restsNightPerDay[day.dateStr] = (restsNightPerDay[day.dateStr] || 0) + 1;
        assigned++;
      }
    });
  });

  // ─── FASE 1: Cobertura NOCTURNA ────────────────────────────────────────────
  if (nightConfig) {
    const nightPool: Employee[] = [];
    if (nightConfig.employeeIds?.length) {
      employees.forEach(e => {
        if (nightConfig.employeeIds.includes(e.id) && !nightPool.includes(e)) nightPool.push(e);
      });
    }
    const dedicados = [...empByClass.NIGHT_ONLY, ...empByClass.MIXED];
    dedicados.forEach(e => { if (!nightPool.includes(e)) nightPool.push(e); });
    const baseInsuficiente = nightPool.length < nightConfig.minStaff || nightPool.length === 0;

    if (nightConfig.permiteDiaCubrir || !nightConfig.soloDedicados) {
      empByClass.ANY.forEach(e => { if (!nightPool.includes(e)) nightPool.push(e); });
    } else if (baseInsuficiente) {
      warnings.push(`Pool nocturno insuficiente (${nightPool.length} de ${nightConfig.minStaff} requeridos) con 'solo dedicados' activado. Asignando con el personal disponible.`);
    }
    if (nightPool.length === 0) {
      warnings.push("No hay empleados habilitados para la noche en esta área 24/7.");
    }

    const placeOneNightBlock = (day: typeof validDays[0]): boolean => {
      const dNextObj = addDays(day.date, 1);
      const dNextStr = dateToStr(dNextObj);
      const demD = getDemandVecFor(day.date);
      const demN = getDemandVecFor(dNextObj);
      const covD = getCoverageVector(day.dateStr);
      const covN = getCoverageVector(dNextStr);

      const nightVal = (i: number) => {
        const onNext = i >= slotsPerDay;
        const localSlot = i - (onNext ? slotsPerDay : 0);
        const dem = Math.max((onNext ? demN : demD)[localSlot] || 0, nightConfig.minStaff);
        const cov = (onNext ? covN : covD)[localSlot] || 0;
        return { dem, cov, def: Math.max(0, dem - cov) };
      };

      let best: { start: number; dur: number; score: number } | null = null;
      for (let start = nightStartSlot!; start + minSlots <= nightEndExt!; start += snapSlots) {
        const tope = Math.min(start + maxSlots, nightEndExt!);
        let dur = minSlots;
        for (let s = start + minSlots; s < tope; s += snapSlots) {
          let d = 0;
          for (let k = 0; k < snapSlots && (s + k) < tope; k++) d += nightVal(s + k).def;
          if (d > 0) dur = (s - start) + snapSlots;
        }
        dur = Math.max(minSlots, Math.min(dur, nightEndExt! - start, maxSlots));

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

      if (maxEmpDia != null && distinctPeopleOnDay(startDateStr) >= maxEmpDia) return false;

      const proposed = { start_time: getLocalISOString(startDateStr, startTimeStr), end_time: getLocalISOString(endDateStr, endTimeStr) };
      const nightHrs = shiftNightHours(proposed);

      const candidate = pickCandidate(nightPool, {
        startDateStr, startDateObj, startTimeStr, endTimeStr, shiftHrs, nightHrs, entersNight: true,
      }, startDateObj);
      if (!candidate) return false;

      const nb = buildDescansos(startTimeStr, shiftHrs * 60, bp);
      generatedShifts.push({
        employee_id: candidate.id,
        template_id: undefined,
        start_time: proposed.start_time,
        end_time: proposed.end_time,
        shift_type: "night",
        periodo: periodoStr,
        break_minutes: nb.breakMinutes,
        almuerzo_minutos: nb.almuerzoMin,
        breaks_15_count: nb.breaksCount,
        descansos: nb.descansos,
        shift_kind: "NOCTURNO",
        bloque: 1,
        disponibilidad: false,
        recargo_porcentaje: 0,
        observaciones: `Auto-asignado v4.1 · Turno nocturno ${startTimeStr}-${endTimeStr} (cobertura 24/7)`,
      });
      return true;
    };

    const nightDaysSorted = [...validDays].sort((a, b) => dayDemandWeight(b.date) - dayDemandWeight(a.date));
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

    for (const day of validDays) {
      const dNextStr = dateToStr(addDays(day.date, 1));
      const demD = getDemandVecFor(day.date);
      const demN = getDemandVecFor(addDays(day.date, 1));
      const covDfin = getCoverageVector(day.dateStr);
      const covNfin = getCoverageVector(dNextStr);
      let nightDeficit = 0;
      for (let i = nightStartSlot!; i < nightEndExt!; i++) {
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

  // ─── FASE 2: Cobertura DIURNA ──────────────────────────────────────────────
  if (modoOperacion === "OFICINA" || is247) {
    const dayPool = [...empByClass.DAY_ONLY, ...empByClass.MIXED, ...empByClass.ANY];
    const dayMinFloor = is247 ? 1 : 0;
    const dayWindowStart = dayStartSlot;
    const dayWindowEnd = nightConfig ? nightStartSlot! : dayEndSlotCfg;

    const daysSorted = [...validDays].sort((a, b) => dayDemandWeight(b.date) - dayDemandWeight(a.date));

    let changed = true;
    let iterations = 0;
    const MAX_ITER = validDays.length * 45 + 10;

    while (changed && iterations < MAX_ITER) {
      changed = false;
      iterations++;

      for (const day of daysSorted) {
        if (maxEmpDia != null && distinctPeopleOnDay(day.dateStr) >= maxEmpDia) continue;
        const demVec = getDemandVecFor(day.date);
        const covVec = getCoverageVector(day.dateStr);
        const effDem = (s: number) => Math.max(demVec[s] || 0, (s >= dayWindowStart && s < dayWindowEnd) ? dayMinFloor : 0);
        const defVec = new Array(slotsPerDay).fill(0);
        for (let s = dayWindowStart; s < dayWindowEnd; s++) defVec[s] = Math.max(0, effDem(s) - covVec[s]);
        const totalDeficit = defVec.reduce((s, v) => s + v, 0);
        if (totalDeficit === 0) continue;

        const earlyDeficit = defVec.slice(dayWindowStart, 9 * slotsPorHora).reduce((a, b) => a + b, 0);
        const lateDeficit = defVec.slice(Math.max(dayWindowStart, 13 * slotsPorHora), dayWindowEnd).reduce((a, b) => a + b, 0);

        const canonicalSlots = CANONICAL_DAY_STARTS
          .map(([h, m]) => h * slotsPorHora + Math.floor(m / (60 / slotsPorHora)))
          .filter(s => s >= dayWindowStart && s <= dayWindowEnd - minSlots);

        const allCandidateStarts = new Set(canonicalSlots);
        for (let s = dayWindowStart; s <= dayWindowEnd - minSlots; s += snapSlots) {
          allCandidateStarts.add(s);
        }

        const scored: { start: number; score: number }[] = [];
        for (const start of allCandidateStarts) {
          const tope = Math.min(start + maxSlots, dayWindowEnd);
          let score = 0;
          for (let s = start; s < tope; s++) {
            score += defVec[s];
            if (covVec[s] >= effDem(s)) score -= 0.3;
          }
          if (canonicalSlots.includes(start)) score += 0.5;
          if (start < 9 * slotsPorHora && earlyDeficit > 0) score += earlyDeficit * 0.5;
          if (start >= 16 * slotsPorHora && lateDeficit > 0) score += lateDeficit * 0.5;
          if (score > 0) scored.push({ start, score });
        }
        scored.sort((a, b) => b.score - a.score);

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
            variants.push(nightStartLegal - start);
          }

          for (const dur of variants) {
            if (dur < minSlots) continue;
            const startSlotAbs = start;
            const endSlotAbs = start + dur;
            const startTimeStr = slotToTime(startSlotAbs, slotsPorHora);
            const endTimeStr = slotToTime(endSlotAbs, slotsPorHora);
            const shiftHrs = dur / slotsPorHora;
            const endOnNextDay = endSlotAbs >= slotsPerDay;
            const endDateStr = endOnNextDay ? dateToStr(addDays(day.date, 1)) : day.dateStr;
            const proposed = {
              start_time: getLocalISOString(day.dateStr, startTimeStr),
              end_time: getLocalISOString(endDateStr, endTimeStr),
            };
            const nightHrs = shiftNightHours(proposed);
            const entersNight = nightConfig
              ? (start < nightEndRaw! || (start + dur) > nightStartSlot!)
              : false;
            const candidate = pickCandidate(dayPool, {
              startDateStr: day.dateStr, startDateObj: day.date, startTimeStr,
              endTimeStr, shiftHrs, nightHrs, entersNight,
            }, day.date);
            if (!candidate) continue;

            const db = buildDescansos(startTimeStr, shiftHrs * 60, bp);
            generatedShifts.push({
              employee_id: candidate.id,
              template_id: undefined,
              start_time: proposed.start_time,
              end_time: proposed.end_time,
              shift_type: "custom",
              periodo: periodoStr,
              break_minutes: db.breakMinutes,
              almuerzo_minutos: db.almuerzoMin,
              breaks_15_count: db.breaksCount,
              descansos: db.descansos,
              shift_kind: nightHrs > 0 ? "NOCTURNO" : "STANDARD",
              bloque: 1,
              disponibilidad: false,
              recargo_porcentaje: 0,
              observaciones: `Auto-asignado v5 · Slot ${startTimeStr}-${endTimeStr}${nightHrs > 0 ? " (con recargo nocturno)" : ""} · ${estrategia}`,
            });
            changed = true;
            placed = true;
            break;
          }
          if (placed) break;
        }
      }
    }
  }

  // ─── FASE 3: Templates ─────────────────────────────────────────────────────
  if (Array.isArray(templates) && templates.length > 0) {
    let tplChanged = true;
    let tplIter = 0;
    const MAX_TPL_ITER = employees.length * validDays.length + 10;
    while (tplChanged && tplIter < MAX_TPL_ITER) {
      tplChanged = false;
      tplIter++;
      for (const day of validDays) {
        for (const tpl of templates) {
          if (!tpl.hora_inicio || !tpl.hora_fin) continue;
          // v6: Permitir SPLIT_LARGO y DOBLE solo si permitePartidos; REFUERZO y FLEXIBLE siempre
          if ((tpl.shift_kind === "PARTIDO" || tpl.shift_kind === "SPLIT_LARGO" || tpl.shift_kind === "DOBLE") && !permitePartidos) continue;

          const covVec = getCoverageVector(day.dateStr);
          const demVec = getDemandVecFor(day.date);
          const tplStart = timeToSlot(tpl.hora_inicio, slotsPorHora);
          const tplEnd = tpl.cruza_medianoche
            ? slotsPerDay + timeToSlot(tpl.hora_fin, slotsPorHora)
            : timeToSlot(tpl.hora_fin, slotsPorHora);

          let totalDeficit = 0;
          for (let s = tplStart; s < tplEnd && s < slotsPerDay; s++) {
            const slotIdx = s >= slotsPerDay ? s - slotsPerDay : s;
            totalDeficit += Math.max(0, demVec[slotIdx] - covVec[slotIdx]);
          }
          // v6: SPLIT_LARGO y DOBLE también tienen segundo bloque
          const hasSecondBlock = ["PARTIDO", "SPLIT_LARGO", "DOBLE"].includes(tpl.shift_kind || "");
          if (hasSecondBlock && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            const t2s = timeToSlot(tpl.hora_inicio_2, slotsPorHora);
            const t2e = timeToSlot(tpl.hora_fin_2, slotsPorHora);
            for (let s = t2s; s < t2e; s++) totalDeficit += Math.max(0, demVec[s] - covVec[s]);
          }
          if (totalDeficit <= 0) continue;

          let tplHrs: number;
          if (tpl.cruza_medianoche) {
            tplHrs = ((slotsPerDay - tplStart) + timeToSlot(tpl.hora_fin, slotsPorHora)) / slotsPorHora;
          } else {
            tplHrs = (tplEnd - tplStart) / slotsPorHora;
          }
          if (hasSecondBlock && tpl.hora_inicio_2 && tpl.hora_fin_2) {
            tplHrs += (timeToSlot(tpl.hora_fin_2, slotsPorHora) - timeToSlot(tpl.hora_inicio_2, slotsPorHora)) / slotsPorHora;
          }
          if (tplHrs < minHoras) continue;

          const nextDay = dateToStr(addDays(day.date, 1));
          const blocks = expandTemplateToShifts(tpl, day.dateStr, nextDay);
          const nightHrs = blocks.reduce((a, b) => a + shiftNightHours(b), 0);
          const tplEntersNight = nightConfig
            ? (tplStart < nightEndRaw! || tplEnd > nightStartSlot!)
            : false;

          const candidate = pickCandidate(employees, {
            startDateStr: day.dateStr, startDateObj: day.date,
            startTimeStr: tpl.hora_inicio, endTimeStr: tpl.hora_fin,
            shiftHrs: tplHrs, nightHrs,
            entersNight: tplEntersNight,
          }, day.date);
          if (!candidate) continue;

          blocks.forEach(b => {
            const grossMin = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000;
            const startHHMM = String(b.start_time).slice(11, 16);
            const esMultiBloque = ["PARTIDO", "SPLIT_LARGO", "DOBLE"].includes(b.shift_kind || "");
            const tb = buildDescansos(startHHMM, grossMin, bp, { soloBreaks: esMultiBloque });
            const descansos = [...tb.descansos];
            if (!esMultiBloque && (b.break_minutes || 0) > 0) {
              descansos.unshift({ tipo: "ALMUERZO", inicio: null, minutos: b.break_minutes || 0 });
            }
            generatedShifts.push({
              employee_id: candidate.id,
              template_id: tpl.id,
              start_time: b.start_time,
              end_time: b.end_time,
              shift_type: "custom",
              periodo: periodoStr,
              break_minutes: b.break_minutes,
              almuerzo_minutos: b.break_minutes,
              breaks_15_count: tb.breaksCount,
              descansos,
              shift_kind: b.shift_kind,
              bloque: b.bloque,
              disponibilidad: b.disponibilidad,
              recargo_porcentaje: b.recargo_porcentaje,
              observaciones: `Auto-asignado v4.1 · ${tpl.nombre || ""} (${tpl.shift_kind})`,
            });
          });
          tplChanged = true;
        }
      }
    }
  }

  // ─── FASE 3.5: Piso de personas/día ────────────────────────────────────────
  if (minEmpDia != null) {
    const daysByDemandAsc = [...validDays].sort((a, b) => dayDemandWeight(a.date) - dayDemandWeight(b.date));
    let huboVaciado = true;
    let pases = 0;
    while (huboVaciado && pases < validDays.length + 1) {
      huboVaciado = false;
      pases++;
      for (const day of daysByDemandAsc) {
        if (diasSinCobertura.includes(day.dateStr)) continue;
        const personas = distinctPeopleOnDay(day.dateStr);
        if (personas > 0 && personas < minEmpDia) {
          for (let i = generatedShifts.length - 1; i >= 0; i--) {
            if (String(generatedShifts[i].start_time).startsWith(day.dateStr)) {
              generatedShifts.splice(i, 1);
            }
          }
          diasSinCobertura.push(day.dateStr);
          warnings.push(
            `${day.dateStr}: sin trabajadores disponibles — ` +
            `no se alcanza el mínimo de ${minEmpDia} personas (solo ${personas}). ` +
            `Día dejado sin cubrir para priorizar los días de mayor demanda.`
          );
          huboVaciado = true;
        }
      }
    }
  }

  // ─── FASE 4: Balanceo de carga SEMANAL ─────────────────────────────────────
  if (balancearCarga && generatedShifts.length > 0) {
    const maxDiff = 4;
    const MAX_REBALANCE_PASSES = 3;

    const weekKeys = new Set<string>();
    validDays.forEach(day => weekKeys.add(dateToStr(weekBounds(day.date).monday)));

    weekKeys.forEach(weekKey => {
      const refDate = parseLocalDate(weekKey);
      const { monday, sunday } = weekBounds(refDate);

      for (let pass = 0; pass < MAX_REBALANCE_PASSES; pass++) {
        const horasPorEmp = activeEmployees
          .map(emp => ({ emp, h: getWeeklyHours(emp.id, refDate) }))
          .filter(x => x.h > 0)
          .sort((a, b) => b.h - a.h);

        if (horasPorEmp.length < 2) break;
        const avg = horasPorEmp.reduce((a, x) => a + x.h, 0) / horasPorEmp.length;

        const sobrecargados = horasPorEmp.filter(x => x.h > avg + maxDiff);
        if (sobrecargados.length === 0) break;

        let huboCambio = false;

        for (const { emp: empSobre } of sobrecargados) {
          const turnosSobre = generatedShifts.filter(s => {
            if (s.employee_id !== empSobre.id) return false;
            const sd = new Date(s.start_time);
            return sd >= monday && sd <= sunday;
          });

          for (const turno of turnosSobre) {
            const turnoHrs = shiftHours(turno);
            const turnoDateStr = String(turno.start_time).slice(0, 10);
            const turnoStartStr = String(turno.start_time).slice(11, 16);
            const tEndStr = String(turno.end_time).slice(11, 16);
            const tCrosses = String(turno.end_time).slice(0, 10) !== turnoDateStr;
            const tStartSlot = timeToSlot(turnoStartStr, slotsPorHora);
            const tEndSlot = (tCrosses ? slotsPerDay : 0) + timeToSlot(tEndStr, slotsPorHora);
            const turnoEntersNight = nightConfig
              ? (tStartSlot < nightEndRaw! || tEndSlot > nightStartSlot!)
              : false;

            const subcargados = activeEmployees
              .filter(e => e.id !== empSobre.id)
              .map(e => ({ e, h: getWeeklyHours(e.id, refDate) }))
              .filter(({ h }) => h < avg - 1)
              .sort((a, b) => a.h - b.h);

            let receptor: Employee | null = null;
            for (const { e } of subcargados) {
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
              turno.employee_id = receptor.id;
              turno.observaciones = (turno.observaciones || "") +
                ` [Rebalanceado desde ${empSobre.nombre || empSobre.id} → ${receptor.nombre || receptor.id}]`;
              huboCambio = true;
              break;
            }
          }
          if (huboCambio) break;
        }

        if (!huboCambio) break;
      }

      const horasFinales = activeEmployees
        .map(emp => ({ emp, h: getWeeklyHours(emp.id, refDate) }))
        .filter(x => x.h > 0);
      if (horasFinales.length === 0) return;
      const avgFinal = horasFinales.reduce((a, x) => a + x.h, 0) / horasFinales.length;
      horasFinales
        .filter(x => x.h > avgFinal + maxDiff)
        .forEach(x => {
          warnings.push(
            `Semana ${weekKey} · ${x.emp.nombre || "Empleado"}: ${x.h.toFixed(1)}h ` +
            `(media ${avgFinal.toFixed(1)}h) — desbalance residual tras rebalanceo automático.`
          );
        });
    });
  }

  // ─── Advertencias finales ──────────────────────────────────────────────────
  validDays.forEach(day => {
    if (diasSinCobertura.includes(day.dateStr)) return;
    const covVec = getCoverageVector(day.dateStr);
    const demVec = getDemandVecFor(day.date);
    let totalDef = 0;
    for (let s = 0; s < slotsPerDay; s++) totalDef += Math.max(0, demVec[s] - covVec[s]);
    if (totalDef > 0) {
      warnings.push(`${day.dateStr}: déficit de ${Math.round(totalDef / slotsPorHora)} horas-persona sin cubrir.`);
    }
  });

  activeEmployees.forEach(emp => {
    if (!generatedShifts.some(s => s.employee_id === emp.id)) {
      warnings.push(`${emp.nombre || "Empleado"}: sin turnos asignados en el período.`);
    }
    // v6: Advertencia si no tiene skills requeridos
    if (safeRequiredSkills.length > 0 && !hasRequiredSkills(emp)) {
      warnings.push(`${emp.nombre || "Empleado"}: no tiene los skills requeridos (${safeRequiredSkills.join(", ")}). No se le asignaron turnos.`);
    }
    // v6: Advertencia si trabajó más domingos de los permitidos
    const domingosTrabajados = getDomingosMes(emp.id, parseLocalDate(`${periodoStr}-01`));
    if (domingosTrabajados > getMaxDomingos(emp)) {
      warnings.push(`${emp.nombre || "Empleado"}: trabajó ${domingosTrabajados} domingos (máximo ${getMaxDomingos(emp)}). Revisa la programación.`);
    }
  });

  return { shifts: generatedShifts, warnings };
}
