import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import { useAuth } from '../context/AuthContext';
import { generateAutomaticShifts } from '../core/generateAutomaticShifts';
import { createCrudHook } from './createCrudHook';

// Activar/desactivar Edge Function (true = servidor, false = navegador)
const USE_EDGE_FUNCTION = true;

// ─── Factory: hook base para shifts (fetch con caché + CRUD) ──────────────────
const useCrudShifts = createCrudHook({
  tableName: 'shifts',
  selectQuery: '*, employees(nombre, cedula, valor_hora)',
  cacheTTL: 15_000,
  queryModifier: (query, _tenant, periodo) => {
    query = query.order('start_time');
    if (periodo) {
      if (Array.isArray(periodo)) query = query.in('periodo', periodo);
      else query = query.eq('periodo', periodo);
    }
    return query;
  },
});

// ─── Hook público (preserva API original) ─────────────────────────────────────
export function useShifts(periodo = null) {
  const { tenant } = useAuth();
  const {
    data: shifts,
    loading,
    error,
    fetch: _fetch,
    create: createShift,
    update: updateShift,
    remove: deleteShift,
    invalidate,
  } = useCrudShifts(periodo);

  // API original: fetchShifts() fuerza recarga
  const fetchShifts = () => _fetch(true);

  // ═══ Operaciones específicas (no cubiertas por la factory) ═════════════════

  const bulkInsertShifts = async (shiftsArray) => {
    const withTenant = shiftsArray.map(s => ({ ...s, tenant_id: tenant.id }));
    const { data, error: insertErr } = await supabase
      .from('shifts')
      .insert(withTenant)
      .select();
    if (insertErr) throw insertErr;
    await invalidate();
    return data;
  };

  const clearShiftsByPeriodo = async (periodoStr, empIds = []) => {
    if (!tenant) return 0;
    let query = supabase.from('shifts').delete().eq('tenant_id', tenant.id).eq('periodo', periodoStr);
    if (empIds.length > 0) query = query.in('employee_id', empIds);
    const { error: delErr, count } = await query;
    if (delErr) throw delErr;
    await invalidate();
    return count || 0;
  };

  const clearShiftsByDateRange = async (startStr, endStr, empIds = []) => {
    if (!tenant) return 0;
    let query = supabase.from('shifts').delete()
      .eq('tenant_id', tenant.id)
      .gte('start_time', startStr + 'T00:00:00')
      .lte('start_time', endStr + 'T23:59:59');
    if (empIds.length > 0) query = query.in('employee_id', empIds);
    const { error: delErr, count } = await query;
    if (delErr) throw delErr;
    await invalidate();
    return count || 0;
  };

  const getShiftsForEmployee = (employeeId, fecha) => {
    return shifts.filter(s => {
      const shiftDate = s.start_time.slice(0, 10);
      return s.employee_id === employeeId && shiftDate === fecha;
    });
  };

  // ═══ autoAssignShifts: algoritmo completo (inalterado) ═════════════════════
  const autoAssignShifts = async (params) => {
    const { employees, templates, absences, existingShifts, year, month, diasTrabajo,
      diasToProcess, areaId, modoOperacion, laborLimits, nightShiftConfig, patronRotativo,
      overrideMinEmpleadosDia, overrideMaxEmpleadosDia, overrideMinEmpleadosNoche } = params;

    if (!tenant) return { error: 'No hay tenant activo.', inserted: 0, alertaDias: [] };
    if (!Array.isArray(employees) || !employees.length) return { error: 'No hay empleados en el área.', inserted: 0, alertaDias: [] };

    // ── Intentar Edge Function (servidor) ────────────────────────────────────
    if (USE_EDGE_FUNCTION) {
      try {
        const { data: result, error: fnErr } = await supabase.functions.invoke('auto-assign', {
          body: { tenant_id: tenant.id, params }
        });

        if (!fnErr && result && !result.error) {
          await invalidate();
          return result;
        }
        logger.warn('useShifts', 'Edge Function falló o retornó error:', fnErr?.message || result?.error);
      } catch (e) {
        logger.warn('useShifts', 'Edge Function no disponible:', e.message, '→ algoritmo local');
      }
    }

    // ── Fallback: algoritmo local ────────────────────────────────────────────
    let demandSlots = [];
    if (areaId) {
      try {
        const { data } = await supabase.from('area_demand_slots').select('*').eq('area_id', areaId).eq('tenant_id', tenant.id);
        demandSlots = data || [];
      } catch (e) { logger.warn('useShifts', 'demandSlots:', e.message); }
    }

    let areaConfig = {};
    if (areaId) {
      try {
        const { data: ad } = await supabase.from('areas')
          .select('modo_operacion, estrategia_asignacion, min_empleados_noche, noche_solo_empleados_dedicados, permite_dia_cubrir_noche, slots_por_hora, snap_turnos_minutos, balancear_carga, rotar_slots_entre_asesores, permitir_horas_extras, permitir_turno_partido, min_horas_turno_override, max_horas_turno_override')
          .eq('id', areaId).single();
        areaConfig = ad || {};
      } catch (e) { logger.warn('useShifts', 'areaConfig:', e.message); }
      try {
        const { data: hc } = await supabase.from('areas')
          .select('min_empleados_dia, max_empleados_dia, hora_inicio_dia, hora_fin_dia').eq('id', areaId).single();
        if (hc) areaConfig = { ...areaConfig, ...hc };
      } catch (e) { /* ok */ }
      try {
        const { data: bp } = await supabase.from('areas').select('break_policy').eq('id', areaId).single();
        if (bp) areaConfig = { ...areaConfig, ...bp };
      } catch (e) { /* ok */ }
    }

    const { shifts: shiftsToInsert, warnings } = generateAutomaticShifts({
      modoOperacion: modoOperacion || 'OFICINA', employees, templates,
      absences: absences || [], existingShifts: existingShifts || [],
      year, month, diasTrabajoArea: diasTrabajo || [1,2,3,4,5],
      diasToProcess: diasToProcess || [], demandSlots,
      laborLimits: laborLimits || {}, nightShiftConfig: nightShiftConfig || null,
      patronRotativo: patronRotativo || null,
      estrategia: areaConfig.estrategia_asignacion ?? 'COVERAGE_FIRST',
      minEmpleadosNoche: overrideMinEmpleadosNoche ?? areaConfig.min_empleados_noche ?? 1,
      nocheSoloDedicados: areaConfig.noche_solo_empleados_dedicados ?? true,
      permiteDiaCubrirNoche: areaConfig.permite_dia_cubrir_noche ?? false,
      balancearCarga: areaConfig.balancear_carga ?? true,
      rotarSlots: areaConfig.rotar_slots_entre_asesores ?? false,
      slotsPorHora: areaConfig.slots_por_hora ?? 4,
      snapMinutos: areaConfig.snap_turnos_minutos ?? 15,
      minHorasTurnoOverride: areaConfig.min_horas_turno_override || null,
      maxHorasTurnoOverride: areaConfig.max_horas_turno_override || null,
      permiteExtras: areaConfig.permitir_horas_extras ?? false,
      permitePartidos: areaConfig.permitir_turno_partido ?? false,
      minEmpleadosDia: overrideMinEmpleadosDia ?? areaConfig.min_empleados_dia ?? null,
      maxEmpleadosDia: overrideMaxEmpleadosDia ?? areaConfig.max_empleados_dia ?? null,
      horaInicioDia: areaConfig.hora_inicio_dia ?? '04:00',
      horaFinDia: areaConfig.hora_fin_dia ?? null,
      breakPolicy: areaConfig.break_policy ?? null,
    });

    if (!Array.isArray(shiftsToInsert) || shiftsToInsert.length === 0) {
      await invalidate();
      return { inserted: 0, skipped: 0, alertaDias: warnings || [] };
    }

    const ALLOWED_FIELDS = new Set([
      'tenant_id', 'employee_id', 'start_time', 'end_time',
      'shift_type', 'periodo', 'break_minutes', 'template_id',
      'shift_kind', 'bloque', 'disponibilidad', 'recargo_porcentaje',
      'observaciones', 'almuerzo_minutos', 'breaks_15_count', 'descansos',
    ]);

    const sanitizedShifts = shiftsToInsert.map(s => {
      const clean = { tenant_id: tenant.id };
      for (const key of Object.keys(s)) { if (ALLOWED_FIELDS.has(key)) clean[key] = s[key]; }
      return clean;
    });

    const invalidShifts = sanitizedShifts.filter(s =>
      !s.start_time || !s.end_time || new Date(s.end_time) <= new Date(s.start_time)
    );
    const validShifts = sanitizedShifts.filter(s =>
      s.start_time && s.end_time && new Date(s.end_time) > new Date(s.start_time)
    );
    if (invalidShifts.length > 0) {
      logger.warn('useShifts', `${invalidShifts.length} turno(s) inválido(s) descartado(s)`);
      warnings.push(`Se descartaron ${invalidShifts.length} turno(s) con horario inválido.`);
    }
    if (validShifts.length === 0) {
      await invalidate();
      return { inserted: 0, skipped: invalidShifts.length, alertaDias: warnings || [] };
    }

    let inserted = 0;
    const BATCH = 250;
    for (let i = 0; i < validShifts.length; i += BATCH) {
      const chunk = validShifts.slice(i, i + BATCH);
      const { error: insertErr } = await supabase.from('shifts').insert(chunk);
      if (insertErr) {
        return { inserted, skipped: validShifts.length - i, alertaDias: [...(warnings || []), `Error BD: ${insertErr.message}`], error: insertErr.message };
      }
      inserted += chunk.length;
    }

    await invalidate();
    return { inserted, skipped: invalidShifts.length, alertaDias: warnings || [] };
  };

  return {
    shifts, loading, error,
    fetchShifts,
    createShift, updateShift, deleteShift,
    bulkInsertShifts, getShiftsForEmployee,
    autoAssignShifts, clearShiftsByPeriodo, clearShiftsByDateRange,
  };
}
