import { useState, useEffect, useCallback, useRef } from 'react';
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

  const fieldsWithZeroDefault = ['numero_hijos', 'numero_dependientes'];
  Object.keys(out).forEach(k => {
    if (out[k] === undefined) {
      out[k] = null;
    } else if (out[k] === '' && !fieldsWithZeroDefault.includes(k)) {
      out[k] = null;
    }
  });

  if (out.numero_hijos !== null) {
    const n = parseInt(String(out.numero_hijos), 10);
    out.numero_hijos = isNaN(n) || n < 0 ? 0 : n;
  } else { out.numero_hijos = 0; }

  if (out.numero_dependientes !== null) {
    const n = parseInt(String(out.numero_dependientes), 10);
    out.numero_dependientes = isNaN(n) || n < 0 ? 0 : n;
  } else { out.numero_dependientes = 0; }

  const floatFields = ['valor_hora', 'salario_mensual', 'bono_rodamiento', 'bonificacion_fija', 'duracion_jornada_horas'];
  floatFields.forEach(f => {
    if (out[f] === '' || out[f] === null) { out[f] = null; }
    else { const n = parseFloat(out[f]); out[f] = isNaN(n) ? null : n; }
  });

  if (out.horas_semanales_contrato === '' || out.horas_semanales_contrato === null || out.horas_semanales_contrato === undefined) {
    out.horas_semanales_contrato = 42;
  } else {
    const n = parseInt(String(out.horas_semanales_contrato), 10);
    out.horas_semanales_contrato = (isNaN(n) || n <= 0) ? 42 : Math.min(n, 168);
  }

  if (out.horas_mensuales_contrato === '' || out.horas_mensuales_contrato === null) {
    out.horas_mensuales_contrato = 182;
  } else { const n = parseInt(String(out.horas_mensuales_contrato), 10); out.horas_mensuales_contrato = isNaN(n) ? null : n; }

  if (out.dias_descanso_semana === '' || out.dias_descanso_semana === null) {
    out.dias_descanso_semana = 1;
  } else { const n = parseInt(String(out.dias_descanso_semana), 10); out.dias_descanso_semana = (n === 1 || n === 2) ? n : 1; }

  if (out.nivel_riesgo_arl === '' || out.nivel_riesgo_arl === null) {
    out.nivel_riesgo_arl = 1;
  } else { const n = parseInt(String(out.nivel_riesgo_arl), 10); out.nivel_riesgo_arl = (isNaN(n) || n < 1 || n > 5) ? 1 : n; }

  if (out.tipo_contrato && !TIPOS_CONTRATO_VALIDOS.has(String(out.tipo_contrato).toUpperCase())) {
    console.warn(`[cleanEmployeeData] tipo_contrato inválido: "${out.tipo_contrato}" → INDEFINIDO`);
    out.tipo_contrato = 'INDEFINIDO';
  }
  if (out.tipo_documento && !TIPOS_DOC_VALIDOS.has(String(out.tipo_documento).toUpperCase())) out.tipo_documento = 'CC';
  if (out.genero && !GENEROS_VALIDOS.has(String(out.genero).toUpperCase())) out.genero = null;
  if (out.estado_civil && !ESTADOS_CIVIL_VALIDOS.has(String(out.estado_civil).toUpperCase())) out.estado_civil = null;
  if (out.nivel_cargo && !NIVELES_CARGO_VALIDOS.has(String(out.nivel_cargo).toUpperCase())) out.nivel_cargo = 'JUNIOR';
  if (out.nivel_educacion && !NIVELES_EDUCACION_VALIDOS.has(String(out.nivel_educacion).toUpperCase())) out.nivel_educacion = null;
  if (out.jornada_tipo && !TIPOS_JORNADA_VALIDOS.has(String(out.jornada_tipo).toUpperCase())) out.jornada_tipo = 'DIURNA';
  if (out.tipo_cuenta && !TIPOS_CUENTA_VALIDOS.has(String(out.tipo_cuenta).toUpperCase())) out.tipo_cuenta = 'AHORROS';
  if (out.afp_tipo && !AFP_TIPOS_VALIDOS.has(String(out.afp_tipo).toUpperCase())) out.afp_tipo = 'RAZON';

  const dateFields = [
    'fecha_nacimiento', 'fecha_ingreso', 'fecha_fin_contrato', 'periodo_prueba_hasta',
    'fecha_etapa_lectiva_inicio', 'fecha_etapa_lectiva_fin', 'vencimiento_licencia',
  ];
  dateFields.forEach(f => {
    if (out[f] === '' || out[f] === undefined) { out[f] = null; }
    else if (typeof out[f] === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(out[f])) { out[f] = null; }
  });

  return out;
}

// ═══════════════════════════════════════════════════════════════
// Caché simple en memoria (TTL: 30 segundos para evitar
// recargas innecesarias en cambios rápidos de página / filtros)
// ═══════════════════════════════════════════════════════════════
const cache = { data: null, ts: 0, tenantId: null };
const CACHE_TTL_MS = 30_000;

// ═══════════════════════════════════════════════════════════════
// Hook principal
// ═══════════════════════════════════════════════════════════════
export function useEmployees() {
  const { tenant } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchEmployees = useCallback(async (force = false) => {
    if (!tenant) return;
    // Caché: si los datos son recientes y del mismo tenant, no recargar
    if (!force && cache.data && cache.tenantId === tenant.id && Date.now() - cache.ts < CACHE_TTL_MS) {
      if (mountedRef.current) setEmployees(cache.data);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .order('nombre');
      if (fetchErr) throw fetchErr;
      const result = data || [];
      // Guardar en caché
      cache.data = result;
      cache.ts = Date.now();
      cache.tenantId = tenant.id;
      if (mountedRef.current) setEmployees(result);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Invalida la caché (para usar después de mutaciones)
  const invalidateCache = useCallback(() => {
    cache.ts = 0;
    return fetchEmployees(true);
  }, [fetchEmployees]);

  const createEmployee = async (employeeData) => {
    const cleaned = cleanEmployeeData(employeeData);
    const { data, error: insertErr } = await supabase
      .from('employees')
      .insert([{ ...cleaned, tenant_id: tenant.id }])
      .select()
      .single();
    if (insertErr) throw insertErr;
    await invalidateCache();
    return data;
  };

  const updateEmployee = async (id, updates) => {
    const cleaned = cleanEmployeeData(updates);
    const { data, error: updateErr } = await supabase
      .from('employees')
      .update(cleaned)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    await invalidateCache();
    return data;
  };

  const deleteEmployee = async (id) => {
    const { error: deleteErr } = await supabase
      .from('employees')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (deleteErr) throw deleteErr;
    await invalidateCache();
  };

  return {
    employees, loading, error,
    fetchEmployees: () => fetchEmployees(true),
    createEmployee, updateEmployee, deleteEmployee,
    cleanEmployeeData,
  };
}
