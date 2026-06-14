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
            employees(id, nombre, cedula, cargo)
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

  const createArea = async (areaData) => {
    const { data, error } = await supabase
      .from('areas')
      .insert([{ ...areaData, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;

    // Fetch global templates and copy them to the new area
    const { data: globalTemplates } = await supabase
      .from('shift_templates')
      .select('nombre, hora_inicio, hora_fin, cruza_medianoche, color, activo')
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

    await fetchAreas();
    return data;
  };

  const updateArea = async (id, updates) => {
    const { data, error } = await supabase
      .from('areas')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (error) throw error;

    // Si se actualizó el valor_hora_default, propagar a empleados no especiales
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
    // Eliminar asignación previa del empleado (solo puede estar en 1 área)
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

  /** Obtiene los empleados de un área específica */
  const getAreaEmployees = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    return area?.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
  };

  /** Obtiene el área de un empleado */
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
