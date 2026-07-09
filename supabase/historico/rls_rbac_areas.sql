-- ============================================================
-- ChronosWork — RLS RBAC para tablas de áreas, templates y demanda
-- Actualiza las políticas para respetar el modelo de roles:
--   - empleado    → solo ve su propia área/asignación
--   - coordinator → ve todo en su tenant (operational admin)
--   - super_admin → ve todo en su tenant
--   - saas_admin  → ve todo (platform_admin)
--
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- ── areas: restringir SELECT para empleados ───────────────────────────────
DROP POLICY IF EXISTS "areas_select" ON areas;
CREATE POLICY "areas_select" ON areas FOR SELECT USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
  OR is_platform_admin()
);

-- INSERT/UPDATE/DELETE solo para admins operativos
DROP POLICY IF EXISTS "areas_insert" ON areas;
CREATE POLICY "areas_insert" ON areas FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "areas_update" ON areas;
CREATE POLICY "areas_update" ON areas FOR UPDATE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "areas_delete" ON areas;
CREATE POLICY "areas_delete" ON areas FOR DELETE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

-- ── area_employees: empleado solo ve su propia asignación ─────────────────
DROP POLICY IF EXISTS "area_employees_select" ON area_employees;
CREATE POLICY "area_employees_select" ON area_employees FOR SELECT USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
  OR is_platform_admin()
  OR employee_id = auth_employee_id()  -- empleado ve su propia área
);

DROP POLICY IF EXISTS "area_employees_insert" ON area_employees;
CREATE POLICY "area_employees_insert" ON area_employees FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "area_employees_delete" ON area_employees;
CREATE POLICY "area_employees_delete" ON area_employees FOR DELETE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

-- ── shift_templates: solo admins operativos gestionan ─────────────────────
DROP POLICY IF EXISTS "shift_templates_select" ON shift_templates;
CREATE POLICY "shift_templates_select" ON shift_templates FOR SELECT USING (
  tenant_id = auth_tenant_id()
  OR is_platform_admin()
);

DROP POLICY IF EXISTS "shift_templates_insert" ON shift_templates;
CREATE POLICY "shift_templates_insert" ON shift_templates FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "shift_templates_update" ON shift_templates;
CREATE POLICY "shift_templates_update" ON shift_templates FOR UPDATE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "shift_templates_delete" ON shift_templates;
CREATE POLICY "shift_templates_delete" ON shift_templates FOR DELETE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

-- ── area_demand_slots: restringir escritura a admins ──────────────────────
ALTER TABLE area_demand_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "area_demand_slots_select" ON area_demand_slots;
CREATE POLICY "area_demand_slots_select" ON area_demand_slots FOR SELECT USING (
  tenant_id = auth_tenant_id()
  OR is_platform_admin()
);

DROP POLICY IF EXISTS "area_demand_slots_insert" ON area_demand_slots;
CREATE POLICY "area_demand_slots_insert" ON area_demand_slots FOR INSERT WITH CHECK (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "area_demand_slots_update" ON area_demand_slots;
CREATE POLICY "area_demand_slots_update" ON area_demand_slots FOR UPDATE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);

DROP POLICY IF EXISTS "area_demand_slots_delete" ON area_demand_slots;
CREATE POLICY "area_demand_slots_delete" ON area_demand_slots FOR DELETE USING (
  tenant_id = auth_tenant_id() AND is_operational_admin()
);
