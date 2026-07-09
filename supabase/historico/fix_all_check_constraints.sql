-- ============================================================
-- ChronosWork — Migración correctiva: TODOS los CHECK constraints
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Este script:
-- 1) Elimina y recrea TODOS los CHECK constraints con valores actualizados
-- 2) Normaliza datos existentes que puedan tener valores viejos
-- 3) Valida que las modificaciones funcionen
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 🛠️ HELPER: función para recrear CHECK de forma segura
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION recreate_check_constraint(
  p_table TEXT,
  p_constraint_name TEXT,
  p_check_sql TEXT
) RETURNS TEXT AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar si existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = p_table
      AND constraint_name = p_constraint_name
      AND constraint_type = 'CHECK'
  ) INTO v_exists;

  IF v_exists THEN
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, p_constraint_name);
  END IF;

  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', p_table, p_constraint_name, p_check_sql);

  RETURN format('✅ %I.%I recreado: %s', p_table, p_constraint_name, p_check_sql);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 🔧 1. AREAS: tipo_contrato_default (tenía solo 2 valores)
-- ─────────────────────────────────────────────────────────────
-- Primero normalizar datos existentes
UPDATE areas SET tipo_contrato_default = 'INDEFINIDO'
  WHERE tipo_contrato_default IS NOT NULL
    AND tipo_contrato_default NOT IN (
      'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
      'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
    );

