// ============================================================
// Edge Function: auto-assign — catálogo laboral
// Puerto de laborCatalog.js para Deno
// ============================================================

/** Defaults legales Colombia (Ley 2101/2021 + Ley 2466/2025) */
export const LEGAL_DEFAULTS_CO = {
  maxHorasSemanales: 42,
  minHorasTurno: 4,
  maxHorasTurno: 9,
  maxHorasDiarias: 9,
  minHorasEntreJornadas: 9,
  diasDescansoSemana: 1,
};

/** Constantes de horario nocturno (CST colombiano) */
export const NOCTURNA_INICIO_H = 19;
export const NOCTURNA_FIN_H = 6;

/** Curvas de demanda por defecto */
export const DEMAND_CURVE_DIURNA: Record<number, number> = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 4, 6: 6, 7: 8, 8: 9, 9: 9,
  10: 8, 11: 7, 12: 7, 13: 8, 14: 8, 15: 8, 16: 7, 17: 6, 18: 5,
  19: 3, 20: 2, 21: 1, 22: 1, 23: 1,
};

export const DEMAND_CURVE_NOCTURNA: Record<number, number> = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2,
  10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 3,
  19: 4, 20: 4, 21: 4, 22: 4, 23: 3,
};

export const DEMAND_CURVE_FIN_SEMANA: Record<number, number> = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 3, 8: 4, 9: 5,
  10: 6, 11: 6, 12: 6, 13: 5, 14: 5, 15: 4, 16: 4, 17: 3, 18: 3,
  19: 2, 20: 2, 21: 1, 22: 1, 23: 1,
};

/** Horarios canónicos de inicio (variedad real de turnos) */
export const CANONICAL_DAY_STARTS: [number, number][] = [
  [4,0],[5,0],[5,30],[6,0],[6,30],[7,0],[7,30],[8,0],[9,0],[10,0],
  [11,0],[12,0],[13,0],[14,0],[15,0],[15,30],[16,0],[17,0],[18,0],
  [19,0],[20,0],[21,0],[22,0],[23,0],
];

/** Política de descansos por defecto */
export const BREAK_POLICY_DEFAULTS_CO = {
  breakMinutos: 15,
  almuerzoMinutos: 60,
  gapMinHoras: 1,
  gapMaxHoras: 3,
  reglas: [
    { desdeHoras: 0, breaks: 1, almuerzo: false },
    { desdeHoras: 6.5, breaks: 2, almuerzo: false },
    { desdeHoras: 8, breaks: 1, almuerzo: true },
    { desdeHoras: 9, breaks: 2, almuerzo: true },
  ],
};

export function resolveBreakPolicy(policy: Record<string, unknown> | null) {
  const p = policy && typeof policy === "object" ? policy : {};
  return {
    breakMinutos: Number(p.breakMinutos) > 0 ? Number(p.breakMinutos) : BREAK_POLICY_DEFAULTS_CO.breakMinutos,
    almuerzoMinutos: Number(p.almuerzoMinutos) > 0 ? Number(p.almuerzoMinutos) : BREAK_POLICY_DEFAULTS_CO.almuerzoMinutos,
    gapMinHoras: Number(p.gapMinHoras) > 0 ? Number(p.gapMinHoras) : BREAK_POLICY_DEFAULTS_CO.gapMinHoras,
    gapMaxHoras: Number(p.gapMaxHoras) > 0 ? Number(p.gapMaxHoras) : BREAK_POLICY_DEFAULTS_CO.gapMaxHoras,
    reglas: Array.isArray(p.reglas) && p.reglas.length > 0 ? p.reglas as typeof BREAK_POLICY_DEFAULTS_CO.reglas : BREAK_POLICY_DEFAULTS_CO.reglas,
  };
}

export function isNightHour(h: number): boolean {
  return h >= NOCTURNA_INICIO_H || h < NOCTURNA_FIN_H;
}
