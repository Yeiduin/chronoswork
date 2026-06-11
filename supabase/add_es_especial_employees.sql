-- ============================================================
-- ChronosWork — Migración: columna es_especial en employees
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- Marca si el empleado tiene salario personalizado (independiente del área)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS es_especial BOOLEAN DEFAULT false;
