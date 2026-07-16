-- ============================================================
-- ChronosWork — Migración v6: Universalización del algoritmo
-- Skills, preferencias granulares, demanda por fecha,
-- domingos/mes, seniority, nuevos tipos de turno
-- ============================================================
-- Idempotente: se puede correr varias veces sin romper nada.
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- ── 1. NUEVOS TIPOS DE TURNO en shift_templates ───────────────────────────
-- Actualizar el CHECK constraint para incluir los nuevos tipos
ALTER TABLE shift_templates
  DROP CONSTRAINT IF EXISTS shift_templates_shift_kind_check;

ALTER TABLE shift_templates
  ADD CONSTRAINT shift_templates_shift_kind_check
  CHECK (shift_kind IN (
    'STANDARD','PARTIDO','SPLIT_LARGO','ROTATIVO','NOCTURNO',
    'DISPONIBILIDAD','ON_CALL_REMOTO','DOBLE','REFUERZO','FLEXIBLE','CUSTOM'
  ));

-- ── 2. NUEVOS TIPOS DE TURNO en shifts ────────────────────────────────────
ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_shift_kind_check;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_shift_kind_check
  CHECK (shift_kind IN (
    'STANDARD','PARTIDO','SPLIT_LARGO','ROTATIVO','NOCTURNO',
    'DISPONIBILIDAD','ON_CALL_REMOTO','DOBLE','REFUERZO','FLEXIBLE','CUSTOM'
  ));

-- ── 3. TABLA: employee_skills (Habilidades por empleado) ──────────────────
CREATE TABLE IF NOT EXISTS employee_skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill       VARCHAR(100) NOT NULL,  -- ej: 'ingles', 'soporte', 'cocina', 'electricista'
  nivel       VARCHAR(20) DEFAULT 'BASICO'
    CHECK (nivel IN ('BASICO','INTERMEDIO','AVANZADO','EXPERTO')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_employee_skills_emp ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_tenant ON employee_skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill ON employee_skills(tenant_id, skill);

-- ── 4. TABLA: area_skill_requirements (Skills requeridos por área) ────────
CREATE TABLE IF NOT EXISTS area_skill_requirements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id     UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  skill       VARCHAR(100) NOT NULL,
  required    BOOLEAN DEFAULT true,  -- true = obligatorio, false = deseable
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_area_skill_req ON area_skill_requirements(area_id);

-- ── 5. TABLA: employee_preferences (Restricciones de horario) ─────────────
CREATE TABLE IF NOT EXISTS employee_preferences (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_hour   VARCHAR(5),  -- HH:mm
  end_hour     VARCHAR(5),   -- HH:mm
  available    BOOLEAN DEFAULT false,  -- false = NO disponible en esa franja
  observacion  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_prefs_emp ON employee_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_prefs_tenant ON employee_preferences(tenant_id);

-- ── 6. TABLA: area_demand_exceptions (Demanda por fecha específica) ────────
CREATE TABLE IF NOT EXISTS area_demand_exceptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id     UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  slots       JSONB DEFAULT '[]'::jsonb,  -- [{start_hour, end_hour, required_staff}, ...]
  observacion TEXT,  -- ej: "Black Friday", "Día de la Madre", "Festivo"
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area_id, date)
);

CREATE INDEX IF NOT EXISTS idx_demand_exc_area ON area_demand_exceptions(area_id);
CREATE INDEX IF NOT EXISTS idx_demand_exc_date ON area_demand_exceptions(area_id, date);

-- ── 7. CAMPOS NUEVOS en employees ─────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS seniority          DECIMAL(4,1),  -- 0-10, mayor = más prioridad
  ADD COLUMN IF NOT EXISTS max_domingos_mes   INT DEFAULT 2,  -- CST Colombia: mínimo 2 de descanso
  ADD COLUMN IF NOT EXISTS embarazada         BOOLEAN DEFAULT false;

COMMENT ON COLUMN employees.seniority IS
  'Nivel de antigüedad/prioridad (0-10). Mayor = más prioridad para mejores turnos.
   Si es NULL, se calcula automáticamente desde fecha_ingreso.';
COMMENT ON COLUMN employees.max_domingos_mes IS
  'Máximo de domingos trabajables por mes. CST Colombia exige mínimo 2 de descanso.
   Default 2. Si se quiere permitir más (con pago dominical), subir a 3-4.';
COMMENT ON COLUMN employees.embarazada IS
  'Si true, el algoritmo NO asigna turnos nocturnos ni >8h/día (protección maternal).';

-- ── 8. CAMPOS NUEVOS en areas ─────────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS consecutividad_horario  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS equidad_fin_semana      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS peso_seniority          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_domingos_mes_area    INT DEFAULT 2;

COMMENT ON COLUMN areas.consecutividad_horario IS
  'Si true, el algoritmo intenta mantener al empleado en el mismo horario
   días consecutivos (evita rotar de 6am a 2pm a 10pm cada día).';
