// ============================================================
// Tests unitarios — validators.js
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  validarCedula,
  validarNIT,
  validarValorHora,
  validarEmail,
  validarPassword,
  validarRangoFechas,
  validarNombre,
  formatCOP,
} from './validators';

describe('validarCedula', () => {
  it('acepta cédula de 7 dígitos', () => {
    expect(validarCedula('1234567')).toEqual({ valid: true });
  });

  it('acepta cédula de 10 dígitos', () => {
    expect(validarCedula('1234567890')).toEqual({ valid: true });
  });

  it('rechaza cédula de menos de 5 dígitos', () => {
    const result = validarCedula('123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('5 y 12 dígitos');
  });

  it('limpia caracteres no numéricos', () => {
    expect(validarCedula('12.345.678')).toEqual({ valid: true });
  });
});

describe('validarNIT', () => {
  it('acepta NIT con formato válido', () => {
    expect(validarNIT('900123456-7')).toEqual({ valid: true });
  });

  it('rechaza NIT sin dígito de verificación', () => {
    const result = validarNIT('123');
    expect(result.valid).toBe(false);
  });
});

describe('validarValorHora', () => {
  it('acepta valor de hora normal', () => {
    expect(validarValorHora('15000')).toEqual({ valid: true });
  });

  it('rechaza valor menor a 5000', () => {
    const result = validarValorHora('1000');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('$5.000');
  });

  it('rechaza valor mayor a 2 millones', () => {
    const result = validarValorHora('3000000');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('$2.000.000');
  });

  it('rechaza valor no numérico', () => {
    const result = validarValorHora('abc');
    expect(result.valid).toBe(false);
  });
});

describe('validarEmail', () => {
  it('acepta email válido', () => {
    expect(validarEmail('test@example.com')).toEqual({ valid: true });
  });

  it('rechaza email sin @', () => {
    const result = validarEmail('testexample.com');
    expect(result.valid).toBe(false);
  });

  it('rechaza email vacío', () => {
    const result = validarEmail('');
    expect(result.valid).toBe(false);
  });
});

describe('validarPassword', () => {
  it('acepta contraseña fuerte', () => {
    expect(validarPassword('Password1')).toEqual({ valid: true });
  });

  it('rechaza contraseña muy corta', () => {
    const result = validarPassword('Ab1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('8 caracteres');
  });

  it('rechaza contraseña sin números', () => {
    const result = validarPassword('Password');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('número');
  });

  it('rechaza contraseña sin letras', () => {
    const result = validarPassword('12345678');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('letra');
  });
});

describe('validarRangoFechas', () => {
  it('acepta fecha fin posterior a inicio', () => {
    expect(validarRangoFechas('2026-07-01', '2026-07-15')).toEqual({ valid: true });
  });

  it('acepta fechas iguales', () => {
    expect(validarRangoFechas('2026-07-01', '2026-07-01')).toEqual({ valid: true });
  });

  it('rechaza fecha fin anterior a inicio', () => {
    const result = validarRangoFechas('2026-07-15', '2026-07-01');
    expect(result.valid).toBe(false);
  });
});

describe('validarNombre', () => {
  it('acepta nombre y apellido', () => {
    expect(validarNombre('Juan Pérez')).toEqual({ valid: true });
  });

  it('rechaza solo un nombre', () => {
    const result = validarNombre('Juan');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('nombre y apellido');
  });
});

describe('formatCOP', () => {
  it('formatea número como moneda COP', () => {
    const result = formatCOP(1500000);
    expect(result).toContain('$');
    expect(result).toContain('1.500.000');
  });

  it('formatea cero', () => {
    expect(formatCOP(0)).toContain('$');
  });
});
