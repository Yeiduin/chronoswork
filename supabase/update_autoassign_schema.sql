-- ============================================================
-- ChronosWork — Actualización de Esquema: Asignación Automática
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- ── 1. Modificaciones en tabla "areas" ───────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS cobertura_minima_diaria INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cobertura_maxima_diaria INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cobertura_por_turno JSONB DEFAULT '{}'::jsonb;

-- ── 2. Modificaciones en tabla "employees" ───────────────────────────────────
-- 2.1 Añadir columnas de contrato y descansos
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(20) DEFAULT 'POR_HORAS' CHECK (tipo_contrato IN ('SALARIO_FIJO', 'POR_HORAS')),
  ADD COLUMN IF NOT EXISTS dias_descanso_semana INT DEFAULT 1 CHECK (dias_descanso_semana IN (1, 2));

-- 2.2 Añadir turno_predeterminado_id (requiere que la tabla shift_templates exista)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS turno_predeterminado_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_turno_predeterminado ON employees(turno_predeterminado_id);

-- Opcional: Actualizar datos existentes (si es necesario)
-- UPDATE areas SET cobertura_minima_diaria = 1, cobertura_maxima_diaria = 10 WHERE cobertura_minima_diaria IS NULL;
-- UPDATE employees SET tipo_contrato = 'POR_HORAS', dias_descanso_semana = 1 WHERE tipo_contrato IS NULL;
