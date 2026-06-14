-- ============================================================
-- ChronosWork — Fix: columnas faltantes en `shifts`
-- Para soportar: shift_kind, bloque, disponibilidad,
-- recargo_porcentaje, observaciones
-- (las usa el algoritmo v3 de auto-asignación de turnos)
-- ============================================================
-- Idempotente: se puede correr varias veces sin romper nada.
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- ── 1. Añadir columnas a la tabla shifts ─────────────────────────────────
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS shift_kind           VARCHAR(20) DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS bloque               INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS disponibilidad       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recargo_porcentaje   DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observaciones        TEXT;

-- ── 2. CHECK constraint para shift_kind ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'shifts' AND constraint_name = 'shifts_shift_kind_check'
  ) THEN
    ALTER TABLE shifts
      ADD CONSTRAINT shifts_shift_kind_check
      CHECK (shift_kind IN ('STANDARD','PARTIDO','ROTATIVO','NOCTURNO','DISPONIBILIDAD','CUSTOM'));
  END IF;
END $$;

-- ── 3. Backfill de filas existentes (defensivo) ─────────────────────────
-- Si ya tienes turnos con shift_type = 'morning/afternoon/night',
-- los mapeamos a su shift_kind correspondiente para mantener
-- consistencia con los datos viejos.
UPDATE shifts
SET shift_kind = CASE
  WHEN shift_type = 'night'  THEN 'NOCTURNO'
  WHEN shift_type = 'custom' THEN 'STANDARD'
  ELSE 'STANDARD'
END
WHERE shift_kind IS NULL OR shift_kind = '';

-- ── 4. Índices para los filtros de liquidación de prenómina ────────────
CREATE INDEX IF NOT EXISTS idx_shifts_shift_kind        ON shifts(tenant_id, shift_kind);
CREATE INDEX IF NOT EXISTS idx_shifts_disponibilidad    ON shifts(tenant_id, disponibilidad);
CREATE INDEX IF NOT EXISTS idx_shifts_bloque            ON shifts(template_id, bloque);

-- ── 5. Comentarios documentando las nuevas columnas ────────────────────
COMMENT ON COLUMN shifts.shift_kind IS
  'STANDARD: turno corrido simple.
   PARTIDO: con hora de almuerzo (2 bloques).
   ROTATIVO: sistema rota entre varios turnos.
   NOCTURNO: predominantemente nocturno (HON automático).
   DISPONIBILIDAD: guardia on-call.
   CUSTOM: definido por el usuario.';
COMMENT ON COLUMN shifts.bloque IS
  'Número de bloque cuando el turno es PARTIDO (1 = mañana, 2 = tarde).';
COMMENT ON COLUMN shifts.disponibilidad IS
  'true si el turno es de disponibilidad/guardia (paga recargo sin laborar).';
COMMENT ON COLUMN shifts.recargo_porcentaje IS
  'Recargo % extra para turnos de disponibilidad, definido en la plantilla.';
COMMENT ON COLUMN shifts.observaciones IS
  'Notas libres: ej. "Reprogramado por ausencia", "Cambio autorizado por jefe X", etc.';

-- ── 6. Verificación final ──────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_name = 'shifts'
    AND column_name IN ('shift_kind','bloque','disponibilidad','recargo_porcentaje','observaciones');

  IF v_count = 5 THEN
    RAISE NOTICE '✅ Migración exitosa: las 5 columnas nuevas están en shifts.';
  ELSE
    RAISE EXCEPTION '❌ Solo se encontraron % columnas de las 5 esperadas.', v_count;
  END IF;
END $$;
