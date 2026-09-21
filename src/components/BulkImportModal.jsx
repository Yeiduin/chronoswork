// ============================================================
// ChronosWork — Importación Masiva de Empleados (wrapper)
// Usa BulkImportModalGeneric internamente
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { useAuth } from '../context/AuthContext';
import { useAreas } from '../hooks/useAreas';
import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import {
  TIPOS_CONTRATO, SMLV_2025, SMLV_HORA_2025, AUX_TRANSPORTE_2025,
} from '../config/laborCatalog';
import {
  BANCOS_COLOMBIA,
  EPS_COLOMBIA,
  AFP_COLOMBIA,
  ARL_COLOMBIA,
  CAJAS_COMPENSACION_COLOMBIA,
  FONDOS_CESANTIAS_COLOMBIA,
  DEPARTAMENTOS_Y_CIUDADES,
} from '../config/colombiaCatalogs';
import { MdPeople, MdInfo } from 'react-icons/md';
import BulkImportModalGeneric, { parseNumero } from './BulkImportModalGeneric';

// ═══════════════════════════════════════════════════════════════
// Catálogos base optimizados
// ═══════════════════════════════════════════════════════════════
const TIPOS_CONTRATO_VALUES = TIPOS_CONTRATO.map(t => t.value);
const TIPOS_DOC = ['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'];
const GENEROS = ['M', 'F', 'OTRO', 'PREFIERO_NO_DECIR'];
const TIPOS_CUENTA = ['AHORROS', 'CORRIENTE'];
const JORNADAS_PREF = ['CUALQUIERA', 'DIURNA', 'NOCTURNA', 'MIXTA'];
const NIVELES_ARL = [1, 2, 3, 4, 5];

const EPS_LIST = EPS_COLOMBIA.map(e => e.nombre);
const AFP_LIST = AFP_COLOMBIA.map(a => a.nombre);
const ARL_LIST = ARL_COLOMBIA.map(a => a.nombre);
const DEPTOS_LIST = DEPARTAMENTOS_Y_CIUDADES.map(d => d.departamento);

// ═══════════════════════════════════════════════════════════════
// Mapeo de columnas (incluye soporte para plantilla ágil y aliases previos)
// ═══════════════════════════════════════════════════════════════
const COLUMN_ALIASES = {
  cedula:                   ['cedula', 'cédula', 'documento', 'cc', 'identificacion', 'identificación', 'dni'],
  tipo_documento:           ['tipo_documento', 'tipo documento', 'tipo doc', 'tipo_id', 'tipodoc'],
  nombre:                   ['nombre', 'nombre completo', 'nombres', 'name', 'empleado', 'colaborador'],
  telefono_contacto:        ['telefono', 'teléfono', 'celular', 'movil', 'móvil', 'phone', 'telefono_contacto'],
  email_personal:           ['email', 'correo', 'correo personal', 'mail', 'email_personal'],
  cargo:                    ['cargo', 'puesto', 'position', 'rol', 'job', 'ocupacion', 'ocupación'],
  area:                     ['area', 'área', 'seccion', 'sección'],
  turno_predeterminado:     ['turno_predeterminado', 'turno', 'franja', 'turno fijo', 'turno_fijo'],
  tipo_contrato:            ['tipo_contrato', 'tipo contrato', 'contrato', 'contract_type', 'modalidad'],
  fecha_ingreso:            ['fecha_ingreso', 'ingreso', 'fecha ingreso', 'f. ingreso'],
  fecha_fin_contrato:       ['fecha_fin', 'fin contrato', 'fecha terminacion', 'fecha_fin_contrato', 'fin_contrato'],
  horas_semanales_contrato: ['horas_semana', 'horas_semanales', 'horas semana', 'hrs_semana', 'horas_semanales_contrato'],
  dias_descanso_semana:     ['dias_descanso', 'dias descanso', 'días descanso', 'dias_descanso_semana', 'descansos', 'dias libres'],
  salario_mensual:          ['salario_mensual', 'salario', 'sueldo', 'salario base', 'sueldo mensual'],
  recibe_auxilio_transporte:['auxilio_transporte', 'recibe_auxilio', 'auxilio transporte', 'aux_transporte'],
  jornada_preferida:        ['jornada_preferida', 'jornada preferida', 'preferencia jornada', 'jornada_pref', 'jornada'],
  departamento:             ['departamento_residencia', 'depto', 'departamento', 'state', 'provincia'],
  ciudad:                   ['ciudad', 'city', 'municipio'],
  genero:                   ['genero', 'género', 'sexo'],
  eps_nombre:               ['eps', 'eps_nombre', 'salud'],
  afp_nombre:               ['afp', 'afp_nombre', 'pension', 'pensiones'],
  arl_nombre:               ['arl', 'arl_nombre', 'riesgos laborales'],
  nivel_riesgo_arl:         ['nivel_arl', 'nivel riesgo', 'nivel_riesgo_arl', 'nivel arl'],
  caja_compensacion:        ['caja', 'caja_compensacion', 'caja de compensacion', 'caja compensacion'],
  fondo_cesantias:          ['fondo_cesantias', 'cesantias', 'cesantías'],
  banco_nombre:             ['banco', 'banco_nombre', 'entidad bancaria'],
  tipo_cuenta:              ['tipo_cuenta', 'tipo cuenta'],
  numero_cuenta:            ['numero_cuenta', 'n° cuenta', 'n°_cuenta', 'cuenta'],
  // Campos heredados/compatibilidad
  valor_hora:               ['valor_hora', 'valor hora', 'salario hora', 'hourly_rate', 'tarifa hora'],
  es_especial:              ['es_especial', 'especial', 'salario especial'],
  lugar_expedicion:         ['lugar_expedicion', 'lugar expedicion', 'expedida en'],
  fecha_nacimiento:         ['fecha_nacimiento', 'nacimiento', 'f. nacimiento'],
  estado_civil:             ['estado_civil', 'estado civil'],
  numero_hijos:             ['numero_hijos', 'hijos', 'n° hijos'],
  direccion:                ['direccion', 'dirección', 'address'],
  nivel_cargo:              ['nivel_cargo', 'nivel', 'nivel cargo'],
  sector:                   ['sector', 'industria', 'rubro'],
  nivel_educacion:          ['nivel_educacion', 'nivel educativo', 'educacion'],
  horas_max_diarias:        ['horas_max_diarias', 'max horas dia'],
  horas_max_semana:         ['horas_max_semana', 'max horas semana'],
  horas_nocturnas_max_semana:['horas_nocturnas_max', 'max horas nocturnas'],
  permite_partido:         ['permite_partido', 'turno_partido'],
  dias_descanso_fijos:      ['dias_descanso_fijos', 'descansos fijos'],
  max_domingos_mes:        ['max_domingos', 'max domingos'],
  embarazada:              ['embarazada', 'embarazo', 'gestante'],
  email_institucional:     ['email_institucional', 'email trabajo', 'correo trabajo'],
};

