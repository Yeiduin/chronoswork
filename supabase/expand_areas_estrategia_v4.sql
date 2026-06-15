-- ============================================================
-- ChronosWork — Migración 006: Estrategia de asignación por área
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Añade parámetros al área que controlan cómo el algoritmo
-- prioriza: cobertura vs balanceo, granularidad de slots,
-- mínimos nocturnos, etc. Pensado para call centers 24/7
-- pero aplica a cualquier operación con demanda variable.
-- ============================================================

-- ── 1. Modo de operación extendido ─────────────────────────────────────────
-- OFICINA: lunes a viernes jornada diurna (8h).
-- 24_7: cobertura continua, todos los días, todas las horas.
-- 24_7_NIGHT_SPLIT: 24/7 con jornada nocturna dedicada (CASO CALL CENTER).
ALTER TABLE areas
  DROP CONSTRAINT IF EXISTS areas_modo_operacion_check;
ALTER TABLE areas
  ALTER COLUMN modo_operacion TYPE VARCHAR(30);
ALTER TABLE areas
  ADD CONSTRAINT areas_modo_operacion_check
  CHECK (modo_operacion IN ('OFICINA','24_7','24_7_NIGHT_SPLIT'));

-- ── 2. Estrategia de asignación ────────────────────────────────────────────
-- COVERAGE_FIRST: el algoritmo prioriza llenar la demanda configurada.
--                 Recomendado para call center, salud, seguridad, 24/7.
-- BALANCED: el algoritmo prioriza balancear horas entre empleados.
--           Recomendado para oficinas, administrativos.
-- EMPLOYEE_PREF: el algoritmo prioriza respetar la jornada_preferida
--                del empleado, incluso a costa de déficit de cobertura.
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS estrategia_asignacion VARCHAR(20) DEFAULT 'COVERAGE_FIRST'
    CHECK (estrategia_asignacion IN ('COVERAGE_FIRST','BALANCED','EMPLOYEE_PREF'));

-- ── 3. Config nocturna detallada (extiende lo que ya hay) ──────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS min_empleados_noche              INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS permite_dia_cubrir_noche         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS noche_solo_empleados_dedicados   BOOLEAN DEFAULT true;

COMMENT ON COLUMN areas.min_empleados_noche IS
  'Mínimo de empleados simultáneos durante la franja nocturna (22:00-06:00).
   Por defecto 1. En call center con bajo volumen nocturno puede ser 1.';

COMMENT ON COLUMN areas.permite_dia_cubrir_noche IS
  'Si true, empleados con jornada_preferida=DIURNA pueden cubrir
  偶尔 un turno nocturno cuando no haya nadie disponible.';

COMMENT ON COLUMN areas.noche_solo_empleados_dedicados IS
  'Si true, SOLO empleados con solo_nocturno=true o jornada_preferida
   en {NOCTURNA, MIXTA} pueden ser asignados a la franja nocturna.
   Default true (recomendado para proteger al personal diurno).';

-- ── 4. Granularidad temporal del algoritmo ─────────────────────────────────
-- El algoritmo divide el día en slots. Por defecto 4 slots/hora (15 min)
-- que es lo que usa para evaluar la demanda continua.
-- Para áreas más simples, se puede bajar a 1 slot/hora (60 min) y
-- acelerar el cálculo 4x.
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS slots_por_hora INT DEFAULT 4
    CHECK (slots_por_hora IN (1,2,4));

-- ── 5. Configuración de duración mínima/máxima del turno ──────────────────
-- (extiende lo que ya está en la tabla, pero ahora es por área
--  y se puede dejar NULL para que el sistema use defaults legales)
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS min_horas_turno_override  DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS max_horas_turno_override  DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS permitir_horas_extras     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_turno_partido    BOOLEAN DEFAULT false;

-- ── 6. Política de balanceo semanal ────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS balancear_carga            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rotar_slots_entre_asesores BOOLEAN DEFAULT false;

COMMENT ON COLUMN areas.balancear_carga IS
  'Si true, al final de la generación el algoritmo intenta mover turnos
   para que la diferencia entre el empleado con más horas y el de menos
   no supere MAX_DIFERENCIA_HORAS. Default true (mercado CO).';

COMMENT ON COLUMN areas.rotar_slots_entre_asesores IS
  'Si true, dentro de un mismo día, distintos empleados cubren slots
   adyacentes. Útil cuando quieres que varios asesores compartan la
   misma franja (ej: 2 personas en 14:00-18:00).';

-- ── 7. Tolerancia de inicio de turno (snap a grid) ────────────────────────
-- Define cada cuántos minutos los turnos se "ajustan" a la grilla.
-- 15 = cada 15 min (4 slots/h), 30 = cada 30 min (2 slots/h), 60 = cada hora.
-- Por defecto 15, alineado con la grilla del algoritmo.
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS snap_turnos_minutos INT DEFAULT 15
    CHECK (snap_turnos_minutos IN (5,10,15,30,60));

-- ── 8. Helper view: resumen de config del área ────────────────────────────
CREATE OR REPLACE VIEW v_area_strategy AS
SELECT
  a.id,
  a.tenant_id,
  a.nombre,
  a.modo_operacion,
  a.estrategia_asignacion,
  a.jornada_tipo,
  a.patron_rotativo,
  a.night_shift_enabled,
  a.night_shift_start,
  a.night_shift_end,
  a.min_empleados_noche,
  a.noche_solo_empleados_dedicados,
  a.permite_dia_cubrir_noche,
  a.slots_por_hora,
  a.snap_turnos_minutos,
  a.balancear_carga,
  a.rotar_slots_entre_asesores,
  a.permitir_horas_extras,
  a.permitir_turno_partido,
  a.min_horas_turno_override,
  a.max_horas_turno_override
FROM areas a;

COMMENT ON VIEW v_area_strategy IS
  'Vista consolidada con la estrategia completa del área para el algoritmo v4.0.';

-- ── 9. Backfill: si la operación es 24/7 y el área no tiene min_noche, set 1
UPDATE areas
SET min_empleados_noche = COALESCE(min_empleados_noche, 1)
WHERE modo_operacion IN ('24_7','24_7_NIGHT_SPLIT');

UPDATE areas
SET estrategia_asignacion = COALESCE(estrategia_asignacion, 'COVERAGE_FIRST')
WHERE modo_operacion = '24_7' OR modo_operacion = '24_7_NIGHT_SPLIT';

UPDATE areas
SET estrategia_asignacion = COALESCE(estrategia_asignacion, 'BALANCED')
WHERE modo_operacion = 'OFICINA';
