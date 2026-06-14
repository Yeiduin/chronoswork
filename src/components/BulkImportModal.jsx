// ============================================================
// ChronosWork — Importación Masiva de Empleados v3
// Soporta todos los tipos de contrato, seguridad social, etc.
// ============================================================

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  MdClose, MdUpload, MdDownload, MdCheckCircle, MdError, MdWarning,
  MdInfo, MdTableChart, MdPeople,
} from 'react-icons/md';
import { TIPOS_CONTRATO, SMLV_2025, SMLV_HORA_2025, AUX_TRANSPORTE_2025 } from '../config/laborCatalog';

const TIPOS_CONTRATO_VALUES = TIPOS_CONTRATO.map(t => t.value);
const TIPOS_DOC = ['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'];
const GENEROS = ['M', 'F', 'OTRO', 'PREFIERO_NO_DECIR'];
const ESTADOS_CIVIL = ['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO', 'SEPARADO'];
const NIVELES_EDUCATIVOS = ['PRIMARIA', 'BACHILLERATO', 'TECNICO', 'TECNOLOGO', 'PREGRADO', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'];
const NIVELES_ARL = [1, 2, 3, 4, 5];

// ─── Mapeo de columnas (tolerante a variaciones) ────────────────────────────
const COLUMN_ALIASES = {
  // Identidad
  cedula:                   ['cedula', 'cédula', 'documento', 'cc', 'identificacion', 'identificación', 'dni'],
  tipo_documento:           ['tipo_documento', 'tipo documento', 'tipo doc', 'tipo_id'],
  nombre:                   ['nombre', 'nombre completo', 'nombres', 'name', 'empleado', 'colaborador'],
  lugar_expedicion:         ['lugar_expedicion', 'lugar expedicion', 'expedida en'],
  fecha_nacimiento:         ['fecha_nacimiento', 'nacimiento', 'f. nacimiento', 'fecha nac'],
  genero:                   ['genero', 'género', 'sexo'],
  estado_civil:             ['estado_civil', 'estado civil'],
  numero_hijos:             ['numero_hijos', 'hijos', 'n° hijos', 'cantidad hijos'],
  // Contacto
  telefono_contacto:        ['telefono', 'teléfono', 'celular', 'movil', 'móvil', 'phone'],
  email_personal:           ['email', 'correo', 'correo personal', 'mail'],
  direccion:                ['direccion', 'dirección', 'address'],
  ciudad:                   ['ciudad', 'city'],
  departamento:             ['departamento', 'state', 'provincia'],
  // Contrato
  cargo:                    ['cargo', 'puesto', 'position', 'rol', 'job', 'ocupacion', 'ocupación'],
  nivel_cargo:              ['nivel_cargo', 'nivel', 'nivel cargo'],
  area:                     ['area', 'área', 'departamento', 'department', 'seccion', 'sección'],
  tipo_contrato:            ['tipo_contrato', 'tipo contrato', 'contrato', 'contract_type', 'modalidad'],
  fecha_ingreso:            ['fecha_ingreso', 'ingreso', 'fecha ingreso', 'f. ingreso'],
  fecha_fin_contrato:       ['fecha_fin', 'fin contrato', 'fecha terminacion', 'fecha_fin_contrato'],
  horas_semanales_contrato: ['horas_semanales', 'horas semana', 'hrs_semana', 'horas_semanales_contrato'],
  dias_descanso_semana:     ['dias_descanso', 'dias descanso', 'días descanso', 'dias_descanso_semana', 'descansos', 'dias libres'],
  // Salario
  valor_hora:               ['valor_hora', 'valor hora', 'salario hora', 'hourly_rate', 'tarifa hora', 'valor/hora'],
  salario_mensual:          ['salario_mensual', 'salario', 'sueldo', 'salario base', 'sueldo mensual'],
  es_especial:              ['es_especial', 'especial', 'salario especial', 'personalizado'],
  recibe_auxilio_transporte:['recibe_auxilio', 'auxilio transporte', 'aux_transporte'],
  // Seguridad social
  eps_nombre:               ['eps', 'eps_nombre', 'salud'],
  afp_nombre:               ['afp', 'afp_nombre', 'pension', 'pensiones'],
  arl_nombre:               ['arl', 'arl_nombre', 'riesgos laborales'],
  nivel_riesgo_arl:         ['nivel_arl', 'nivel riesgo', 'nivel_riesgo_arl'],
  caja_compensacion:        ['caja', 'caja_compensacion', 'caja de compensacion'],
  fondo_cesantias:          ['fondo_cesantias', 'cesantias'],
  // Banco
  banco_nombre:             ['banco', 'banco_nombre', 'entidad bancaria'],
  tipo_cuenta:              ['tipo_cuenta', 'tipo cuenta'],
  numero_cuenta:            ['numero_cuenta', 'n° cuenta', 'cuenta'],
  // Académico
  nivel_educacion:          ['nivel_educacion', 'nivel educativo', 'educacion', 'estudios'],
  // Fiscales
  responsable_iva:          ['responsable_iva', 'iva'],
  declarante_renta:         ['declarante_renta', 'renta'],
};

function normalizeHeader(h) { return String(h || '').toLowerCase().trim().replace(/\s+/g, ' '); }
function findColumn(headers, aliases) {
  for (const a of aliases) {
    const idx = headers.findIndex(h => normalizeHeader(h) === a);
    if (idx !== -1) return idx;
  }
  return -1;
}
function buildColumnIndexes(headers) {
  const map = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    map[field] = findColumn(headers, aliases);
  }
  return map;
}
function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  return ['si', 'sí', 'yes', 'true', '1', 'x', '✓'].includes(String(val || '').toLowerCase().trim());
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

