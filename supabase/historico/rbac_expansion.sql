-- ============================================================
-- ChronosWork — Expansión RBAC Multi-tenant
-- Sistema de Control de Acceso Basado en Roles (4 niveles)
-- ============================================================
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- Ejecutar en: Supabase SQL Editor
--
-- Roles implementados:
--   SaaS_Admin       → tabla platform_admins (ya existente)
--   Super_Admin      → tenant_users.rol = 'super_admin'
--   Coordinador_Admin→ tenant_users.rol = 'coordinator'
--   Empleado         → tenant_users.rol = 'empleado' (NUEVO)
-- ============================================================

-- ── SECCIÓN 1: Ampliar rol en tenant_users ────────────────────────────────

-- Eliminar el CHECK constraint antiguo y reemplazarlo con uno que incluye 'empleado'
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints
  WHERE table_name = 'tenant_users'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%rol%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
  END IF;
END $$;

ALTER TABLE tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_rol_check;

ALTER TABLE tenant_users
  ADD CONSTRAINT tenant_users_rol_check
  CHECK (rol IN ('super_admin', 'admin', 'coordinator', 'empleado'));

COMMENT ON COLUMN tenant_users.rol IS
  'super_admin=Dueño empresa | admin=sinónimo coordinator | coordinator=Programador turnos | empleado=Colaborador';

-- ── SECCIÓN 2: Vincular empleado con su cuenta Auth ───────────────────────

-- Agregar auth_user_id a employees (nullable: no todos tienen cuenta)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_auth_user
  ON employees(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN employees.auth_user_id IS
  'UUID de auth.users. Se llena al provisionar cuenta de acceso al empleado.';

-- ── SECCIÓN 3: Tabla subscriptions ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type   VARCHAR(20) NOT NULL DEFAULT 'mensual'
              CHECK (plan_type IN ('mensual', 'trimestral', 'semestral', 'anual')),
  status      VARCHAR(20) NOT NULL DEFAULT 'trialing'
              CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, expires_at);

COMMENT ON TABLE subscriptions IS
  'Detalle de suscripciones SaaS por tenant. Gestionado exclusivamente por el SaaS_Admin.';

-- Trigger para updated_at automático en subscriptions
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- Migrar tenants existentes a la tabla subscriptions si aún no tienen registro
INSERT INTO subscriptions (tenant_id, plan_type, status, starts_at, expires_at)
SELECT
  t.id,
  CASE
    WHEN t.plan = 'start'      THEN 'mensual'
    WHEN t.plan = 'scale'      THEN 'trimestral'
    WHEN t.plan = 'enterprise' THEN 'anual'
    ELSE 'mensual'
  END,
  CASE
    WHEN t.suscripcion_activa = true AND t.plan_vigente_hasta > NOW() THEN 'active'
    WHEN t.suscripcion_activa = true THEN 'trialing'
    ELSE 'canceled'
  END,
  t.created_at,
  COALESCE(t.plan_vigente_hasta, NOW() + INTERVAL '30 days')
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id
);

-- ── SECCIÓN 4: RLS para subscriptions ────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Solo platform_admin ve y modifica todas las suscripciones
DROP POLICY IF EXISTS "subscriptions_saas_admin_all" ON subscriptions;
CREATE POLICY "subscriptions_saas_admin_all" ON subscriptions
  FOR ALL USING (is_platform_admin());

-- Tenant puede ver su propia suscripción
DROP POLICY IF EXISTS "subscriptions_tenant_select" ON subscriptions;
CREATE POLICY "subscriptions_tenant_select" ON subscriptions
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ── SECCIÓN 5: Funciones helper de rol ───────────────────────────────────

