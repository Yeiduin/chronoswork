// ============================================================
// Edge Function: auto-assign — utilidades de fecha
// Puerto de dateUtils.js para Deno / Supabase Edge Functions
// ============================================================
// 🔧 v3: Convención "hora de reloj" naïve. getLocalISOString emite
//        la hora tal cual con sufijo Z (UTC). Postgres (timestamptz)
//        la guarda como UTC y la devuelve como ...+00:00, de modo que
//        las vistas (que leen la hora con string slice) muestran la
//        MISMA hora que se generó. Igual que buildISO en dateUtils.js.
//        ⚠ No usar offset real (-05:00): desplazaría las vistas +5h.
// ============================================================

import { format } from "npm:date-fns@4";

/**
 * Retorna una fecha ISO con la hora de reloj tal cual, en UTC (sufijo Z).
 * Ej: getLocalISOString("2026-06-15", "22:00") → "2026-06-15T22:00:00Z"
 *
 * Se guarda como 22:00 UTC y PostgREST la devuelve como
 * "2026-06-15T22:00:00+00:00", por lo que start_time.slice(11,16) === "22:00".
 */
export function getLocalISOString(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);

  // Validar que los minutos existen (defensivo contra "hh" sin ":mm")
  const safeMM = mm ?? 0;

  return (
    `${String(y).padStart(4, "0")}-` +
    `${String(m).padStart(2, "0")}-` +
    `${String(d).padStart(2, "0")}T` +
    `${String(hh).padStart(2, "0")}:` +
    `${String(safeMM).padStart(2, "0")}:00Z`
  );
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
  return Array.from(
    { length: daysInMonth },
    (_, i) => new Date(anio, mes - 1, i + 1),
  );
}
