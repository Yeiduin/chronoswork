-- ============================================================
-- ChronosWork — Fix: agregar columna `sector` a la tabla `employees`
-- ============================================================
-- El modal de importación masiva (BulkImportModal.jsx) envía
-- el campo `sector` del Excel al insertar empleados. Pero la
-- tabla `employees` no tenía esa columna, lo que provocaba:
--   "Could not find the 'sector' column of 'employees' in the schema cache"
--
-- Esta migración agrega la columna con su CHECK constraint
-- alineado a los sectores del catálogo SECTORES en laborCatalog.js.
--
-- Es idempotente: se puede correr varias veces sin romper.
-- ============================================================

-- 1) Agregar la columna (si no existe)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sector TEXT;

-- 2) Limpiar valores huérfanos (por si los hay) para que el CHECK no falle
UPDATE public.employees
SET sector = NULL
WHERE sector IS NOT NULL
  AND sector NOT IN (
    'RETAIL', 'HOTELERIA', 'RESTAURANTE', 'SALUD', 'SEGURIDAD',
    'INDUSTRIA', 'CONSTRUCCION', 'LOGISTICA', 'OFICINA', 'EDUCACION',
    'AGRO', 'TECNOLOGIA', 'CALL_CENTER', 'OTRO'
  );

-- 3) Eliminar CHECK constraint antiguo si existe
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_sector_check;

-- 4) Crear CHECK constraint con los valores del catálogo SECTORES
ALTER TABLE public.employees
  ADD CONSTRAINT employees_sector_check
  CHECK (
    sector IS NULL OR sector IN (
      'RETAIL', 'HOTELERIA', 'RESTAURANTE', 'SALUD', 'SEGURIDAD',
      'INDUSTRIA', 'CONSTRUCCION', 'LOGISTICA', 'OFICINA', 'EDUCACION',
      'AGRO', 'TECNOLOGIA', 'CALL_CENTER', 'OTRO'
    )
  );

-- 5) Índice para reportes / filtros rápidos por sector
CREATE INDEX IF NOT EXISTS idx_employees_sector
  ON public.employees(tenant_id, sector)
  WHERE sector IS NOT NULL;

-- 6) Comentario descriptivo
COMMENT ON COLUMN public.employees.sector IS
  'Sector económico del empleado (catálogo SECTORES de laborCatalog.js). Independiente del sector del área donde trabaja.';

-- 7) Verificación
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'employees'
    AND column_name = 'sector';
  IF v_count = 1 THEN
    RAISE NOTICE '✅ Columna employees.sector creada correctamente.';
  ELSE
    RAISE EXCEPTION '❌ La columna employees.sector no se creó. Revisa los logs.';
  END IF;
END $$;