-- Obtener el rol del usuario autenticado dentro de su tenant
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT rol FROM tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar si el usuario es Super_Admin de su empresa
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid() AND rol = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar si el usuario es Coordinador de su empresa
CREATE OR REPLACE FUNCTION is_coordinator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid() AND rol IN ('coordinator', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar si el usuario es un Empleado (colaborador)
CREATE OR REPLACE FUNCTION is_employee_role()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid() AND rol = 'empleado'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar si el usuario es admin operativo (super_admin o coordinator)
CREATE OR REPLACE FUNCTION is_operational_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid() AND rol IN ('super_admin', 'admin', 'coordinator')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Obtener el employee_id del empleado autenticado
CREATE OR REPLACE FUNCTION auth_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── SECCIÓN 6: RLS actualizado para rol Empleado ──────────────────────────

-- ---- employees: el empleado puede leer solo su propio registro ----
DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees
  FOR SELECT USING (
    -- Admins ven todos los de su tenant
    (tenant_id = auth_tenant_id() AND is_operational_admin())
    -- Platform admin ve todos
    OR is_platform_admin()
    -- Empleado ve solo su propio registro
    OR auth_user_id = auth.uid()
  );

-- Empleados no pueden insertar/actualizar/eliminar empleados
-- (ya existían las policies restrictivas, se dejan igual)

-- ---- absences: el empleado ve solo sus novedades ----
DROP POLICY IF EXISTS "absences_select" ON absences;
CREATE POLICY "absences_select" ON absences
  FOR SELECT USING (
    -- Admins ven todas las de su tenant
    (tenant_id = auth_tenant_id() AND is_operational_admin())
    -- Platform admin ve todas
    OR is_platform_admin()
    -- Empleado ve solo las suyas: join via employees.auth_user_id
    OR employee_id = auth_employee_id()
  );

-- Empleado NO puede crear/modificar/eliminar novedades (solo leer las suyas)
DROP POLICY IF EXISTS "absences_insert" ON absences;
CREATE POLICY "absences_insert" ON absences
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

DROP POLICY IF EXISTS "absences_delete" ON absences;
CREATE POLICY "absences_delete" ON absences
  FOR DELETE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

-- ---- shifts: el empleado ve solo sus turnos ----
DROP POLICY IF EXISTS "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts
  FOR SELECT USING (
    -- Admins ven todos los de su tenant
    (tenant_id = auth_tenant_id() AND is_operational_admin())
    -- Platform admin ve todos
    OR is_platform_admin()
    -- Empleado ve solo los suyos: join via employees.auth_user_id
    OR employee_id = auth_employee_id()
  );

-- Empleado NO puede crear/modificar/eliminar turnos
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
CREATE POLICY "shifts_insert" ON shifts
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

DROP POLICY IF EXISTS "shifts_update" ON shifts;
CREATE POLICY "shifts_update" ON shifts
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

DROP POLICY IF EXISTS "shifts_delete" ON shifts;
CREATE POLICY "shifts_delete" ON shifts
  FOR DELETE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

-- ── SECCIÓN 7: RPC — Perfil completo del empleado autenticado ─────────────

CREATE OR REPLACE FUNCTION get_my_employee_profile()
RETURNS JSONB AS $$
DECLARE
  v_employee_id UUID;
  v_result JSONB;
BEGIN
  -- Solo disponible para rol 'empleado'
  IF NOT is_employee_role() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Esta función es exclusiva para colaboradores.';
  END IF;

  SELECT id INTO v_employee_id FROM employees WHERE auth_user_id = auth.uid();

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: No se encontró el perfil del empleado autenticado.';
  END IF;

  SELECT jsonb_build_object(
    'employee', row_to_json(e.*),
    'shifts', (
      SELECT jsonb_agg(row_to_json(s.*) ORDER BY s.start_time DESC)
      FROM shifts s
      WHERE s.employee_id = v_employee_id
        AND s.start_time >= NOW() - INTERVAL '60 days'
    ),
    'absences', (
      SELECT jsonb_agg(row_to_json(a.*) ORDER BY a.fecha_inicio DESC)
      FROM absences a
      WHERE a.employee_id = v_employee_id
    )
  )
  INTO v_result
  FROM employees e
  WHERE e.id = v_employee_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── SECCIÓN 8: RPC — Gestión de suscripciones (SaaS_Admin) ───────────────

-- Listar todos los tenants con su suscripción (solo platform_admin)
CREATE OR REPLACE FUNCTION get_all_tenants_with_subscriptions()
RETURNS TABLE (
  tenant_id       UUID,
  razon_social    VARCHAR,
  nit             VARCHAR,
  plan            VARCHAR,
  activo          BOOLEAN,
  sub_plan_type   VARCHAR,
  sub_status      VARCHAR,
  sub_expires_at  TIMESTAMPTZ,
  sub_notas       TEXT,
  created_at      TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Solo el administrador de la plataforma puede ver esta información.';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.razon_social,
    t.nit,
    t.plan,
    t.activo,
    s.plan_type,
    s.status,
    s.expires_at,
    s.notas,
    t.created_at
  FROM tenants t
  LEFT JOIN subscriptions s ON s.tenant_id = t.id
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Actualizar suscripción de un tenant (solo platform_admin)
CREATE OR REPLACE FUNCTION update_tenant_subscription(
  p_tenant_id   UUID,
  p_plan_type   VARCHAR,
  p_status      VARCHAR,
  p_expires_at  TIMESTAMPTZ,
  p_notas       TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Solo el administrador de la plataforma puede modificar suscripciones.';
  END IF;

  -- Actualizar tabla subscriptions
  INSERT INTO subscriptions (tenant_id, plan_type, status, expires_at, notas)
  VALUES (p_tenant_id, p_plan_type, p_status, p_expires_at, p_notas)
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_type  = EXCLUDED.plan_type,
    status     = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    notas      = EXCLUDED.notas;

  -- Sincronizar con tabla tenants (para compatibilidad con el sistema existente)
  UPDATE tenants SET
    plan                = CASE p_plan_type
                            WHEN 'mensual'     THEN 'start'
                            WHEN 'trimestral'  THEN 'scale'
                            WHEN 'semestral'   THEN 'scale'
                            WHEN 'anual'       THEN 'enterprise'
                            ELSE plan
                          END,
    suscripcion_activa  = (p_status IN ('active', 'trialing')),
    plan_vigente_hasta  = p_expires_at
  WHERE id = p_tenant_id;

  RETURN 'OK: Suscripción actualizada correctamente para tenant ' || p_tenant_id::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── SECCIÓN 9: RPC — Check de suscripción activa ─────────────────────────

-- Retorna si el tenant del usuario autenticado tiene suscripción vigente
CREATE OR REPLACE FUNCTION check_my_tenant_subscription()
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  v_tenant_id := auth_tenant_id();

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('active', false, 'reason', 'NO_TENANT');
  END IF;

  SELECT jsonb_build_object(
    'active',      t.suscripcion_activa AND t.plan_vigente_hasta > NOW(),
    'plan',        t.plan,
    'expires_at',  t.plan_vigente_hasta,
    'status',      COALESCE(s.status, 'trialing'),
    'reason',      CASE
                     WHEN NOT t.suscripcion_activa THEN 'SUBSCRIPTION_INACTIVE'
                     WHEN t.plan_vigente_hasta <= NOW() THEN 'SUBSCRIPTION_EXPIRED'
                     ELSE 'OK'
                   END
  )
  INTO v_result
  FROM tenants t
  LEFT JOIN subscriptions s ON s.tenant_id = t.id
  WHERE t.id = v_tenant_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── SECCIÓN 10: RPC — Provisionar empleado en DB (sin Auth) ──────────────
-- Esta función registra al empleado en tenant_users.
-- La creación del usuario Auth se hace desde la Edge Function.

CREATE OR REPLACE FUNCTION link_employee_auth_account(
  p_employee_id  UUID,
  p_auth_user_id UUID
)
RETURNS TEXT AS $$
BEGIN
  -- Solo admins operativos de ese tenant pueden vincular cuentas
  IF NOT is_operational_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: No tiene permisos para provisionar cuentas de empleados.';
  END IF;

  -- Verificar que el empleado pertenece al tenant del admin que ejecuta
  IF NOT EXISTS (
    SELECT 1 FROM employees
    WHERE id = p_employee_id AND tenant_id = auth_tenant_id()
  ) THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: El empleado no pertenece a su organización.';
  END IF;

  -- Vincular el auth_user_id al empleado
  UPDATE employees SET auth_user_id = p_auth_user_id WHERE id = p_employee_id;

  -- Crear entrada en tenant_users para el nuevo empleado
  INSERT INTO tenant_users (user_id, tenant_id, rol)
  VALUES (p_auth_user_id, auth_tenant_id(), 'empleado')
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET rol = 'empleado';

  RETURN 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── FIN DEL SCRIPT ────────────────────────────────────────────────────────
-- Verificación post-ejecución:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'employees' AND column_name = 'auth_user_id';
-- SELECT * FROM subscriptions;
-- SELECT auth_user_role();
