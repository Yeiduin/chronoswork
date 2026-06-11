// ============================================================
// MOTOR ALGORÍTMICO CST COLOMBIA 2026 — ChronosWork
// Ley 2101 de 2021 + Ley 2466 de 2025
// Procesa timestamps ISO 8601 y clasifica horas por concepto legal
// ============================================================

import {
  MAX_HORAS_SEMANALES,
  MAX_EXTRAS_DIARIAS,
  MAX_EXTRAS_SEMANALES,
  RECARGOS,
  FESTIVOS_2026,
} from '../config/constants';

const INICIO_DIURNA_H = 6;   // 06:00
const FIN_DIURNA_H = 19;     // 19:00

/**
 * Determina si una fecha es domingo o festivo en Colombia 2026
 */
export function esDominicalOFestivo(fecha) {
  const d = new Date(fecha);
  const esDOM = d.getDay() === 0;
  const dateStr = d.toISOString().slice(0, 10);
  const esFestivo = FESTIVOS_2026.includes(dateStr);
  return esDOM || esFestivo;
}

/**
 * Determina si una fecha cae en el período A (Ene-Jun) o B (Jul-Dic) del 2026
 */
export function getPeriodo2026(fecha) {
  const mes = new Date(fecha).getMonth() + 1; // 1-12
  return mes <= 6 ? 'A' : 'B';
}

/**
 * Verifica si una hora (0-23) está en jornada nocturna
 * Nocturna: 19:00 - 06:00
 */
export function esNocturna(hora) {
  return hora >= FIN_DIURNA_H || hora < INICIO_DIURNA_H;
}

/**
 * Divide un turno (start_time, end_time ISO 8601) en fracciones de 1 minuto
 * y clasifica cada fracción según la normativa CST 2026.
 *
 * Retorna un objeto con las horas acumuladas por concepto legal:
 * {
 *   horas_ordinarias: 0,
 *   HON: 0, HOD: 0, HCDN: 0,
 *   HED: 0, HEN: 0, HEDD: 0, HEND: 0,
 *   total_minutos: 0
 * }
 *
 * @param {string} startISO - Timestamp de inicio ISO 8601
 * @param {string} endISO - Timestamp de fin ISO 8601
 * @param {number} horasOrdinariasAcumuladas - Horas ordinarias ya acumuladas en la semana
 * @param {number} horasExtrasAcumuladas - Horas extras ya acumuladas en la semana
 */
