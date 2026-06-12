-- ============================================================
-- ChronosWork — Migración: defaults de contrato en áreas
-- Agrega tipo_contrato_default y dias_descanso_default a la
-- tabla areas para que al asignar un área a un empleado se
-- arrastren automáticamente estos valores al formulario.
--
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS tipo_contrato_default VARCHAR(20)
    DEFAULT 'POR_HORAS'
    CHECK (tipo_contrato_default IN ('SALARIO_FIJO', 'POR_HORAS')),
  ADD COLUMN IF NOT EXISTS dias_descanso_default INT
    DEFAULT 1
    CHECK (dias_descanso_default IN (1, 2));

COMMENT ON COLUMN areas.tipo_contrato_default IS
  'Tipo de contrato por defecto para nuevos empleados de esta área (POR_HORAS | SALARIO_FIJO)';
COMMENT ON COLUMN areas.dias_descanso_default IS
  'Días de descanso semanal por defecto para nuevos empleados de esta área (1 | 2)';

-- Opcional: actualizar áreas existentes con modo_operacion 24_7
-- a tipo_contrato_default = 'POR_HORAS' (ya está así por defecto, pero
-- puedes ajustar manualmente según tu configuración actual).
-- UPDATE areas SET tipo_contrato_default = 'POR_HORAS', dias_descanso_default = 1
--   WHERE modo_operacion = '24_7';
