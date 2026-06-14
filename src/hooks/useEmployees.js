import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useEmployees() {
  const { tenant } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEmployees = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = async (employeeData) => {
    const { data, error } = await supabase
      .from('employees')
      .insert([{ ...employeeData, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;
    await fetchEmployees();
    return data;
  };

  const updateEmployee = async (id, updates) => {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (error) throw error;
    await fetchEmployees();
    return data;
  };

  const deleteEmployee = async (id) => {
    // Borrado lógico
    const { error } = await supabase
      .from('employees')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchEmployees();
  };

  const deleteAllEmployees = async () => {
    const { error } = await supabase
      .from('employees')
      .update({ activo: false })
      .eq('tenant_id', tenant.id)
      .eq('activo', true);
    if (error) throw error;
    await fetchEmployees();
  };

  return { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee, deleteAllEmployees };
}
