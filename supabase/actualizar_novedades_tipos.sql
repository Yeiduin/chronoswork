-- ============================================================
-- ChronosWork — Migración: Expandir tipos de Novedades (CST)
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. Eliminar la restricción (CHECK) estricta de la columna 'tipo'
-- Como el nombre de la restricción pudo ser generado automáticamente (ej: absences_tipo_check),
-- usamos un bloque anónimo para encontrar su nombre exacto y eliminarlo.
DO $$ 
DECLARE 
  const_name text;
BEGIN
  SELECT constraint_name INTO const_name 
  FROM information_schema.table_constraints 
  WHERE table_name = 'absences' 
    AND constraint_type = 'CHECK' 
    AND constraint_name LIKE '%tipo%';
  
  IF const_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE absences DROP CONSTRAINT ' || const_name;
  END IF;
END $$;

-- (Opcional) Si en el futuro deseas volver a restringir los valores estrictamente a nivel base de datos:
-- ALTER TABLE absences ADD CONSTRAINT absences_tipo_check CHECK (tipo IN (
--   'vacaciones', 'incapacidad_general', 'incapacidad_laboral', 'licencia_maternidad', 
--   'licencia_paternidad', 'licencia_luto', 'calamidad_domestica', 'licencia_sufragio', 
--   'licencia_sindical', 'permiso_remunerado', 'permiso_no_remunerado', 'suspension', 'otro'
-- ));
