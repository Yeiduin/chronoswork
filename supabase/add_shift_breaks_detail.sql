-- ============================================================
-- ChronosWork — Desglose de descansos en `shifts`
-- Separa el descanso total en: almuerzo (no pagado) + breaks de 15 min.
-- ============================================================
-- Idempotente: se puede correr varias veces sin romper nada.
-- Ejecutar en: Supabase SQL Editor
--
-- Convención de horas:
--   break_minutes      = minutos que SE DESCUENTAN de las horas netas
--                        (= almuerzo_minutos). Lo usan el trigger y la
--                        liquidación de prenómina. NO se toca su semántica.
--   almuerzo_minutos   = duración del almuerzo (no pagado).
--   breaks_15_count    = nº de breaks de 15 min (pagados, informativos;
--                        NO se descuentan de las horas netas).
-- ============================================================

-- ── 1. Añadir columnas de desglose ───────────────────────────────────────
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS almuerzo_minutos INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breaks_15_count  INT DEFAULT 0;

-- ── 2. Backfill defensivo de filas existentes ────────────────────────────
-- Los turnos viejos guardaban todo el descanso en break_minutes; lo
-- interpretamos como almuerzo. Solo backfill donde aún no se ha desglosado.
UPDATE shifts
SET almuerzo_minutos = COALESCE(break_minutes, 0)
WHERE almuerzo_minutos = 0
  AND COALESCE(break_minutes, 0) > 0;

-- ── 3. Comentarios documentando las columnas ─────────────────────────────
COMMENT ON COLUMN shifts.almuerzo_minutos IS
  'Duración del almuerzo en minutos (no pagado). Se descuenta de las horas netas vía break_minutes.';
COMMENT ON COLUMN shifts.breaks_15_count IS
  'Cantidad de breaks de 15 minutos del turno (pagados, informativos). No se descuentan de horas netas.';

-- ── 4. Verificación final ────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_name = 'shifts'
    AND column_name IN ('almuerzo_minutos', 'breaks_15_count');

  IF v_count = 2 THEN
    RAISE NOTICE '✅ Migración exitosa: almuerzo_minutos y breaks_15_count están en shifts.';
  ELSE
    RAISE EXCEPTION '❌ Solo se encontraron % columnas de las 2 esperadas.', v_count;
  END IF;
END $$;
