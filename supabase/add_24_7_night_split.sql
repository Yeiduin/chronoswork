-- ============================================================
-- ChronosWork — Agregar modo_operacion '24_7_NIGHT_SPLIT'
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Este script actualiza el constraint de modo_operacion para incluir
-- el nuevo valor '24_7_NIGHT_SPLIT', que permite áreas 24/7 con gestión
-- separada del turno nocturno.
-- ============================================================

-- Eliminar constraint existente
ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_modo_operacion_check;

-- Recrear constraint con el nuevo valor
ALTER TABLE areas
  ADD CONSTRAINT areas_modo_operacion_check
  CHECK (modo_operacion IS NULL OR modo_operacion IN ('OFICINA', '24_7', '24_7_NIGHT_SPLIT'));

-- Verificar que el constraint se creó correctamente
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.table_constraints
  WHERE table_name = 'areas'
    AND constraint_name = 'areas_modo_operacion_check';

  IF v_count = 1 THEN
    RAISE NOTICE 'Constraint areas_modo_operacion_check actualizado exitosamente';
  ELSE
    RAISE EXCEPTION 'Error: no se pudo crear el constraint';
  END IF;
END $$;
