// ============================================================
// ChronosWork — Importación Masiva de Empleados v4
// Plantilla con TODOS los catálogos del usuario como dropdowns:
//   - Áreas del tenant (no hardcoded)
//   - Tipos de contrato del CST
//   - Sectores, niveles ARL, tipos de documento, etc.
//   - Turnos/franjas de cada área
//   - Bancos, EPS, AFP, ARL, Cajas registrados en la app
// ============================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { useAuth } from '../context/AuthContext';
import { useAreas } from '../hooks/useAreas';
import { useShiftTemplates } from '../hooks/useShiftTemplates';
import { supabase } from '../config/supabaseClient';
import {
  TIPOS_CONTRATO, SMLV_2025, SMLV_HORA_2025, AUX_TRANSPORTE_2025,
  SECTORES, TIPOS_JORNADA, PATRONES_ROTATIVOS,
} from '../config/laborCatalog';
import {
  MdClose, MdUpload, MdDownload, MdCheckCircle, MdError, MdWarning,
  MdInfo, MdTableChart, MdPeople, MdDomain,
} from 'react-icons/md';

// ═══════════════════════════════════════════════════════════════
// Catálogos base (los que vienen del CST, no cambian por tenant)
// ═══════════════════════════════════════════════════════════════
const TIPOS_CONTRATO_VALUES = TIPOS_CONTRATO.map(t => t.value);
const TIPOS_DOC = ['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'];
const GENEROS = ['M', 'F', 'OTRO', 'PREFIERO_NO_DECIR'];
const ESTADOS_CIVIL = ['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO', 'SEPARADO'];
const NIVELES_EDUCATIVOS = ['NINGUNO', 'PRIMARIA', 'BACHILLERATO', 'TECNICO', 'TECNOLOGO', 'PREGRADO', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'];
const NIVELES_ARL = [1, 2, 3, 4, 5];
const NIVELES_CARGO = ['JUNIOR', 'SENIOR', 'COORDINADOR', 'SUPERVISOR', 'JEFE', 'GERENTE', 'DIRECTOR'];
const TIPOS_CUENTA = ['AHORROS', 'CORRIENTE'];
const MODOS_OPERACION = ['OFICINA', '24_7'];
const JORNADAS_VALUES = TIPOS_JORNADA.map(j => j.value);
const PATRONES_VALUES = PATRONES_ROTATIVOS.map(p => p.value);

// EPS, AFP, ARL, Cajas y Bancos más comunes (también se pueden
// agregar desde el dropdown si el usuario completa el campo libre)
const EPS_COMUNES = [
  'Nueva EPS', 'Sanitas', 'Sura EPS', 'Compensar EPS', 'Famisanar',
  'Salud Total', 'Coomeva', 'Medimás', 'Aliansalud', 'Cajacopi EPS',
  'Mutual Ser', 'EPS Sanitas', 'Savia Salud', 'Dusakawi',
];
const AFP_COMUNES = [
  'Porvenir', 'Protección', 'Colfondos', 'Skandia',
  'Cafam', 'Colpensiones',
];
const ARL_COMUNES = [
  'Sura ARL', 'Positiva ARL', 'Bolívar ARL', 'Colmena Seguros ARL',
  'Liberty Seguros ARL', 'Mapfre ARL', 'La Equidad Seguros',
];
const CAJAS_COMUNES = [
  'Compensar', 'Comfama', 'Comfenalco Antioquia', 'Comfandi', 'Cajacopi',
  'Comfamiliar Atlántico', 'Comfenalco Quindío', 'Confandi',
];
const BANCOS_COMUNES = [
  'Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Banco de Occidente',
  'Banco Popular', 'Scotiabank Colpatria', 'Banco Agrario', 'Banco AV Villas',
  'Banco Caja Social', 'Banco Falabella', 'Banco Pichincha', 'Banco Itaú',
  'Nequi', 'Daviplata',
];
const FONDOS_CESANTIAS = [
  'Porvenir', 'Protección', 'Colfondos', 'BBVA', 'Fondo Nacional del Ahorro',
  'Skandia', 'Cafam',
];

// ═══════════════════════════════════════════════════════════════
// Mapeo de columnas (tolerante a variaciones)
// ═══════════════════════════════════════════════════════════════
const COLUMN_ALIASES = {
  cedula:                   ['cedula', 'cédula', 'documento', 'cc', 'identificacion', 'identificación', 'dni'],
  tipo_documento:           ['tipo_documento', 'tipo documento', 'tipo doc', 'tipo_id'],
  nombre:                   ['nombre', 'nombre completo', 'nombres', 'name', 'empleado', 'colaborador'],
  lugar_expedicion:         ['lugar_expedicion', 'lugar expedicion', 'expedida en'],
  fecha_nacimiento:         ['fecha_nacimiento', 'nacimiento', 'f. nacimiento', 'fecha nac'],
  genero:                   ['genero', 'género', 'sexo'],
  estado_civil:             ['estado_civil', 'estado civil'],
  numero_hijos:             ['numero_hijos', 'hijos', 'n° hijos', 'cantidad hijos'],
  telefono_contacto:        ['telefono', 'teléfono', 'celular', 'movil', 'móvil', 'phone'],
  email_personal:           ['email', 'correo', 'correo personal', 'mail'],
  direccion:                ['direccion', 'dirección', 'address'],
  ciudad:                   ['ciudad', 'city'],
  departamento:             ['departamento', 'state', 'provincia'],
  cargo:                    ['cargo', 'puesto', 'position', 'rol', 'job', 'ocupacion', 'ocupación'],
  nivel_cargo:              ['nivel_cargo', 'nivel', 'nivel cargo'],
  area:                     ['area', 'área', 'departamento', 'department', 'seccion', 'sección'],
  turno_predeterminado:     ['turno_predeterminado', 'turno', 'franja', 'turno fijo'],
  tipo_contrato:            ['tipo_contrato', 'tipo contrato', 'contrato', 'contract_type', 'modalidad'],
  fecha_ingreso:            ['fecha_ingreso', 'ingreso', 'fecha ingreso', 'f. ingreso'],
  fecha_fin_contrato:       ['fecha_fin', 'fin contrato', 'fecha terminacion', 'fecha_fin_contrato'],
  horas_semanales_contrato: ['horas_semanales', 'horas semana', 'hrs_semana', 'horas_semanales_contrato'],
  dias_descanso_semana:     ['dias_descanso', 'dias descanso', 'días descanso', 'dias_descanso_semana', 'descansos', 'dias libres'],
  valor_hora:               ['valor_hora', 'valor hora', 'salario hora', 'hourly_rate', 'tarifa hora', 'valor/hora'],
  salario_mensual:          ['salario_mensual', 'salario', 'sueldo', 'salario base', 'sueldo mensual'],
  es_especial:              ['es_especial', 'especial', 'salario especial', 'personalizado'],
  recibe_auxilio_transporte:['recibe_auxilio', 'auxilio transporte', 'aux_transporte'],
  eps_nombre:               ['eps', 'eps_nombre', 'salud'],
  afp_nombre:               ['afp', 'afp_nombre', 'pension', 'pensiones'],
  arl_nombre:               ['arl', 'arl_nombre', 'riesgos laborales'],
  nivel_riesgo_arl:         ['nivel_arl', 'nivel riesgo', 'nivel_riesgo_arl'],
  caja_compensacion:        ['caja', 'caja_compensacion', 'caja de compensacion'],
  fondo_cesantias:          ['fondo_cesantias', 'cesantias'],
  banco_nombre:             ['banco', 'banco_nombre', 'entidad bancaria'],
  tipo_cuenta:              ['tipo_cuenta', 'tipo cuenta'],
  numero_cuenta:            ['numero_cuenta', 'n° cuenta', 'cuenta'],
  nivel_educacion:          ['nivel_educacion', 'nivel educativo', 'educacion', 'estudios'],
  sector:                   ['sector', 'industria', 'rubro'],
};

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function normalizeH(h) {
  return String(h || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[*\s]+$/, '').trim();
}

function findCol(headers, aliases) {
  // 1) exacto
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h) === a);
    if (i !== -1) return i;
  }
  // 2) contiene
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h).includes(a));
    if (i !== -1) return i;
  }
  return -1;
}

