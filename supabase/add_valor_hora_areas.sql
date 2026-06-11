-- ============================================================
-- ChronosWork — Migración: Agregar valor_hora_default a areas
-- Ejecutar en: Supabase SQL Editor
-- https://supabase.com/dashboard/project/nazvmxcbrmqzsfxlowkx/sql/new
-- ============================================================

-- Agregar columna de salario base por área
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS valor_hora_default DECIMAL(12,2) CHECK (valor_hora_default > 0);
