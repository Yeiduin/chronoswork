-- ============================================================
-- ChronosWork — Migración: Agregar email_institucional a employees
-- Para soportar login con cédula (resolver cédula → email)
-- ============================================================

-- Agregar columna email_institucional a employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS email_institucional VARCHAR(200);

-- Índice para búsqueda rápida por cédula + email_institucional
CREATE INDEX IF NOT EXISTS idx_employees_cedula_email
  ON employees(cedula, email_institucional)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN employees.email_institucional IS
  'Email institucional generado automáticamente al provisionar la cuenta de acceso. Formato: nombresapellidos@empresa.chronoswork.app';

-- ============================================================
-- Para empleados que YA tienen cuenta provisonada (migración),
-- se puede llenar este campo manualmente con:
--
-- UPDATE employees e
-- SET email_institucional = u.email
-- FROM auth.users u
-- WHERE e.auth_user_id = u.id
--   AND e.email_institucional IS NULL
--   AND e.auth_user_id IS NOT NULL;
-- ============================================================