// ─── Validación ─────────────────────────────────────────────────────────────
function validateRow(row, areas) {
  const errors = [];

  if (!String(row.cedula || '').trim()) {
    errors.push({ campo: 'cedula', msg: 'La cédula es obligatoria' });
  } else if (!/^\d{5,12}$/.test(String(row.cedula).replace(/\D/g, ''))) {
    errors.push({ campo: 'cedula', msg: `Cédula "${row.cedula}" inválida (5-12 dígitos)` });
  }

  if (!String(row.nombre || '').trim()) {
    errors.push({ campo: 'nombre', msg: 'El nombre es obligatorio' });
  }
  if (!String(row.cargo || '').trim()) {
    errors.push({ campo: 'cargo', msg: 'El cargo es obligatorio' });
  }

  const areaNombre = String(row.area || '').trim();
  if (!areaNombre) {
    errors.push({ campo: 'area', msg: 'El área es obligatoria' });
  } else {
    const areaMatch = areas.find(a => a.nombre.toLowerCase() === areaNombre.toLowerCase());
    if (!areaMatch) {
      const disponibles = areas.map(a => `"${a.nombre}"`).slice(0, 5).join(', ');
      errors.push({ campo: 'area', msg: `Área "${areaNombre}" no existe${areas.length > 5 ? ` (${disponibles}...)` : `: ${disponibles}`}` });
    }
  }

  if (row.tipo_contrato) {
    const tc = String(row.tipo_contrato).trim().toUpperCase();
    if (!TIPOS_CONTRATO_VALUES.includes(tc)) {
      errors.push({ campo: 'tipo_contrato', msg: `Tipo contrato "${row.tipo_contrato}" inválido. Válidos: ${TIPOS_CONTRATO_VALUES.join(', ')}` });
    }
  }

  if (row.tipo_documento) {
    const td = String(row.tipo_documento).trim().toUpperCase();
    if (!TIPOS_DOC.includes(td)) {
      errors.push({ campo: 'tipo_documento', msg: `Tipo doc "${row.tipo_documento}" inválido. Válidos: ${TIPOS_DOC.join(', ')}` });
    }
  }

  if (row.dias_descanso_semana) {
    const d = parseEntero(row.dias_descanso_semana);
    if (d === null || (d !== 1 && d !== 2)) {
      errors.push({ campo: 'dias_descanso_semana', msg: 'Debe ser 1 o 2' });
    }
  }

  if (row.nivel_riesgo_arl) {
    const n = parseEntero(row.nivel_riesgo_arl);
    if (n === null || n < 1 || n > 5) {
      errors.push({ campo: 'nivel_riesgo_arl', msg: 'Debe ser 1-5' });
    }
  }

  if (row.valor_hora !== undefined && row.valor_hora !== '') {
    const v = parseNumero(row.valor_hora);
    if (v === null || v <= 0) errors.push({ campo: 'valor_hora', msg: 'Debe ser número > 0' });
  }

  if (row.salario_mensual !== undefined && row.salario_mensual !== '') {
    const s = parseNumero(row.salario_mensual);
    if (s === null || s <= 0) errors.push({ campo: 'salario_mensual', msg: 'Debe ser número > 0' });
  }

  return errors;
}

