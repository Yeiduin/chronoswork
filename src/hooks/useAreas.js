import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useAreas() {
  const { tenant } = useAuth();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAreas = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('areas')
        .select(`
          *,
          area_employees(
            id,
            employee_id,
            employees(
              id, nombre, cedula, cargo, valor_hora, tipo_contrato, es_especial,
              activo, horas_semanales_contrato, dias_descanso_semana,
              jornada_preferida, solo_diurno, solo_nocturno, permite_partido,
              horas_max_diarias, horas_nocturnas_max_semana, horas_max_semana,
              dias_descanso_fijos, turno_predeterminado_id
            )
          )
        `)
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      setAreas(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  // ─── Helper: sanitizar campos numéricos vacíos → null ──────────────────
  // Si mandamos "" a una columna DECIMAL/INT, Postgres falla con
  // "invalid input syntax for type numeric".
  const sanitizeNumeric = (raw) => {
    const NUMERIC_FIELDS = [
      'min_empleados_noche', 'min_horas_turno_override', 'max_horas_turno_override',
      'slots_por_hora', 'snap_turnos_minutos', 'valor_hora_default',
      'duracion_jornada_horas', 'dias_descanso', 'dias_descanso_default',
      'horas_extras_max_dia', 'horas_extras_max_semana',
      'descanso_min_entre_jornadas', 'dotacion_periodicidad_meses',
      'break_minutos', 'nivel_riesgo_arl',
    ];
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (NUMERIC_FIELDS.includes(k)) {
        const empty = v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
        out[k] = empty ? null : (isNaN(Number(v)) ? null : Number(v));
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  // ─── Crear área con TODOS los campos laborales ──────────────────────────
  const createArea = async (areaData) => {
    const { franjas_iniciales, ...raw } = areaData;
    const dataToInsert = sanitizeNumeric(raw);
    // 1. Insertar el área
    const { data, error } = await supabase
      .from('areas')
      .insert([{ ...dataToInsert, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;

    // 2. Si se pidió franjas típicas del sector, las creamos automáticamente
    if (franjas_iniciales?.length) {
      const templatesToInsert = franjas_iniciales.map(t => ({
        tenant_id: tenant.id,
        area_id: data.id,
        nombre: t.nombre,
        hora_inicio: t.hora_inicio,
        hora_fin: t.hora_fin,
        cruza_medianoche: t.cruza_medianoche || false,
        color: t.color || '#3b82f6',
        shift_kind: t.shift_kind || 'STANDARD',
        activo: true,
      }));
      await supabase.from('shift_templates').insert(templatesToInsert);
    } else {
      // Si no, copiamos las globales como respaldo
      const { data: globalTemplates } = await supabase
        .from('shift_templates')
        .select('nombre, hora_inicio, hora_fin, cruza_medianoche, color, shift_kind, activo')
        .eq('tenant_id', tenant.id)
        .is('area_id', null)
        .eq('activo', true);

      if (globalTemplates && globalTemplates.length > 0) {
        const templatesToInsert = globalTemplates.map(t => ({
          ...t,
          area_id: data.id,
          tenant_id: tenant.id
        }));
        await supabase.from('shift_templates').insert(templatesToInsert);
      }
    }

    await fetchAreas();
    return data;
  };

  // ─── Actualizar área ─────────────────────────────────────────────────────
  const updateArea = async (id, updates) => {
    const { franjas_iniciales, ...raw } = updates;
    const dataToUpdate = sanitizeNumeric(raw);
    const { data, error } = await supabase
      .from('areas')
      .update(dataToUpdate)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (error) throw error;

    // Si se actualizó valor_hora_default, propagar a empleados no especiales
    if (updates.valor_hora_default !== undefined) {
      const { data: areaEmps } = await supabase
        .from('area_employees')
        .select('employee_id')
        .eq('area_id', id)
        .eq('tenant_id', tenant.id);

      if (areaEmps && areaEmps.length > 0) {
        const empIds = areaEmps.map(ae => ae.employee_id);
        await supabase
          .from('employees')
          .update({ valor_hora: updates.valor_hora_default })
          .in('id', empIds)
          .eq('es_especial', false)
          .eq('tenant_id', tenant.id);
      }
    }

    await fetchAreas();
    return data;
  };

  const deleteArea = async (id) => {
    const { error } = await supabase
      .from('areas')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchAreas();
  };

  const deleteAllAreas = async () => {
    const { error } = await supabase
      .from('areas')
      .update({ activo: false })
      .eq('tenant_id', tenant.id)
      .eq('activo', true);
    if (error) throw error;
    await fetchAreas();
  };

  /** Asigna un empleado a un área (remueve de la anterior si tenía) */
  const assignEmployee = async (areaId, employeeId) => {
    await supabase
      .from('area_employees')
      .delete()
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenant.id);

    const { error } = await supabase
      .from('area_employees')
      .insert([{ area_id: areaId, employee_id: employeeId, tenant_id: tenant.id }]);
    if (error) throw error;
    await fetchAreas();
  };

  /** Remueve un empleado de su área */
  const removeEmployee = async (employeeId) => {
    const { error } = await supabase
      .from('area_employees')
      .delete()
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchAreas();
  };

  const getAreaEmployees = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    return area?.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
  };

  const getEmployeeArea = (employeeId) => {
    return areas.find(a =>
      a.area_employees?.some(ae => ae.employee_id === employeeId)
    ) || null;
  };

  return {
    areas, loading, error, fetchAreas,
    createArea, updateArea, deleteArea, deleteAllAreas,
    assignEmployee, removeEmployee,
    getAreaEmployees, getEmployeeArea,
  };
}
