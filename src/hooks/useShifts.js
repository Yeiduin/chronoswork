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
   * @param {Array}  params.employees      - Empleados del área (con sus campos completos: horas_semanales_contrato, turno_predeterminado_id, etc.)
   * @param {Array}  params.templates      - Plantillas de turno del área
   * @param {Array}  params.absences       - Novedades activas (para bloquear días)
   * @param {Array}  params.existingShifts - Turnos ya existentes en el período
   * @param {number} params.year           - Año del período
   * @param {number} params.month          - Mes del período (1-12)
   * @param {Array}  params.diasTrabajo    - Días laborables del área [1-7], 1=Lun,7=Dom
   * @returns {Promise<{ inserted: number, skipped: number, alertaDias: string[], error?: string }>}
   */
  const autoAssignShifts = async (params) => {
    const {
      employees, templates, absences, existingShifts,
      year, month, diasTrabajo, strategyOptions,
      diasToProcess, areaId, modoOperacion,
      laborLimits, nightShiftConfig, patronRotativo,
    } = params;

    if (!tenant) {
      return { error: 'No hay tenant activo. Inicia sesión nuevamente.', inserted: 0, alertaDias: [] };
    }
    if (!Array.isArray(employees) || !employees.length) {
      return { error: 'No hay empleados en el área para programar.', inserted: 0, alertaDias: [] };
    }
    if (!Array.isArray(templates) || !templates.length) {
      return {
        error: 'El área no tiene franjas horarias configuradas. Agrega al menos una en Áreas → Franjas.',
        inserted: 0,
        alertaDias: [],
      };
    }

    // Cargar curva de demanda horaria si el área la tiene configurada
    let demandSlots = [];
    if (areaId) {
      try {
        const { data } = await supabase
          .from('area_demand_slots')
          .select('*')
          .eq('area_id', areaId)
          .eq('tenant_id', tenant.id);
        demandSlots = data || [];
      } catch (e) {
        // Si la tabla no existe o el query falla, seguimos con []
        console.warn('[autoAssign] demandSlots no se pudo cargar:', e.message);
        demandSlots = [];
      }
    }

    const { shifts: shiftsToInsert, warnings } = generateAutomaticShifts({
      modoOperacion: modoOperacion || 'OFICINA',
      employees,
      templates,
      absences: absences || [],
      existingShifts: existingShifts || [],
      year,
      month,
      diasTrabajoArea: diasTrabajo || [1, 2, 3, 4, 5],
      diasToProcess: diasToProcess || [],
      demandSlots,
      laborLimits: laborLimits || {},
      nightShiftConfig: nightShiftConfig || null,
      patronRotativo: patronRotativo || null,
    });

    if (!Array.isArray(shiftsToInsert) || shiftsToInsert.length === 0) {
      await fetchShifts();
      return { inserted: 0, skipped: 0, alertaDias: warnings || [] };
    }

    // Sanitizar: eliminar campos que la BD no reconozca, mantener solo los
    // que existen en shifts. Defensivo por si se ejecuta antes de la migración.
    const ALLOWED_FIELDS = new Set([
      'tenant_id', 'employee_id', 'start_time', 'end_time',
      'shift_type', 'periodo', 'break_minutes', 'template_id',
      'shift_kind', 'bloque', 'disponibilidad', 'recargo_porcentaje',
      'observaciones',
    ]);

    const sanitizedShifts = shiftsToInsert.map(s => {
      const clean = { tenant_id: tenant.id };
      for (const key of Object.keys(s)) {
        if (ALLOWED_FIELDS.has(key)) clean[key] = s[key];
      }
      return clean;
    });

    let inserted = 0;
    const BATCH = 250; // batches más pequeños para evitar el límite de payload
    for (let i = 0; i < sanitizedShifts.length; i += BATCH) {
      const chunk = sanitizedShifts.slice(i, i + BATCH);
      const { error } = await supabase.from('shifts').insert(chunk);
      if (error) {
        // Devolver mensaje útil al usuario
        console.error('[autoAssign] Error insertando lote:', error);
        return {
          inserted,
          skipped: sanitizedShifts.length - i,
          alertaDias: [
            ...(warnings || []),
            `Error en BD: ${error.message}` +
              (error.message.includes('schema cache') || error.message.includes('column')
                ? '. Probablemente falta aplicar la migración fix_shifts_shift_kind.sql'
                : ''),
          ],
          error: error.message,
        };
      }
      inserted += chunk.length;
    }

    await fetchShifts();
    return { inserted, skipped: 0, alertaDias: warnings || [] };
  };

  return {
    shifts, loading, error, fetchShifts,
    createShift, updateShift, deleteShift,
    bulkInsertShifts, getShiftsForEmployee,
    autoAssignShifts, clearShiftsByPeriodo, clearShiftsByDateRange,
  };
}
