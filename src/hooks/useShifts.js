import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

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
  const autoAssignShifts = async ({ employees, templates, absences, existingShifts, year, month, diasTrabajo, strategyOptions, diasToProcess }) => {
    if (!tenant || !employees.length || !templates.length) {
      return { inserted: 0, skipped: 0, alertaDias: [] };
    }

    const MAX_HORAS_SEMANA = 42; 
    const shiftsToInsert = [];
    const alertaDias = []; 

    const getLocalYYYYMMDD = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Usar diasToProcess si se provee (vista actual), sino todo el mes
    const allDays = diasToProcess ? diasToProcess.map(d => ({
      date: d,
      dateStr: getLocalYYYYMMDD(d),
      dow: d.getDay() === 0 ? 7 : d.getDay()
    })).filter(d => diasTrabajo.includes(d.dow)) : [];

    if (allDays.length === 0) return { inserted: 0, skipped: 0, alertaDias: [] };

    const getWeekKey = (dateObj) => {
      const d = new Date(dateObj);
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - (dow - 1));
      return getLocalYYYYMMDD(startOfWeek);
    };

    const strategy = strategyOptions?.strategy || 'fijo';

    // Cargar historial de turnos (hasta 14 días atrás) para la rotación semanal
    const firstDateStr = allDays[0].dateStr;
    const startHistory = new Date(allDays[0].date);
    startHistory.setDate(startHistory.getDate() - 14);
    const startHistoryStr = getLocalYYYYMMDD(startHistory);

    const { data: historyShifts } = await supabase
      .from('shifts')
      .select('employee_id, start_time, template_id')
      .eq('tenant_id', tenant.id)
      .in('employee_id', employees.map(e => e.id))
      .gte('start_time', startHistoryStr + 'T00:00:00')
      .lt('start_time', firstDateStr + 'T00:00:00');

    // Determinar plantilla dominante de la semana anterior para cada empleado
    const lastWeekTemplateByEmp = {};
    employees.forEach(emp => {
      const empShifts = (historyShifts || []).filter(s => s.employee_id === emp.id && s.template_id);
      if (empShifts.length > 0) {
        // Encontrar el template_id más frecuente
        const counts = {};
        empShifts.forEach(s => { counts[s.template_id] = (counts[s.template_id] || 0) + 1; });
        const dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        lastWeekTemplateByEmp[emp.id] = dominant;
      }
    });

    const horasSemana = {}; 
    employees.forEach(e => { horasSemana[e.id] = {}; });

    existingShifts.forEach(s => {
      const d = new Date(s.start_time);
      const weekKey = getWeekKey(d);
      const horas = (new Date(s.end_time) - d) / 3600000;
      if (!horasSemana[s.employee_id]) horasSemana[s.employee_id] = {};
      horasSemana[s.employee_id][weekKey] = (horasSemana[s.employee_id][weekKey] || 0) + horas;
    });

    const calcHorasTemplate = (t) => {
      const [h1, m1] = t.hora_inicio.split(':').map(Number);
      const [h2, m2] = t.hora_fin.split(':').map(Number);
      let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (mins <= 0) mins += 24 * 60;
      return mins / 60;
    };

    const tieneNovedad = (empId, dateStr) =>
      absences.some(a => a.employee_id === empId && dateStr >= a.fecha_inicio && dateStr <= a.fecha_fin);

    const tieneTurno = (empId, dateStr) =>
      existingShifts.some(s => s.employee_id === empId && getLocalYYYYMMDD(new Date(s.start_time)) === dateStr) ||
      shiftsToInsert.some(s => s.employee_id === empId && getLocalYYYYMMDD(new Date(s.start_time)) === dateStr);

    const isTemplateCovered = (templateId, dateStr) =>
      existingShifts.some(s => s.template_id === templateId && getLocalYYYYMMDD(new Date(s.start_time)) === dateStr) ||
      shiftsToInsert.some(s => s.template_id === templateId && getLocalYYYYMMDD(new Date(s.start_time)) === dateStr);

    // Determinar la plantilla esperada para un empleado en un día específico según la estrategia
    const getExpectedTemplateId = (emp, dateObj) => {
      const empIdx = employees.findIndex(e => e.id === emp.id);
      let baseIdx = empIdx % templates.length;
      
      const dow = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
      const dayIndexInWeek = dow - 1; // 0 para Lunes, 6 para Domingo

      if (strategy === 'rotacion_semanal') {
        const lastTplId = lastWeekTemplateByEmp[emp.id];
        if (lastTplId) {
          const oldIdx = templates.findIndex(t => t.id === lastTplId);
          if (oldIdx !== -1) {
            baseIdx = (oldIdx + 1) % templates.length;
          }
        }
      }

      let tplIdx = baseIdx;
      if (strategy === 'intercalado_dias') {
        tplIdx = (baseIdx + dayIndexInWeek) % templates.length;
      } else if (strategy === 'intercalado_mitad') {
        tplIdx = dayIndexInWeek < 3 ? baseIdx : (baseIdx + 1) % templates.length;
      }

      return templates[tplIdx]?.id;
    };

    for (const { date, dateStr } of allDays) {
      const weekKey = getWeekKey(date);

      for (const emp of employees) {
        if (tieneNovedad(emp.id, dateStr)) continue;
        if (tieneTurno(emp.id, dateStr)) continue; 

        const expectedTemplateId = getExpectedTemplateId(emp, date);
        const template = templates.find(t => t.id === expectedTemplateId);
        if (!template) continue;

        const horas = calcHorasTemplate(template);
        const horasAcum = horasSemana[emp.id]?.[weekKey] || 0;
        if (horasAcum + horas > MAX_HORAS_SEMANA) continue;

        let startISO, endISO;
        const tInicio = template.hora_inicio.slice(0, 5) + ':00';
        const tFin = template.hora_fin.slice(0, 5) + ':00';

        if (template.cruza_medianoche) {
          const nextDay = new Date(date);
          nextDay.setDate(date.getDate() + 1);
          startISO = `${dateStr}T${tInicio}`;
          endISO = `${getLocalYYYYMMDD(nextDay)}T${tFin}`;
        } else {
          startISO = `${dateStr}T${tInicio}`;
          endISO = `${dateStr}T${tFin}`;
        }

        shiftsToInsert.push({
          employee_id: emp.id,
          tenant_id: tenant.id,
          start_time: startISO,
          end_time: endISO,
          shift_type: 'custom',
          periodo: `${year}-${String(month).padStart(2, '0')}`,
          template_id: template.id,
        });

        horasSemana[emp.id][weekKey] = (horasSemana[emp.id][weekKey] || 0) + horas;
      }

      // Check for missing coverage
      for (const template of templates) {
        if (!isTemplateCovered(template.id, dateStr)) {
          if (!alertaDias.includes(dateStr)) alertaDias.push(dateStr);
        }
      }
    }

    let inserted = 0;
    if (shiftsToInsert.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < shiftsToInsert.length; i += BATCH) {
        const chunk = shiftsToInsert.slice(i, i + BATCH);
        const { error } = await supabase.from('shifts').insert(chunk);
        if (error) return { error: error.message };
        inserted += chunk.length;
      }
    }

    await fetchShifts();
    return { inserted, skipped: shiftsToInsert.length - inserted, alertaDias };
  };

  return {
    shifts, loading, error, fetchShifts,
    createShift, updateShift, deleteShift,
    bulkInsertShifts, getShiftsForEmployee,
    autoAssignShifts, clearShiftsByPeriodo, clearShiftsByDateRange,
  };
}
