import { createCrudHook } from './createCrudHook';
import { logger } from '../config/logger';
import {
  DEFAULT_HORAS_SEMANALES, MAX_HORAS_SEMANALES_POR_EMPLEADO,
  DEFAULT_HORAS_MENSUALES, DEFAULT_DIAS_DESCANSO,
  DEFAULT_NIVEL_ARL, MAX_NIVEL_ARL,
} from '../config/constants';

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
// Función de limpieza y validación (exportada, parte de la API)
// ═══════════════════════════════════════════════════════════════
export function cleanEmployeeData(data) {
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
    out.horas_semanales_contrato = DEFAULT_HORAS_SEMANALES;
  } else {
    const n = parseInt(String(out.horas_semanales_contrato), 10);
    out.horas_semanales_contrato = (isNaN(n) || n <= 0) ? DEFAULT_HORAS_SEMANALES : Math.min(n, MAX_HORAS_SEMANALES_POR_EMPLEADO);
  }

  if (out.horas_mensuales_contrato === '' || out.horas_mensuales_contrato === null) {
    out.horas_mensuales_contrato = DEFAULT_HORAS_MENSUALES;
  } else { const n = parseInt(String(out.horas_mensuales_contrato), 10); out.horas_mensuales_contrato = isNaN(n) ? null : n; }

  if (out.dias_descanso_semana === '' || out.dias_descanso_semana === null) {
    out.dias_descanso_semana = DEFAULT_DIAS_DESCANSO;
  } else { const n = parseInt(String(out.dias_descanso_semana), 10); out.dias_descanso_semana = (n === 1 || n === 2) ? n : DEFAULT_DIAS_DESCANSO; }

  if (out.nivel_riesgo_arl === '' || out.nivel_riesgo_arl === null) {
    out.nivel_riesgo_arl = DEFAULT_NIVEL_ARL;
  } else { const n = parseInt(String(out.nivel_riesgo_arl), 10); out.nivel_riesgo_arl = (isNaN(n) || n < 1 || n > MAX_NIVEL_ARL) ? DEFAULT_NIVEL_ARL : n; }

  if (out.tipo_contrato && !TIPOS_CONTRATO_VALIDOS.has(String(out.tipo_contrato).toUpperCase())) {
    logger.warn('useEmployees', `tipo_contrato inválido: "${out.tipo_contrato}" → INDEFINIDO`);
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
// Factory: hook CRUD base para employees
// ═══════════════════════════════════════════════════════════════
const useCrudEmployees = createCrudHook({
  tableName: 'employees',
  cacheTTL: 30_000,
  softDelete: true,
  queryModifier: (query) => query.eq('activo', true).order('nombre'),
  beforeCreate: cleanEmployeeData,
  beforeUpdate: cleanEmployeeData,
});

// ═══════════════════════════════════════════════════════════════
// Hook público (preserva API original)
// ═══════════════════════════════════════════════════════════════
export function useEmployees() {
  const {
    data: employees,
    loading,
    error,
    fetch: _fetch,
    create: createEmployee,
    update: updateEmployee,
    remove: deleteEmployee,
  } = useCrudEmployees();

  // API original: fetchEmployees() fuerza recarga (pasa force=true)
  const fetchEmployees = () => _fetch(true);

  return {
    employees, loading, error,
    fetchEmployees,
    createEmployee, updateEmployee, deleteEmployee,
    cleanEmployeeData,
  };
}
