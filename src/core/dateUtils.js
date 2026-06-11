// ============================================================
// UTILIDADES DE FECHAS — ChronosWork
// ============================================================

import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formatea una fecha ISO a formato legible en español
 */
export function formatFecha(fecha, formatStr = 'dd/MM/yyyy') {
  try {
    const date = typeof fecha === 'string' ? parseISO(fecha) : fecha;
    return format(date, formatStr, { locale: es });
  } catch {
    return fecha;
  }
}

/**
 * Formatea fecha y hora
 */
export function formatFechaHora(fecha) {
  return formatFecha(fecha, 'dd/MM/yyyy HH:mm');
}

/**
 * Genera timestamp ISO completo a partir de fecha (string) y hora (string HH:mm)
 */
export function buildISO(fecha, hora) {
  return `${fecha}T${hora}:00.000Z`;
}

/**
 * Obtiene el inicio y fin de la semana para una fecha dada
 */
export function getSemana(fecha = new Date()) {
  const date = typeof fecha === 'string' ? parseISO(fecha) : fecha;
  return {
    inicio: startOfWeek(date, { weekStartsOn: 1 }),
    fin: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

/**
 * Obtiene todos los días de un mes dado (año, mes 1-12)
 */
export function getDiasMes(anio, mes) {
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0);
  return eachDayOfInterval({ start: inicio, end: fin });
}

/**
 * Verifica si una fecha cae dentro de un rango
 */
export function estaEnRango(fecha, inicio, fin) {
  return isWithinInterval(
    typeof fecha === 'string' ? parseISO(fecha) : fecha,
    {
      start: typeof inicio === 'string' ? parseISO(inicio) : inicio,
      end: typeof fin === 'string' ? parseISO(fin) : fin,
    }
  );
}

/**
 * Calcula la diferencia en horas entre dos timestamps
 */
export function diferenciaHoras(startISO, endISO) {
  const diff = new Date(endISO) - new Date(startISO);
  return Math.round((diff / 1000 / 3600) * 100) / 100;
}

/**
 * Retorna el nombre del día de la semana en español
 */
export function getNombreDia(fecha) {
  const date = typeof fecha === 'string' ? parseISO(fecha) : fecha;
  return format(date, 'EEEE', { locale: es });
}

/**
 * Genera un arreglo con los días de la semana actual
 */
export function diasDeSemana(fechaRef = new Date()) {
  const { inicio, fin } = getSemana(fechaRef);
  return eachDayOfInterval({ start: inicio, end: fin });
}

/**
 * Período actual en formato YYYY-MM
 */
export function getPeriodoActual() {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Nombre del mes en español
 */
export function getNombreMes(mes) {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return meses[mes - 1] || '';
}