// ═══════════════════════════════════════════════════════════════
// Helpers específicos de empleados
// ═══════════════════════════════════════════════════════════════
function parseFecha(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  return s;
}

function parseEntero(val) {
  const n = parseNumero(val);
  return n === null ? null : Math.round(n);
}

function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════
// Validación por fila
// ═══════════════════════════════════════════════════════════════
function validateEmployeeRow(row, areaNames) {
  const errors = [];
  if (!String(row.cedula || '').trim()) {
    errors.push({ campo: 'cedula', msg: 'Cédula obligatoria' });
  } else if (!/^\d{5,12}$/.test(String(row.cedula).replace(/\D/g, ''))) {
    errors.push({ campo: 'cedula', msg: `Cédula "${row.cedula}" inválida (5-12 dígitos)` });
  }
  if (!String(row.nombre || '').trim()) {
    errors.push({ campo: 'nombre', msg: 'Nombre obligatorio' });
  }
  if (!String(row.cargo || '').trim()) {
    errors.push({ campo: 'cargo', msg: 'Cargo obligatorio' });
  }
  if (!String(row.area || '').trim()) {
    errors.push({ campo: 'area', msg: 'Área obligatoria' });
  } else if (areaNames && !areaNames.includes(String(row.area).trim())) {
    errors.push({ campo: 'area', msg: `Área "${row.area}" no existe. Crea primero: ${areaNames.join(', ')}` });
  }
  if (row.tipo_contrato) {
    const u = String(row.tipo_contrato).trim().toUpperCase().replace(/\s+/g, '_');
    if (!TIPOS_CONTRATO_VALUES.includes(u)) {
      const recoverable = TIPOS_CONTRATO_VALUES.some(t => u.includes(t.replace(/_/g, ' ')) || u.includes(t));
      if (!recoverable) {
        errors.push({ campo: 'tipo_contrato', msg: `Tipo "${row.tipo_contrato}" inválido. Use: ${TIPOS_CONTRATO_VALUES.join(', ')}` });
      }
    }
  }
  if (row.tipo_documento) {
    const u = String(row.tipo_documento).trim().toUpperCase();
    if (!TIPOS_DOC.includes(u)) errors.push({ campo: 'tipo_documento', msg: `Tipo doc "${row.tipo_documento}" inválido` });
  }
  if (row.dias_descanso_semana !== undefined && row.dias_descanso_semana !== '') {
    const u = String(row.dias_descanso_semana).toUpperCase().trim();
    const validAliases = ['1', '2', 'D', 'S-D', 'SAB-DOM', 'DOMINGO'];
    if (!validAliases.includes(u)) {
      const n = parseInt(u, 10);
      if (isNaN(n) || (n !== 1 && n !== 2)) {
        errors.push({ campo: 'dias_descanso_semana', msg: `dias_descanso "${row.dias_descanso_semana}" no es válido` });
      }
    }
  }
  if (row.nivel_riesgo_arl) {
    const n = parseInt(row.nivel_riesgo_arl, 10);
    if (isNaN(n) || n < 1 || n > 5) {
      errors.push({ campo: 'nivel_riesgo_arl', msg: 'Nivel ARL debe ser 1-5' });
    }
  }
  return errors;
}

