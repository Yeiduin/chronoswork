-- ============================================================
-- ChronosWork — Schema completo: Áreas, Franjas Horarias y Turnos
-- Ejecutar en: Supabase SQL Editor
-- https://supabase.com/dashboard/project/nazvmxcbrmqzsfxlowkx/sql/new
--
-- ORDEN CORRECTO (dependencias primero):
--   1. areas
--   2. area_employees
--   3. shift_templates
--   4. ALTER shifts ADD template_id  ← al final, cuando shift_templates ya existe
-- ============================================================

-- ── PASO 1: Tabla areas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre       VARCHAR(100) NOT NULL,
  descripcion  TEXT,
  color        VARCHAR(7) DEFAULT '#6366f1',
  dias_trabajo INT[] DEFAULT '{1,2,3,4,5}',  -- 1=Lun … 7=Dom
  valor_hora_default      NUMERIC(10, 2),
  cobertura_minima_diaria INT DEFAULT 1,
  cobertura_maxima_diaria INT DEFAULT 10,
  cobertura_por_turno     JSONB DEFAULT '{}'::jsonb,
  modo_operacion          VARCHAR(10) DEFAULT 'OFICINA' CHECK (modo_operacion IN ('OFICINA', '24_7')),
  activo       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_tenant ON areas(tenant_id);

-- ── PASO 2: Tabla area_employees ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS area_employees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id     UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_employees_area     ON area_employees(area_id);
CREATE INDEX IF NOT EXISTS idx_area_employees_employee ON area_employees(employee_id);

-- ── PASO 3: Tabla shift_templates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_templates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id          UUID REFERENCES areas(id) ON DELETE CASCADE,  -- NULL = global
  nombre           VARCHAR(80) NOT NULL,
  hora_inicio      TIME NOT NULL,
  hora_fin         TIME NOT NULL,
  cruza_medianoche BOOLEAN DEFAULT false,
  color            VARCHAR(7) DEFAULT '#3b82f6',
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_tenant ON shift_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_area   ON shift_templates(area_id);

-- ── PASO 4: Agregar template_id a shifts (ahora shift_templates ya existe) ───
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_template ON shifts(template_id);

-- ── PASO 5: RLS para las tres tablas nuevas ──────────────────────────────────

-- areas
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='areas' AND policyname='areas_select') THEN
    CREATE POLICY "areas_select" ON areas FOR SELECT USING (tenant_id = auth_tenant_id() OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='areas' AND policyname='areas_insert') THEN
    CREATE POLICY "areas_insert" ON areas FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='areas' AND policyname='areas_update') THEN
    CREATE POLICY "areas_update" ON areas FOR UPDATE USING (tenant_id = auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='areas' AND policyname='areas_delete') THEN
    CREATE POLICY "areas_delete" ON areas FOR DELETE USING (tenant_id = auth_tenant_id());
  END IF;
END $$;

-- area_employees
ALTER TABLE area_employees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='area_employees' AND policyname='area_employees_select') THEN
    CREATE POLICY "area_employees_select" ON area_employees FOR SELECT USING (tenant_id = auth_tenant_id() OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='area_employees' AND policyname='area_employees_insert') THEN
    CREATE POLICY "area_employees_insert" ON area_employees FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='area_employees' AND policyname='area_employees_delete') THEN
    CREATE POLICY "area_employees_delete" ON area_employees FOR DELETE USING (tenant_id = auth_tenant_id());
  END IF;
END $$;

-- shift_templates
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shift_templates' AND policyname='shift_templates_select') THEN
    CREATE POLICY "shift_templates_select" ON shift_templates FOR SELECT USING (tenant_id = auth_tenant_id() OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shift_templates' AND policyname='shift_templates_insert') THEN
    CREATE POLICY "shift_templates_insert" ON shift_templates FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shift_templates' AND policyname='shift_templates_update') THEN
    CREATE POLICY "shift_templates_update" ON shift_templates FOR UPDATE USING (tenant_id = auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shift_templates' AND policyname='shift_templates_delete') THEN
    CREATE POLICY "shift_templates_delete" ON shift_templates FOR DELETE USING (tenant_id = auth_tenant_id());
  END IF;
END $$;
