-- ============================================================
-- ChronosWork — Schema completo de Base de Datos
-- PostgreSQL / Supabase
-- Multi-tenant SaaS con Row Level Security (RLS)
-- Versión 2.0 — con Platform Admin y gestión de suscripciones
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: platform_admins
-- Dueños/administradores de la PLATAFORMA (no de empresas clientes)
-- Solo Yeiduin y quienes él autorice pueden estar aquí
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_admins (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función: verificar si el usuario autenticado es platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- TABLA: tenants (Empresas cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razon_social    VARCHAR(200) NOT NULL,
  nit             VARCHAR(20) UNIQUE NOT NULL,
  direccion       TEXT,
  telefono        VARCHAR(30),
  -- PLAN Y SUSCRIPCIÓN
  plan            VARCHAR(20) DEFAULT 'start' CHECK (plan IN ('start', 'scale', 'enterprise')),
  plan_vigente_hasta TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- Trial 30 días gratis
  suscripcion_activa BOOLEAN DEFAULT true,
  -- ESTADO
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: tenant_users (Asociación usuarios <-> empresas)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rol         VARCHAR(30) DEFAULT 'admin' CHECK (rol IN ('super_admin', 'admin', 'coordinator')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- ============================================================
-- TABLA: employees (Empleados de cada tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cedula      VARCHAR(15) NOT NULL,
  nombre      VARCHAR(200) NOT NULL,
  cargo       VARCHAR(100) NOT NULL,
  valor_hora  DECIMAL(12, 2) NOT NULL CHECK (valor_hora > 0),
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, cedula)
);

CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(tenant_id, activo);

-- ============================================================
-- TABLA: absences (Novedades laborales)
-- ============================================================
CREATE TABLE IF NOT EXISTS absences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo          VARCHAR(30) NOT NULL CHECK (tipo IN ('vacaciones', 'incapacidad', 'licencia', 'suspension')),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  aprobada      BOOLEAN DEFAULT true,
  observaciones TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_absences_tenant ON absences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_absences_employee ON absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_fechas ON absences(fecha_inicio, fecha_fin);

-- ============================================================
-- TABLA: shifts (Turnos asignados)
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  shift_type    VARCHAR(20) CHECK (shift_type IN ('morning', 'afternoon', 'night', 'custom')),
  periodo       VARCHAR(7) NOT NULL,  -- formato YYYY-MM
  break_minutes INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_shift_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_periodo ON shifts(tenant_id, periodo);
CREATE INDEX IF NOT EXISTS idx_shifts_start ON shifts(start_time);

-- ============================================================
-- TRIGGER: Validar límite de horas extras (CST colombiano)
-- ============================================================
CREATE OR REPLACE FUNCTION validate_shift_extras()
RETURNS TRIGGER AS $$
DECLARE
  v_dia_horas DECIMAL;
  v_semana_horas DECIMAL;
  v_horas_turno DECIMAL;
  v_fecha DATE;
  v_semana_inicio DATE;
  v_semana_fin DATE;
BEGIN
  v_horas_turno := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600) - (COALESCE(NEW.break_minutes, 0) / 60.0);
  IF v_horas_turno < 0 THEN
    v_horas_turno := 0;
  END IF;

  v_fecha := DATE(NEW.start_time AT TIME ZONE 'America/Bogota');
  v_semana_inicio := DATE_TRUNC('week', v_fecha)::DATE;
  v_semana_fin := v_semana_inicio + INTERVAL '6 days';

  SELECT COALESCE(SUM((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) - (COALESCE(break_minutes, 0) / 60.0)), 0)
  INTO v_dia_horas
  FROM shifts
  WHERE employee_id = NEW.employee_id
    AND DATE(start_time AT TIME ZONE 'America/Bogota') = v_fecha
    AND id != COALESCE(NEW.id, uuid_generate_v4());

  SELECT COALESCE(SUM((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) - (COALESCE(break_minutes, 0) / 60.0)), 0)
  INTO v_semana_horas
  FROM shifts
  WHERE employee_id = NEW.employee_id
    AND DATE(start_time AT TIME ZONE 'America/Bogota') BETWEEN v_semana_inicio AND v_semana_fin
    AND id != COALESCE(NEW.id, uuid_generate_v4());

  IF (v_dia_horas + v_horas_turno) > 14 THEN
    RAISE EXCEPTION 'LÍMITE_EXCEDIDO: El turno supera el máximo diario permitido de horas para el empleado.';
  END IF;

  IF (v_semana_horas + v_horas_turno) > 54 THEN
    RAISE EXCEPTION 'LÍMITE_SEMANAL_EXCEDIDO: El turno supera el límite semanal de horas del CST colombiano.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_shift_extras
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_shift_extras();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Función auxiliar: obtener tenant_id del usuario autenticado
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---- Políticas para: platform_admins ----
-- Solo el propio admin puede verse a sí mismo
CREATE POLICY "platform_admin_select_self" ON platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- ---- Políticas para: tenants ----
-- Empresas: cada usuario ve solo la suya. Platform admin ve TODAS.
CREATE POLICY "tenant_select_own" ON tenants
  FOR SELECT USING (
    id = auth_tenant_id()
    OR is_platform_admin()
  );

CREATE POLICY "tenant_update_own" ON tenants
  FOR UPDATE USING (
    id = auth_tenant_id()
    OR is_platform_admin()
  );

-- Platform admin puede insertar tenants directamente
CREATE POLICY "tenant_insert_platform" ON tenants
  FOR INSERT WITH CHECK (true); -- Permitido durante registro

-- Platform admin puede desactivar/eliminar tenants
CREATE POLICY "tenant_delete_platform" ON tenants
  FOR DELETE USING (is_platform_admin());

-- ---- Políticas para: tenant_users ----
CREATE POLICY "tenant_users_select" ON tenant_users
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    OR is_platform_admin()
  );

