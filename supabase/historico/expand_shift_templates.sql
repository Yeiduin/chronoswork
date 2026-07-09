-- ============================================================
-- ChronosWork — Migración 005: Ampliar `shift_templates` con tipos de turno
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- El campo shift_kind define el comportamiento del turno en el
-- algoritmo de auto-asignación. Los valores permitidos son:
--   STANDARD        : turno corrido simple
--   PARTIDO         : con hora de almuerzo (split shift)
--   ROTATIVO        : rotativo entre mañana/tarde/noche
--   NOCTURNO        : predominantemente nocturno (HON automático)
--   DISPONIBILIDAD  : guardia on-call
--   CUSTOM          : definido por el usuario
-- ============================================================

ALTER TABLE shift_templates
  ADD COLUMN IF NOT EXISTS shift_kind          VARCHAR(20) DEFAULT 'STANDARD'
    CHECK (shift_kind IN ('STANDARD','PARTIDO','ROTATIVO','NOCTURNO','DISPONIBILIDAD','CUSTOM')),
  -- Para turnos partidos (dos bloques)
  ADD COLUMN IF NOT EXISTS hora_inicio_2       TIME,
  ADD COLUMN IF NOT EXISTS hora_fin_2          TIME,
  ADD COLUMN IF NOT EXISTS split_break_minutos INT DEFAULT 60,  -- duración del intermedio
  -- Para turnos rotativos
  ADD COLUMN IF NOT EXISTS rotacion_patron     VARCHAR(15),     -- 2x1, 3x2, 4x3, 5x2, 6x1, 7x7, 10x5, 14x14
  ADD COLUMN IF NOT EXISTS rotacion_posicion   INT,             -- 0 = primero en rotar (mañana), 1 = segundo (tarde), etc.
  -- Disponibilidad / on-call
  ADD COLUMN IF NOT EXISTS disponibilidad_recargo_porcentaje DECIMAL(5,2) DEFAULT 0,  -- % extra por estar on-call
  -- Etiquetas / búsqueda
  ADD COLUMN IF NOT EXISTS descripcion         TEXT,
  ADD COLUMN IF NOT EXISTS etiquetas           TEXT[] DEFAULT '{}',  -- p.ej. {'apertura','fin de semana'}
  -- Configuración legal
  ADD COLUMN IF NOT EXISTS paga_recargo_dominical   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS paga_recargo_nocturno    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requiere_descanso_antes  BOOLEAN DEFAULT true,  -- respeta 9h descanso previo
  -- Auditoría
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_shift_templates_updated_at ON shift_templates;
CREATE TRIGGER trg_shift_templates_updated_at
  BEFORE UPDATE ON shift_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── Índices para filtros por tipo de turno ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shift_templates_kind   ON shift_templates(tenant_id, shift_kind);
CREATE INDEX IF NOT EXISTS idx_shift_templates_patron ON shift_templates(tenant_id, rotacion_patron);

-- ── Comentarios ────────────────────────────────────────────────────────────
COMMENT ON COLUMN shift_templates.shift_kind IS
  'STANDARD: turno corrido (ej 6-2, 8-5).
   PARTIDO: con hora de almuerzo (ej 7-12 y 14-18).
   ROTATIVO: el sistema rota el patrón entre varios turnos.
   NOCTURNO: predominantemente nocturno (≥50% del turno entre 19:00-06:00).
   DISPONIBILIDAD: guardia on-call, se paga un recargo por disponibilidad.
   CUSTOM: definido libremente por el usuario.';
COMMENT ON COLUMN shift_templates.rotacion_patron IS
  'Patrón de rotación (2x1, 3x2, 4x3, 5x2, 6x1, 7x7, 10x5, 14x14). Solo aplica a shift_kind=ROTATIVO.';
COMMENT ON COLUMN shift_templates.paga_recargo_nocturno IS
  'true si este turno genera recargo HON (Hora Ordinaria Nocturna) en liquidación.';
