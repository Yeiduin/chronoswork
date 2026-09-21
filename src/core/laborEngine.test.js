// ============================================================
// Tests unitarios — laborEngine.js (motor de clasificación CST)
// Cubre: zona horaria UTC, nocturno, dominical, festivo, cruce
// de medianoche, horas extras, contrato POR_HORAS, recargos.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  clasificarTurno,
  calcularValorMonetario,
  calcularTotalBruto,
  procesarTurnosEmpleado,
  getPeriodo2026,
  esNocturna,
} from './laborEngine';

// ── Helpers ──────────────────────────────────────────────────
// Todos los timestamps usan sufijo Z (UTC "hora de reloj"), que es la
// convención de la app: 22:00 local se guarda como "...T22:00:00Z".

describe('esNocturna', () => {
  it('19:00 es nocturna (frontera inclusive)', () => {
    expect(esNocturna(19)).toBe(true);
  });
  it('06:00 NO es nocturna (fin franja)', () => {
    expect(esNocturna(6)).toBe(false);
  });
  it('22:00 es nocturna', () => {
    expect(esNocturna(22)).toBe(true);
  });
  it('12:00 NO es nocturna', () => {
    expect(esNocturna(12)).toBe(false);
  });
  it('03:00 es nocturna (madrugada)', () => {
    expect(esNocturna(3)).toBe(true);
  });
});

describe('getPeriodo2026', () => {
  it('enero es período A', () => {
    expect(getPeriodo2026('2026-01-15T10:00:00Z')).toBe('A');
  });
  it('junio es período A', () => {
    expect(getPeriodo2026('2026-06-15T10:00:00Z')).toBe('A');
  });
  it('julio es período B', () => {
    expect(getPeriodo2026('2026-07-15T10:00:00Z')).toBe('B');
  });
  it('diciembre es período B', () => {
    expect(getPeriodo2026('2026-12-15T10:00:00Z')).toBe('B');
  });
});

describe('clasificarTurno — casos básicos', () => {
  it('turno diurno completo 08:00-17:00 (9h ordinarias)', () => {
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T17:00:00Z', 0, 0, 0, []);
    expect(r.horas_ordinarias).toBe(9);
    expect(r.HON).toBe(0);
    expect(r.total_minutos).toBe(540);
  });

  it('turno nocturno completo 22:00-06:00 (8h HON, no diurnas)', () => {
    const r = clasificarTurno('2026-07-30T22:00:00Z', '2026-07-31T06:00:00Z', 0, 0, 0, []);
    expect(r.horas_ordinarias).toBe(0);
    expect(r.HON).toBe(8);
    expect(r.total_minutos).toBe(480);
  });

  it('turno mixto 15:00-23:00 (4h diurnas + 4h nocturnas)', () => {
    const r = clasificarTurno('2026-07-30T15:00:00Z', '2026-07-30T23:00:00Z', 0, 0, 0, []);
    expect(r.horas_ordinarias).toBe(4); // 15:00-19:00
    expect(r.HON).toBe(4);              // 19:00-23:00
  });

  it('turno que cruza medianoche 19:00-07:00 (12h, todo nocturno)', () => {
    const r = clasificarTurno('2026-07-30T19:00:00Z', '2026-07-31T07:00:00Z', 0, 0, 0, []);
    // 19:00-06:00 = 11h nocturna, 06:00-07:00 = 1h diurna
    expect(r.HON).toBe(11);
    expect(r.horas_ordinarias).toBe(1);
  });
});

describe('clasificarTurno — dominical y festivo', () => {
  // Domingo 2026-07-05 (getUTCDay === 0)
  it('turno dominical diurno → HOD_B (julio = período B)', () => {
    const r = clasificarTurno('2026-07-05T08:00:00Z', '2026-07-05T17:00:00Z', 0, 0, 0, []);
    expect(r.HOD_B).toBe(9);
    expect(r.horas_ordinarias).toBe(0);
  });

  it('turno dominical nocturno 22:00-06:00 → 2h HCDN_B (dom) + 6h HON (lun)', () => {
    // El turno cruza medianoche: 22:00-00:00 es domingo (HCDN_B),
    // 00:00-06:00 ya es lunes (HON). El motor parte en medianoche. ✓
    const r = clasificarTurno('2026-07-05T22:00:00Z', '2026-07-06T06:00:00Z', 0, 0, 0, []);
    expect(r.HCDN_B).toBe(2);
    expect(r.HON).toBe(6);
  });

  it('turno en festivo (no domingo) → HOD_A si festivo cae en período A', () => {
    // 2026-01-01 es festivo (Año Nuevo), enero = período A
    const festivos = ['2026-01-01'];
    const r = clasificarTurno('2026-01-01T08:00:00Z', '2026-01-01T17:00:00Z', 0, 0, 0, festivos);
    expect(r.HOD_A).toBe(9);
  });

  it('turno en día laboral normal NO marca como dominical', () => {
    // Jueves 2026-07-30
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T17:00:00Z', 0, 0, 0, []);
    expect(r.HOD_A).toBe(0);
    expect(r.HOD_B).toBe(0);
    expect(r.horas_ordinarias).toBe(9);
  });
});

