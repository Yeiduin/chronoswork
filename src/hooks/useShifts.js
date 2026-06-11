import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { generateAutomaticShifts } from '../core/generateAutomaticShifts';

export function useShifts(periodo = null) {
  const { tenant } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const periodosKey = Array.isArray(periodo) ? periodo.join(',') : periodo;

  const fetchShifts = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      let query = supabase
        .from('shifts')
        .select('*, employees(nombre, cedula, valor_hora)')
        .eq('tenant_id', tenant.id)
        .order('start_time');

      if (periodo) {
        if (Array.isArray(periodo)) {
          query = query.in('periodo', periodo);
        } else {
          query = query.eq('periodo', periodo);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setShifts(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, periodosKey]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const createShift = async (shiftData) => {
    const { data, error } = await supabase
      .from('shifts')
      .insert([{ ...shiftData, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;
    await fetchShifts();
    return data;
  };

  const updateShift = async (id, updates) => {
    const { data, error } = await supabase
      .from('shifts')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (error) throw error;
    await fetchShifts();
    return data;
  };

  const deleteShift = async (id) => {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchShifts();
  };

  const bulkInsertShifts = async (shiftsArray) => {
    const withTenant = shiftsArray.map(s => ({ ...s, tenant_id: tenant.id }));
    const { data, error } = await supabase
      .from('shifts')
      .insert(withTenant)
      .select();
    if (error) throw error;
    await fetchShifts();
    return data;
  };

  /**
   * Elimina todos los turnos de un período (y opcionalmente de ciertos empleados).
   * @param {string} periodoStr  - 'YYYY-MM'
   * @param {string[]} [empIds]  - si se pasa, solo borra los de esos empleados
   */
  const clearShiftsByPeriodo = async (periodoStr, empIds = []) => {
    if (!tenant) return 0;
    let query = supabase
      .from('shifts')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('periodo', periodoStr);

    if (empIds.length > 0) {
      query = query.in('employee_id', empIds);
    }

    const { error, count } = await query;
    if (error) throw error;
    await fetchShifts();
    return count || 0;
  };

  /**
   * Elimina los turnos en un rango de fechas.
   * @param {string} startStr - 'YYYY-MM-DD'
   * @param {string} endStr - 'YYYY-MM-DD'
   * @param {string[]} [empIds]
   */
  const clearShiftsByDateRange = async (startStr, endStr, empIds = []) => {
    if (!tenant) return 0;
    let query = supabase
      .from('shifts')
      .delete()
      .eq('tenant_id', tenant.id)
      .gte('start_time', startStr + 'T00:00:00')
      .lte('start_time', endStr + 'T23:59:59');

    if (empIds.length > 0) {
      query = query.in('employee_id', empIds);
    }

    const { error, count } = await query;
    if (error) throw error;
    await fetchShifts();
    return count || 0;
  };

  /**
   * Obtiene los turnos de un empleado en una fecha específica
   */
  const getShiftsForEmployee = (employeeId, fecha) => {
    return shifts.filter(s => {
      const shiftDate = s.start_time.slice(0, 10);
      return s.employee_id === employeeId && shiftDate === fecha;
    });
  };

  /**
   * Auto-asignar turnos para un área o toda la empresa.
   * @param {Object} params
   * @param {Array}  params.employees     - Empleados del área
   * @param {Array}  params.templates     - Plantillas de turno del área
   * @param {Array}  params.absences      - Novedades activas (para bloquear días)
   * @param {Array}  params.existingShifts- Turnos ya existentes en el período
   * @param {number} params.year          - Año del período
   * @param {number} params.month         - Mes del período (1-12)
   * @param {Array}  params.diasTrabajo   - Días laborables del área [1-7], 1=Lun,7=Dom
   * @returns {{ inserted: number, skipped: number, alertaDias: string[] }}
   */
  const autoAssignShifts = async (params) => {
    const { employees, templates, absences, existingShifts, year, month, diasTrabajo, strategyOptions, diasToProcess, coberturaMinimaDiaria, coberturaMaximaDiaria, areaId } = params;
    if (!tenant || !employees.length || !templates.length) {
      return { inserted: 0, skipped: 0, alertaDias: [] };
    }

    // Cargar curva de demanda horaria si el área la tiene configurada
    let demandSlots = [];
    if (areaId) {
      const { data } = await supabase
        .from('area_demand_slots')
        .select('*')
        .eq('area_id', areaId)
        .eq('tenant_id', tenant.id);
      demandSlots = data || [];
    }

    const { shifts: shiftsToInsert, warnings } = generateAutomaticShifts({
      employees,
      templates,
      absences,
      existingShifts,
      year,
      month,
      diasTrabajoArea: diasTrabajo,
      coberturaMinimaDiaria,
      coberturaMaximaDiaria,
      diasToProcess: diasToProcess || [],
      demandSlots,   // nuevo: vacío = modo plantillas fijas (compatibilidad)
    });

    let inserted = 0;
    if (shiftsToInsert.length > 0) {
      const shiftsWithTenant = shiftsToInsert.map(s => ({ ...s, tenant_id: tenant.id }));
      const BATCH = 500;
      for (let i = 0; i < shiftsWithTenant.length; i += BATCH) {
        const chunk = shiftsWithTenant.slice(i, i + BATCH);
        const { error } = await supabase.from('shifts').insert(chunk);
        if (error) return { error: error.message };
        inserted += chunk.length;
      }
    }

    await fetchShifts();
    return { inserted, skipped: 0, alertaDias: warnings };
  };

  return {
    shifts, loading, error, fetchShifts,
    createShift, updateShift, deleteShift,
    bulkInsertShifts, getShiftsForEmployee,
    autoAssignShifts, clearShiftsByPeriodo, clearShiftsByDateRange,
  };
}
