-- Script para actualizar la base de datos: Añadir break_minutes
-- Este archivo debe ejecutarse manualmente en el SQL Editor de Supabase.

-- 1. Añadir la columna break_minutes a la tabla shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_minutes INT DEFAULT 0;

-- 2. Actualizar la función del trigger para que descuente los minutos de descanso
CREATE OR REPLACE FUNCTION validate_shift_extras()
RETURNS TRIGGER AS $$
DECLARE
  v_dia_horas DECIMAL;
  v_semana_horas DECIMAL;
  v_horas_turno DECIMAL;
  v_fecha DATE;
  v_semana_inicio DATE;
  v_semana_fin DATE;
BEGIN
  -- Calcular horas del turno descontando los minutos de descanso
  v_horas_turno := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600) - (COALESCE(NEW.break_minutes, 0) / 60.0);
  
  -- Asegurar que las horas del turno no sean negativas por un error en break_minutes
  IF v_horas_turno < 0 THEN
    v_horas_turno := 0;
  END IF;

  v_fecha := DATE(NEW.start_time AT TIME ZONE 'America/Bogota');
  v_semana_inicio := DATE_TRUNC('week', v_fecha)::DATE;
  v_semana_fin := v_semana_inicio + INTERVAL '6 days';

  -- Sumar horas previas del mismo día
  SELECT COALESCE(SUM((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) - (COALESCE(break_minutes, 0) / 60.0)), 0)
  INTO v_dia_horas
  FROM shifts
  WHERE employee_id = NEW.employee_id
    AND DATE(start_time AT TIME ZONE 'America/Bogota') = v_fecha
    AND id != COALESCE(NEW.id, uuid_generate_v4());

  -- Sumar horas previas de la misma semana
  SELECT COALESCE(SUM((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) - (COALESCE(break_minutes, 0) / 60.0)), 0)
  INTO v_semana_horas
  FROM shifts
  WHERE employee_id = NEW.employee_id
    AND DATE(start_time AT TIME ZONE 'America/Bogota') BETWEEN v_semana_inicio AND v_semana_fin
    AND id != COALESCE(NEW.id, uuid_generate_v4());

  -- Límite Diario: 14 horas
  IF (v_dia_horas + v_horas_turno) > 14 THEN
    RAISE EXCEPTION 'LÍMITE_EXCEDIDO: El turno supera el máximo diario permitido de horas para el empleado.';
  END IF;

  -- Límite Semanal: 42 horas (Ley 2101/2021 — jornada máxima legal en Colombia)
  IF (v_semana_horas + v_horas_turno) > 42 THEN
    RAISE EXCEPTION 'LÍMITE_SEMANAL_EXCEDIDO: El turno supera el límite semanal de 42 horas (Ley 2101/2021).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