export function clasificarTurno(startISO, endISO, horasOrdinariasAcumuladas = 0, horasExtrasAcumuladas = 0, breakMinutes = 0) {
  const inicio = new Date(startISO);
  const fin = new Date(endISO);

  const resultado = {
    horas_ordinarias: 0,
    HON: 0, HOD_A: 0, HOD_B: 0, HCDN_A: 0, HCDN_B: 0,
    HED: 0, HEN: 0, HEDD_A: 0, HEDD_B: 0, HEND_A: 0, HEND_B: 0,
    total_minutos: 0,
    advertencias: [],
  };

  // Generar fronteras para dividir el turno
  const boundaries = new Set();
  boundaries.add(inicio.getTime());
  boundaries.add(fin.getTime());

  // Medianoches
  let curr = new Date(inicio);
  curr.setHours(0, 0, 0, 0);
  curr.setDate(curr.getDate() + 1);
  while (curr < fin) {
    boundaries.add(curr.getTime());
    curr.setDate(curr.getDate() + 1);
  }

  // 06:00
  curr = new Date(inicio);
  curr.setHours(6, 0, 0, 0);
  if (curr <= inicio) curr.setDate(curr.getDate() + 1);
  while (curr < fin) {
    boundaries.add(curr.getTime());
    curr.setDate(curr.getDate() + 1);
  }

  // 19:00
  curr = new Date(inicio);
  curr.setHours(19, 0, 0, 0);
  if (curr <= inicio) curr.setDate(curr.getDate() + 1);
  while (curr < fin) {
    boundaries.add(curr.getTime());
    curr.setDate(curr.getDate() + 1);
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const intervals = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const t1 = sortedBoundaries[i];
    const t2 = sortedBoundaries[i + 1];
    const durationHours = (t2 - t1) / 3600000;
    if (durationHours <= 0) continue;

    const mid = new Date((t1 + t2) / 2);
    intervals.push({
      t1,
      t2,
      duration: durationHours,
      domingo: esDominicalOFestivo(mid),
      periodo: getPeriodo2026(mid),
      nocturna: esNocturna(mid.getHours())
    });
  }

  // Descontar break_minutes (priorizando horas diurnas ordinarias)
  let remainingBreak = breakMinutes / 60.0;
  if (remainingBreak > 0) {
    const priority = (intv) => {
      if (!intv.domingo && !intv.nocturna) return 1;
      if (!intv.domingo && intv.nocturna) return 2;
      if (intv.domingo && !intv.nocturna) return 3;
      return 4;
    };
    intervals.sort((a, b) => priority(a) - priority(b));
    for (const intv of intervals) {
      if (remainingBreak <= 0) break;
      const deduct = Math.min(intv.duration, remainingBreak);
      intv.duration -= deduct;
      remainingBreak -= deduct;
    }
    // Restaurar orden cronológico
    intervals.sort((a, b) => a.t1 - b.t1);
  }

  let horasOrdActual = horasOrdinariasAcumuladas;
  let horasExtActual = horasExtrasAcumuladas;
  let extrasDiarias = 0; // en horas

  for (const intv of intervals) {
    if (intv.duration <= 0) continue;
    
    // Convertir de nuevo a minutos para mantener compatibilidad de la métrica original
    resultado.total_minutos += intv.duration * 60;

    let ordToAssign = 0;
    let extToAssign = 0;

    if (horasOrdActual < MAX_HORAS_SEMANALES) {
      const espacioOrdinario = MAX_HORAS_SEMANALES - horasOrdActual;
      if (intv.duration <= espacioOrdinario) {
        ordToAssign = intv.duration;
      } else {
        ordToAssign = espacioOrdinario;
        extToAssign = intv.duration - espacioOrdinario;
      }
    } else {
      extToAssign = intv.duration;
    }

    if (ordToAssign > 0) {
      horasOrdActual += ordToAssign;
      if (intv.domingo && intv.nocturna) {
        intv.periodo === 'A' ? resultado.HCDN_A += ordToAssign : resultado.HCDN_B += ordToAssign;
      } else if (intv.domingo) {
        intv.periodo === 'A' ? resultado.HOD_A += ordToAssign : resultado.HOD_B += ordToAssign;
      } else if (intv.nocturna) {
        resultado.HON += ordToAssign;
      } else {
        resultado.horas_ordinarias += ordToAssign;
      }
    }

    if (extToAssign > 0) {
      // Validar límites antes de asignar
      let allowedExt = extToAssign;
      if (extrasDiarias >= MAX_EXTRAS_DIARIAS || horasExtActual >= MAX_EXTRAS_SEMANALES) {
        allowedExt = 0;
        resultado.advertencias.push(`Límite legal de horas extras alcanzado.`);
      } else {
        const remainingDiarias = MAX_EXTRAS_DIARIAS - extrasDiarias;
        const remainingSemanales = MAX_EXTRAS_SEMANALES - horasExtActual;
        const remainingExt = Math.min(remainingDiarias, remainingSemanales);
        
        if (extToAssign > remainingExt) {
          allowedExt = remainingExt;
          resultado.advertencias.push(`Límite legal de horas extras alcanzado durante el turno.`);
        }
      }

      if (allowedExt > 0) {
        horasExtActual += allowedExt;
        extrasDiarias += allowedExt;
        
        if (intv.domingo && intv.nocturna) {
          intv.periodo === 'A' ? resultado.HEND_A += allowedExt : resultado.HEND_B += allowedExt;
        } else if (intv.domingo) {
          intv.periodo === 'A' ? resultado.HEDD_A += allowedExt : resultado.HEDD_B += allowedExt;
        } else if (intv.nocturna) {
          resultado.HEN += allowedExt;
        } else {
          resultado.HED += allowedExt;
        }
      }
    }
  }

  // Redondear a 2 decimales
  Object.keys(resultado).forEach(k => {
    if (typeof resultado[k] === 'number' && k !== 'total_minutos') {
      resultado[k] = Math.round(resultado[k] * 100) / 100;
    }
  });

  return resultado;
}

/**
 * Calcula el valor monetario a pagar por concepto de horas clasificadas
 * @param {object} clasificacion - Resultado de clasificarTurno()
 * @param {number} valorHoraBase - Valor hora ordinaria pactada del empleado
 * @returns {object} - Desglose monetario por concepto
 */