// ═══════════════════════════════════════════════════════════════
// Genera plantilla Excel de empleados (Ágil, con Selects oficiales)
// ═══════════════════════════════════════════════════════════════
async function generateTemplate({ areas, shiftTemplatesByArea, allShiftTemplates }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  const wsL = wb.addWorksheet('__listas__');
  wsL.state = 'veryHidden';
  wsL.getColumn(1).values = ['TipoContrato', ...TIPOS_CONTRATO_VALUES];
  wsL.getColumn(2).values = ['TipoDocumento', ...TIPOS_DOC];
  wsL.getColumn(3).values = ['Genero', ...GENEROS];
  wsL.getColumn(4).values = ['DiasDescanso', '1', '2'];
  wsL.getColumn(5).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsL.getColumn(6).values = ['TipoCuenta', 'AHORROS', 'CORRIENTE'];
  wsL.getColumn(7).values = ['JornadaPreferida', ...JORNADAS_PREF];
  wsL.getColumn(8).values = ['SiNo', 'Si', 'No'];
  wsL.getColumn(9).values = ['Area', ...(areas || []).map(a => a.nombre)];
  wsL.getColumn(10).values = ['EPS', ...EPS_LIST];
  wsL.getColumn(11).values = ['AFP', ...AFP_LIST];
  wsL.getColumn(12).values = ['ARL', ...ARL_LIST];
  wsL.getColumn(13).values = ['CajaCompensacion', ...CAJAS_COMPENSACION_COLOMBIA];
  wsL.getColumn(14).values = ['Banco', ...BANCOS_COLOMBIA];
  wsL.getColumn(15).values = ['FondoCesantias', ...FONDOS_CESANTIAS_COLOMBIA];
  wsL.getColumn(16).values = ['Departamento', ...DEPTOS_LIST];

  const wsT = wb.addWorksheet('__turnos_por_area__');
  wsT.state = 'veryHidden';
  let col = 1;
  const areaShiftMap = [];
  for (const area of (areas || [])) {
    const tpls = (shiftTemplatesByArea && shiftTemplatesByArea[area.id]) || [];
    if (tpls.length === 0) continue;
    const shiftNames = tpls.map(t => t.nombre);
    wsT.getColumn(col).values = [`${area.nombre}__turnos`, ...shiftNames];
    areaShiftMap.push({ areaId: area.id, areaName: area.nombre, ref: `__turnos_por_area__!${colLetter(col)}$2:${colLetter(col)}${shiftNames.length + 1}` });
    col++;
  }
  const allShifts = (allShiftTemplates || []).map(t => t.nombre);
  if (allShifts.length > 0) {
    wsT.getColumn(col).values = ['__todos_los_turnos__', ...allShifts];
  }

  const ws = wb.addWorksheet('Empleados', { views: [{ state: 'frozen', ySplit: 1 }] });

  const columns = [
    // 1. Identificación y contacto
    { k: 'cedula',                    w: 16, req: true,  l: 'cedula' },
    { k: 'tipo_documento',            w: 14, req: false, l: 'tipo_documento' },
    { k: 'nombre',                    w: 32, req: true,  l: 'nombre' },
    { k: 'telefono_contacto',         w: 18, req: false, l: 'telefono' },
    { k: 'email_personal',            w: 26, req: false, l: 'email' },
    // 2. Cargo y Asignación
    { k: 'cargo',                     w: 24, req: true,  l: 'cargo' },
    { k: 'area',                      w: 22, req: true,  l: 'area' },
    { k: 'turno_predeterminado',      w: 24, req: false, l: 'turno_predeterminado' },
    // 3. Contrato y Jornada
    { k: 'tipo_contrato',             w: 22, req: false, l: 'tipo_contrato' },
    { k: 'fecha_ingreso',             w: 14, req: false, l: 'fecha_ingreso' },
    { k: 'fecha_fin_contrato',        w: 16, req: false, l: 'fecha_fin_contrato' },
    { k: 'horas_semanales_contrato',   w: 14, req: false, l: 'horas_semana' },
    { k: 'dias_descanso_semana',      w: 14, req: false, l: 'dias_descanso' },
    { k: 'salario_mensual',           w: 18, req: false, l: 'salario_mensual' },
    { k: 'recibe_auxilio_transporte', w: 16, req: false, l: 'auxilio_transporte' },
    { k: 'jornada_preferida',         w: 18, req: false, l: 'jornada_preferida' },
    // 4. Ubicación y datos básicos
    { k: 'departamento',              w: 20, req: false, l: 'departamento' },
    { k: 'ciudad',                    w: 18, req: false, l: 'ciudad' },
    { k: 'genero',                    w: 12, req: false, l: 'genero' },
    // 5. Seguridad Social (Colombia)
    { k: 'eps_nombre',                w: 24, req: false, l: 'eps' },
    { k: 'afp_nombre',                w: 22, req: false, l: 'afp' },
    { k: 'arl_nombre',                w: 24, req: false, l: 'arl' },
    { k: 'nivel_riesgo_arl',          w: 12, req: false, l: 'nivel_arl' },
    { k: 'caja_compensacion',         w: 24, req: false, l: 'caja' },
    { k: 'fondo_cesantias',           w: 22, req: false, l: 'cesantias' },
    // 6. Nómina y Bancos
    { k: 'banco_nombre',              w: 24, req: false, l: 'banco' },
    { k: 'tipo_cuenta',               w: 14, req: false, l: 'tipo_cuenta' },
    { k: 'numero_cuenta',             w: 20, req: false, l: 'n°_cuenta' },
  ];

  ws.columns = columns.map(c => ({ header: c.l, key: c.k, width: c.w }));

  const hRow = ws.getRow(1);
  columns.forEach((c, i) => {
    const cell = ws.getCell(1, i + 1);
    if (c.req) {
      cell.value = c.l + ' *';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFBBF24' }, size: 11 };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FFD1D5DB' }, size: 11 };
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };
  });
  hRow.height = 30;

  const maxRow = 502;
  const ref = (colIdx, n) => `__listas__!${colLetter(colIdx)}$2:${colLetter(colIdx)}${n + 1}`;
  const refs = {
    tipoContrato: ref(1, TIPOS_CONTRATO_VALUES.length),
    tipoDoc: ref(2, TIPOS_DOC.length),
    genero: ref(3, GENEROS.length),
    diasDescanso: ref(4, 2),
    nivelARL: ref(5, NIVELES_ARL.length),
    tipoCuenta: ref(6, TIPOS_CUENTA.length),
    jornadaPref: ref(7, JORNADAS_PREF.length),
    siNo: ref(8, 2),
    area: ref(9, (areas || []).length),
    eps: ref(10, EPS_LIST.length),
    afp: ref(11, AFP_LIST.length),
    arl: ref(12, ARL_LIST.length),
    caja: ref(13, CAJAS_COMPENSACION_COLOMBIA.length),
    banco: ref(14, BANCOS_COLOMBIA.length),
    cesantias: ref(15, FONDOS_CESANTIAS_COLOMBIA.length),
    departamento: ref(16, DEPTOS_LIST.length),
  };

  for (let r = 2; r <= maxRow; r++) {
    const addList = (col, refsKey, opts) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [refs[refsKey]],
        showErrorMessage: true, errorStyle: 'stop',
        showInputMessage: true,
        ...opts,
      };
    };
    const addNum = (col, promptMsg) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Inválido', error: 'Número > 0',
        showInputMessage: true, promptTitle: '💰 Valor numérico', prompt: promptMsg,
      };
    };
    const addInt = (col, min, promptMsg) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [min],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Inválido', error: `Debe ser entero ≥ ${min}`,
        showInputMessage: true, promptTitle: '🔢 Entero', prompt: promptMsg,
      };
    };
    const addDate = (col, promptMsg) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'date', allowBlank: true,
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Fecha inválida', error: 'Use YYYY-MM-DD',
        showInputMessage: true, promptTitle: '📅 Fecha', prompt: promptMsg,
      };
    };

    // Col B: tipo_documento (select)
    addList('B', 'tipoDoc', { errorTitle: 'Tipo doc inválido', error: `Use: ${TIPOS_DOC.join(', ')}`, promptTitle: 'Tipo documento', prompt: TIPOS_DOC.join(', ') });
    // Col G: area (select)
    addList('G', 'area', { errorTitle: 'Área no existe', error: 'Crea primero el área en la app' });
    // Col H: turno_predeterminado (select)
    if (allShifts.length > 0) {
      const refTodos = `__turnos_por_area__!${colLetter(areaShiftMap.length + 1)}$2:${colLetter(areaShiftMap.length + 1)}${allShifts.length + 1}`;
      ws.getCell(`H${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [refTodos],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Turno inválido', error: 'Use un turno de los configurados',
        showInputMessage: true, promptTitle: '🕐 Turno', prompt: 'Selecciona un turno predeterminado del área',
      };
    }
    // Col I: tipo_contrato (select)
    addList('I', 'tipoContrato', { errorTitle: 'Tipo contrato inválido', error: `Use: ${TIPOS_CONTRATO_VALUES.join(', ')}`, promptTitle: 'Tipo de contrato', prompt: 'Selecciona modalidad del CST' });
    // Col J: fecha_ingreso (fecha)
    addDate('J', 'YYYY-MM-DD');
    // Col K: fecha_fin_contrato (fecha)
    addDate('K', 'YYYY-MM-DD (solo para término fijo u obra labor)');
    // Col L: horas_semana (entero)
    addInt('L', 1, 'Horas semanales de contrato (Ley 2101/2021: 42h)');
    // Col M: dias_descanso (select)
    addList('M', 'diasDescanso', { errorTitle: 'Inválido', error: '1 o 2', promptTitle: 'Días descanso', prompt: '1 o 2 días a la semana' });
    // Col N: salario_mensual (numérico)
    addNum('N', 'Salario mensual en COP. Si vacío, usa el del área.');
    // Col O: auxilio_transporte (select)
    addList('O', 'siNo', { errorTitle: 'Inválido', error: 'Si o No', promptTitle: 'Auxilio transporte', prompt: `Aplica para sueldos ≤ 2 SMLV ($${AUX_TRANSPORTE_2025.toLocaleString('es-CO')} en 2025)` });
    // Col P: jornada_preferida (select)
    addList('P', 'jornadaPref', { errorTitle: 'Inválido', error: `Use: ${JORNADAS_PREF.join(', ')}`, promptTitle: 'Jornada preferida', prompt: 'CUALQUIERA, DIURNA, NOCTURNA o MIXTA' });
    // Col Q: departamento (select)
    addList('Q', 'departamento', { errorTitle: 'Inválido', error: 'Seleccione un departamento de Colombia', promptTitle: 'Departamento', prompt: 'Departamento de residencia' });
    // Col S: genero (select)
    addList('S', 'genero', { errorTitle: 'Género inválido', error: `Use: ${GENEROS.join(', ')}`, promptTitle: 'Género', prompt: 'M, F, OTRO, PREFIERO_NO_DECIR' });
    // Col T: eps (select)
    addList('T', 'eps', { errorTitle: 'EPS no reconocida', error: 'Seleccione de la lista o digite el nombre', promptTitle: '🏥 EPS', prompt: 'EPS oficial de Colombia' });
    // Col U: afp (select)
    addList('U', 'afp', { errorTitle: 'AFP no reconocida', error: 'Seleccione de la lista o digite el nombre', promptTitle: '🏦 AFP', prompt: 'Fondo de pensiones' });
    // Col V: arl (select)
    addList('V', 'arl', { errorTitle: 'ARL no reconocida', error: 'Seleccione de la lista o digite el nombre', promptTitle: '⛑️ ARL', prompt: 'Aseguradora de riesgos laborales' });
    // Col W: nivel_arl (select)
    addList('W', 'nivelARL', { errorTitle: 'Inválido', error: '1 a 5', promptTitle: 'Nivel ARL', prompt: '1 (Oficina) a 5 (Alto riesgo)' });
    // Col X: caja (select)
    addList('X', 'caja', { errorTitle: 'Caja no reconocida', error: 'Seleccione de la lista o digite el nombre', promptTitle: '💼 Caja de compensación', prompt: 'Caja de compensación familiar' });
    // Col Y: cesantias (select)
    addList('Y', 'cesantias', { errorTitle: 'Fondo no reconocido', error: 'Seleccione de la lista o digite el nombre', promptTitle: '💰 Fondo de cesantías', prompt: 'Porvenir, Protección, FNA, etc.' });
    // Col Z: banco (select)
    addList('Z', 'banco', { errorTitle: 'Banco no reconocido', error: 'Seleccione de la lista o digite el nombre', promptTitle: '🏦 Banco / Billetera', prompt: 'Bancolombia, Davivienda, Nequi, etc.' });
    // Col AA: tipo_cuenta (select)
    addList('AA', 'tipoCuenta', { errorTitle: 'Inválido', error: 'AHORROS o CORRIENTE', promptTitle: 'Tipo de cuenta', prompt: 'AHORROS o CORRIENTE' });
  }

  ws.autoFilter = { from: 'A1', to: `${colLetter(columns.length)}1` };

  const wsInfo = wb.addWorksheet('📋 Guía de uso');
  wsInfo.getColumn(1).width = 35;
  wsInfo.getColumn(2).width = 80;
  const guias = [
    ['CHRONOSWORK — Plantilla Ágil de Empleados', ''],
    ['', ''],
    ['⚠️ COLUMNAS OBLIGATORIAS (Solo 4)', 'cedula, nombre, cargo, area'],
    ['', ''],
    ['COLUMNA', 'DESCRIPCIÓN Y SELECTS'],
    ['cedula *', 'Cédula o documento de identidad (5-12 dígitos).'],
    ['tipo_documento', `Desplegable con tipo de doc: ${TIPOS_DOC.join(', ')}`],
    ['nombre *', 'Nombre completo del colaborador.'],
    ['telefono', 'Número telefónico o celular.'],
    ['email', 'Correo electrónico personal.'],
    ['cargo *', 'Cargo o posición del empleado.'],
    ['area *', `Desplegable con TUS áreas reales: ${(areas || []).map(a => a.nombre).join(', ') || '(primero crea áreas)'}`],
    ['turno_predeterminado', 'Desplegable con turnos disponibles en tu empresa.'],
    ['tipo_contrato', `Desplegable con modalidades del CST Colombia: ${TIPOS_CONTRATO_VALUES.join(', ')}`],
    ['fecha_ingreso', 'Fecha de ingreso en formato YYYY-MM-DD.'],
    ['fecha_fin_contrato', 'YYYY-MM-DD. Opcional (término fijo / obra labor).'],
    ['horas_semana', 'Horas semanales de contrato. Por defecto: 42 (Ley 2101/2021).'],
    ['dias_descanso', 'Desplegable: 1 o 2 días de descanso semanal.'],
    ['salario_mensual', 'Salario mensual en COP. Si se deja vacío, toma el del área.'],
    ['auxilio_transporte', 'Desplegable: Si o No (aplica para sueldos ≤ 2 SMLV).'],
    ['jornada_preferida', 'Desplegable: CUALQUIERA, DIURNA, NOCTURNA, MIXTA.'],
    ['departamento', 'Desplegable con los 33 departamentos de Colombia.'],
    ['ciudad', 'Ciudad o municipio de residencia.'],
    ['genero', `Desplegable: ${GENEROS.join(', ')}`],
    ['eps', 'Desplegable con todas las EPS de Colombia (Sura, Sanitas, Compensar, Nueva EPS, etc.)'],
    ['afp', 'Desplegable con fondos de pensión (Porvenir, Protección, Colfondos, Skandia, Colpensiones)'],
    ['arl', 'Desplegable con ARLs (ARL Sura, Positiva, Seguros Bolívar, etc.)'],
    ['nivel_arl', 'Desplegable: 1 a 5.'],
    ['caja', 'Desplegable con Cajas de Compensación Familiar (Compensar, Comfama, Comfenalco, etc.)'],
    ['cesantias', 'Desplegable con Fondos de Cesantías (Porvenir, Protección, FNA, etc.)'],
    ['banco', 'Desplegable con bancos y billeteras digitales (Bancolombia, Davivienda, Nequi, Daviplata, etc.)'],
    ['tipo_cuenta', 'Desplegable: AHORROS o CORRIENTE.'],
    ['n°_cuenta', 'Número de cuenta para consignación de nómina.'],
    ['', ''],
    ['⭐ VENTAJAS DE ESTA PLANTILLA', ''],
    ['• Rediseñada para ser rápida y fácil: los campos innecesarios fueron eliminados.', ''],
    ['• Casi todas las columnas tienen listas desplegables (selects) nativas en Excel para evitar errores de tipeo.', ''],
    ['• Si dejas campos vacíos, el sistema aplica automáticamente valores estándar de ley o los valores por defecto del área.', ''],
    ['• Si tu EPS/AFP/Banco no figura en la sugerencia, también puedes escribirla manualmente.', ''],
  ];
  guias.forEach((row, i) => {
    const r = wsInfo.addRow(row);
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
      r.height = 26;
    } else if ([2, 4, '⭐ VENTAJAS DE ESTA PLANTILLA'].includes(row[0])) {
      r.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      r.height = 20;
    } else if (row[0] && row[0].includes('*')) {
      r.getCell(1).font = { color: { argb: 'FFFBBF24' }, bold: true };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_empleados_chronoswork.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// Preview columns
// ═══════════════════════════════════════════════════════════════
const PREVIEW_COLUMNS = [
  { key: 'cedula',  label: 'Cédula' },
  { key: 'nombre',  label: 'Nombre' },
  { key: 'cargo',   label: 'Cargo' },
  { key: 'area',    label: 'Área' },
  { key: 'tipo_contrato', label: 'Contrato', format: (v) => v || '—' },
  { key: 'salario_mensual', label: 'Salario', format: (v) => parseNumero(v)?.toLocaleString('es-CO') || '—' },
  { key: 'banco_nombre', label: 'Banco', format: (v) => v || '—' },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENTE WRAPPER
// ═══════════════════════════════════════════════════════════════
export default function BulkImportModal({ areas = [], onClose, onBulkSave }) {
  const { tenant } = useAuth();
  const { areas: areasFromHook } = useAreas();
  const [useAreaDefaultSalario, setUseAreaDefaultSalario] = useState(true);

  // Shift templates
  const [shiftTemplatesByArea, setShiftTemplatesByArea] = useState({});
  const [allShiftTemplates, setAllShiftTemplates] = useState([]);

  useEffect(() => {
    let active = true;
    const loadTemplates = async () => {
      if (!tenant) return;
      const tenantAreas = areas.length > 0 ? areas : areasFromHook;
      if (!tenantAreas.length) return;
      const { data, error } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('activo', true);
      if (error) { logger.error('BulkImportModal', error); return; }
      if (!active) return;
      const all = data || [];
      setAllShiftTemplates(all);
      const byArea = {};
      for (const t of all) {
        if (t.area_id) {
          if (!byArea[t.area_id]) byArea[t.area_id] = [];
          byArea[t.area_id].push(t);
        }
      }
      setShiftTemplatesByArea(byArea);
    };
    loadTemplates();
    return () => { active = false; };
  }, [tenant, areas, areasFromHook]);

  const finalAreas = areas.length > 0 ? areas : areasFromHook;
  const areaNames = useMemo(() => finalAreas.map(a => a.nombre), [finalAreas]);

  // ── Validación (closure sobre areaNames) ────────────────────
  const validateRow = useCallback((row) => {
    return validateEmployeeRow(row, areaNames);
  }, [areaNames]);

  // ── Normalización ──────────────────────────────────────────
  const normFn = useCallback((field, val) => {
    if (val === null || val === undefined || val === '') return null;
    const s = String(val).trim();
    switch (field) {
      case 'tipo_contrato': {
        const u = s.toUpperCase().replace(/\s+/g, '_');
        if (TIPOS_CONTRATO_VALUES.includes(u)) return u;
        if (u.includes('INDEFINIDO')) return 'INDEFINIDO';
        if (u.includes('TERMINO') && u.includes('FIJO')) return 'TERMINO_FIJO';
        if (u.includes('OBRA') || u.includes('LABOR')) return 'OBRA_LABOR';
        if (u.includes('HORA')) return 'POR_HORAS';
        if (u.includes('FIJO') || u === 'MENSUAL') return 'SALARIO_FIJO';
        if (u.includes('PRESTACION')) return 'PRESTACION_SERVICIOS';
        if (u.includes('APRENDIZ') || u === 'SENA') return 'APRENDIZAJE';
        if (u.includes('OCASIONAL')) return 'OCASIONAL';
        if (u.includes('TEMPORAL') || u === 'EST') return 'TEMPORAL';
        return null;
      }
      case 'dias_descanso_semana': {
        const u = s.toUpperCase();
        if (['1', 'D', 'DOMINGO'].includes(u)) return 1;
        if (['2', 'S-D', 'SAB-DOM', 'FIN_DE_SEMANA'].includes(u)) return 2;
        const n = parseInt(u, 10);
        return (n === 1 || n === 2) ? n : null;
      }
      case 'es_especial':
      case 'recibe_auxilio_transporte': {
        const u = s.toLowerCase();
        if (['no', 'false', '0'].includes(u)) return false;
        return true;
      }
      default:
        return val;
    }
  }, []);

  // ── Template ───────────────────────────────────────────────
  const handleGenerateTemplate = useCallback(async () => {
    await generateTemplate({ areas: finalAreas, shiftTemplatesByArea, allShiftTemplates });
  }, [finalAreas, shiftTemplatesByArea, allShiftTemplates]);

  // ── Import ─────────────────────────────────────────────────
  const handleImport = useCallback(async (validRows, setProgress) => {
    let successCount = 0;
    const errorList = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const areaObj = finalAreas.find(a => a.nombre.toLowerCase() === String(row.area).trim().toLowerCase());
        const valorHora = parseNumero(row.valor_hora);
        const salarioMensual = parseNumero(row.salario_mensual);
        const tipoContrato = normFn('tipo_contrato', row.tipo_contrato)
          || (areaObj?.tipo_contrato_predominante) || 'INDEFINIDO';
        const diasDescanso = normFn('dias_descanso_semana', row.dias_descanso_semana)
          || (areaObj?.dias_descanso_default) || 1;
        const nivelArl = row.nivel_riesgo_arl ? (parseInt(row.nivel_riesgo_arl, 10) || 1) : 1;
        const horasSemanales = row.horas_semanales_contrato ? parseInt(row.horas_semanales_contrato, 10) : 42;

        const employeeData = {
          tipo_documento: row.tipo_documento ? String(row.tipo_documento).toUpperCase().trim() : 'CC',
          cedula: String(row.cedula).replace(/\D/g, '').trim(),
          nombre: String(row.nombre).trim(),
          lugar_expedicion: row.lugar_expedicion ? String(row.lugar_expedicion).trim() : null,
          fecha_nacimiento: row.fecha_nacimiento ? parseFecha(row.fecha_nacimiento) : null,
          genero: row.genero ? String(row.genero).toUpperCase().trim() : null,
          estado_civil: row.estado_civil ? String(row.estado_civil).toUpperCase().trim() : null,
          numero_hijos: parseEntero(row.numero_hijos) ?? 0,
          telefono_contacto: row.telefono_contacto ? String(row.telefono_contacto).trim() : null,
          email_personal: row.email_personal ? String(row.email_personal).trim() : null,
          direccion: row.direccion ? String(row.direccion).trim() : null,
          ciudad: row.ciudad ? String(row.ciudad).trim() : null,
          departamento: row.departamento ? String(row.departamento).trim() : null,
          cargo: String(row.cargo).trim(),
          nivel_cargo: row.nivel_cargo ? String(row.nivel_cargo).toUpperCase().trim() : 'JUNIOR',
          tipo_contrato: tipoContrato,
          fecha_ingreso: row.fecha_ingreso ? parseFecha(row.fecha_ingreso) : new Date().toISOString().slice(0, 10),
          fecha_fin_contrato: row.fecha_fin_contrato ? parseFecha(row.fecha_fin_contrato) : null,
          horas_semanales_contrato: horasSemanales > 0 && horasSemanales <= 168 ? horasSemanales : 42,
          dias_descanso_semana: diasDescanso,
          valor_hora: valorHora ?? (useAreaDefaultSalario && areaObj ? parseFloat(areaObj.valor_hora_default) : SMLV_HORA_2025),
          salario_mensual: salarioMensual ?? (valorHora ? Math.round(valorHora * 182) : (useAreaDefaultSalario && areaObj ? Math.round(parseFloat(areaObj.valor_hora_default) * 182) : SMLV_2025)),
          es_especial: normFn('es_especial', row.es_especial) || (valorHora === null && !useAreaDefaultSalario),
          recibe_auxilio_transporte: normFn('recibe_auxilio_transporte', row.recibe_auxilio_transporte),
          eps_nombre: row.eps_nombre ? String(row.eps_nombre).trim() : null,
          afp_nombre: row.afp_nombre ? String(row.afp_nombre).trim() : null,
          arl_nombre: row.arl_nombre ? String(row.arl_nombre).trim() : null,
          nivel_riesgo_arl: nivelArl,
          caja_compensacion: row.caja_compensacion ? String(row.caja_compensacion).trim() : null,
          fondo_cesantias: row.fondo_cesantias ? String(row.fondo_cesantias).trim() : null,
          banco_nombre: row.banco_nombre ? String(row.banco_nombre).trim() : null,
          tipo_cuenta: row.tipo_cuenta ? String(row.tipo_cuenta).toUpperCase().trim() : 'AHORROS',
          numero_cuenta: row.numero_cuenta ? String(row.numero_cuenta).trim() : null,
          nivel_educacion: row.nivel_educacion ? String(row.nivel_educacion).toUpperCase().trim() : null,
          sector: row.sector ? String(row.sector).toUpperCase().trim() : null,
          // Campos de jornada v4
          jornada_preferida: row.jornada_preferida ? String(row.jornada_preferida).toUpperCase().trim() : 'CUALQUIERA',
          solo_diurno: String(row.jornada_preferida || '').toUpperCase().trim() === 'DIURNA',
          solo_nocturno: String(row.jornada_preferida || '').toUpperCase().trim() === 'NOCTURNA',
          horas_max_diarias: row.horas_max_diarias ? parseFloat(row.horas_max_diarias) : null,
          horas_max_semana: row.horas_max_semana ? parseFloat(row.horas_max_semana) : null,
          horas_nocturnas_max_semana: row.horas_nocturnas_max_semana ? parseInt(row.horas_nocturnas_max_semana, 10) : null,
          permite_partido: normFn('permite_partido', row.permite_partido) ?? false,
          dias_descanso_fijos: row.dias_descanso_fijos ? String(row.dias_descanso_fijos).split(',').map(d => parseInt(d.trim(), 10)).filter(d => d >= 1 && d <= 7) : null,
          max_domingos_mes: row.max_domingos_mes ? parseInt(row.max_domingos_mes, 10) : null,
          embarazada: normFn('embarazada', row.embarazada) ?? false,
          email_institucional: row.email_institucional ? String(row.email_institucional).trim() : null,
          activo: true,
        };

        if (row.turno_predeterminado && areaObj) {
          const tpl = (shiftTemplatesByArea[areaObj.id] || []).find(
            t => t.nombre.toLowerCase() === String(row.turno_predeterminado).toLowerCase()
          );
          if (tpl) employeeData.turno_predeterminado_id = tpl.id;
        }

        const saved = await onBulkSave(employeeData);
        if (areaObj && saved?.id) {
          // ⚠️ Filtrar por tenant_id en el delete: sin él, en multi-tenant
          // borraría asignaciones de otros tenants para el mismo employee_id.
          const { error: delErr } = await supabase.from('area_employees')
            .delete().eq('employee_id', saved.id).eq('tenant_id', tenant.id);
          if (delErr) logger.warn('BulkImportModal', 'Error al limpiar asignación previa:', delErr.message);
          const { error: insErr } = await supabase.from('area_employees')
            .insert([{ area_id: areaObj.id, employee_id: saved.id, tenant_id: tenant.id }]);
          if (insErr) logger.warn('BulkImportModal', 'Error al asignar área:', insErr.message);
        }
        successCount++;
      } catch (err) {
        const msg = err?.message || String(err);
        const hint = err?.hint || err?.details ? ` (${err.details || err.hint})` : '';
        if (/schema cache|column .* (of|not found)/i.test(msg)) {
          errorList.push({
            row: row._row,
            nombre: row.nombre,
            msg: `Columna inexistente en BD: ${msg.replace(/.*'([^']+)'.*'([^']+)'.*/, "$2.$1")}${hint}`,
          });
        } else {
          errorList.push({ row: row._row, nombre: row.nombre, msg: `${msg}${hint}` });
        }
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    return { success: successCount, errors: errorList };
  }, [finalAreas, tenant, useAreaDefaultSalario, shiftTemplatesByArea, onBulkSave, normFn]);

  // ── Upload info ────────────────────────────────────────────
  const uploadInfoContent = (
    <>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
        <MdInfo style={{ color: '#34d399' }} /> Plantilla ágil con 28 columnas optimizadas y menús desplegables (selects)
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Solo <strong>cédula, nombre, cargo y área</strong> son obligatorios.
        Casi todas las demás columnas (EPS, AFP, ARL, Bancos, Cajas, Cesantías, Contratos, Departamentos, Descansos, etc.)
        tienen listas desplegables oficiales para diligenciamiento rápido y sin errores.
      </div>
    </>
  );

  // ── Upload extras (checkboxes + áreas detectadas) ──────────
  const uploadExtras = (
    <>
      {finalAreas.length === 0 && (
        <div className="cw-alert cw-alert--warning">
          ⚠️ Aún no has creado áreas. Crea al menos una en la sección de Áreas antes de importar empleados.
        </div>
      )}

      {finalAreas.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          <strong>📋 {finalAreas.length} áreas detectadas:</strong>
          {finalAreas.slice(0, 8).map(a => (
            <span key={a.id} style={{ background: a.color + '20', color: a.color, padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.7rem' }}>
              ● {a.nombre}
            </span>
          ))}
          {finalAreas.length > 8 && <span style={{ color: 'var(--text-muted)' }}>... y {finalAreas.length - 8} más</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={useAreaDefaultSalario} onChange={e => setUseAreaDefaultSalario(e.target.checked)} />
          <span>Usar salario del área si no se especifica valor_hora en el archivo</span>
        </label>
      </div>
    </>
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <BulkImportModalGeneric
      title="Importación Masiva de Empleados"
      icon={<MdPeople />}
      entityName="empleado"
      entityNamePlural="empleados"
      columnAliases={COLUMN_ALIASES}
      validateRow={validateRow}
      generateTemplate={handleGenerateTemplate}
      templateButtonLabel={`Descargar plantilla con TUS áreas (${finalAreas.length}) y TUS turnos`}
      templateButtonDisabled={finalAreas.length === 0}
      onImport={handleImport}
      uploadInfoContent={uploadInfoContent}
      uploadExtras={uploadExtras}
      previewColumns={PREVIEW_COLUMNS}
      previewRowKey="nombre"
      importingMessage="Asignando a áreas"
      onClose={onClose}
      maxWidth={880}
    />
  );
}
