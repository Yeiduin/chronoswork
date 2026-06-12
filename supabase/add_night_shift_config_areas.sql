-- ChronosWork — Migración: configuración de jornada nocturna por área
-- Ejecutar en Supabase SQL Editor

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS night_shift_enabled   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_shift_start      TEXT    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS night_shift_end        TEXT    DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS night_shift_employee_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN areas.night_shift_enabled
  IS 'Si true, hay una jornada nocturna dedicada (solo aplica en modo 24_7)';
COMMENT ON COLUMN areas.night_shift_start
  IS 'Hora de inicio de la jornada nocturna, ej: 22:00';
COMMENT ON COLUMN areas.night_shift_end
  IS 'Hora de fin de la jornada nocturna (puede cruzar medianoche), ej: 06:00';
COMMENT ON COLUMN areas.night_shift_employee_ids
  IS 'IDs de empleados asignados exclusivamente a la jornada nocturna. Si está vacío, el sistema los elige automáticamente.';
