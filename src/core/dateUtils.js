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
 * Genera un timestamp ISO con la "hora de reloj" tal cual, en UTC (sufijo Z).
 * Convención de toda la app: la hora se guarda como UTC sin conversión y las
 * vistas la leen con string slice (start_time.slice(11,16)). Así un turno de
 * las 22:00 se guarda como "...T22:00:00Z" y se MUESTRA a las 22:00.
 * ⚠ No usar el offset real del navegador (-getTimezoneOffset): desplazaría
 * todas las vistas según la zona horaria de la máquina. Igual que buildISO.
 */
export function getLocalISOString(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    throw new Error(`Invalid time value: getLocalISOString received empty dateStr (${dateStr}) or timeStr (${timeStr})`);
  }
  const cleanTimeStr = String(timeStr).slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(cleanTimeStr)) {
    throw new Error(`Invalid time value: getLocalISOString received invalid timeStr (${timeStr})`);
  }
  return `${dateStr}T${cleanTimeStr}:00Z`;
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
 * Analiza un string HH:mm y lo pasa a minutos
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
}

/**
 * Obtiene el listado de fechas exactas basándose en la opción del modal (this_week, next_week, etc.)
 */
export function getDatesByOption(option, customStart, customEnd) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const getDays = (start, end) => {
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  switch (option) {
    case 'this_week': {
      const start = new Date(hoy);
      const day = start.getDay() === 0 ? 7 : start.getDay();
      start.setDate(start.getDate() - day + 1); // Monday
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // Sunday
      return getDays(start, end);
    }
    case 'rest_of_week': {
      const end = new Date(hoy);
      const day = end.getDay() === 0 ? 7 : end.getDay();
      end.setDate(end.getDate() + (7 - day)); // Upcoming Sunday
      return getDays(hoy, end);
    }
    case 'next_week': {
      const start = new Date(hoy);
      const day = start.getDay() === 0 ? 7 : start.getDay();
      start.setDate(start.getDate() + (7 - day) + 1); // Next Monday
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // Next Sunday
      return getDays(start, end);
    }
    case 'this_biweek': {
      const d = hoy.getDate();
      const start = new Date(hoy.getFullYear(), hoy.getMonth(), d <= 15 ? 1 : 16);
      const end = new Date(hoy.getFullYear(), hoy.getMonth(), d <= 15 ? 15 : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate());
      return getDays(start, end);
    }
    case 'next_biweek': {
      const d = hoy.getDate();
      let start, end;
      if (d <= 15) {
        start = new Date(hoy.getFullYear(), hoy.getMonth(), 16);
        end = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      } else {
        start = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
        end = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 15);
      }
      return getDays(start, end);
    }
    case 'this_month': {
      const start = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const end = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      return getDays(start, end);
    }
    case 'next_month': {
      const start = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      const end = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
      return getDays(start, end);
    }
    case 'custom': {
      if (!customStart || !customEnd) return [];
      const start = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T00:00:00');
      return getDays(start, end);
    }
    default:
      return [];
  }
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
