-- ============================================================
-- ChronosWork — Migración 004: Ampliar `employees` con datos laborales CO
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Amplía la tabla employees con todos los campos necesarios para
-- liquidación de nómina y administración de personal colombiano:
-- contrato, ARL, EPS, AFP, cesantías, salarios, datos personales, etc.
-- ============================================================

-- ── 1. Cambiar el CHECK de tipo_contrato para incluir todos los tipos ──────
ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_tipo_contrato_check;

ALTER TABLE employees
  ALTER COLUMN tipo_contrato TYPE VARCHAR(20);

-- Si no existe CHECK, lo creamos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'employees' AND constraint_name = 'employees_tipo_contrato_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_tipo_contrato_check
      CHECK (tipo_contrato IN (
        'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
        'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
      ));
  END IF;
END $$;

-- ── 2. Datos personales adicionales ────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tipo_documento       VARCHAR(5) DEFAULT 'CC'
    CHECK (tipo_documento IN ('CC','CE','TI','PA','RC','PPT','NIT')),
  ADD COLUMN IF NOT EXISTS lugar_expedicion     VARCHAR(80),
  ADD COLUMN IF NOT EXISTS fecha_nacimiento     DATE,
  ADD COLUMN IF NOT EXISTS genero               VARCHAR(20)
    CHECK (genero IN ('M','F','OTRO','PREFIERO_NO_DECIR')),
  ADD COLUMN IF NOT EXISTS estado_civil         VARCHAR(20)
    CHECK (estado_civil IN ('SOLTERO','CASADO','UNION_LIBRE','DIVORCIADO','VIUDO','SEPARADO')),
  ADD COLUMN IF NOT EXISTS direccion            TEXT,
  ADD COLUMN IF NOT EXISTS ciudad               VARCHAR(80),
  ADD COLUMN IF NOT EXISTS departamento         VARCHAR(80),
  ADD COLUMN IF NOT EXISTS telefono_contacto    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email_personal       VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_parentesco VARCHAR(50),
  ADD COLUMN IF NOT EXISTS numero_hijos         INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiene_discapacidad   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS descripcion_discapacidad TEXT;

-- ── 3. Datos contractuales completos ───────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS fecha_ingreso        DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_contrato   DATE,  -- para término fijo/obra
  ADD COLUMN IF NOT EXISTS periodo_prueba_hasta DATE,
  ADD COLUMN IF NOT EXISTS cargo_codigo         VARCHAR(30),  -- p.ej. CIUO-08: "5221"
  ADD COLUMN IF NOT EXISTS nivel_cargo          VARCHAR(30)
    CHECK (nivel_cargo IN ('JUNIOR','SENIOR','COORDINADOR','SUPERVISOR','JEFE','GERENTE','DIRECTOR')),
  ADD COLUMN IF NOT EXISTS reporta_a            UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS es_jefe              BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subordinados_ids     UUID[] DEFAULT '{}';

-- ── 4. Configuración salarial extendida ────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS salario_mensual      DECIMAL(12,2),  -- para SALARIO_FIJO (sueldo pactado)
  ADD COLUMN IF NOT EXISTS valor_hora           DECIMAL(12,2),  -- para POR_HORAS (ya existe como valor_hora, redundante OK)
  ADD COLUMN IF NOT EXISTS auxiliar_areas_ids   UUID[] DEFAULT '{}',  -- áreas secundarias
  ADD COLUMN IF NOT EXISTS bono_rodamiento      DECIMAL(12,2) DEFAULT 0,  -- p.ej. minero
  ADD COLUMN IF NOT EXISTS bonificacion_fija    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recibe_auxilio_transporte BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS aplica_pago_dominical       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS aplica_horas_extras         BOOLEAN DEFAULT true;

-- ── 5. Seguridad social (Aportes a salud, pensión, ARL) ───────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS eps_nombre           VARCHAR(100),  -- Nueva EPS, Sanitas, Sura, etc.
  ADD COLUMN IF NOT EXISTS eps_codigo           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS afp_nombre           VARCHAR(100),  -- Porvenir, Protección, Colfondos, Skandia
  ADD COLUMN IF NOT EXISTS afp_codigo           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS afp_tipo             VARCHAR(20) DEFAULT 'RAZON'
    CHECK (afp_tipo IN ('RAZON','PRIMAPROMEDIO')),  -- medio de cálculo pensión
  ADD COLUMN IF NOT EXISTS arl_nombre           VARCHAR(100),  -- Sura, Positiva, Bolívar, Colmena
  ADD COLUMN IF NOT EXISTS arl_codigo           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nivel_riesgo_arl     INT DEFAULT 1
    CHECK (nivel_riesgo_arl IN (1,2,3,4,5)),
  ADD COLUMN IF NOT EXISTS caja_compensacion    VARCHAR(100),  -- Compensar, Comfama, Comfenalco
  ADD COLUMN IF NOT EXISTS caja_codigo          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fondo_cesantias      VARCHAR(100),  -- Protección, Porvenir, BBVA, etc.
  ADD COLUMN IF NOT EXISTS cesantias_afc        BOOLEAN DEFAULT false;  -- cuentas AFC

