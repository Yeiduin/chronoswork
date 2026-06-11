-- ============================================================
-- ChronosWork — Migración: modo_operacion en areas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Agrega el tipo de operación al área
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS modo_operacion VARCHAR(10) DEFAULT 'OFICINA'
  CHECK (modo_operacion IN ('OFICINA', '24_7'));

-- Comentario explicativo
COMMENT ON COLUMN areas.modo_operacion IS
  'OFICINA = jornada normal semana laboral (8-6, 6-2, 2-10 etc), 42h/sem.
   24_7   = operación continua 7x24, turnos rotativos, todos los días incluyendo domingos y festivos.';
