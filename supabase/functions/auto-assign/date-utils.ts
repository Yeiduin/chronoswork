// ============================================================
// Edge Function: auto-assign — utilidades de fecha
// Puerto de dateUtils.js para Deno / Supabase Edge Functions
// ============================================================

import { format } from "npm:date-fns@4";

/**
 * Retorna una fecha ISO local sin offset UTC.
 * Evita el bug de zona horaria de new Date('yyyy-mm-dd').
 */
export function getLocalISOString(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}:00`;
}

/** Parser de fecha LOCAL (evita desfase UTC) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Convierte Date a string 'YYYY-MM-DD' */
export function dateToStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Obtiene los días de un mes como array de Date */
export function getDiasMes(anio: number, mes: number): Date[] {
  const daysInMonth = new Date(anio, mes, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(anio, mes - 1, i + 1));
}
