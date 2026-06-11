import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useAbsences() {
  const { tenant } = useAuth();
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAbsences = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('absences')
        .select(`
          *,
          employees(
            nombre,
            cedula,
            cargo,
            area_employees(areas(nombre))
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('fecha_inicio', { ascending: false });
      if (error) throw error;
      setAbsences(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

  const createAbsence = async (absenceData) => {
    const { data, error } = await supabase
      .from('absences')
      .insert([{ ...absenceData, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;
    await fetchAbsences();
    return data;
  };

  const deleteAbsence = async (id) => {
    const { error } = await supabase
      .from('absences')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchAbsences();
  };

  /**
   * Verifica si un empleado tiene novedad activa en un rango de fechas
   */
  const tieneNovedad = (employeeId, fecha) => {
    return absences.some(a =>
      a.employee_id === employeeId &&
      fecha >= a.fecha_inicio &&
      fecha <= a.fecha_fin
    );
  };

  /**
   * Obtiene la novedad activa para un empleado en una fecha dada
   */
  const getNovedad = (employeeId, fecha) => {
    return absences.find(a =>
      a.employee_id === employeeId &&
      fecha >= a.fecha_inicio &&
      fecha <= a.fecha_fin
    );
  };

  return { absences, loading, error, fetchAbsences, createAbsence, deleteAbsence, tieneNovedad, getNovedad };
}