describe('clasificarTurno — horas extras', () => {
  it('excede 42h semanales → 2h ordinarias + 2h HED (límite diario 2h)', () => {
    // Empleado ya tiene 40h. Turno 08:00-17:00 (9h): 2h ordinarias (llega a 42)
    // + 7h extras potenciales, pero MAX_EXTRAS_DIARIAS=2 → solo 2h HED, 5h descartadas
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T17:00:00Z', 40, 0, 0, []);
    expect(r.horas_ordinarias).toBe(2);
    expect(r.HED).toBe(2);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });

  it('excede 42h con turno nocturno → 1h HON + 2h HEN (límite diario)', () => {
    // 41h acumuladas, turno 22:00-06:00 (8h): 1h HON (llega a 42) + 7h extras
    // nocturnas, pero límite diario 2h → solo 2h HEN
    const r = clasificarTurno('2026-07-30T22:00:00Z', '2026-07-31T06:00:00Z', 41, 0, 0, []);
    expect(r.HON).toBe(1);
    expect(r.HEN).toBe(2);
  });

  it('respeta límite de extras diarias (max 2h)', () => {
    // 42h acumuladas (ya no hay ordinarias), turno 08:00-18:00 (10h extras):
    // solo 2h HED permitidas, 8h descartadas con advertencia
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T18:00:00Z', 42, 0, 0, []);
    expect(r.HED).toBe(2);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });
});

describe('clasificarTurno — contrato POR_HORAS (30h)', () => {
  it('empleado POR_HORAS recibe extras al superar 30h (límite diario 2h)', () => {
    // 29h acumuladas, turno 08:00-17:00 (9h): 1h ordinaria (llega a 30) + 8h extras
    // pero MAX_EXTRAS_DIARIAS=2 → solo 2h HED
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T17:00:00Z', 29, 0, 0, [], 30);
    expect(r.horas_ordinarias).toBe(1);
    expect(r.HED).toBe(2);
  });

  it('empleado normal (42h) con 35h acumuladas: 7h ord + 2h HED', () => {
    // 35h + 9h = 44h. Límite 42h → 7h ordinarias (llega a 42) + 2h HED (límite diario)
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T17:00:00Z', 35, 0, 0, [], 42);
    expect(r.horas_ordinarias).toBe(7);
    expect(r.HED).toBe(2);
  });
});

describe('clasificarTurno — break_minutes', () => {
  it('descuenta break de horas diurnas primero', () => {
    // Turno 08:00-17:00 (9h) con 1h break → 8h, descuenta de diurnas
    const r = clasificarTurno('2026-07-30T08:00:00Z', '2026-07-30T17:00:00Z', 0, 0, 60, []);
    expect(r.horas_ordinarias).toBe(8);
    expect(r.total_minutos).toBe(480);
  });

  it('descuenta break de nocturnas si no hay diurnas', () => {
    // Turno 22:00-06:00 (8h nocturna) con 1h break → 7h HON
    const r = clasificarTurno('2026-07-30T22:00:00Z', '2026-07-31T06:00:00Z', 0, 0, 60, []);
    expect(r.HON).toBe(7);
  });
});

describe('calcularValorMonetario', () => {
  it('calcula recargo HON (+35%)', () => {
    const clasif = { horas_ordinarias: 0, HON: 8, HOD_A: 0, HOD_B: 0, HCDN_A: 0, HCDN_B: 0,
      HED: 0, HEN: 0, HEDD_A: 0, HEDD_B: 0, HEND_A: 0, HEND_B: 0, total_minutos: 480, advertencias: [] };
    const d = calcularValorMonetario(clasif, 10000);
    // 8h * $10.000 * 1.35 = $108.000
    expect(d.HON.horas).toBe(8);
    expect(d.HON.factor).toBe(1.35);
    expect(d.HON.valor).toBe(108000);
  });

  it('calcula recargo HOD_B (+90%)', () => {
    const clasif = { horas_ordinarias: 0, HON: 0, HOD_A: 0, HOD_B: 9, HCDN_A: 0, HCDN_B: 0,
      HED: 0, HEN: 0, HEDD_A: 0, HEDD_B: 0, HEND_A: 0, HEND_B: 0, total_minutos: 540, advertencias: [] };
    const d = calcularValorMonetario(clasif, 10000);
    // 9h * $10.000 * 1.90 = $171.000
    expect(d.HOD_B.valor).toBe(171000);
  });

  it('horas ordinarias sin recargo (factor 1.0)', () => {
    const clasif = { horas_ordinarias: 8, HON: 0, HOD_A: 0, HOD_B: 0, HCDN_A: 0, HCDN_B: 0,
      HED: 0, HEN: 0, HEDD_A: 0, HEDD_B: 0, HEND_A: 0, HEND_B: 0, total_minutos: 480, advertencias: [] };
    const d = calcularValorMonetario(clasif, 10000);
    expect(d.horas_ordinarias.factor).toBe(1.0);
    expect(d.horas_ordinarias.valor).toBe(80000);
  });
});

