-- ============================================================
-- ChronosWork — Programación de descansos con horarios reales
-- Almacena los descansos (breaks y almuerzo) de cada turno con su
-- hora exacta, y la política de descansos configurable por área.
-- ============================================================
-- Idempotente: se puede correr varias veces sin romper nada.
-- Ejecutar en: Supabase SQL Editor
-- Prerequisito: add_shift_breaks_detail.sql ya aplicado.
-- ============================================================

-- ── 1. Columna de descansos detallados en cada turno ─────────────────────
-- Estructura: array de objetos
--   [{ "tipo": "BREAK"|"ALMUERZO", "inicio": "HH:MM", "minutos": 15 }, ...]
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS descansos JSONB DEFAULT '[]'::jsonb;

-- ── 2. Política de descansos por área ────────────────────────────────────
-- NULL = usar los defaults legales del front (BREAK_POLICY_DEFAULTS_CO).
-- Estructura:
-- {
--   "breakMinutos": 15,
--   "almuerzoMinutos": 60,        -- 30 | 45 | 60
--   "gapMinHoras": 1,             -- mín. horas antes del 1er descanso / entre descansos
--   "gapMaxHoras": 3,             -- máx. horas antes del 1er descanso / entre descansos
--   "reglas": [                   -- nº de breaks y almuerzo según duración del turno
--     { "desdeHoras": 0, "breaks": 1, "almuerzo": false },
--     { "desdeHoras": 6, "breaks": 2, "almuerzo": false },
--     { "desdeHoras": 8, "breaks": 1, "almuerzo": true  },
--     { "desdeHoras": 9, "breaks": 2, "almuerzo": true  }
--   ]
-- }
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS break_policy JSONB DEFAULT NULL;

-- ── 3. Comentarios ───────────────────────────────────────────────────────
COMMENT ON COLUMN shifts.descansos IS
  'Descansos del turno con hora exacta: [{tipo:BREAK|ALMUERZO, inicio:HH:MM, minutos}]. El almuerzo (ALMUERZO) se descuenta de horas netas vía break_minutes; los BREAK son pagados.';
COMMENT ON COLUMN areas.break_policy IS
  'Política de descansos configurable por el empleador (duración de breaks/almuerzo, espaciado mín/máx y reglas por horas). NULL = defaults legales Colombia.';

-- ── 4. Verificación final ────────────────────────────────────────────────
DO $$
DECLARE
  v_shifts INT;
  v_areas  INT;
BEGIN
  SELECT COUNT(*) INTO v_shifts FROM information_schema.columns
   WHERE table_name = 'shifts' AND column_name = 'descansos';
  SELECT COUNT(*) INTO v_areas FROM information_schema.columns
   WHERE table_name = 'areas' AND column_name = 'break_policy';

  IF v_shifts = 1 AND v_areas = 1 THEN
    RAISE NOTICE '✅ Migración exitosa: shifts.descansos y areas.break_policy listos.';
  ELSE
    RAISE EXCEPTION '❌ Faltan columnas (shifts.descansos=% , areas.break_policy=%).', v_shifts, v_areas;
  END IF;
END $$;