function buildColumnIndexes(headers) {
  const map = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    map[field] = findCol(headers, aliases);
  }
  return map;
}

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

function parseNumero(val) {
  if (val === null || val === undefined || val === '') return null;
  const v = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseEntero(val) {
  const n = parseNumero(val);
  return n === null ? null : Math.round(n);
}

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  return ['si', 'sí', 'yes', 'true', '1', 'x', '✓'].includes(String(val || '').toLowerCase().trim());
}

function findDataSheet(wb) {
  for (const sn of wb.SheetNames) {
    if (sn.startsWith('__')) continue;
    if (sn.toLowerCase().includes('guía') || sn.toLowerCase().includes('guia')) continue;
    if (sn.toLowerCase().includes('instrucciones')) continue;
    if (sn.toLowerCase().includes('readme')) continue;
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
    if (json.length < 2) continue;
    const headers = (json[0] || []).map(h => normalizeH(h));
    if (headers.some(h => ['nombre', 'name', 'area', 'área'].some(a => h === a || h.includes(a)))) {
      return sn;
    }
  }
  return wb.SheetNames.find(sn => !sn.startsWith('__')) || wb.SheetNames[0];
}

// ═══════════════════════════════════════════════════════════════
// Validación por fila
// ═══════════════════════════════════════════════════════════════
function validateRow(row, areas, areaNames) {
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
// Genera la plantilla Excel con TODOS los catálogos del tenant
// ═══════════════════════════════════════════════════════════════
async function generateTemplate({ areas, shiftTemplatesByArea, allShiftTemplates }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  // ── Hoja oculta con listas desplegables ──
  const wsL = wb.addWorksheet('__listas__');
  wsL.state = 'veryHidden';
  wsL.getColumn(1).values = ['TipoContrato', ...TIPOS_CONTRATO_VALUES];
  wsL.getColumn(2).values = ['TipoDocumento', ...TIPOS_DOC];
  wsL.getColumn(3).values = ['Genero', ...GENEROS];
  wsL.getColumn(4).values = ['EstadoCivil', ...ESTADOS_CIVIL];
  wsL.getColumn(5).values = ['DiasDescanso', '1', '2'];
  wsL.getColumn(6).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsL.getColumn(7).values = ['TipoCuenta', 'AHORROS', 'CORRIENTE'];
  wsL.getColumn(8).values = ['NivelEducacion', ...NIVELES_EDUCATIVOS];
  wsL.getColumn(9).values = ['NivelCargo', ...NIVELES_CARGO];
  wsL.getColumn(10).values = ['Sector', ...SECTORES.map(s => s.value)];
  wsL.getColumn(11).values = ['ModoOperacion', 'OFICINA', '24_7'];
  wsL.getColumn(12).values = ['JornadaTipo', ...JORNADAS_VALUES];
  wsL.getColumn(13).values = ['Patron', ...PATRONES_VALUES];
  wsL.getColumn(14).values = ['SiNo', 'Si', 'No'];
  wsL.getColumn(15).values = ['Area', ...(areas || []).map(a => a.nombre)];
  wsL.getColumn(16).values = ['EPS', ...EPS_COMUNES];
  wsL.getColumn(17).values = ['AFP', ...AFP_COMUNES];
  wsL.getColumn(18).values = ['ARL', ...ARL_COMUNES];
  wsL.getColumn(19).values = ['CajaCompensacion', ...CAJAS_COMUNES];
  wsL.getColumn(20).values = ['Banco', ...BANCOS_COMUNES];
  wsL.getColumn(21).values = ['FondoCesantias', ...FONDOS_CESANTIAS];

  // Hoja de turnos por área
  const wsT = wb.addWorksheet('__turnos_por_area__');
  wsT.state = 'veryHidden';
  let col = 1;
  const areaShiftMap = []; // [{areaId, areaName, shiftNames, ref}]
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

  // ── Hoja principal: Empleados ──
  const ws = wb.addWorksheet('Empleados', { views: [{ state: 'frozen', ySplit: 1 }] });

  const columns = [
    // Identidad
    { k: 'cedula',                 w: 14, req: true,  l: 'cedula' },
    { k: 'tipo_documento',         w: 12, req: false, l: 'tipo_documento' },
    { k: 'nombre',                 w: 32, req: true,  l: 'nombre' },
    { k: 'lugar_expedicion',       w: 20, req: false, l: 'lugar_expedicion' },
    { k: 'fecha_nacimiento',       w: 14, req: false, l: 'fecha_nacimiento' },
    { k: 'genero',                 w: 10, req: false, l: 'genero' },
    { k: 'estado_civil',           w: 14, req: false, l: 'estado_civil' },
    { k: 'numero_hijos',           w: 10, req: false, l: 'numero_hijos' },
    // Contacto
    { k: 'telefono_contacto',      w: 18, req: false, l: 'telefono' },
    { k: 'email_personal',         w: 24, req: false, l: 'email' },
    { k: 'direccion',              w: 26, req: false, l: 'direccion' },
    { k: 'ciudad',                 w: 16, req: false, l: 'ciudad' },
    { k: 'departamento',           w: 16, req: false, l: 'departamento' },
    // Contrato
    { k: 'cargo',                  w: 24, req: true,  l: 'cargo' },
    { k: 'nivel_cargo',            w: 14, req: false, l: 'nivel_cargo' },
    { k: 'sector',                 w: 18, req: false, l: 'sector' },
    { k: 'area',                   w: 20, req: true,  l: 'area' },
    { k: 'turno_predeterminado',   w: 24, req: false, l: 'turno_predeterminado' },
    { k: 'tipo_contrato',          w: 22, req: false, l: 'tipo_contrato' },
    { k: 'fecha_ingreso',          w: 14, req: false, l: 'fecha_ingreso' },
    { k: 'fecha_fin_contrato',     w: 14, req: false, l: 'fecha_fin_contrato' },
    { k: 'horas_semanales_contrato',w: 12, req: false, l: 'horas_semana' },
    { k: 'dias_descanso_semana',   w: 12, req: false, l: 'dias_descanso' },
    // Salario
    { k: 'valor_hora',             w: 14, req: false, l: 'valor_hora' },
    { k: 'salario_mensual',        w: 16, req: false, l: 'salario_mensual' },
    { k: 'es_especial',            w: 12, req: false, l: 'es_especial' },
    { k: 'recibe_auxilio_transporte',w: 14, req: false, l: 'auxilio_transporte' },
    // Seguridad social
    { k: 'eps_nombre',             w: 18, req: false, l: 'eps' },
    { k: 'afp_nombre',             w: 18, req: false, l: 'afp' },
    { k: 'afp_tipo',               w: 14, req: false, l: 'afp_tipo' },
    { k: 'arl_nombre',             w: 18, req: false, l: 'arl' },
    { k: 'nivel_riesgo_arl',       w: 12, req: false, l: 'nivel_arl' },
    { k: 'caja_compensacion',      w: 18, req: false, l: 'caja' },
    { k: 'fondo_cesantias',        w: 18, req: false, l: 'cesantias' },
    // Banco
    { k: 'banco_nombre',           w: 18, req: false, l: 'banco' },
    { k: 'tipo_cuenta',            w: 14, req: false, l: 'tipo_cuenta' },
    { k: 'numero_cuenta',          w: 20, req: false, l: 'n°_cuenta' },
    // Académico
    { k: 'nivel_educacion',        w: 18, req: false, l: 'nivel_educacion' },
  ];

  ws.columns = columns.map(c => ({ header: c.l, key: c.k, width: c.w }));

  // Estilo de encabezados
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

  // ── Data validations para cada columna ──
  const maxRow = 502;
  // Calcular las filas finales correctas en __listas__ para las referencias
  const lastRowList = (col, values) => values.length + 1;
  const ref = (colIdx, n) => `__listas__!${colLetter(colIdx)}$2:${colLetter(colIdx)}${n + 1}`;

  // Índices en __listas__:
  // 1:TipoContrato  2:TipoDocumento  3:Genero  4:EstadoCivil  5:DiasDescanso
  // 6:NivelARL  7:TipoCuenta  8:NivelEducacion  9:NivelCargo
  // 10:Sector  11:ModoOperacion  12:JornadaTipo  13:Patron  14:SiNo
  // 15:Area  16:EPS  17:AFP  18:ARL  19:CajaCompensacion  20:Banco  21:FondoCesantias
  const refs = {
    tipoContrato: ref(1, TIPOS_CONTRATO_VALUES.length),
    tipoDoc: ref(2, TIPOS_DOC.length),
    genero: ref(3, GENEROS.length),
    estadoCivil: ref(4, ESTADOS_CIVIL.length),
    diasDescanso: ref(5, 2),
    nivelARL: ref(6, NIVELES_ARL.length),
    tipoCuenta: ref(7, TIPOS_CUENTA.length),
    nivelEduc: ref(8, NIVELES_EDUCATIVOS.length),
    nivelCargo: ref(9, NIVELES_CARGO.length),
    sector: ref(10, SECTORES.length),
    modo: ref(11, MODOS_OPERACION.length),
    jornada: ref(12, JORNADAS_VALUES.length),
    patron: ref(13, PATRONES_VALUES.length),
    siNo: ref(14, 2),
    area: ref(15, (areas || []).length),
    eps: ref(16, EPS_COMUNES.length),
    afp: ref(17, AFP_COMUNES.length),
    arl: ref(18, ARL_COMUNES.length),
    caja: ref(19, CAJAS_COMUNES.length),
    banco: ref(20, BANCOS_COMUNES.length),
    cesantias: ref(21, FONDOS_CESANTIAS.length),
  };

  for (let r = 2; r <= maxRow; r++) {
    const addList = (col, refsKey, opts) => {
      const cfg = {
        type: 'list', allowBlank: true, formulae: [refs[refsKey]],
        showErrorMessage: true, errorStyle: 'stop',
        showInputMessage: true,
        ...opts,
      };
      ws.getCell(`${col}${r}`).dataValidation = cfg;
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

    // Identidad
    addList('B', 'tipoDoc', { errorTitle: 'Tipo doc inválido', error: `Use: ${TIPOS_DOC.join(', ')}`, promptTitle: 'Tipo doc', prompt: `CC, CE, TI, PA, PPT, NIT` });
    addDate('E', 'YYYY-MM-DD');
    addList('F', 'genero', { errorTitle: 'Género inválido', error: `Use: ${GENEROS.join(', ')}`, promptTitle: 'Género', prompt: 'M, F, OTRO, PREFIERO_NO_DECIR' });
    addList('G', 'estadoCivil', { errorTitle: 'Estado civil inválido', error: `Use: ${ESTADOS_CIVIL.join(', ')}`, promptTitle: 'Estado civil', prompt: 'SOLTERO, CASADO, UNION_LIBRE, etc.' });
    addInt('H', 0, 'Número de hijos (0 o más)');

    // Contrato
    addList('O', 'nivelCargo', { errorTitle: 'Nivel cargo inválido', error: `Use: ${NIVELES_CARGO.join(', ')}` });
    addList('P', 'sector', { errorTitle: 'Sector inválido', error: `Use: ${SECTORES.map(s => s.value).join(', ')}` });
    addList('Q', 'area', { errorTitle: 'Área no existe', error: 'Crea primero el área en la app' });
    // turno_predeterminado se valida dinámicamente por área (no se puede saber de antemano)
    if (allShifts.length > 0) {
      const refTodos = `__turnos_por_area__!${colLetter(areaShiftMap.length + 1)}$2:${colLetter(areaShiftMap.length + 1)}${allShifts.length + 1}`;
      ws.getCell(`R${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [refTodos],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Turno inválido', error: 'Use un turno de los configurados en las áreas',
        showInputMessage: true, promptTitle: '🕐 Turno', prompt: 'Selecciona un turno (los turnos disponibles dependen del área)',
      };
    }
    addList('S', 'tipoContrato', { errorTitle: 'Tipo contrato inválido', error: `Use: ${TIPOS_CONTRATO_VALUES.join(', ')}` });
    addDate('T', 'YYYY-MM-DD');
    addDate('U', 'YYYY-MM-DD (solo término fijo / obra labor)');
    addInt('V', 1, 'Horas semanales (1-168). Típico: 42 (Ley 2101/2021)');
    addList('W', 'diasDescanso', { errorTitle: 'Inválido', error: '1 o 2' });

    // Salario
    addNum('X', 'Valor hora en COP. Si vacío, usa el del área.');
    addNum('Y', 'Salario mensual. Si vacío, se calcula (valor_hora × 240).');
    addList('Z', 'siNo', { errorTitle: 'Inválido', error: 'Si o No', promptTitle: '⭐ Salario especial', prompt: 'Marque Sí si el salario NO viene del área' });
    addList('AA', 'siNo', { errorTitle: 'Inválido', error: 'Si o No', promptTitle: '🚌 Auxilio transporte', prompt: `Aplica para sueldos ≤ 2 SMLV ($${AUX_TRANSPORTE_2025.toLocaleString('es-CO')} en 2025)` });

    // Seguridad social
    addList('AB', 'eps', { errorTitle: 'EPS inválida', error: 'Seleccione de la lista o escriba una nueva', promptTitle: '🏥 EPS', prompt: 'Nombre de la EPS. Si no está en la lista, puede escribirla.' });
    addList('AC', 'afp', { errorTitle: 'AFP inválida', error: 'Seleccione de la lista o escriba una nueva', promptTitle: '🏦 AFP', prompt: 'Porvenir, Protección, etc.' });
    addList('AD', 'siNo', { errorTitle: 'Inválido', error: 'Si o No', promptTitle: 'Tipo AFP', prompt: 'RAZON o PRIMAPROMEDIO' });
    addList('AE', 'arl', { errorTitle: 'ARL inválida', error: 'Seleccione de la lista o escriba una nueva', promptTitle: '⛑️ ARL', prompt: 'Sura, Positiva, Bolívar, etc.' });
    addList('AF', 'nivelARL', { errorTitle: 'Inválido', error: '1 a 5' });
    addList('AG', 'caja', { errorTitle: 'Caja inválida', error: 'Seleccione de la lista o escriba una nueva', promptTitle: '💰 Caja compensación', prompt: 'Compensar, Comfama, Comfenalco, etc.' });
    addList('AH', 'cesantias', { errorTitle: 'Fondo inválido', error: 'Seleccione de la lista o escriba una nueva', promptTitle: '💼 Fondo cesantías', prompt: 'Porvenir, Protección, Fondo Nacional del Ahorro, etc.' });

    // Banco
    addList('AI', 'banco', { errorTitle: 'Banco inválido', error: 'Seleccione de la lista o escriba uno nuevo', promptTitle: '🏦 Banco', prompt: 'Bancolombia, Davivienda, BBVA, Nequi, etc.' });
    addList('AJ', 'tipoCuenta', { errorTitle: 'Inválido', error: 'AHORROS o CORRIENTE' });

    // Académico
    addList('AL', 'nivelEduc', { errorTitle: 'Nivel educativo inválido', error: `Use: ${NIVELES_EDUCATIVOS.join(', ')}` });
  }

  ws.autoFilter = { from: 'A1', to: `${colLetter(columns.length)}1` };

  // ── Hoja instrucciones ──
  const wsInfo = wb.addWorksheet('📋 Guía de uso');
  wsInfo.getColumn(1).width = 40;
  wsInfo.getColumn(2).width = 80;

  const guias = [
    ['CHRONOSWORK — Importación Masiva de Empleados v4', ''],
    ['', ''],
    ['⚠️ COLUMNAS OBLIGATORIAS', 'cedula, nombre, cargo, area'],
    ['', ''],
    ['COLUMNA', 'DESCRIPCIÓN'],
    ['cedula *', 'Cédula. 5-12 dígitos. Dropdown: NO (es texto).'],
    ['tipo_documento', `Tipo de documento. Dropdown: ${TIPOS_DOC.join(', ')}`],
    ['nombre *', 'Nombre completo.'],
    ['lugar_expedicion', 'Ciudad donde se expidió la cédula.'],
    ['fecha_nacimiento', 'YYYY-MM-DD.'],
    ['genero', `Dropdown: ${GENEROS.join(', ')}`],
    ['estado_civil', `Dropdown: ${ESTADOS_CIVIL.join(', ')}`],
    ['numero_hijos', 'Entero ≥ 0.'],
    ['telefono', 'Texto libre.'],
    ['email', 'Correo personal.'],
    ['direccion', 'Texto libre.'],
    ['ciudad', 'Texto libre.'],
    ['departamento', 'Texto libre.'],
    ['cargo *', 'Texto libre.'],
    ['nivel_cargo', `Dropdown: ${NIVELES_CARGO.join(', ')}`],
    ['sector', `Dropdown: ${SECTORES.map(s => s.value).join(', ')}`],
    ['area *', `Dropdown con TUS áreas. Disponibles: ${(areas || []).map(a => a.nombre).join(', ') || '(primero crea áreas)'}`],
    ['turno_predeterminado', 'Dropdown con TUS turnos. Si no está en la lista, déjalo vacío.'],
    ['tipo_contrato', `Dropdown con 9 tipos del CST: ${TIPOS_CONTRATO_VALUES.join(', ')}`],
    ['fecha_ingreso', 'YYYY-MM-DD.'],
    ['fecha_fin_contrato', 'YYYY-MM-DD. Solo para TERMINO_FIJO u OBRA_LABOR.'],
    ['horas_semana', 'Entero. Típico: 42.'],
    ['dias_descanso', '1 o 2.'],
    ['valor_hora', 'Número > 0. Si vacío, usa el del área.'],
    ['salario_mensual', 'Número > 0. Si vacío, se calcula (valor_hora × 240).'],
    ['es_especial', 'Si/No. Marcar Sí si el salario NO viene del área.'],
    ['auxilio_transporte', 'Si/No. Para sueldos ≤ 2 SMLV.'],
    ['eps', `Dropdown: ${EPS_COMUNES.slice(0, 6).join(', ')}, etc. (también puedes escribir uno nuevo)`],
    ['afp', `Dropdown: ${AFP_COMUNES.join(', ')}`],
    ['arl', `Dropdown: ${ARL_COMUNES.join(', ')}`],
    ['nivel_arl', '1-5.'],
    ['caja', `Dropdown: ${CAJAS_COMUNES.slice(0, 5).join(', ')}, etc.`],
    ['cesantias', `Dropdown: ${FONDOS_CESANTIAS.join(', ')}`],
    ['banco', `Dropdown: ${BANCOS_COMUNES.slice(0, 6).join(', ')}, etc. (también Nequi, Daviplata)`],
    ['tipo_cuenta', 'AHORROS o CORRIENTE.'],
    ['n°_cuenta', 'Texto libre.'],
    ['nivel_educacion', `Dropdown: ${NIVELES_EDUCATIVOS.join(', ')}`],
    ['', ''],
    ['⭐ NOTAS', ''],
    ['• Solo cedula, nombre, cargo y area son obligatorios. Lo demás puede ir vacío y se usa el default del área.', ''],
    [`• Valor hora vacío → usa el del área. Salario mensual vacío → se calcula como valor_hora × 240.`, ''],
    [`• Auxilio de transporte: $${AUX_TRANSPORTE_2025.toLocaleString('es-CO')} si sueldo ≤ 2 SMLV ($${(SMLV_2025 * 2).toLocaleString('es-CO')}).`, ''],
    ['• Los dropdowns muestran sugerencias. Si tu EPS/AFP/ARL/Banco no está en la lista, puedes escribirla manualmente.', ''],
    ['• Las áreas del dropdown son TUS áreas reales. Si no ves alguna, créala primero en la app.', ''],
    ['• Los turnos del dropdown son TUS turnos configurados. Si el empleado no tiene turno fijo, déjalo vacío.', ''],
  ];
  guias.forEach((row, i) => {
    const r = wsInfo.addRow(row);
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
      r.height = 26;
    } else if ([2, 4, '⭐ NOTAS'].includes(row[0])) {
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
  a.download = 'plantilla_empleados_chronoswork_v4.xlsx';
  a.click();
  URL.revokeObjectURL(url);
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
// Componente principal
// ═══════════════════════════════════════════════════════════════
export default function BulkImportModal({ areas = [], onClose, onBulkSave }) {
  const { tenant } = useAuth();
  const { areas: areasFromHook } = useAreas();
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [useAreaDefaultSalario, setUseAreaDefaultSalario] = useState(true);
  const fileInputRef = useRef(null);

  // Cargar plantillas de turnos de cada área
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
      if (error) { console.error(error); return; }
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

  // Áreas finales (las del prop tienen prioridad)
  const finalAreas = areas.length > 0 ? areas : areasFromHook;
  const areaNames = useMemo(() => finalAreas.map(a => a.nombre), [finalAreas]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = findDataSheet(wb);
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) {
          setParseError(`La hoja "${wsname}" no contiene filas con datos.`);
          return;
        }
        const headers = Object.keys(json[0]);
        const idxMap = buildColumnIndexes(headers);
        const rows = json.map((row, i) => {
          const r = { _row: i + 2 };
          Object.keys(COLUMN_ALIASES).forEach(field => {
            const colIdx = idxMap[field];
            if (colIdx === -1) return;
            const headerName = Object.keys(row)[colIdx];
            r[field] = headerName != null ? row[headerName] : '';
          });
          r._errors = validateRow(r, finalAreas, areaNames);
          return r;
        });
        setParsedRows(rows);
        setStep('preview');
      } catch (err) {
        setParseError('No se pudo leer el archivo. Verifica que sea .xlsx, .xls o .csv válido.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [finalAreas, areaNames]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const validRows = parsedRows.filter(r => r._errors.length === 0);
  const invalidRows = parsedRows.filter(r => r._errors.length > 0);

  // Normalización centralizada
  const norm = (field, val) => {
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
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setStep('importing');
    setProgress(0);
    let successCount = 0;
    const errorList = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const areaObj = finalAreas.find(a => a.nombre.toLowerCase() === String(row.area).trim().toLowerCase());
        const valorHora = parseNumero(row.valor_hora);
        const salarioMensual = parseNumero(row.salario_mensual);
        const tipoContrato = norm('tipo_contrato', row.tipo_contrato)
          || (areaObj?.tipo_contrato_predominante) || 'INDEFINIDO';
        const diasDescanso = norm('dias_descanso_semana', row.dias_descanso_semana)
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
          salario_mensual: salarioMensual ?? (valorHora ? valorHora * 240 : (useAreaDefaultSalario && areaObj ? parseFloat(areaObj.valor_hora_default) * 240 : SMLV_2025)),
          es_especial: norm('es_especial', row.es_especial) || (valorHora === null && !useAreaDefaultSalario),
          recibe_auxilio_transporte: norm('recibe_auxilio_transporte', row.recibe_auxilio_transporte),
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
          activo: true,
        };

        // Si hay turno_predeterminado, buscar su id en las plantillas del área
        if (row.turno_predeterminado && areaObj) {
          const tpl = (shiftTemplatesByArea[areaObj.id] || []).find(
            t => t.nombre.toLowerCase() === String(row.turno_predeterminado).toLowerCase()
          );
          if (tpl) employeeData.turno_predeterminado_id = tpl.id;
        }

        const saved = await onBulkSave(employeeData);
        if (areaObj && saved?.id) {
          await supabase.from('area_employees').delete().eq('employee_id', saved.id);
          await supabase.from('area_employees').insert([{ area_id: areaObj.id, employee_id: saved.id, tenant_id: tenant.id }]);
        }
        successCount++;
      } catch (err) {
        errorList.push({ row: row._row, nombre: row.nombre, msg: err.message });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResults({ success: successCount, errors: errorList, total: parsedRows.length });
    setStep('done');
  };

  return (
    <div className="cw-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 880, width: '96vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            <MdPeople style={{ marginRight: 8, color: '#10b981' }} />
            Importación Masiva de Empleados
            {fileName && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{fileName}</span>}
          </h3>
          <button className="cw-modal__close" onClick={() => onClose(results?.success > 0)}><MdClose /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 1.5rem', flexShrink: 0 }}>
          {[
            { key: 'upload',    label: '1. Subir' },
            { key: 'preview',   label: '2. Revisar' },
            { key: 'importing', label: '3. Importando' },
            { key: 'done',      label: '4. Resultado' },
          ].map(s => {
            const order = ['upload', 'preview', 'importing', 'done'];
            const active = step === s.key;
            const passed = order.indexOf(step) > order.indexOf(s.key);
            return (
              <div key={s.key} style={{
                padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: active ? 700 : 400,
                color: active ? '#10b981' : passed ? 'var(--cw-success)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
              }}>{passed ? '✓ ' : ''}{s.label}</div>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                  <MdInfo style={{ color: '#34d399' }} /> Plantilla inteligente con 38 columnas y catálogos del tenant
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Solo <strong>cedula, nombre, cargo y area</strong> son obligatorios.
                  Todos los demás campos (tipo contrato, EPS, AFP, ARL, bancos, turnos, etc.) son dropdowns
                  con datos del CST y de tu empresa. <strong>Si no escribes el valor, se usa el default del área</strong>.
                </div>
              </div>

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

              <button className="cw-btn cw-btn--secondary" onClick={() => generateTemplate({ areas: finalAreas, shiftTemplatesByArea, allShiftTemplates })} style={{ alignSelf: 'flex-start' }} disabled={finalAreas.length === 0}>
                <MdDownload /> Descargar plantilla con TUS áreas ({finalAreas.length}) y TUS turnos
              </button>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#10b981' : 'var(--border-subtle)'}`,
                  borderRadius: 16, padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(16,185,129,0.06)' : 'var(--bg-glass)',
                  transition: 'all 0.25s',
                }}
              >
                <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>📂</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Arrastra tu archivo aquí o haz clic para seleccionarlo
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Acepta <strong>.xlsx</strong>, <strong>.xls</strong> y <strong>.csv</strong>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])} />
              </div>

              {parseError && (
                <div className="cw-alert cw-alert--error">🚫 {parseError}</div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <StatBox label="Filas" value={parsedRows.length} color="#6366f1" />
                <StatBox label="Válidas" value={validRows.length} color="#10b981" />
                <StatBox label="Con errores" value={invalidRows.length} color={invalidRows.length ? '#ef4444' : 'var(--text-muted)'} />
              </div>

              {invalidRows.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                    ⚠ {invalidRows.length} fila(s) con errores:
                  </div>
                  {invalidRows.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <strong>Fila {r._row}:</strong> {r.nombre || r.cedula || '(sin nombre)'}
                      <ul style={{ margin: '0.2rem 0 0 1.2rem', color: '#fca5a5' }}>
                        {r._errors.map((e, j) => <li key={j}>{e.msg}</li>)}
                      </ul>
                    </div>
                  ))}
                  {invalidRows.length > 5 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ... y {invalidRows.length - 5} más
                    </div>
                  )}
                </div>
              )}

              {validRows.length > 0 && (
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <table className="cw-table" style={{ fontSize: '0.72rem' }}>
                    <thead>
                      <tr>
                        <th>✓</th><th>Fila</th><th>Cédula</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Contrato</th><th>$/h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((r, i) => (
                        <tr key={i}>
                          <td><MdCheckCircle style={{ color: '#10b981' }} /></td>
                          <td>{r._row}</td>
                          <td>{r.cedula}</td>
                          <td>{r.nombre}</td>
                          <td>{r.cargo}</td>
                          <td>{r.area}</td>
                          <td>{r.tipo_contrato || '—'}</td>
                          <td>${parseNumero(r.valor_hora)?.toLocaleString('es-CO') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="cw-modal__footer" style={{ padding: 0, borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <button className="cw-btn cw-btn--secondary" onClick={() => { setStep('upload'); setParsedRows([]); setFileName(''); }}>
                  ← Cambiar archivo
                </button>
                <button className="cw-btn cw-btn--primary" onClick={handleImport} disabled={validRows.length === 0}>
                  ✅ Importar {validRows.length} empleado{validRows.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div className="cw-spinner" style={{ margin: '0 auto 1rem' }}></div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Importando empleados...</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {progress}% completado · Asignando a áreas
              </div>
              <div style={{ background: 'var(--border-subtle)', height: 6, borderRadius: 3, marginTop: '0.75rem', overflow: 'hidden' }}>
                <div style={{ background: '#10b981', height: '100%', width: `${progress}%`, transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {step === 'done' && results && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                {results.errors.length === 0 ? '🎉' : results.success > 0 ? '⚠️' : '🚫'}
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>
                {results.errors.length === 0 ? '¡Importación exitosa!' :
                 results.success > 0 ? 'Importación parcial' : 'No se pudo importar'}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: '#10b981' }}>{results.success}</strong> empleado(s) creado(s) ·
                {' '}<strong style={{ color: results.errors.length ? '#ef4444' : 'var(--text-muted)' }}>{results.errors.length}</strong> error(es)
              </div>
              {results.errors.length > 0 && (
                <div style={{ marginTop: '0.75rem', textAlign: 'left', maxHeight: 180, overflowY: 'auto', background: 'rgba(239,68,68,0.05)', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.75rem' }}>
                  {results.errors.map((e, i) => (
                    <div key={i} style={{ color: '#fca5a5' }}>
                      Fila {e.row} ({e.nombre}): {e.msg}
                    </div>
                  ))}
                </div>
              )}
              <button className="cw-btn cw-btn--primary" onClick={() => onClose(results.success > 0)} style={{ marginTop: '1rem' }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-glass)', border: `1px solid ${color}30`, borderRadius: 8, padding: '0.5rem 0.75rem' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
