-- ============================================================
-- ChronosWork — Migración: Límites de jornada personalizables por área
-- Ejecutar en: Supabase SQL Editor
-- Prerequisito: areas_schema.sql ya aplicado
-- ============================================================

-- Añadir campo labor_limits al área
-- Almacena overrides del empleador sobre los defaults legales colombianos.
-- NULL = usar siempre los defaults de la ley (LEGAL_DEFAULTS_CO en el front).
-- Ejemplo de estructura:
-- {
--   "maxHorasSemanales": 36,
--   "minHorasTurno": 4,
--   "maxHorasTurno": 8,
--   "maxHorasDiarias": 9,
--   "minHorasEntreJornadas": 10,
--   "diasDescansoSemana": 2
-- }
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS labor_limits JSONB DEFAULT NULL;

COMMENT ON COLUMN areas.labor_limits IS
  'Override de límites de jornada laboral. NULL = defaults legales Colombia (Ley 2101/2021 + Ley 2466/2025).';