CREATE POLICY "tenant_users_insert" ON tenant_users
  FOR INSERT WITH CHECK (true); -- Permitir durante registro

-- ---- Políticas para: employees ----
CREATE POLICY "employees_select" ON employees
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    OR is_platform_admin()
  );

CREATE POLICY "employees_insert" ON employees
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "employees_update" ON employees
  FOR UPDATE USING (tenant_id = auth_tenant_id());

CREATE POLICY "employees_delete" ON employees
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ---- Políticas para: absences ----
CREATE POLICY "absences_select" ON absences
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    OR is_platform_admin()
  );

CREATE POLICY "absences_insert" ON absences
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "absences_delete" ON absences
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ---- Políticas para: shifts ----
CREATE POLICY "shifts_select" ON shifts
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    OR is_platform_admin()
  );

CREATE POLICY "shifts_insert" ON shifts
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "shifts_update" ON shifts
  FOR UPDATE USING (tenant_id = auth_tenant_id());

CREATE POLICY "shifts_delete" ON shifts
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ============================================================
-- FUNCIÓN: Registrar Platform Admin (ejecutar manualmente una vez)
-- Reemplaza 'TU-USER-ID-AQUI' con tu UUID de auth.users
-- ============================================================
-- Para ejecutar: descomenta y pega tu user_id real
/*
INSERT INTO platform_admins (user_id, nombre)
VALUES ('TU-USER-ID-AQUI', 'Yeiduin Romero Muñoz')
ON CONFLICT (user_id) DO NOTHING;
*/

-- ============================================================
-- FUNCIÓN: Cambiar plan de un tenant (solo platform admin lo puede usar)
-- Uso desde Supabase SQL Editor: SELECT change_tenant_plan('tenant-uuid', 'scale');
-- ============================================================
CREATE OR REPLACE FUNCTION change_tenant_plan(
  p_tenant_id UUID,
  p_nuevo_plan VARCHAR,
  p_meses INT DEFAULT 1
)
RETURNS TEXT AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo el administrador de la plataforma puede cambiar planes.';
  END IF;

  UPDATE tenants SET
    plan = p_nuevo_plan,
    suscripcion_activa = true,
    plan_vigente_hasta = NOW() + (p_meses || ' months')::INTERVAL
  WHERE id = p_tenant_id;

  RETURN 'Plan actualizado correctamente a: ' || p_nuevo_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
