-- ============================================================
-- ChronosWork — Curva de Demanda Horaria por Área
-- Ejecutar en: Supabase SQL Editor
-- Prerequisito: areas_schema.sql y update_autoassign_schema.sql ya aplicados
-- ============================================================

-- ── TABLA: area_demand_slots ──────────────────────────────────────────────────
-- Almacena cuántos asesores se necesitan por franja horaria, por día de semana,
-- para cada área. Reemplaza el número fijo cobertura_minima_diaria cuando el
-- área tiene operación 24/7 o picos variables.
--
-- Ejemplo de filas para un lunes en un call center:
--   area_id | day_of_week | start_hour | end_hour | required_staff
--   <uuid>  |      1      |     0      |    5     |       2         ← madrugada
--   <uuid>  |      1      |     5      |    7     |       5         ← apertura
--   <uuid>  |      1      |     7      |    13    |      15         ← pico mañana
--   <uuid>  |      1      |    13      |    19    |      12         ← pico tarde
--   <uuid>  |      1      |    19      |    24    |       6         ← cierre
-- ============================================================

CREATE TABLE IF NOT EXISTS area_demand_slots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id       UUID NOT NULL,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id        UUID NOT NULL REFERENCES areas(id)   ON DELETE CASCADE,
  day_of_week    INT  NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Lun … 7=Dom
  start_hour     INT  NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour       INT  NOT NULL CHECK (end_hour   BETWEEN 1 AND 24),  -- 24 = medianoche
  required_staff INT  NOT NULL DEFAULT 1 CHECK (required_staff >= 0),
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  -- No se pueden solapar franjas del mismo día/área (restricción de unicidad simple)
  UNIQUE (area_id, day_of_week, start_hour),
  CONSTRAINT check_hours CHECK (end_hour > start_hour)
);

CREATE INDEX IF NOT EXISTS idx_demand_slots_tenant  ON area_demand_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_demand_slots_area    ON area_demand_slots(area_id);
CREATE INDEX IF NOT EXISTS idx_demand_slots_day     ON area_demand_slots(area_id, day_of_week);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE area_demand_slots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'area_demand_slots' AND policyname = 'demand_slots_select'
  ) THEN
    CREATE POLICY "demand_slots_select" ON area_demand_slots
      FOR SELECT USING (tenant_id = auth_tenant_id() OR is_platform_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'area_demand_slots' AND policyname = 'demand_slots_insert'
  ) THEN
    CREATE POLICY "demand_slots_insert" ON area_demand_slots
      FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'area_demand_slots' AND policyname = 'demand_slots_update'
  ) THEN
    CREATE POLICY "demand_slots_update" ON area_demand_slots
      FOR UPDATE USING (tenant_id = auth_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'area_demand_slots' AND policyname = 'demand_slots_delete'
  ) THEN
    CREATE POLICY "demand_slots_delete" ON area_demand_slots
      FOR DELETE USING (tenant_id = auth_tenant_id());
  END IF;

END $$;

-- ── FUNCIÓN HELPER: obtener el requerimiento de personal en una hora dada ────
-- Útil para queries ad-hoc o desde Edge Functions en el futuro.
-- Retorna required_staff para (area_id, day_of_week, hora_exacta).
-- Si no hay franja configurada para esa hora, retorna NULL.
CREATE OR REPLACE FUNCTION get_required_staff_at(
  p_area_id    UUID,
  p_day        INT,   -- 1=Lun … 7=Dom
  p_hour       INT    -- 0-23
)
RETURNS INT AS $$
  SELECT required_staff
  FROM area_demand_slots
  WHERE area_id    = p_area_id
    AND day_of_week = p_day
    AND start_hour  <= p_hour
    AND end_hour    >  p_hour
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