export function calcularValorMonetario(clasificacion, valorHoraBase) {
  const base = parseFloat(valorHoraBase);

  return {
    horas_ordinarias: {
      horas: clasificacion.horas_ordinarias,
      factor: 1.0,
      valor: Math.round(clasificacion.horas_ordinarias * base * 100) / 100,
    },
    HON: {
      horas: clasificacion.HON,
      factor: 1 + RECARGOS.HON,
      valor: Math.round(clasificacion.HON * base * (1 + RECARGOS.HON) * 100) / 100,
    },
    HOD_A: {
      horas: clasificacion.HOD_A,
      factor: 1 + RECARGOS.HOD_A,
      valor: Math.round(clasificacion.HOD_A * base * (1 + RECARGOS.HOD_A) * 100) / 100,
    },
    HOD_B: {
      horas: clasificacion.HOD_B,
      factor: 1 + RECARGOS.HOD_B,
      valor: Math.round(clasificacion.HOD_B * base * (1 + RECARGOS.HOD_B) * 100) / 100,
    },
    HCDN_A: {
      horas: clasificacion.HCDN_A,
      factor: 1 + RECARGOS.HCDN_A,
      valor: Math.round(clasificacion.HCDN_A * base * (1 + RECARGOS.HCDN_A) * 100) / 100,
    },
    HCDN_B: {
      horas: clasificacion.HCDN_B,
      factor: 1 + RECARGOS.HCDN_B,
      valor: Math.round(clasificacion.HCDN_B * base * (1 + RECARGOS.HCDN_B) * 100) / 100,
    },
    HED: {
      horas: clasificacion.HED,
      factor: 1 + RECARGOS.HED,
      valor: Math.round(clasificacion.HED * base * (1 + RECARGOS.HED) * 100) / 100,
    },
    HEN: {
      horas: clasificacion.HEN,
      factor: 1 + RECARGOS.HEN,
      valor: Math.round(clasificacion.HEN * base * (1 + RECARGOS.HEN) * 100) / 100,
    },
    HEDD_A: {
      horas: clasificacion.HEDD_A,
      factor: 1 + RECARGOS.HEDD_A,
      valor: Math.round(clasificacion.HEDD_A * base * (1 + RECARGOS.HEDD_A) * 100) / 100,
    },
    HEDD_B: {
      horas: clasificacion.HEDD_B,
      factor: 1 + RECARGOS.HEDD_B,
      valor: Math.round(clasificacion.HEDD_B * base * (1 + RECARGOS.HEDD_B) * 100) / 100,
    },
    HEND_A: {
      horas: clasificacion.HEND_A,
      factor: 1 + RECARGOS.HEND_A,
      valor: Math.round(clasificacion.HEND_A * base * (1 + RECARGOS.HEND_A) * 100) / 100,
    },
    HEND_B: {
      horas: clasificacion.HEND_B,
      factor: 1 + RECARGOS.HEND_B,
      valor: Math.round(clasificacion.HEND_B * base * (1 + RECARGOS.HEND_B) * 100) / 100,
    },
  };
}

/**
 * Genera el total bruto a pagar sumando todos los conceptos
 */
export function calcularTotalBruto(desglose) {
  return Object.values(desglose).reduce((acc, concepto) => acc + (concepto.valor || 0), 0);
}

/**
 * Procesa todos los turnos de un empleado en un período dado
 * @param {Array} turnos - Array de { start_time, end_time }
 * @param {number} valorHoraBase
 * @returns {object} - Resumen completo del empleado
 */
export function procesarTurnosEmpleado(turnos, valorHoraBase) {
  let horasOrdAcumuladas = 0;
  let horasExtAcumuladas = 0;

  const clasificacionTotal = {
    horas_ordinarias: 0,
    HON: 0, HOD_A: 0, HOD_B: 0, HCDN_A: 0, HCDN_B: 0,
    HED: 0, HEN: 0, HEDD_A: 0, HEDD_B: 0, HEND_A: 0, HEND_B: 0,
    total_minutos: 0,
    advertencias: [],
  };

  // Ordenar turnos cronológicamente
  const turnosOrdenados = [...turnos].sort((a, b) =>
    new Date(a.start_time) - new Date(b.start_time)
  );

  for (const turno of turnosOrdenados) {
    const cls = clasificarTurno(
      turno.start_time, 
      turno.end_time, 
      horasOrdAcumuladas, 
      horasExtAcumuladas, 
      turno.break_minutes || 0
    );

    // Acumular resultados
    Object.keys(clasificacionTotal).forEach(k => {
      if (typeof clasificacionTotal[k] === 'number') {
        clasificacionTotal[k] += cls[k] || 0;
      } else if (Array.isArray(clasificacionTotal[k])) {
        if (cls[k] && cls[k].length > 0) {
           // Incluir fecha en advertencia para contexto
           clasificacionTotal[k].push(...cls[k].map(warn => `[${turno.start_time.slice(0, 10)}] ${warn}`));
        }
      }
    });

    horasOrdAcumuladas += cls.horas_ordinarias + cls.HON + cls.HOD_A + cls.HOD_B + cls.HCDN_A + cls.HCDN_B;
    horasExtAcumuladas += cls.HED + cls.HEN + cls.HEDD_A + cls.HEDD_B + cls.HEND_A + cls.HEND_B;
  }

  // Redondear
  Object.keys(clasificacionTotal).forEach(k => {
    if (typeof clasificacionTotal[k] === 'number') {
      clasificacionTotal[k] = Math.round(clasificacionTotal[k] * 100) / 100;
    }
  });

  const desglose = calcularValorMonetario(clasificacionTotal, valorHoraBase);
  const total_bruto = calcularTotalBruto(desglose);

  return {
    clasificacion: clasificacionTotal,
    desglose,
    total_bruto: Math.round(total_bruto * 100) / 100,
    total_horas_ordinarias: Math.round(horasOrdAcumuladas * 100) / 100,
    total_horas_extras: Math.round(horasExtAcumuladas * 100) / 100,
  };
}