-- Eliminar todos los CHECK constraints que pueda tener
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'areas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_contrato_default%'
  ) LOOP
    EXECUTE format('ALTER TABLE areas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE areas
  ADD CONSTRAINT areas_tipo_contrato_default_check
  CHECK (tipo_contrato_default IS NULL OR tipo_contrato_default IN (
    'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
    'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
  ));

-- ─────────────────────────────────────────────────────────────
-- 🔧 2. AREAS: tipo_contrato_predominante
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'areas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_contrato_predominante%'
  ) LOOP
    EXECUTE format('ALTER TABLE areas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE areas SET tipo_contrato_predominante = 'INDEFINIDO'
  WHERE tipo_contrato_predominante IS NOT NULL
    AND tipo_contrato_predominante NOT IN (
      'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
      'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
    );

ALTER TABLE areas
  ADD CONSTRAINT areas_tipo_contrato_predominante_check
  CHECK (tipo_contrato_predominante IS NULL OR tipo_contrato_predominante IN (
    'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
    'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
  ));

-- ─────────────────────────────────────────────────────────────
-- 🔧 3. AREAS: modo_operacion (incluye 24_7_NIGHT_SPLIT)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'areas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%modo_operacion%'
  ) LOOP
    EXECUTE format('ALTER TABLE areas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE areas
  ADD CONSTRAINT areas_modo_operacion_check
  CHECK (modo_operacion IS NULL OR modo_operacion IN ('OFICINA', '24_7', '24_7_NIGHT_SPLIT'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 4. AREAS: jornada_tipo
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'areas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%jornada_tipo%'
  ) LOOP
    EXECUTE format('ALTER TABLE areas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE areas SET jornada_tipo = 'DIURNA'
  WHERE jornada_tipo IS NOT NULL
    AND jornada_tipo NOT IN ('DIURNA','NOCTURNA','MIXTA','POR_TURNOS');

ALTER TABLE areas
  ADD CONSTRAINT areas_jornada_tipo_check
  CHECK (jornada_tipo IS NULL OR jornada_tipo IN ('DIURNA','NOCTURNA','MIXTA','POR_TURNOS'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 5. AREAS: nivel_riesgo_arl
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'areas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%nivel_riesgo_arl%'
  ) LOOP
    EXECUTE format('ALTER TABLE areas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE areas SET nivel_riesgo_arl = 1
  WHERE nivel_riesgo_arl IS NOT NULL
    AND (nivel_riesgo_arl < 1 OR nivel_riesgo_arl > 5);

ALTER TABLE areas
  ADD CONSTRAINT areas_nivel_riesgo_arl_check
  CHECK (nivel_riesgo_arl IS NULL OR (nivel_riesgo_arl BETWEEN 1 AND 5));

-- ─────────────────────────────────────────────────────────────
-- 🔧 6. EMPLOYEES: tipo_contrato
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_contrato%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET tipo_contrato = 'INDEFINIDO'
  WHERE tipo_contrato IS NOT NULL
    AND tipo_contrato NOT IN (
      'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
      'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
    );

ALTER TABLE employees
  ADD CONSTRAINT employees_tipo_contrato_check
  CHECK (tipo_contrato IS NULL OR tipo_contrato IN (
    'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
    'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
  ));

-- ─────────────────────────────────────────────────────────────
-- 🔧 7. EMPLOYEES: tipo_documento
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_documento%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET tipo_documento = 'CC'
  WHERE tipo_documento IS NOT NULL
    AND tipo_documento NOT IN ('CC','CE','TI','PA','RC','PPT','NIT');

ALTER TABLE employees
  ADD CONSTRAINT employees_tipo_documento_check
  CHECK (tipo_documento IS NULL OR tipo_documento IN ('CC','CE','TI','PA','RC','PPT','NIT'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 8. EMPLOYEES: genero
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%genero%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET genero = NULL
  WHERE genero IS NOT NULL
    AND genero NOT IN ('M','F','OTRO','PREFIERO_NO_DECIR');

ALTER TABLE employees
  ADD CONSTRAINT employees_genero_check
  CHECK (genero IS NULL OR genero IN ('M','F','OTRO','PREFIERO_NO_DECIR'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 9. EMPLOYEES: estado_civil
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%estado_civil%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET estado_civil = NULL
  WHERE estado_civil IS NOT NULL
    AND estado_civil NOT IN ('SOLTERO','CASADO','UNION_LIBRE','DIVORCIADO','VIUDO','SEPARADO');

ALTER TABLE employees
  ADD CONSTRAINT employees_estado_civil_check
  CHECK (estado_civil IS NULL OR estado_civil IN ('SOLTERO','CASADO','UNION_LIBRE','DIVORCIADO','VIUDO','SEPARADO'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 10. EMPLOYEES: nivel_cargo
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%nivel_cargo%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET nivel_cargo = 'JUNIOR'
  WHERE nivel_cargo IS NOT NULL
    AND nivel_cargo NOT IN ('JUNIOR','SENIOR','COORDINADOR','SUPERVISOR','JEFE','GERENTE','DIRECTOR');

ALTER TABLE employees
  ADD CONSTRAINT employees_nivel_cargo_check
  CHECK (nivel_cargo IS NULL OR nivel_cargo IN ('JUNIOR','SENIOR','COORDINADOR','SUPERVISOR','JEFE','GERENTE','DIRECTOR'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 11. EMPLOYEES: afp_tipo
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%afp_tipo%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET afp_tipo = 'RAZON'
  WHERE afp_tipo IS NOT NULL
    AND afp_tipo NOT IN ('RAZON','PRIMAPROMEDIO');

ALTER TABLE employees
  ADD CONSTRAINT employees_afp_tipo_check
  CHECK (afp_tipo IS NULL OR afp_tipo IN ('RAZON','PRIMAPROMEDIO'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 12. EMPLOYEES: jornada_tipo
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%jornada_tipo%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS jornada_tipo VARCHAR(20) DEFAULT 'DIURNA';

UPDATE employees SET jornada_tipo = 'DIURNA'
  WHERE jornada_tipo IS NOT NULL
    AND jornada_tipo NOT IN ('DIURNA','NOCTURNA','MIXTA','POR_TURNOS');

ALTER TABLE employees
  ADD CONSTRAINT employees_jornada_tipo_check
  CHECK (jornada_tipo IS NULL OR jornada_tipo IN ('DIURNA','NOCTURNA','MIXTA','POR_TURNOS'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 13. EMPLOYEES: nivel_riesgo_arl
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%nivel_riesgo_arl%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET nivel_riesgo_arl = 1
  WHERE nivel_riesgo_arl IS NOT NULL
    AND (nivel_riesgo_arl < 1 OR nivel_riesgo_arl > 5);

ALTER TABLE employees
  ADD CONSTRAINT employees_nivel_riesgo_arl_check
  CHECK (nivel_riesgo_arl IS NULL OR (nivel_riesgo_arl BETWEEN 1 AND 5));

-- ─────────────────────────────────────────────────────────────
-- 🔧 14. EMPLOYEES: nivel_educacion
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'employees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%nivel_educacion%'
  ) LOOP
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE employees SET nivel_educacion = NULL
  WHERE nivel_educacion IS NOT NULL
    AND nivel_educacion NOT IN ('PRIMARIA','BACHILLERATO','TECNICO','TECNOLOGO','PREGRADO','ESPECIALIZACION','MAESTRIA','DOCTORADO','NINGUNO');

ALTER TABLE employees
  ADD CONSTRAINT employees_nivel_educacion_check
  CHECK (nivel_educacion IS NULL OR nivel_educacion IN ('PRIMARIA','BACHILLERATO','TECNICO','TECNOLOGO','PREGRADO','ESPECIALIZACION','MAESTRIA','DOCTORADO','NINGUNO'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 15. SHIFT_TEMPLATES: shift_kind
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'shift_templates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%shift_kind%'
  ) LOOP
    EXECUTE format('ALTER TABLE shift_templates DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE shift_templates SET shift_kind = 'STANDARD'
  WHERE shift_kind IS NOT NULL
    AND shift_kind NOT IN ('STANDARD','PARTIDO','ROTATIVO','NOCTURNO','DISPONIBILIDAD','CUSTOM');

ALTER TABLE shift_templates
  ADD CONSTRAINT shift_templates_shift_kind_check
  CHECK (shift_kind IS NULL OR shift_kind IN ('STANDARD','PARTIDO','ROTATIVO','NOCTURNO','DISPONIBILIDAD','CUSTOM'));

-- ─────────────────────────────────────────────────────────────
-- 🔧 16. ABSENCES: tipo
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'absences'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  ) LOOP
    EXECUTE format('ALTER TABLE absences DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE absences
  ADD CONSTRAINT absences_tipo_check
  CHECK (tipo IN (
    'vacaciones','incapacidad','licencia','suspension',
    'licencia_luto','licencia_paternidad','licencia_menstrual',
    'dia_familia','permiso_sindical','calamidad'
  ));

-- ─────────────────────────────────────────────────────────────
-- 🧪 17. TESTS AUTOMÁTICOS: simular inserciones
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tenant_id UUID;
  v_test_areas INT := 0;
  v_test_pass INT := 0;
  v_test_fail INT := 0;
  v_contrato TEXT;
  v_modo TEXT;
  v_jornada TEXT;
  v_nivel INT;
BEGIN
  -- Buscar un tenant existente para los tests
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '⚠️  No hay tenants creados. Los tests de inserción se saltarán. Crea al menos un tenant para validar.';
    RETURN;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🧪 TESTS DE INSERCIÓN — usando tenant: %', v_tenant_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Test los 9 tipos de contrato × modos de operación × jornadas
  FOREACH v_contrato IN ARRAY ARRAY[
    'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
    'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
  ] LOOP
    FOREACH v_modo IN ARRAY ARRAY['OFICINA', '24_7'] LOOP
      FOREACH v_jornada IN ARRAY ARRAY['DIURNA','NOCTURNA','MIXTA','POR_TURNOS'] LOOP
        FOREACH v_nivel IN ARRAY ARRAY[1, 2, 3, 4, 5] LOOP
          v_test_areas := v_test_areas + 1;
          BEGIN
            INSERT INTO areas (
              tenant_id, nombre, valor_hora_default,
              tipo_contrato_default, tipo_contrato_predominante,
              modo_operacion, jornada_tipo, nivel_riesgo_arl,
              dias_trabajo, dias_descanso_default, dias_descanso,
              horas_extras_max_dia, horas_extras_max_semana,
              descanso_min_entre_jornadas, duracion_jornada_horas,
              color, paga_auxilio_transporte, break_minutos
            ) VALUES (
              v_tenant_id,
              'TEST_AREA_' || v_contrato || '_' || v_modo || '_' || v_jornada || '_ARL' || v_nivel,
              12500.00,
              v_contrato, v_contrato,
              v_modo, v_jornada, v_nivel,
              CASE WHEN v_modo = '24_7' THEN ARRAY[1,2,3,4,5,6,7] ELSE ARRAY[1,2,3,4,5] END,
              1, 1, 2, 12, 9, 8,
              '#6366f1', true, 0
            );
            v_test_pass := v_test_pass + 1;
            -- Limpiar inmediatamente
            DELETE FROM areas WHERE nombre LIKE 'TEST_AREA_%';
          EXCEPTION WHEN OTHERS THEN
            v_test_fail := v_test_fail + 1;
            RAISE NOTICE '❌ FAIL: %, modo=%, jornada=%, arl=% → %',
              v_contrato, v_modo, v_jornada, v_nivel, SQLERRM;
          END;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 RESULTADO: % intentos · ✅ % pasaron · ❌ % fallaron',
    v_test_areas, v_test_pass, v_test_fail;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ─────────────────────────────────────────────────────────────
-- 🧪 18. TESTS DE TIPOS DE DOCUMENTO Y GÉNERO
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tenant_id UUID;
  v_emp_id UUID;
  v_pass INT := 0;
  v_fail INT := 0;
  v_total INT := 0;
  v_doc TEXT;
  v_gen TEXT;
  v_est TEXT;
  v_niv TEXT;
  v_tipo TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🧪 TESTS DE EMPLEADOS — combinaciones de catálogos';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  FOREACH v_doc IN ARRAY ARRAY['CC','CE','TI','PA','PPT','NIT'] LOOP
    FOREACH v_gen IN ARRAY ARRAY['M','F','OTRO','PREFIERO_NO_DECIR'] LOOP
      FOREACH v_est IN ARRAY ARRAY['SOLTERO','CASADO','UNION_LIBRE','DIVORCIADO','VIUDO','SEPARADO'] LOOP
        FOREACH v_niv IN ARRAY ARRAY['JUNIOR','SENIOR','COORDINADOR','SUPERVISOR','JEFE','GERENTE','DIRECTOR'] LOOP
          FOREACH v_tipo IN ARRAY ARRAY['INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO','PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'] LOOP
            v_total := v_total + 1;
            BEGIN
              INSERT INTO employees (tenant_id, cedula, nombre, cargo, valor_hora, tipo_contrato, tipo_documento, genero, estado_civil, nivel_cargo, nivel_riesgo_arl)
              VALUES (v_tenant_id, 'TEST' || v_total::TEXT, 'Test ' || v_total::TEXT, 'Cargo Test', 12500, v_tipo, v_doc, v_gen, v_est, v_niv, 1)
              RETURNING id INTO v_emp_id;
              v_pass := v_pass + 1;
              DELETE FROM employees WHERE id = v_emp_id;
            EXCEPTION WHEN OTHERS THEN
              v_fail := v_fail + 1;
              RAISE NOTICE '❌ FAIL: doc=%, gen=%, est=%, niv=%, tipo=% → %',
                v_doc, v_gen, v_est, v_niv, v_tipo, SQLERRM;
            END;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 EMPLEADOS: % intentos · ✅ % pasaron · ❌ % fallaron',
    v_total, v_pass, v_fail;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ─────────────────────────────────────────────────────────────
-- 🧹 LIMPIEZA: borrar función helper temporal
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS recreate_check_constraint(TEXT, TEXT, TEXT);

-- Mensaje final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ MIGRACIÓN COMPLETADA';
  RAISE NOTICE '   Todos los CHECK constraints han sido actualizados.';
  RAISE NOTICE '   Datos huérfanos normalizados.';
  RAISE NOTICE '   Si viste ❌ FAIL arriba, revisa el log para detalles.';
END $$;
