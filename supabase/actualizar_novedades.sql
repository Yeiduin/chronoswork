-- ============================================================
-- ChronosWork — Actualización de Novedades (Flujo de Aprobación)
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. Añadir columna 'estado' a la tabla absences
ALTER TABLE absences 
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente' 
  CHECK (estado IN ('pendiente', 'aprobada', 'rechazada'));

-- 2. Migrar las novedades existentes a estado 'aprobada' (ya que actualmente `aprobada = true` es el default y son las únicas que existen)
UPDATE absences SET estado = 'aprobada' WHERE aprobada = true AND estado = 'pendiente';

-- 3. Actualizar políticas RLS para permitir a los empleados crear novedades pendientes

-- Eliminar políticas de inserción existentes
DROP POLICY IF EXISTS "absences_insert" ON absences;

-- Nueva política de inserción:
--  - Operacionales pueden insertar directamente (ej: aprobadas por defecto o como deseen).
--  - Empleados pueden insertar PERO solo con estado 'pendiente' y su propio employee_id.
CREATE POLICY "absences_insert" ON absences
  FOR INSERT WITH CHECK (
    (tenant_id = auth_tenant_id() AND is_operational_admin())
    OR 
    (
      tenant_id = auth_tenant_id() AND 
      is_employee_role() AND 
      employee_id = auth_employee_id() AND 
      estado = 'pendiente'
    )
  );

-- Actualizar política de UPDATE para que el empleado no pueda auto-aprobarse,
-- solo el admin operativo puede modificar.
DROP POLICY IF EXISTS "absences_update" ON absences;
CREATE POLICY "absences_update" ON absences
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

-- Actualizar política de DELETE: el empleado podría cancelar su propia solicitud si sigue pendiente? 
-- Por ahora lo mantenemos como estaba: solo admins pueden eliminar.
DROP POLICY IF EXISTS "absences_delete" ON absences;
CREATE POLICY "absences_delete" ON absences
  FOR DELETE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );
