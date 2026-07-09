-- ============================================================
-- ChronosWork — Migración 003: Ampliar `areas` con datos laborales CO
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Añade campos para configurar el área de forma completa
-- desde el día 1, alineado al CST, Ley 2101/2021, Ley 2466/2025.
-- Los campos son nullable o con default para que las áreas
-- existentes no se rompan.
-- ============================================================

-- ── 1. Identidad del área ──────────────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS codigo_area      VARCHAR(20),   -- ej: "CAJ-01"
  ADD COLUMN IF NOT EXISTS sector           VARCHAR(30),   -- RETAIL, SALUD, etc.
  ADD COLUMN IF NOT EXISTS sub_sector       VARCHAR(50),   -- opcional, libre
  ADD COLUMN IF NOT EXISTS centro_costo     VARCHAR(30),   -- p.ej. para reportes contables
  ADD COLUMN IF NOT EXISTS jornada_tipo     VARCHAR(20) DEFAULT 'DIURNA'
    CHECK (jornada_tipo IN ('DIURNA','NOCTURNA','MIXTA','POR_TURNOS'));

-- ── 2. Configuración legal / jornada ───────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS duracion_jornada_horas   DECIMAL(4,1) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS horas_extras_max_dia      INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS horas_extras_max_semana   INT DEFAULT 12,
  ADD COLUMN IF NOT EXISTS descanso_min_entre_jornadas INT DEFAULT 9,  -- horas
  ADD COLUMN IF NOT EXISTS dias_descanso             INT DEFAULT 1,    -- patrón: 1 o 2
  ADD COLUMN IF NOT EXISTS patron_rotativo          VARCHAR(15),      -- 2x1, 3x2, 4x3, 5x2, 6x1, 7x7, 10x5, 14x14, PERSONALIZADO
  ADD COLUMN IF NOT EXISTS jornada_partida          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS jornada_partida_inicio    TIME,             -- ej 07:00
  ADD COLUMN IF NOT EXISTS jornada_partida_fin       TIME,             -- ej 12:00
  ADD COLUMN IF NOT EXISTS jornada_partida_reinicio  TIME,             -- ej 13:00
  ADD COLUMN IF NOT EXISTS jornada_partida_termino   TIME,             -- ej 17:00
  ADD COLUMN IF NOT EXISTS break_minutos             INT DEFAULT 0,    -- almuerzo (ya no se paga, pero se usa para liquidación)
  ADD COLUMN IF NOT EXISTS requiere_marca_asistencia BOOLEAN DEFAULT false; -- kiosko/QR

-- ── 3. Configuración de turno nocturno (24/7) ──────────────────────────────
-- Las columnas ya existen de add_night_shift_config_areas.sql
-- Aquí solo las extendemos si faltan
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS night_shift_paga_hon          BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS night_shift_porcentaje_umbral INT DEFAULT 50;  -- 50% del turno debe ser nocturno

-- ── 4. Configuración salarial y contractual ───────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS tipo_contrato_predominante VARCHAR(20) DEFAULT 'INDEFINIDO'
    CHECK (tipo_contrato_predominante IN (
      'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
      'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'
    )),
  ADD COLUMN IF NOT EXISTS paga_auxilio_transporte     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS nivel_riesgo_arl            INT DEFAULT 1
    CHECK (nivel_riesgo_arl IN (1,2,3,4,5)),  -- I a V, clase de riesgo
  ADD COLUMN IF NOT EXISTS tarifa_arl_por_mil          DECIMAL(8,4) DEFAULT 0.522,  -- % mensual sobre IBC para nivel I
  ADD COLUMN IF NOT EXISTS aplica_pago_dominical       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS horario_especial            BOOLEAN DEFAULT false;  -- Ley 2466/2025

-- ── 5. Dotación y elementos ────────────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS requiere_dotacion             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dotacion_periodicidad_meses   INT DEFAULT 4,  -- 4 meses (Art. 230 CST)
  ADD COLUMN IF NOT EXISTS requiere_epp                 BOOLEAN DEFAULT false,  -- Elementos Protección Personal
  ADD COLUMN IF NOT EXISTS descripcion_epp              TEXT;  -- ej: "Casco, botas punta acero, gafas"

-- ── 6. Centro de trabajo / ubicación ───────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS sede_id          UUID,           -- para multi-sede
  ADD COLUMN IF NOT EXISTS direccion        TEXT,
  ADD COLUMN IF NOT EXISTS ciudad           VARCHAR(80) DEFAULT 'Bogotá',
  ADD COLUMN IF NOT EXISTS departamento     VARCHAR(80) DEFAULT 'Cundinamarca',
  ADD COLUMN IF NOT EXISTS latitud          DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS longitud         DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS radio_geofence_m INT DEFAULT 150;

-- ── 7. Prestaciones y beneficios del área ──────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS incluye_prima_servicios       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS incluye_cesantias             BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS incluye_intereses_cesantias   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS incluye_vacaciones            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS prima_legal_anual             BOOLEAN DEFAULT true,  -- 1 salario / año
  ADD COLUMN IF NOT EXISTS bono_extra_legal              BOOLEAN DEFAULT false, -- p.ej. Rodamiento minera
  ADD COLUMN IF NOT EXISTS bono_monto_fijo_mensual       DECIMAL(12,2);

-- ── 8. Configuración presupuestal ─────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS presupuesto_mensual           DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS alerta_sobrecosto_porcentaje  INT DEFAULT 110;  -- avisa si llega al 110% del presupuesto

-- ── 9. Flags operativos ────────────────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS permite_turno_partido         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS permite_rotacion_interna      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tiene_turno_fijo              BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_operativas              TEXT;

-- ── 10. Auditoría ──────────────────────────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 11. Índices para filtros frecuentes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_areas_sector        ON areas(tenant_id, sector);
CREATE INDEX IF NOT EXISTS idx_areas_patron        ON areas(tenant_id, patron_rotativo);
CREATE INDEX IF NOT EXISTS idx_areas_jornada_tipo  ON areas(tenant_id, jornada_tipo);
CREATE INDEX IF NOT EXISTS idx_areas_sede          ON areas(sede_id);

-- ── 12. Función para autogestionar updated_at ─────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_areas_updated_at ON areas;
CREATE TRIGGER trg_areas_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── 13. Comentarios para documentar el schema ──────────────────────────────
COMMENT ON COLUMN areas.sector IS
  'Sector económico (RETAIL, SALUD, INDUSTRIA, etc.) — se usa para sugerir áreas, franjas y salarios típicos.';
COMMENT ON COLUMN areas.duracion_jornada_horas IS
  'Duración de la jornada ordinaria por turno (ej: 8, 10, 12). No incluye hora de almuerzo.';
COMMENT ON COLUMN areas.patron_rotativo IS
  'Patrón de trabajo/descanso. Ej: 5x2 (L-V), 6x1, 7x7, 14x14. PERSONALIZADO = definido por dias_trabajo.';
COMMENT ON COLUMN areas.jornada_partida IS
  'true si la jornada se interrumpe para almuerzo (no se paga la interrupción, jurisprudencia).';
COMMENT ON COLUMN areas.nivel_riesgo_arl IS
  'Clase de riesgo ARL (Decreto 1295/94). I=0.522%, II=1.044%, III=2.436%, IV=4.350%, V=6.960%.';
COMMENT ON COLUMN areas.horario_especial IS
  'true si el área tiene horario especial bajo Ley 2466/2025 (sectores críticos).';
