-- ============================================================
-- ChronosWork — Migración: Expandir Novedades a "Por Horas"
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. Añadir los campos a la tabla `absences` para soportar rangos horarios.
ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS por_horas BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin TIME;

-- 2. Asegurarse de que si es por_horas, existan las horas.
-- Como ya hay registros antiguos, la regla aplicará sólo para el futuro,
-- pero lo dejaremos manejado por el backend para evitar errores de migración.
-- (Sin Constraints nuevas para que los registros existentes no rompan).

-- Comentarios explicativos
COMMENT ON COLUMN absences.por_horas IS 'Indica si la novedad es fraccionada en horas (true) o días completos (false)';
COMMENT ON COLUMN absences.hora_inicio IS 'Si por_horas es true, indica la hora de inicio (ej: 08:00)';
COMMENT ON COLUMN absences.hora_fin IS 'Si por_horas es true, indica la hora de fin (ej: 11:30)';
