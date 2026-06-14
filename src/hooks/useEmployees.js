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

  // ─── Crear empleado con TODOS los campos laborales ─────────────────────
  const createEmployee = async (employeeData) => {
    // Limpia campos opcionales vacíos para evitar errores de tipo
    const cleaned = cleanEmployeeData(employeeData);

    const { data, error } = await supabase
      .from('employees')
      .insert([{ ...cleaned, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;
    await fetchEmployees();
    return data;
  };

  const updateEmployee = async (id, updates) => {
    const cleaned = cleanEmployeeData(updates);
    const { data, error } = await supabase
      .from('employees')
      .update(cleaned)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (error) throw error;
    await fetchEmployees();
    return data;
  };

  const deleteEmployee = async (id) => {
    const { error } = await supabase
      .from('employees')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchEmployees();
  };

  return { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee };
}

// ── Limpia el payload: convierte vacíos a null, mantiene el resto ───────────
function cleanEmployeeData(data) {
  const out = { ...data };
  Object.keys(out).forEach(k => {
    if (out[k] === '' || out[k] === undefined) {
      out[k] = null;
    }
  });
  // coerción numérica
  if (out.valor_hora !== null && out.valor_hora !== undefined) {
    out.valor_hora = parseFloat(out.valor_hora) || null;
  }
  if (out.salario_mensual !== null && out.salario_mensual !== undefined) {
    out.salario_mensual = parseFloat(out.salario_mensual) || null;
  }
  if (out.bono_rodamiento !== null && out.bono_rodamiento !== undefined) {
    out.bono_rodamiento = parseFloat(out.bono_rodamiento) || null;
  }
  if (out.bonificacion_fija !== null && out.bonificacion_fija !== undefined) {
    out.bonificacion_fija = parseFloat(out.bonificacion_fija) || null;
  }
  if (out.numero_hijos !== null && out.numero_hijos !== undefined) {
    out.numero_hijos = parseInt(out.numero_hijos, 10) || 0;
  }
  if (out.numero_dependientes !== null && out.numero_dependientes !== undefined) {
    out.numero_dependientes = parseInt(out.numero_dependientes, 10) || 0;
  }
  if (out.nivel_riesgo_arl !== null && out.nivel_riesgo_arl !== undefined) {
    out.nivel_riesgo_arl = parseInt(out.nivel_riesgo_arl, 10) || 1;
  }
  if (out.horas_semanales_contrato !== null && out.horas_semanales_contrato !== undefined) {
    out.horas_semanales_contrato = parseInt(out.horas_semanales_contrato, 10) || 42;
  }
  if (out.horas_mensuales_contrato !== null && out.horas_mensuales_contrato !== undefined) {
    out.horas_mensuales_contrato = parseInt(out.horas_mensuales_contrato, 10) || null;
  }
  if (out.duracion_jornada_horas !== null && out.duracion_jornada_horas !== undefined) {
    out.duracion_jornada_horas = parseFloat(out.duracion_jornada_horas) || null;
  }
  return out;
}