// ─── Genera plantilla Excel ─────────────────────────────────────────────────
async function generateTemplate(areas) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  // Listas
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
  wsL.getColumn(9).values = ['SiNo', 'Si', 'No'];
  wsL.getColumn(10).values = ['Area', ...(areas || []).map(a => a.nombre)];

  // Hoja principal
  const ws = wb.addWorksheet('Empleados', { views: [{ state: 'frozen', ySplit: 1 }] });

  const columns = [
    // Identidad
    { k: 'cedula',                 w: 14, req: true,  l: 'cedula' },
    { k: 'tipo_documento',         w: 12, req: false, l: 'tipo_doc' },
    { k: 'nombre',                 w: 32, req: true,  l: 'nombre' },
    { k: 'lugar_expedicion',       w: 20, req: false, l: 'lugar_expedicion' },
    { k: 'fecha_nacimiento',       w: 14, req: false, l: 'fecha_nacimiento' },
    { k: 'genero',                 w: 10, req: false, l: 'genero' },
    { k: 'estado_civil',           w: 14, req: false, l: 'estado_civil' },
    { k: 'numero_hijos',           w: 10, req: false, l: 'n°_hijos' },
    // Contacto
    { k: 'telefono_contacto',      w: 18, req: false, l: 'telefono' },
    { k: 'email_personal',         w: 24, req: false, l: 'email' },
    { k: 'direccion',              w: 26, req: false, l: 'direccion' },
    { k: 'ciudad',                 w: 16, req: false, l: 'ciudad' },
    { k: 'departamento',           w: 16, req: false, l: 'departamento' },
    // Contrato
    { k: 'cargo',                  w: 24, req: true,  l: 'cargo' },
    { k: 'nivel_cargo',            w: 14, req: false, l: 'nivel_cargo' },
    { k: 'area',                   w: 20, req: true,  l: 'area' },
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
    { k: 'arl_nombre',             w: 18, req: false, l: 'arl' },
    { k: 'nivel_riesgo_arl',       w: 12, req: false, l: 'nivel_arl' },
    { k: 'caja_compensacion',      w: 18, req: false, l: 'caja' },
    { k: 'fondo_cesantias',        w: 18, req: false, l: 'cesantias' },
    // Banco
    { k: 'banco_nombre',           w: 16, req: false, l: 'banco' },
    { k: 'tipo_cuenta',            w: 12, req: false, l: 'tipo_cuenta' },
    { k: 'numero_cuenta',          w: 18, req: false, l: 'n°_cuenta' },
    // Académico
    { k: 'nivel_educacion',        w: 18, req: false, l: 'nivel_educacion' },
  ];

  ws.columns = columns.map(c => ({ header: c.l, key: c.k, width: c.w }));

  // Estilo encabezados
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

  // Data validations
  const maxRow = 502;
  const refContrato = `__listas__!$A$2:$A$${TIPOS_CONTRATO_VALUES.length + 1}`;
  const refTipoDoc = `__listas__!$B$2:$B$${TIPOS_DOC.length + 1}`;
  const refGenero = `__listas__!$C$2:$C$${GENEROS.length + 1}`;
  const refEstadoC = `__listas__!$D$2:$D$${ESTADOS_CIVIL.length + 1}`;
  const refDias = `__listas__!$E$2:$E$3`;
  const refARL = `__listas__!$F$2:$F$6`;
  const refCta = `__listas__!$G$2:$G$3`;
  const refEduc = `__listas__!$H$2:$H$${NIVELES_EDUCATIVOS.length + 1}`;
  const refSiNo = `__listas__!$I$2:$I$3`;
  const areaList = (areas || []).map(a => a.nombre);
  const refAreas = areaList.length > 0 ? `__listas__!$J$2:$J$${areaList.length + 1}` : `__listas__!$J$2:$J$2`;

  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refTipoDoc], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Tipo doc inválido', error: `Use: ${TIPOS_DOC.join(', ')}`, showInputMessage: true, promptTitle: 'Tipo doc', prompt: `CC, CE, TI, PA, PPT, NIT` };
    ws.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refGenero], showErrorMessage: true, errorTitle: 'Género inválido', error: `Use: ${GENEROS.join(', ')}` };
    ws.getCell(`G${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refEstadoC], showErrorMessage: true, errorTitle: 'Estado civil inválido', error: `Use: ${ESTADOS_CIVIL.join(', ')}` };
    ws.getCell(`H${r}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], errorTitle: 'Inválido', error: 'Debe ser 0 o más' };
    ws.getCell(`O${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refAreas], errorTitle: 'Área no existe', error: 'El área debe existir. Créala primero en la app.' };
    ws.getCell(`P${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refContrato], errorTitle: 'Contrato inválido', error: `Use: ${TIPOS_CONTRATO_VALUES.join(', ')}` };
    ws.getCell(`T${r}`).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], errorTitle: 'Inválido', error: 'Número > 0' };
    ws.getCell(`U${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refDias], errorTitle: 'Inválido', error: '1 o 2' };
    ws.getCell(`V${r}`).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], errorTitle: 'Inválido', error: 'Número > 0' };
    ws.getCell(`W${r}`).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], errorTitle: 'Inválido', error: 'Número > 0' };
    ws.getCell(`X${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refSiNo], errorTitle: 'Inválido', error: 'Si o No' };
    ws.getCell(`Y${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refSiNo], errorTitle: 'Inválido', error: 'Si o No' };
    ws.getCell(`AC${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refARL], errorTitle: 'Inválido', error: '1 a 5' };
    ws.getCell(`AG${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refCta], errorTitle: 'Inválido', error: 'AHORROS o CORRIENTE' };
    ws.getCell(`AJ${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refEduc], errorTitle: 'Inválido', error: `Use: ${NIVELES_EDUCATIVOS.join(', ')}` };
  }

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };

  // Hoja instrucciones
  const wsInfo = wb.addWorksheet('📋 Guía de uso');
  wsInfo.getColumn(1).width = 35;
  wsInfo.getColumn(2).width = 75;

  const guia = [
    ['CHRONOSWORK — Importación Masiva de Empleados v3', ''],
    ['', ''],
    ['⚠️ COLUMNAS OBLIGATORIAS', 'cedula, nombre, cargo, area'],
    ['', ''],
    ['COLUMNA', 'DESCRIPCIÓN'],
    ['cedula *', 'Cédula de ciudadanía. Solo números, 5-12 dígitos.'],
    ['tipo_doc', `Tipo de documento. Opciones: ${TIPOS_DOC.join(', ')}. Default: CC.`],
    ['nombre *', 'Nombre completo.'],
    ['lugar_expedicion', 'Ciudad donde se expidió la cédula.'],
    ['fecha_nacimiento', 'YYYY-MM-DD. Ej: 1990-05-15.'],
    ['genero', `${GENEROS.join(', ')}`],
    ['estado_civil', `${ESTADOS_CIVIL.join(', ')}`],
    ['n°_hijos', 'Cantidad de hijos. Número entero.'],
    ['telefono', 'Celular o fijo.'],
    ['email', 'Correo personal.'],
    ['direccion', 'Dirección de residencia.'],
    ['ciudad', 'Ciudad de residencia.'],
    ['departamento', 'Departamento de residencia.'],
    ['cargo *', 'Cargo u ocupación. Ej: Cajero, Vigilante, Operario.'],
    ['nivel_cargo', 'JUNIOR, SENIOR, COORDINADOR, SUPERVISOR, JEFE, GERENTE, DIRECTOR.'],
    ['area *', `Nombre EXACTO del área. Debe existir. Disponibles: ${areaList.slice(0, 8).join(', ')}${areaList.length > 8 ? '...' : ''}`],
    ['tipo_contrato', `${TIPOS_CONTRATO_VALUES.join(', ')}. Si vacío, usa el del área.`],
    ['fecha_ingreso', 'YYYY-MM-DD. Fecha de inicio del contrato.'],
    ['fecha_fin_contrato', 'YYYY-MM-DD. Solo para TERMINO_FIJO u OBRA_LABOR.'],
    ['horas_semana', 'Horas semanales. Default 42 (Ley 2101/2021).'],
    ['dias_descanso', '1 o 2. Días libres por semana.'],
    ['valor_hora', 'Salario por hora en COP. Si vacío, usa el del área.'],
    ['salario_mensual', 'Salario mensual en COP. Si vacío, se calcula (valor_hora × 240).'],
    ['es_especial', 'Si/No. Si=Sí, el salario NO se arrastra del área.'],
    ['auxilio_transporte', 'Si/No. Aplica para sueldos ≤ 2 SMLV ($200.000 en 2025).'],
    ['eps', 'Nombre de la EPS. Sanitas, Sura, Nueva EPS, etc.'],
    ['afp', 'Nombre de la AFP. Porvenir, Protección, Colfondos, etc.'],
    ['arl', 'Nombre de la ARL. Sura, Positiva, Bolívar, etc.'],
    ['nivel_arl', '1 a 5. Nivel de riesgo ARL del cargo.'],
    ['caja', 'Caja de compensación. Compensar, Comfama, etc.'],
    ['cesantias', 'Fondo de cesantías. Porvenir, Protección, etc.'],
    ['banco', 'Banco donde se deposita la nómina.'],
    ['tipo_cuenta', 'AHORROS o CORRIENTE.'],
    ['n°_cuenta', 'Número de cuenta bancaria.'],
    ['nivel_educacion', `${NIVELES_EDUCATIVOS.join(', ')}.`],
    ['', ''],
    ['💡 EJEMPLO RÁPIDO', ''],
    ['cedula', 'nombre', 'cargo', 'area', 'valor_hora', 'tipo_contrato'],
    ['1234567890', 'Juan Pérez García', 'Cajero', 'Cajas', '12500', 'INDEFINIDO'],
    ['9876543210', 'María López Ruiz', 'Vigilante', 'Vigilancia', '12000', 'INDEFINIDO'],
    ['', ''],
    ['INSTRUCCIONES', ''],
    ['1.', 'Llene la hoja "Empleados" con sus datos. Solo use esa hoja.'],
    ['2.', 'Las columnas con dropdown muestran opciones al hacer clic.'],
    ['3.', 'Solo cedula, nombre, cargo y area son obligatorias.'],
    ['4.', 'El área debe existir. Si no existe, créela primero en la app.'],
    ['5.', 'Guarde el archivo (.xlsx) y súbala en la aplicación.'],
  ];

  guia.forEach((row, i) => {
    const r = wsInfo.addRow(row);
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
      r.height = 26;
    } else if ([2, 4, 'INSTRUCCIONES', '💡 EJEMPLO RÁPIDO'].includes(row[0])) {
      r.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      r.height = 20;
    } else if (row[0] && row[0].includes('*')) {
      r.getCell(1).font = { color: { argb: 'FFFBBF24' }, bold: true };
    } else if (i >= guia.length - 5) {
      r.getCell(1).font = { color: { argb: 'FF94a3b8' } };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_empleados_chronoswork_v3.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function BulkImportModal({ areas = [], onClose, onBulkSave }) {
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [useAreaDefaultSalario, setUseAreaDefaultSalario] = useState(true);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setParseError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) {
          setParseError('El archivo no contiene filas con datos.');
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
          r._errors = validateRow(r, areas);
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
  }, [areas]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const validRows = parsedRows.filter(r => r._errors.length === 0);
  const invalidRows = parsedRows.filter(r => r._errors.length > 0);

  const handleImport = async () => {
    if (!validRows.length) return;
    setStep('importing');
    setProgress(0);
    let successCount = 0;
    const errorList = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const areaObj = areas.find(a => a.nombre.toLowerCase() === String(row.area).toLowerCase());

        const valorHora = parseNumero(row.valor_hora);
        const salarioMensual = parseNumero(row.salario_mensual);

        const employeeData = {
          // Identidad
          tipo_documento: row.tipo_documento ? String(row.tipo_documento).toUpperCase().trim() : 'CC',
          cedula: String(row.cedula).replace(/\D/g, '').trim(),
          nombre: String(row.nombre).trim(),
          lugar_expedicion: row.lugar_expedicion ? String(row.lugar_expedicion).trim() : null,
          fecha_nacimiento: row.fecha_nacimiento ? parseFecha(row.fecha_nacimiento) : null,
          genero: row.genero ? String(row.genero).toUpperCase().trim() : null,
          estado_civil: row.estado_civil ? String(row.estado_civil).toUpperCase().trim() : null,
          numero_hijos: parseEntero(row.numero_hijos) ?? 0,
          // Contacto
          telefono_contacto: row.telefono_contacto ? String(row.telefono_contacto).trim() : null,
          email_personal: row.email_personal ? String(row.email_personal).trim() : null,
          direccion: row.direccion ? String(row.direccion).trim() : null,
          ciudad: row.ciudad ? String(row.ciudad).trim() : null,
          departamento: row.departamento ? String(row.departamento).trim() : null,
          // Contrato
          cargo: String(row.cargo).trim(),
          nivel_cargo: row.nivel_cargo ? String(row.nivel_cargo).toUpperCase().trim() : 'JUNIOR',
          tipo_contrato: row.tipo_contrato ? String(row.tipo_contrato).toUpperCase().trim() : (areaObj?.tipo_contrato_predominante || 'INDEFINIDO'),
          fecha_ingreso: row.fecha_ingreso ? parseFecha(row.fecha_ingreso) : new Date().toISOString().slice(0, 10),
          fecha_fin_contrato: row.fecha_fin_contrato ? parseFecha(row.fecha_fin_contrato) : null,
          horas_semanales_contrato: parseEntero(row.horas_semanales_contrato) ?? 42,
          dias_descanso_semana: parseEntero(row.dias_descanso_semana) ?? (areaObj?.dias_descanso_default || 1),
          // Salario
          valor_hora: valorHora ?? (useAreaDefaultSalario && areaObj ? parseFloat(areaObj.valor_hora_default) : SMLV_HORA_2025),
          salario_mensual: salarioMensual ?? (valorHora ? valorHora * 240 : (useAreaDefaultSalario && areaObj ? parseFloat(areaObj.valor_hora_default) * 240 : SMLV_2025)),
          es_especial: parseBoolean(row.es_especial) || (valorHora === null && !useAreaDefaultSalario),
          recibe_auxilio_transporte: row.recibe_auxilio_transporte !== undefined ? parseBoolean(row.recibe_auxilio_transporte) : (areaObj?.paga_auxilio_transporte ?? true),
          // Seguridad social
          eps_nombre: row.eps_nombre ? String(row.eps_nombre).trim() : null,
          afp_nombre: row.afp_nombre ? String(row.afp_nombre).trim() : null,
          arl_nombre: row.arl_nombre ? String(row.arl_nombre).trim() : null,
          nivel_riesgo_arl: parseEntero(row.nivel_riesgo_arl) ?? (areaObj?.nivel_riesgo_arl || 1),
          caja_compensacion: row.caja_compensacion ? String(row.caja_compensacion).trim() : null,
          fondo_cesantias: row.fondo_cesantias ? String(row.fondo_cesantias).trim() : null,
          // Banco
          banco_nombre: row.banco_nombre ? String(row.banco_nombre).trim() : null,
          tipo_cuenta: row.tipo_cuenta ? String(row.tipo_cuenta).toUpperCase().trim() : 'AHORROS',
          numero_cuenta: row.numero_cuenta ? String(row.numero_cuenta).trim() : null,
          // Académico
          nivel_educacion: row.nivel_educacion ? String(row.nivel_educacion).toUpperCase().trim() : null,
          // Fiscal
          responsable_iva: parseBoolean(row.responsable_iva),
          declarante_renta: parseBoolean(row.declarante_renta),
          // Activo
          activo: true,
        };

        const saved = await onBulkSave(employeeData);
        if (areaObj && saved?.id) {
          // Asignar al área
          await supabaseAssign(areaObj.id, saved.id);
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
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 820, width: '96vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

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

          {/* ══ UPLOAD ══ */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                  <MdInfo style={{ color: '#34d399' }} /> 35 columnas con catálogos laborales colombianos
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Solo <strong>cedula, nombre, cargo y area</strong> son obligatorios. El resto se autollena con defaults del área.
                </div>
              </div>

              {areas.length === 0 && (
                <div className="cw-alert cw-alert--warning">
                  ⚠️ Aún no has creado áreas. Crea al menos una en la sección de Áreas antes de importar empleados.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={useAreaDefaultSalario} onChange={e => setUseAreaDefaultSalario(e.target.checked)} />
                  <span>Usar salario del área si no se especifica valor_hora en el archivo</span>
                </label>
              </div>

              <button className="cw-btn cw-btn--secondary" onClick={() => generateTemplate(areas)} style={{ alignSelf: 'flex-start' }} disabled={areas.length === 0}>
                <MdDownload /> Descargar plantilla Excel con tus áreas ({areas.length})
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

          {/* ══ PREVIEW ══ */}
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

          {/* ══ IMPORTING ══ */}
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

          {/* ══ DONE ══ */}
          {step === 'done' && results && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                {results.errors.length === 0 ? '🎉' : results.success > 0 ? '⚠️' : '🚫'}
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>
                {results.errors.length === 0
                  ? '¡Importación exitosa!'
                  : results.success > 0
                    ? 'Importación parcial'
                    : 'No se pudo importar'}
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

// Helpers
function parseFecha(val) {
  if (!val) return null;
  // Acepta Date de Excel (número), YYYY-MM-DD, o DD/MM/YYYY
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

async function supabaseAssign(areaId, employeeId) {
  const { supabase } = await import('../config/supabaseClient');
  await supabase
    .from('area_employees')
    .delete()
    .eq('employee_id', employeeId);
  await supabase
    .from('area_employees')
    .insert([{ area_id: areaId, employee_id: employeeId }]);
}
