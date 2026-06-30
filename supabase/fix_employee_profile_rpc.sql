-- ============================================================
-- ChronosWork — Fix RPC get_my_employee_profile
-- Mejoras:
--   1. Rango de turnos ampliado a 1 año (6 meses atrás + 6 adelante)
--   2. Incluye campo descansos explícitamente en la selección
--   3. Agrega resumen_semana_actual al JSON de respuesta
--   4. Mantiene compatibilidad total con el frontend existente
-- Ejecutar en: Supabase SQL Editor
-- Idempotente: CREATE OR REPLACE
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_employee_profile()
RETURNS JSONB AS $$
DECLARE
  v_employee_id  UUID;
  v_result       JSONB;
  v_week_start   DATE;
  v_week_end     DATE;
BEGIN
  -- Solo disponible para rol 'empleado'
  IF NOT is_employee_role() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Esta función es exclusiva para colaboradores.';
  END IF;

  SELECT id INTO v_employee_id FROM employees WHERE auth_user_id = auth.uid();

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: No se encontró el perfil del empleado autenticado.';
  END IF;

  -- Semana actual (Lunes a Domingo) en zona Colombia
  v_week_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_week_end   := v_week_start + INTERVAL '6 days';

  SELECT jsonb_build_object(
    -- ── Datos del empleado ─────────────────────────────────────────────────
    'employee', row_to_json(e.*),

    -- ── Todos los turnos del año (6 meses atrás + 6 meses adelante) ────────
    -- Se incluye el campo 'descansos' JSONB explícitamente
    'shifts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',                s.id,
            'employee_id',       s.employee_id,
            'tenant_id',         s.tenant_id,
            'start_time',        s.start_time,
            'end_time',          s.end_time,
            'shift_type',        s.shift_type,
            'periodo',           s.periodo,
            'break_minutes',     COALESCE(s.break_minutes, 0),
            'descansos',         COALESCE(s.descansos, '[]'::jsonb),
            'recargo_porcentaje',COALESCE(s.recargo_porcentaje, 0),
            'created_at',        s.created_at
          )
          ORDER BY s.start_time ASC
        ),
        '[]'::jsonb
      )
      FROM shifts s
      WHERE s.employee_id = v_employee_id
        AND s.start_time >= (NOW() AT TIME ZONE 'America/Bogota' - INTERVAL '6 months')
        AND s.start_time <= (NOW() AT TIME ZONE 'America/Bogota' + INTERVAL '6 months')
    ),

    -- ── Novedades (todas) ──────────────────────────────────────────────────
    'absences', (
      SELECT COALESCE(
        jsonb_agg(row_to_json(a.*) ORDER BY a.fecha_inicio DESC),
        '[]'::jsonb
      )
      FROM absences a
      WHERE a.employee_id = v_employee_id
    ),

    -- ── Resumen semana actual ──────────────────────────────────────────────
    'resumen_semana_actual', (
      SELECT jsonb_build_object(
        'semana_inicio',    v_week_start,
        'semana_fin',       v_week_end,
        'total_turnos',     COUNT(s.id),
        'total_horas_brutas',
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
          ), 0),
        'total_horas_netas',
          COALESCE(SUM(
            GREATEST(0,
              EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
              - COALESCE(s.break_minutes, 0) / 60.0
            )
          ), 0)
      )
      FROM shifts s
      WHERE s.employee_id = v_employee_id
        AND (s.start_time AT TIME ZONE 'America/Bogota')::DATE BETWEEN v_week_start AND v_week_end
    ),

    -- ── Resumen mes actual ─────────────────────────────────────────────────
    'resumen_mes', (
      SELECT jsonb_build_object(
        'total_turnos',      COUNT(s.id),
        'total_horas_brutas',
          COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0),
        'total_horas_netas',
          COALESCE(SUM(
            GREATEST(0,
              EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
              - COALESCE(s.break_minutes, 0) / 60.0
            )
          ), 0)
      )
      FROM shifts s
      WHERE s.employee_id = v_employee_id
        AND TO_CHAR(s.start_time AT TIME ZONE 'America/Bogota', 'YYYY-MM')
            = TO_CHAR(NOW() AT TIME ZONE 'America/Bogota', 'YYYY-MM')
    ),

    -- ── Resumen mes siguiente ──────────────────────────────────────────────
    'resumen_mes_siguiente', (
      SELECT jsonb_build_object(
        'total_turnos',      COUNT(s.id),
        'total_horas_brutas',
          COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0),
        'total_horas_netas',
          COALESCE(SUM(
            GREATEST(0,
              EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
              - COALESCE(s.break_minutes, 0) / 60.0
            )
          ), 0)
      )
      FROM shifts s
      WHERE s.employee_id = v_employee_id
        AND TO_CHAR(s.start_time AT TIME ZONE 'America/Bogota', 'YYYY-MM')
            = TO_CHAR((NOW() AT TIME ZONE 'America/Bogota' + INTERVAL '1 month'), 'YYYY-MM')
    )
  )
  INTO v_result
  FROM employees e
  WHERE e.id = v_employee_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Verificación ──────────────────────────────────────────────────────────────
-- Para probar (ejecutar como empleado autenticado):
-- SELECT get_my_employee_profile();
-- El resultado debe incluir: employee, shifts (array), absences, 
-- resumen_semana_actual, resumen_mes, resumen_mes_siguiente