-- ── 6. Datos bancarios ─────────────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS banco_nombre         VARCHAR(80),
  ADD COLUMN IF NOT EXISTS tipo_cuenta          VARCHAR(20)
    CHECK (tipo_cuenta IN ('AHORROS','CORRIENTE')),
  ADD COLUMN IF NOT EXISTS numero_cuenta        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS titular_cuenta       VARCHAR(200);

-- ── 7. Datos académicos / formativos ──────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS nivel_educacion      VARCHAR(30)
    CHECK (nivel_educacion IN (
      'PRIMARIA','BACHILLERATO','TECNICO','TECNOLOGO','PREGRADO',
      'ESPECIALIZACION','MAESTRIA','DOCTORADO','NINGUNO'
    )),
  ADD COLUMN IF NOT EXISTS titulo_obtenido      VARCHAR(150),
  ADD COLUMN IF NOT EXISTS sena_aprendiz        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS etapa_productiva     BOOLEAN DEFAULT false,  -- solo para aprendices
  ADD COLUMN IF NOT EXISTS fecha_etapa_lectiva_inicio DATE,
  ADD COLUMN IF NOT EXISTS fecha_etapa_lectiva_fin    DATE;

-- ── 8. Datos tributarios ───────────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS responsable_iva      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS declarante_renta     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS aplica_retencion_fuente BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS numero_dependientes  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS persona_mayor_dependiente BOOLEAN DEFAULT false;

-- ── 9. Permisos y certificaciones ──────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tiene_licencia_conduccion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS categoria_licencia        VARCHAR(5),  -- A1, B1, C1, etc.
  ADD COLUMN IF NOT EXISTS vencimiento_licencia      DATE,
  ADD COLUMN IF NOT EXISTS tiene_certificaciones     TEXT;  -- libre

-- ── 10. Configuración de jornada y descanso ────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS horas_semanales_contrato   INT DEFAULT 48,  -- antes de Ley 2101 era 48, ahora 42
  ADD COLUMN IF NOT EXISTS horas_mensuales_contrato   INT,
  ADD COLUMN IF NOT EXISTS jornada_partida            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS turno_fijo                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS turno_predeterminado_id    UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dias_descanso_fijos        INT[] DEFAULT '{}',  -- p.ej. {6,7} = descansa S-D
  ADD COLUMN IF NOT EXISTS duracion_jornada_horas     DECIMAL(4,1) DEFAULT 8;

-- ── 11. Auditoría ──────────────────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── 12. Índices ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_eps    ON employees(tenant_id, eps_codigo);
CREATE INDEX IF NOT EXISTS idx_employees_afp    ON employees(tenant_id, afp_codigo);
CREATE INDEX IF NOT EXISTS idx_employees_ingreso ON employees(tenant_id, fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_employees_contrato ON employees(tenant_id, tipo_contrato);
CREATE INDEX IF NOT EXISTS idx_employees_jefe   ON employees(reporta_a);

-- ── 13. Comentarios ────────────────────────────────────────────────────────
COMMENT ON COLUMN employees.tipo_contrato IS
  'INDEFINIDO: contrato a término indefinido (CST art. 47).
   TERMINO_FIJO: plazo definido (no puede fraccionarse en < 1 año desde Ley 2466/2025).
   OBRA_LABOR: hasta terminar la obra (CST art. 45).
   POR_HORAS: hasta 30h/sem, min 4h consecutivas (CST art. 47, Ley 2101/21).
   SALARIO_FIJO: mensual con turno predeterminado.
   PRESTACION_SERVICIOS: autónomo, sin prestaciones (CÓDIGO CIVIL + C-201/24).
   APRENDIZAJE: SENA. Etapa lectiva: 4h teóricas pagas. Productiva: 50% SMLV (Ley 1882/18).
   OCASIONAL: hasta 30 días, sin prestaciones (CST art. 6°).
   TEMPORAL: a través de EST, máximo 1 año (Ley 50/90 art. 71).';
COMMENT ON COLUMN employees.afp_tipo IS
  'RAZON: salario del último mes (más común).
   PRIMAPROMEDIO: promedio de los últimos 10 años (si ha cotizado <10, usa el promedio de los cotizados).';
COMMENT ON COLUMN employees.recibe_auxilio_transporte IS
  'Aplica para empleados con sueldo ≤ 2 SMLV (Ley 2155/21). Monto 2025: $200.000.';
COMMENT ON COLUMN employees.horas_semanales_contrato IS
  'Horas semanales contratadas. A partir de Ley 2101/2021, la jornada ordinaria es 42h/sem.';