describe('calcularTotalBruto', () => {
  it('suma todos los conceptos', () => {
    const desglose = {
      horas_ordinarias: { valor: 80000 },
      HON: { valor: 108000 },
      HOD_A: { valor: 0 }, HOD_B: { valor: 0 }, HCDN_A: { valor: 0 }, HCDN_B: { valor: 0 },
      HED: { valor: 25000 }, HEN: { valor: 0 }, HEDD_A: { valor: 0 }, HEDD_B: { valor: 0 },
      HEND_A: { valor: 0 }, HEND_B: { valor: 0 },
    };
    expect(calcularTotalBruto(desglose)).toBe(213000);
  });
});

describe('procesarTurnosEmpleado', () => {
  it('procesa múltiples turnos acumulando horas (con límite diario de extras)', () => {
    const turnos = [
      { start_time: '2026-07-27T08:00:00Z', end_time: '2026-07-27T17:00:00Z' }, // lun 9h
      { start_time: '2026-07-28T08:00:00Z', end_time: '2026-07-28T17:00:00Z' }, // mar 9h
      { start_time: '2026-07-29T08:00:00Z', end_time: '2026-07-29T17:00:00Z' }, // mié 9h
      { start_time: '2026-07-30T08:00:00Z', end_time: '2026-07-30T17:00:00Z' }, // jue 9h
      { start_time: '2026-07-31T08:00:00Z', end_time: '2026-07-31T17:00:00Z' }, // vie 9h
    ];
    const res = procesarTurnosEmpleado(turnos, 10000, []);
    // 45h total: 42h ordinarias + 3h extras. El viernes (turno 5) tiene 3h extras
    // potenciales pero el límite diario es 2h → 2h HED, 1h descartada.
    expect(res.total_horas_ordinarias).toBe(42);
    expect(res.total_horas_extras).toBe(2);
    expect(res.clasificacion.HED).toBe(2);
  });

  it('contrato POR_HORAS genera extras al superar 30h', () => {
    const turnos = [
      { start_time: '2026-07-27T08:00:00Z', end_time: '2026-07-27T17:00:00Z' }, // 9h
      { start_time: '2026-07-28T08:00:00Z', end_time: '2026-07-28T17:00:00Z' }, // 9h
      { start_time: '2026-07-29T08:00:00Z', end_time: '2026-07-29T17:00:00Z' }, // 9h
      { start_time: '2026-07-30T08:00:00Z', end_time: '2026-07-30T17:00:00Z' }, // 9h = 36h
    ];
    const res = procesarTurnosEmpleado(turnos, 10000, [], 'POR_HORAS');
    // 30h ordinarias. Turno 3 (27h→36h): 3h extras pero límite 2h → 2h HED.
    // Turno 4 ya no genera extras (limite semanal 12h no alcanzado, pero
    // turno 4 entero es extra (30+9=39), limitado a 2h diarias → 2h HED.
    // Total extras: 2h (turno 3) + 2h (turno 4) = 4h... peroesperado.
    // En realidad: turno 3 (0+9=9, 27 acum). turno 4 (9+9=18, 36 acum).
    // A los 30h (turno 4, hora 3) salta a extras: 6h extra, límite 2h → 2h.
    expect(res.total_horas_ordinarias).toBe(30);
    expect(res.total_horas_extras).toBe(2);
  });

  it('ordenar turnos cronológicamente antes de procesar', () => {
    // Turnos desordenados
    const turnos = [
      { start_time: '2026-07-30T08:00:00Z', end_time: '2026-07-30T17:00:00Z' },
      { start_time: '2026-07-27T08:00:00Z', end_time: '2026-07-27T17:00:00Z' },
    ];
    const res = procesarTurnosEmpleado(turnos, 10000, []);
    expect(res.total_horas_ordinarias).toBe(18);
  });
});
