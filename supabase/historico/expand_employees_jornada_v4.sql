-- ============================================================
-- ChronosWork — Migración 005: Configuración de jornada por empleado
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Permite que el algoritmo de auto-asignación distinga entre
-- empleados que SOLO quieren turno de día, SOLO nocturno, o mixto.
-- Caso de uso: call center 24/7 donde la empresa escoge 2-3
-- empleados específicos para cubrir la noche (22:00-06:00) y al
-- resto los programa únicamente entre 04:00 y 22:00.
-- ============================================================

-- ── 1. Jornada preferida del empleado ──────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS jornada_preferida VARCHAR(20) DEFAULT 'CUALQUIERA'
    CHECK (jornada_preferida IN ('DIURNA','NOCTURNA','MIXTA','CUALQUIERA')),
  ADD COLUMN IF NOT EXISTS solo_diurno        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solo_nocturno      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_partido    BOOLEAN DEFAULT false;

COMMENT ON COLUMN employees.jornada_preferida IS
  'Preferencia del empleado. DIURNA: solo turnos entre 04:00 y 22:00.
   NOCTURNA: solo turnos que toquen horario nocturno (>=19:00 o <06:00).
   MIXTA: puede cubrir ambos según necesidad.
   CUALQUIERA: el sistema decide según déficit. Default del mercado CO.';

COMMENT ON COLUMN employees.solo_diurno IS
  'Atajo para jornada_preferida=DIURNA. Si true, el algoritmo NUNCA le asigna noche.';

COMMENT ON COLUMN employees.solo_nocturno IS
  'Atajo para jornada_preferida=NOCTURNA. Útil para empleados designados
   por la empresa a cubrir la franja 22:00-06:00 en operación 24/7.';

COMMENT ON COLUMN employees.permite_partido IS
  'Si true, se le puede asignar turnos partidos (mañana + tarde con break largo).';

-- ── 2. Límites individuales adicionales ────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS horas_max_diarias          DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS horas_nocturnas_max_semana INT,
  ADD COLUMN IF NOT EXISTS horas_max_semana           INT,
  ADD COLUMN IF NOT EXISTS duracion_jornada_horas     DECIMAL(4,1) DEFAULT 8;

-- duracion_jornada_horas ya existe en expand_employees_laboral.sql, redundancia OK
COMMENT ON COLUMN employees.horas_max_diarias IS
  'Override del máximo diario. NULL = usar el del área (default 10h).';

COMMENT ON COLUMN employees.horas_nocturnas_max_semana IS
  'Tope individual de horas nocturnas semanales. NULL = sin tope (el legal).';

-- ── 3. Backfill defensivo para empleados existentes ────────────────────────
-- Si tienen turno_predeterminado_id y es NOCTURNO, marcarlos solo_nocturno
UPDATE employees
SET jornada_preferida = 'CUALQUIERA'
WHERE jornada_preferida IS NULL;

-- ── 4. Helper view: clasificación efectiva del empleado ────────────────────
CREATE OR REPLACE VIEW v_employee_jornada AS
SELECT
  e.id,
  e.tenant_id,
  e.nombre,
  e.tipo_contrato,
  e.turno_predeterminado_id,
  e.horas_semanales_contrato,
  e.dias_descanso_fijos,
  e.solo_diurno,
  e.solo_nocturno,
  e.jornada_preferida,
  e.permite_partido,
  -- Clasificación efectiva
  CASE
    WHEN e.solo_nocturno THEN 'NIGHT_ONLY'
    WHEN e.solo_diurno   THEN 'DAY_ONLY'
    WHEN e.jornada_preferida = 'NOCTURNA' THEN 'NIGHT_ONLY'
    WHEN e.jornada_preferida = 'DIURNA'   THEN 'DAY_ONLY'
    WHEN e.jornada_preferida = 'MIXTA'    THEN 'MIXED'
    ELSE 'ANY'
  END AS jornada_efectiva
FROM employees e
WHERE e.activo = true;

COMMENT ON VIEW v_employee_jornada IS
  'Vista que consolida la jornada efectiva de cada empleado para el algoritmo.
   NIGHT_ONLY: solo se le asignan turnos nocturnos.
   DAY_ONLY: nunca se le asigna un turno que toque horario nocturno.
   MIXED: puede cubrir ambos según déficit.
   ANY: el sistema decide (jornada_preferida=CUALQUIERA).';

-- ── 5. Índice para acelerar filtros del algoritmo ────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_jornada_efectiva
  ON employees(tenant_id, activo)
  WHERE activo = true;
