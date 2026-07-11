// ============================================================
// Tests unitarios — dateUtils.js
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  toISODay,
  formatFecha,
  buildISO,
  getLocalISOString,
  getSemana,
  getDiasMes,
  estaEnRango,
  diferenciaHoras,
  getNombreDia,
  timeToMinutes,
  getPeriodoActual,
  getNombreMes,
  esDominicalOFestivo,
} from './dateUtils';

describe('toISODay', () => {
  // Usar constructor numérico para evitar desfase UTC vs local (Colombia UTC-5)
  it('convierte domingo (getDay=0) a 7', () => {
    expect(toISODay(new Date(2026, 6, 5))).toBe(7); // Domingo
  });

  it('convierte lunes a 1', () => {
    expect(toISODay(new Date(2026, 6, 6))).toBe(1); // Lunes
  });

  it('convierte sábado a 6', () => {
    expect(toISODay(new Date(2026, 6, 11))).toBe(6); // Sábado
  });

  it('retorna 1 para fecha inválida', () => {
    expect(toISODay(new Date('invalida'))).toBe(1);
  });
});

describe('formatFecha', () => {
  it('formatea fecha ISO por defecto', () => {
    const result = formatFecha('2026-07-06');
    expect(result).toBe('06/07/2026');
  });

  it('retorna el mismo valor si falla el parseo', () => {
    expect(formatFecha('invalida')).toBe('invalida');
  });
});

describe('buildISO', () => {
  it('construye timestamp ISO correcto', () => {
    expect(buildISO('2026-07-06', '14:00')).toBe('2026-07-06T14:00:00.000Z');
  });
});

describe('getLocalISOString', () => {
  it('construye timestamp con horas y minutos', () => {
    expect(getLocalISOString('2026-07-06', '22:00')).toBe('2026-07-06T22:00:00Z');
  });

  it('lanza error si dateStr está vacío', () => {
    expect(() => getLocalISOString('', '22:00')).toThrow('Invalid time value');
  });

  it('lanza error si timeStr está vacío', () => {
    expect(() => getLocalISOString('2026-07-06', '')).toThrow('Invalid time value');
  });

  it('lanza error si timeStr no es HH:mm', () => {
    expect(() => getLocalISOString('2026-07-06', 'abc')).toThrow('Invalid time value');
  });
});

describe('getSemana', () => {
  it('retorna lunes a domingo para una fecha', () => {
    const { inicio, fin } = getSemana(new Date(2026, 6, 8)); // Miércoles
    expect(inicio.getDay()).toBe(1); // Lunes
    expect(fin.getDay()).toBe(0);   // Domingo
  });
});

describe('getDiasMes', () => {
  it('retorna 31 días para julio', () => {
    const dias = getDiasMes(2026, 7);
    expect(dias).toHaveLength(31);
    expect(dias[0].getDate()).toBe(1);
    expect(dias[30].getDate()).toBe(31);
  });

  it('retorna 28 días para febrero no bisiesto', () => {
    const dias = getDiasMes(2026, 2); // 2026 no es bisiesto
    expect(dias).toHaveLength(28);
  });
});

describe('estaEnRango', () => {
  it('retorna true si fecha está en el rango', () => {
    expect(estaEnRango('2026-07-15', '2026-07-01', '2026-07-31')).toBe(true);
  });

  it('retorna false si fecha está fuera del rango', () => {
    expect(estaEnRango('2026-08-01', '2026-07-01', '2026-07-31')).toBe(false);
  });
});

describe('diferenciaHoras', () => {
  it('calcula diferencia en horas', () => {
    expect(diferenciaHoras('2026-07-06T08:00:00Z', '2026-07-06T18:00:00Z')).toBe(10);
  });

  it('calcula diferencia fraccionaria', () => {
    const diff = diferenciaHoras('2026-07-06T08:00:00Z', '2026-07-06T12:30:00Z');
    expect(diff).toBeCloseTo(4.5, 1);
  });
});

describe('getNombreDia', () => {
  it('retorna nombre del día en español', () => {
    expect(getNombreDia('2026-07-06')).toBe('lunes');
    expect(getNombreDia('2026-07-11')).toBe('sábado');
    expect(getNombreDia('2026-07-05')).toBe('domingo');
  });
});

describe('timeToMinutes', () => {
  it('convierte HH:mm a minutos', () => {
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('retorna 0 para string vacío', () => {
    expect(timeToMinutes('')).toBe(0);
  });
});

describe('getPeriodoActual', () => {
  it('retorna string en formato YYYY-MM', () => {
    const periodo = getPeriodoActual();
    expect(periodo).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('getNombreMes', () => {
  it('retorna nombre correcto para cada mes', () => {
    expect(getNombreMes(1)).toBe('Enero');
    expect(getNombreMes(7)).toBe('Julio');
    expect(getNombreMes(12)).toBe('Diciembre');
  });

  it('retorna string vacío para mes inválido', () => {
    expect(getNombreMes(0)).toBe('');
    expect(getNombreMes(13)).toBe('');
  });
});

describe('esDominicalOFestivo', () => {
  it('detecta domingo', () => {
    expect(esDominicalOFestivo(new Date(2026, 6, 5))).toBe(true); // Domingo
  });

  it('detecta día no domingo', () => {
    expect(esDominicalOFestivo(new Date(2026, 6, 6))).toBe(false); // Lunes
  });

  it('detecta festivo en lista', () => {
    expect(esDominicalOFestivo('2026-12-25', ['2026-12-25'])).toBe(true);
  });

  it('retorna false para fecha inválida', () => {
    expect(esDominicalOFestivo('invalida')).toBe(false);
  });
});
