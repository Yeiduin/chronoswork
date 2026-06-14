import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

// ═══════════════════════════════════════════════════════════════
// Catálogos válidos (deben coincidir con CHECK constraints en BD)
// ═══════════════════════════════════════════════════════════════
const TIPOS_CONTRATO_VALIDOS = new Set([
  'INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO',
  'PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL',
]);
const TIPOS_DOC_VALIDOS = new Set(['CC','CE','TI','PA','RC','PPT','NIT']);
const GENEROS_VALIDOS = new Set(['M','F','OTRO','PREFIERO_NO_DECIR']);
const ESTADOS_CIVIL_VALIDOS = new Set(['SOLTERO','CASADO','UNION_LIBRE','DIVORCIADO','VIUDO','SEPARADO']);
const NIVELES_CARGO_VALIDOS = new Set(['JUNIOR','SENIOR','COORDINADOR','SUPERVISOR','JEFE','GERENTE','DIRECTOR']);
const NIVELES_EDUCACION_VALIDOS = new Set(['PRIMARIA','BACHILLERATO','TECNICO','TECNOLOGO','PREGRADO','ESPECIALIZACION','MAESTRIA','DOCTORADO','NINGUNO']);
const TIPOS_JORNADA_VALIDOS = new Set(['DIURNA','NOCTURNA','MIXTA','POR_TURNOS']);
const TIPOS_CUENTA_VALIDOS = new Set(['AHORROS','CORRIENTE']);
const AFP_TIPOS_VALIDOS = new Set(['RAZON','PRIMAPROMEDIO']);

// ═══════════════════════════════════════════════════════════════
// Función principal de limpieza y validación
// ═══════════════════════════════════════════════════════════════
function cleanEmployeeData(data) {
  const out = { ...data };

  // ── Paso 1: Convertir strings vacíos y undefined a null
  // EXCEPTO los campos que tienen defaults numéricos (numero_hijos=0, horas=42, etc.)
  const fieldsWithZeroDefault = ['numero_hijos', 'numero_dependientes'];
  Object.keys(out).forEach(k => {
    if (out[k] === undefined) {
      out[k] = null;
    } else if (out[k] === '' && !fieldsWithZeroDefault.includes(k)) {
      out[k] = null;
    }
  });

  // ── Paso 2: Coerción numérica con defaults correctos
  // numero_hijos / numero_dependientes: "" → 0, "abc" → 0, "3" → 3
  if (out.numero_hijos !== null) {
    const n = parseInt(String(out.numero_hijos), 10);
    out.numero_hijos = isNaN(n) || n < 0 ? 0 : n;
  } else {
    out.numero_hijos = 0;
  }
  if (out.numero_dependientes !== null) {
    const n = parseInt(String(out.numero_dependientes), 10);
    out.numero_dependientes = isNaN(n) || n < 0 ? 0 : n;
  } else {
    out.numero_dependientes = 0;
  }

  // valor_hora, salario_mensual, etc.: string → number, "" → null
  const floatFields = ['valor_hora', 'salario_mensual', 'bono_rodamiento', 'bonificacion_fija', 'duracion_jornada_horas'];
  floatFields.forEach(f => {
    if (out[f] === '' || out[f] === null) {
      out[f] = null;
    } else {
      const n = parseFloat(out[f]);
      out[f] = isNaN(n) ? null : n;
    }
  });

  // ── Paso 3: Enteros con default
  // horas_semanales_contrato: "" → 42, "0" → 42 (no se permite 0)
  if (out.horas_semanales_contrato === '' || out.horas_semanales_contrato === null || out.horas_semanales_contrato === undefined) {
    out.horas_semanales_contrato = 42;
  } else {
    const n = parseInt(String(out.horas_semanales_contrato), 10);
    out.horas_semanales_contrato = (isNaN(n) || n <= 0) ? 42 : Math.min(n, 168); // máx 168h/sem
  }

  if (out.horas_mensuales_contrato === '' || out.horas_mensuales_contrato === null) {
    out.horas_mensuales_contrato = 182; // ~42h × 4.33
  } else {
    const n = parseInt(String(out.horas_mensuales_contrato), 10);
    out.horas_mensuales_contrato = isNaN(n) ? null : n;
  }

  if (out.dias_descanso_semana === '' || out.dias_descanso_semana === null) {
    out.dias_descanso_semana = 1;
  } else {
    const n = parseInt(String(out.dias_descanso_semana), 10);
    out.dias_descanso_semana = (n === 1 || n === 2) ? n : 1;
  }

  // ── Paso 4: nivel_riesgo_arl: validar rango 1-5
  if (out.nivel_riesgo_arl === '' || out.nivel_riesgo_arl === null) {
    out.nivel_riesgo_arl = 1;
  } else {
    const n = parseInt(String(out.nivel_riesgo_arl), 10);
    out.nivel_riesgo_arl = (isNaN(n) || n < 1 || n > 5) ? 1 : n;
  }

  // ── Paso 5: Validar catálogos (CHECK constraints)
  if (out.tipo_contrato && !TIPOS_CONTRATO_VALIDOS.has(String(out.tipo_contrato).toUpperCase())) {
    console.warn(`[cleanEmployeeData] tipo_contrato inválido: "${out.tipo_contrato}" → INDEFINIDO`);
    out.tipo_contrato = 'INDEFINIDO';
  }
  if (out.tipo_documento && !TIPOS_DOC_VALIDOS.has(String(out.tipo_documento).toUpperCase())) {
    out.tipo_documento = 'CC';
  }
  if (out.genero && !GENEROS_VALIDOS.has(String(out.genero).toUpperCase())) {
    out.genero = null;
  }
  if (out.estado_civil && !ESTADOS_CIVIL_VALIDOS.has(String(out.estado_civil).toUpperCase())) {
    out.estado_civil = null;
  }
  if (out.nivel_cargo && !NIVELES_CARGO_VALIDOS.has(String(out.nivel_cargo).toUpperCase())) {
    out.nivel_cargo = 'JUNIOR';
  }
  if (out.nivel_educacion && !NIVELES_EDUCACION_VALIDOS.has(String(out.nivel_educacion).toUpperCase())) {
    out.nivel_educacion = null;
  }
  if (out.jornada_tipo && !TIPOS_JORNADA_VALIDOS.has(String(out.jornada_tipo).toUpperCase())) {
    out.jornada_tipo = 'DIURNA';
  }
  if (out.tipo_cuenta && !TIPOS_CUENTA_VALIDOS.has(String(out.tipo_cuenta).toUpperCase())) {
    out.tipo_cuenta = 'AHORROS';
  }
  if (out.afp_tipo && !AFP_TIPOS_VALIDOS.has(String(out.afp_tipo).toUpperCase())) {
    out.afp_tipo = 'RAZON';
  }

  // ── Paso 6: Validar fechas (deben ser ISO YYYY-MM-DD o null)
  const dateFields = [
    'fecha_nacimiento', 'fecha_ingreso', 'fecha_fin_contrato', 'periodo_prueba_hasta',
    'fecha_etapa_lectiva_inicio', 'fecha_etapa_lectiva_fin', 'vencimiento_licencia',
  ];
  dateFields.forEach(f => {
    if (out[f] === '' || out[f] === undefined) {
      out[f] = null;
    } else if (typeof out[f] === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(out[f])) {
      console.warn(`[cleanEmployeeData] ${f} formato inválido: "${out[f]}"`);
      out[f] = null;
    }
  });

  return out;
}

// ═══════════════════════════════════════════════════════════════
// Hook principal
// ═══════════════════════════════════════════════════════════════
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

  return { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee, cleanEmployeeData };
}
