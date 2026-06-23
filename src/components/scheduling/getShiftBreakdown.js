// ─── Desglose de un turno para visualización ──────────────────────────────────
// Robusto ante turnos previos a la migración: si las columnas nuevas no existen,
// deriva el almuerzo desde break_minutes y los breaks de 15 desde la duración.
import { computeBreaks } from '../../core/generateAutomaticShifts';

export function getShiftBreakdown(shift) {
  if (!shift) return null;
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const grossH = Math.max(0, (end - start) / 3600000);
  const breakMin = shift.break_minutes ?? 0;

  // Lista de descansos con horario real (si la migración ya está aplicada).
  const descansos = Array.isArray(shift.descansos) ? shift.descansos : [];
  const tieneDetalle = descansos.length > 0;

  let almuerzo, breaks15, breaks15Min;
  if (tieneDetalle) {
    almuerzo    = descansos.filter(d => d.tipo === 'ALMUERZO').reduce((a, b) => a + (b.minutos || 0), 0);
    const brk   = descansos.filter(d => d.tipo === 'BREAK');
    breaks15    = brk.length;
    breaks15Min = brk.reduce((a, b) => a + (b.minutos || 0), 0);
  } else {
    // Fallback para turnos previos a la migración.
    almuerzo    = shift.almuerzo_minutos ?? breakMin ?? 0;
    breaks15    = (shift.breaks_15_count != null) ? shift.breaks_15_count : computeBreaks(grossH).breaks15;
    breaks15Min = breaks15 * 15;
  }
  const netH = Math.max(0, grossH - breakMin / 60);   // netas = bruto − almuerzo (los breaks son pagados)
  const descansoTotalMin = almuerzo + breaks15Min;     // tiempo total de descanso (informativo)
  return { grossH, netH, almuerzo, breaks15, breaks15Min, descansoTotalMin, descansos, tieneDetalle };
}