COMMENT ON COLUMN areas.equidad_fin_semana IS
  'Si true, el algoritmo reparte los fines de semana equitativamente
   (el que menos fines de semana ha trabajado va primero).';
COMMENT ON COLUMN areas.peso_seniority IS
  'Si true, los empleados con más antigüedad tienen prioridad para mejores turnos
   (menos nocturnos, mejores franjas).';
COMMENT ON COLUMN areas.max_domingos_mes_area IS
  'Máximo de domingos trabajables por mes para esta área. Default 2 (CST Colombia).';

-- ── 9. RLS para las nuevas tablas ──────────────────────────────────────────

-- employee_skills
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_skills_select" ON employee_skills;
CREATE POLICY "employee_skills_select" ON employee_skills FOR SELECT
  USING (tenant_id = auth_tenant_id() AND is_operational_admin()
         OR is_platform_admin()
         OR employee_id = auth_employee_id());
DROP POLICY IF EXISTS "employee_skills_insert" ON employee_skills;
CREATE POLICY "employee_skills_insert" ON employee_skills FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "employee_skills_update" ON employee_skills;
CREATE POLICY "employee_skills_update" ON employee_skills FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "employee_skills_delete" ON employee_skills;
CREATE POLICY "employee_skills_delete" ON employee_skills FOR DELETE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());

-- area_skill_requirements
ALTER TABLE area_skill_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "area_skill_req_select" ON area_skill_requirements;
CREATE POLICY "area_skill_req_select" ON area_skill_requirements FOR SELECT
  USING (tenant_id = auth_tenant_id() AND is_operational_admin()
         OR is_platform_admin());
DROP POLICY IF EXISTS "area_skill_req_insert" ON area_skill_requirements;
CREATE POLICY "area_skill_req_insert" ON area_skill_requirements FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "area_skill_req_update" ON area_skill_requirements;
CREATE POLICY "area_skill_req_update" ON area_skill_requirements FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "area_skill_req_delete" ON area_skill_requirements;
CREATE POLICY "area_skill_req_delete" ON area_skill_requirements FOR DELETE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());

-- employee_preferences
ALTER TABLE employee_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emp_prefs_select" ON employee_preferences;
CREATE POLICY "emp_prefs_select" ON employee_preferences FOR SELECT
  USING (tenant_id = auth_tenant_id() AND is_operational_admin()
         OR is_platform_admin()
         OR employee_id = auth_employee_id());
DROP POLICY IF EXISTS "emp_prefs_insert" ON employee_preferences;
CREATE POLICY "emp_prefs_insert" ON employee_preferences FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "emp_prefs_update" ON employee_preferences;
CREATE POLICY "emp_prefs_update" ON employee_preferences FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "emp_prefs_delete" ON employee_preferences;
CREATE POLICY "emp_prefs_delete" ON employee_preferences FOR DELETE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());

-- area_demand_exceptions
ALTER TABLE area_demand_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "demand_exc_select" ON area_demand_exceptions;
CREATE POLICY "demand_exc_select" ON area_demand_exceptions FOR SELECT
  USING (tenant_id = auth_tenant_id() AND is_operational_admin()
         OR is_platform_admin());
DROP POLICY IF EXISTS "demand_exc_insert" ON area_demand_exceptions;
CREATE POLICY "demand_exc_insert" ON area_demand_exceptions FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "demand_exc_update" ON area_demand_exceptions;
CREATE POLICY "demand_exc_update" ON area_demand_exceptions FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());
DROP POLICY IF EXISTS "demand_exc_delete" ON area_demand_exceptions;
CREATE POLICY "demand_exc_delete" ON area_demand_exceptions FOR DELETE
  USING (tenant_id = auth_tenant_id() AND is_operational_admin());

-- ── 10. Vista consolidada de skills del empleado ──────────────────────────
CREATE OR REPLACE VIEW v_employee_skills AS
SELECT
  es.id,
  es.tenant_id,
  es.employee_id,
  e.nombre AS employee_nombre,
  es.skill,
  es.nivel,
  es.created_at
FROM employee_skills es
JOIN employees e ON e.id = es.employee_id
WHERE e.activo = true;

COMMENT ON VIEW v_employee_skills IS
  'Vista consolidada de skills por empleado activo.';

-- ── 11. Vista de preferencias de empleado ──────────────────────────────────
CREATE OR REPLACE VIEW v_employee_preferences AS
SELECT
  ep.id,
  ep.tenant_id,
  ep.employee_id,
  e.nombre AS employee_nombre,
  ep.day_of_week,
  ep.start_hour,
  ep.end_hour,
  ep.available,
  ep.observacion
FROM employee_preferences ep
JOIN employees e ON e.id = ep.employee_id
WHERE e.activo = true;

COMMENT ON VIEW v_employee_preferences IS
  'Vista de restricciones de horario por empleado activo.';
