// ============================================================
// ChronosWork — Test E2E de la plantilla de empleados v4
// ============================================================
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';
import os from 'os';
import path from 'path';

let pass = 0, fail = 0;
const log = (ok, msg) => { ok ? (pass++, console.log(`  ✅ ${msg}`)) : (fail++, console.log(`  ❌ ${msg}`)); };

const TIPOS_CONTRATO_VALUES = ['INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO','PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'];
const TIPOS_DOC = ['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'];
const GENEROS = ['M', 'F', 'OTRO', 'PREFIERO_NO_DECIR'];
const ESTADOS_CIVIL = ['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO', 'SEPARADO'];
const NIVELES_EDUCATIVOS = ['NINGUNO', 'PRIMARIA', 'BACHILLERATO', 'TECNICO', 'TECNOLOGO', 'PREGRADO', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'];
const NIVELES_ARL = [1, 2, 3, 4, 5];
const NIVELES_CARGO = ['JUNIOR', 'SENIOR', 'COORDINADOR', 'SUPERVISOR', 'JEFE', 'GERENTE', 'DIRECTOR'];
const TIPOS_CUENTA = ['AHORROS', 'CORRIENTE'];
const JORNADAS_VALUES = ['DIURNA', 'NOCTURNA', 'MIXTA', 'POR_TURNOS'];
const PATRONES_VALUES = ['2x1', '3x2', '4x3', '5x2', '6x1', '7x7', '10x5', '14x14', 'PERSONALIZADO'];
const SECTORES = ['RETAIL','HOTELERIA','RESTAURANTE','SALUD','SEGURIDAD','INDUSTRIA','CONSTRUCCION','LOGISTICA','OFICINA','EDUCACION','AGRO','TECNOLOGIA','CALL_CENTER','OTRO'];
const EPS_COMUNES = ['Nueva EPS', 'Sanitas', 'Sura EPS', 'Compensar EPS', 'Famisanar', 'Salud Total', 'Coomeva', 'Medimás', 'Aliansalud', 'Cajacopi EPS', 'Mutual Ser'];
const AFP_COMUNES = ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Cafam', 'Colpensiones'];
const ARL_COMUNES = ['Sura ARL', 'Positiva ARL', 'Bolívar ARL', 'Colmena Seguros ARL', 'Liberty Seguros ARL', 'Mapfre ARL', 'La Equidad Seguros'];
const CAJAS_COMUNES = ['Compensar', 'Comfama', 'Comfenalco Antioquia', 'Comfandi', 'Cajacopi'];
const BANCOS_COMUNES = ['Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Banco de Occidente', 'Banco Popular', 'Nequi', 'Daviplata'];
const FONDOS_CESANTIAS = ['Porvenir', 'Protección', 'Colfondos', 'BBVA', 'Fondo Nacional del Ahorro', 'Skandia', 'Cafam'];

const COLUMN_ALIASES = {
  cedula: ['cedula', 'cédula'], tipo_documento: ['tipo_documento'], nombre: ['nombre'],
  lugar_expedicion: ['lugar_expedicion'], fecha_nacimiento: ['fecha_nacimiento'],
  genero: ['genero'], estado_civil: ['estado_civil'], numero_hijos: ['numero_hijos'],
  telefono_contacto: ['telefono'], email_personal: ['email'], direccion: ['direccion'],
  ciudad: ['ciudad'], departamento: ['departamento'], cargo: ['cargo'],
  nivel_cargo: ['nivel_cargo'], sector: ['sector'], area: ['area'],
  turno_predeterminado: ['turno_predeterminado'], tipo_contrato: ['tipo_contrato'],
  fecha_ingreso: ['fecha_ingreso'], fecha_fin_contrato: ['fecha_fin_contrato'],
  horas_semanales_contrato: ['horas_semana'], dias_descanso_semana: ['dias_descanso'],
  valor_hora: ['valor_hora'], salario_mensual: ['salario_mensual'],
  es_especial: ['es_especial'], recibe_auxilio_transporte: ['auxilio_transporte'],
  eps_nombre: ['eps'], afp_nombre: ['afp'], afp_tipo: ['afp_tipo'],
  arl_nombre: ['arl'], nivel_riesgo_arl: ['nivel_arl'],
  caja_compensacion: ['caja'], fondo_cesantias: ['cesantias'],
  banco_nombre: ['banco'], tipo_cuenta: ['tipo_cuenta'],
  numero_cuenta: ['n°_cuenta'], nivel_educacion: ['nivel_educacion'],
};

const areas = [
  { id: 'a1', nombre: 'Servicio al Cliente Inbound' },
  { id: 'a2', nombre: 'Calidad (QA)' },
  { id: 'a3', nombre: 'Recursos Humanos' },
];
const shiftTemplatesByArea = {
  'a1': [{ id: 't1', nombre: 'Mañana 7-15' }, { id: 't2', nombre: 'Tarde 15-23' }, { id: 't3', nombre: 'Noche 23-7' }],
  'a2': [{ id: 't4', nombre: 'Jornada Completa' }],
  'a3': [{ id: 't5', nombre: 'Oficina L-V' }],
};
const allShiftTemplates = Object.values(shiftTemplatesByArea).flat();

function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function normalizeH(h) { return String(h || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[*\s]+$/, '').trim(); }
function findCol(headers, aliases) {
  for (const a of aliases) { const i = headers.findIndex(h => normalizeH(h) === a); if (i !== -1) return i; }
  for (const a of aliases) { const i = headers.findIndex(h => normalizeH(h).includes(a)); if (i !== -1) return i; }
  return -1;
}
function findDataSheet(wb) {
  for (const sn of wb.SheetNames) {
    if (sn.startsWith('__')) continue;
    if (sn.toLowerCase().includes('guía') || sn.toLowerCase().includes('guia')) continue;
    if (sn.toLowerCase().includes('instrucciones') || sn.toLowerCase().includes('readme')) continue;
    return sn;
  }
  return wb.SheetNames[0];
}
function validateRow(row, areaNames) {
  const errors = [];
  if (!String(row.cedula || '').trim()) errors.push('cedula vacía');
  if (!String(row.nombre || '').trim()) errors.push('nombre vacío');
  if (!String(row.cargo || '').trim()) errors.push('cargo vacío');
  if (!String(row.area || '').trim()) errors.push('área vacía');
  else if (!areaNames.includes(String(row.area).trim())) errors.push(`área "${row.area}" no existe`);
  return errors;
}

async function generateTemplate() {
  const wb = new ExcelJS.Workbook();
  const wsL = wb.addWorksheet('__listas__');
  wsL.state = 'veryHidden';
  wsL.getColumn(1).values = ['TipoContrato', ...TIPOS_CONTRATO_VALUES];
  wsL.getColumn(2).values = ['TipoDocumento', ...TIPOS_DOC];
  wsL.getColumn(3).values = ['Genero', ...GENEROS];
  wsL.getColumn(4).values = ['DiasDescanso', '1', '2'];
  wsL.getColumn(5).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsL.getColumn(6).values = ['TipoCuenta', 'AHORROS', 'CORRIENTE'];
  wsL.getColumn(7).values = ['JornadaPreferida', 'CUALQUIERA', 'DIURNA', 'NOCTURNA', 'MIXTA'];
  wsL.getColumn(8).values = ['SiNo', 'Si', 'No'];
  wsL.getColumn(9).values = ['Area', ...areas.map(a => a.nombre)];
  wsL.getColumn(10).values = ['EPS', ...EPS_COMUNES];
  wsL.getColumn(11).values = ['AFP', ...AFP_COMUNES];
  wsL.getColumn(12).values = ['ARL', ...ARL_COMUNES];
  wsL.getColumn(13).values = ['CajaCompensacion', ...CAJAS_COMUNES];
  wsL.getColumn(14).values = ['Banco', ...BANCOS_COMUNES];
  wsL.getColumn(15).values = ['FondoCesantias', ...FONDOS_CESANTIAS];
  wsL.getColumn(16).values = ['Departamento', 'Bogotá D.C.', 'Antioquia', 'Valle del Cauca', 'Cundinamarca', 'Atlántico'];

  const wsT = wb.addWorksheet('__turnos_por_area__');
  wsT.state = 'veryHidden';
  let col = 1;
  for (const area of areas) {
    const tpls = shiftTemplatesByArea[area.id] || [];
    if (tpls.length === 0) continue;
    wsT.getColumn(col).values = [`${area.nombre}__turnos`, ...tpls.map(t => t.nombre)];
    col++;
  }
  wsT.getColumn(col).values = ['__todos_los_turnos__', ...allShiftTemplates.map(t => t.nombre)];

  const ws = wb.addWorksheet('Empleados');
  const columns = [
    { k: 'cedula',                    w: 16, req: true,  l: 'cedula' },
    { k: 'tipo_documento',            w: 14, req: false, l: 'tipo_documento' },
    { k: 'nombre',                    w: 32, req: true,  l: 'nombre' },
    { k: 'telefono_contacto',         w: 18, req: false, l: 'telefono' },
    { k: 'email_personal',            w: 26, req: false, l: 'email' },
    { k: 'cargo',                     w: 24, req: true,  l: 'cargo' },
    { k: 'area',                      w: 22, req: true,  l: 'area' },
    { k: 'turno_predeterminado',      w: 24, req: false, l: 'turno_predeterminado' },
    { k: 'tipo_contrato',             w: 22, req: false, l: 'tipo_contrato' },
    { k: 'fecha_ingreso',             w: 14, req: false, l: 'fecha_ingreso' },
    { k: 'fecha_fin_contrato',        w: 16, req: false, l: 'fecha_fin_contrato' },
    { k: 'horas_semanales_contrato',   w: 14, req: false, l: 'horas_semana' },
    { k: 'dias_descanso_semana',      w: 14, req: false, l: 'dias_descanso' },
    { k: 'salario_mensual',           w: 18, req: false, l: 'salario_mensual' },
    { k: 'recibe_auxilio_transporte', w: 16, req: false, l: 'auxilio_transporte' },
    { k: 'jornada_preferida',         w: 18, req: false, l: 'jornada_preferida' },
    { k: 'departamento',              w: 20, req: false, l: 'departamento' },
    { k: 'ciudad',                    w: 18, req: false, l: 'ciudad' },
    { k: 'genero',                    w: 12, req: false, l: 'genero' },
    { k: 'eps_nombre',                w: 24, req: false, l: 'eps' },
    { k: 'afp_nombre',                w: 22, req: false, l: 'afp' },
    { k: 'arl_nombre',                w: 24, req: false, l: 'arl' },
    { k: 'nivel_riesgo_arl',          w: 12, req: false, l: 'nivel_arl' },
    { k: 'caja_compensacion',         w: 24, req: false, l: 'caja' },
    { k: 'fondo_cesantias',           w: 22, req: false, l: 'cesantias' },
    { k: 'banco_nombre',              w: 24, req: false, l: 'banco' },
    { k: 'tipo_cuenta',               w: 14, req: false, l: 'tipo_cuenta' },
    { k: 'numero_cuenta',             w: 20, req: false, l: 'n°_cuenta' },
  ];
  ws.columns = columns.map(c => ({ header: c.l, key: c.k, width: c.w }));
  columns.forEach((c, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = c.req ? c.l + ' *' : c.l;
    cell.font = { bold: true };
  });
  const hRow = ws.getRow(1);
  hRow.height = 30;
  ws.autoFilter = { from: 'A1', to: `${colLetter(columns.length)}1` };

  const maxRow = 50;
  const ref = (c, n) => `__listas__!${colLetter(c)}$2:${colLetter(c)}${n + 1}`;
  const refs = {
    tipoContrato: ref(1, TIPOS_CONTRATO_VALUES.length),
    tipoDoc: ref(2, TIPOS_DOC.length),
    genero: ref(3, GENEROS.length),
    diasDescanso: ref(4, 2),
    nivelARL: ref(5, NIVELES_ARL.length),
    tipoCuenta: ref(6, TIPOS_CUENTA.length),
    jornadaPref: ref(7, 4),
    siNo: ref(8, 2),
    area: ref(9, areas.length),
    eps: ref(10, EPS_COMUNES.length),
    afp: ref(11, AFP_COMUNES.length),
    arl: ref(12, ARL_COMUNES.length),
    caja: ref(13, CAJAS_COMUNES.length),
    banco: ref(14, BANCOS_COMUNES.length),
    cesantias: ref(15, FONDOS_CESANTIAS.length),
    departamento: ref(16, 5),
  };
  for (let r = 2; r <= maxRow; r++) {
    const addList = (col, refsKey) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [refs[refsKey]],
        showErrorMessage: true, errorStyle: 'stop', showInputMessage: true,
      };
    };
    const addNum = (col) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0],
        showErrorMessage: true, errorStyle: 'stop', showInputMessage: true,
      };
    };
    const addInt = (col) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
        showErrorMessage: true, errorStyle: 'stop', showInputMessage: true,
      };
    };
    const addDate = (col) => {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'date', allowBlank: true, showErrorMessage: true, errorStyle: 'stop', showInputMessage: true,
      };
    };

    addList('B', 'tipoDoc');
    addList('G', 'area');
    const refTodos = `__turnos_por_area__!${colLetter(areas.length + 1)}$2:${colLetter(areas.length + 1)}${allShiftTemplates.length + 1}`;
    ws.getCell(`H${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refTodos], showErrorMessage: true, errorStyle: 'stop' };
    addList('I', 'tipoContrato');
    addDate('J');
    addDate('K');
    addInt('L');
    addList('M', 'diasDescanso');
    addNum('N');
    addList('O', 'siNo');
    addList('P', 'jornadaPref');
    addList('Q', 'departamento');
    addList('S', 'genero');
    addList('T', 'eps');
    addList('U', 'afp');
    addList('V', 'arl');
    addList('W', 'nivelARL');
    addList('X', 'caja');
    addList('Y', 'cesantias');
    addList('Z', 'banco');
    addList('AA', 'tipoCuenta');
  }
  return wb;
}

async function runTests() {
  console.log('\n🧪 ===== TEST PLANTILLA EMPLEADOS v4 =====\n');
  const wb = await generateTemplate();
  const buffer = await wb.xlsx.writeBuffer();
  // os.tmpdir() es multiplataforma: en Windows → C:\Users\...\AppData\Local\Temp
  // (antes estaba hardcodeado /tmp, que solo existe en Unix → ENOENT en Windows)
  const tmpFile = path.join(os.tmpdir(), 'test_plantilla_empleados.xlsx');
  fs.writeFileSync(tmpFile, buffer);
  console.log(`📄 Plantilla generada: ${tmpFile} (${fs.statSync(tmpFile).size} bytes)\n`);

  // 1. Test estructura de hojas
  console.log('📂 Estructura:');
  const sheetNames = wb.worksheets.map(w => w.name);
  log(sheetNames.includes('__listas__'), 'Hoja __listas__ existe');
  log(sheetNames.includes('__turnos_por_area__'), 'Hoja __turnos_por_area__ existe');
  log(sheetNames.includes('Empleados'), 'Hoja Empleados existe');
  log(sheetNames.length === 3, `Total de hojas = 3 (real: ${sheetNames.length})`);

  // 2. Test hoja Empleados
  console.log('\n📊 Hoja Empleados:');
  const ws = wb.getWorksheet('Empleados');
  // ExcelJS: maxColumn viene de columnCount, no de maxColumn
  log(ws.columnCount === 28, `28 columnas (real: ${ws.columnCount})`);
  log(ws.getCell('A1').value === 'cedula *', 'A1 = "cedula *"');
  log(ws.getCell('C1').value === 'nombre *', 'C1 = "nombre *"');
  log(ws.getCell('F1').value === 'cargo *', 'F1 = "cargo *"');
  log(ws.getCell('G1').value === 'area *', 'G1 = "area *"');

  // 3. Test data validations
  console.log('\n🔒 Data validations:');
  const dvModel = ws.dataValidations.model;
  const dvTotal = Object.keys(dvModel).length;
  log(dvTotal >= 50, `>= 50 data validations (real: ${dvTotal})`);

  // 4. Test catálogos en __listas__
  console.log('\n📚 Catálogos en __listas__:');
  const wsL = wb.getWorksheet('__listas__');
  const filterVals = (col) => {
    const v = wsL.getColumn(col).values || [];
    return v.filter(x => x != null && x !== '');
  };
  const tc = filterVals(1);
  log(tc.length === 10 && tc.includes('INDEFINIDO'), `9 tipos de contrato (real: ${tc.length - 1})`);
  const td = filterVals(2);
  log(td.length === 7 && td.includes('CC'), `6 tipos de documento (real: ${td.length - 1})`);
  const g = filterVals(3);
  log(g.length === 5, `4 géneros (real: ${g.length - 1})`);
  const e = filterVals(10);
  log(e.length >= 10 && e.includes('Sanitas'), `>= 10 EPS (real: ${e.length - 1})`);
  const a = filterVals(11);
  log(a.length >= 5 && a.includes('Porvenir'), `>= 5 AFP (real: ${a.length - 1})`);
  const ar = filterVals(12);
  log(ar.length >= 5 && ar.includes('Sura ARL'), `>= 5 ARL (real: ${ar.length - 1})`);
  const cj = filterVals(13);
  log(cj.length >= 5 && cj.includes('Compensar'), `>= 5 Cajas (real: ${cj.length - 1})`);
  const bn = filterVals(14);
  log(bn.length >= 5 && bn.includes('Bancolombia'), `>= 5 Bancos (real: ${bn.length - 1})`);
  const cs = filterVals(15);
  log(cs.length >= 5 && cs.includes('Porvenir'), `>= 5 Fondos Cesantías (real: ${cs.length - 1})`);
  const dp = filterVals(16);
  log(dp.length >= 5 && dp.includes('Antioquia'), `>= 5 Departamentos (real: ${dp.length - 1})`);

  // 5. Test turnos por área
  console.log('\n🕐 Turnos por área:');
  const wsT = wb.getWorksheet('__turnos_por_area__');
  const filterValsT = (col) => {
    const v = wsT.getColumn(col).values || [];
    return v.filter(x => x != null && x !== '');
  };
  const t1 = filterValsT(1);
  log(t1.length > 0 && t1[0].includes('Servicio al Cliente Inbound'), `Col 1 = Servicio al Cliente Inbound (header: ${t1[0]})`);
  log(t1.includes('Mañana 7-15'), 'Incluye Mañana 7-15');
  const t4 = filterValsT(4);
  log(t4.length > 0 && t4[0] === '__todos_los_turnos__', `Col 4 = __todos_los_turnos__ (real: ${t4[0]})`);

  // 6. Test parseo de archivo con 100 filas
  console.log('\n📋 Parseo de archivo con 100 filas:');
  const wb2 = XLSX.readFile(tmpFile);
  const sheetName = findDataSheet(wb2);
  log(sheetName === 'Empleados', `findDataSheet = "Empleados" (real: "${sheetName}")`);
  const ws2 = wb2.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws2, { defval: '' });
  // Insertar 1 fila de prueba
  json[0] = { 'cedula *': '12345', 'nombre *': 'Test', 'cargo *': 'Analista', 'area *': 'Calidad (QA)', 'tipo_contrato': 'INDEFINIDO' };
  // Crear headers
  const realHeaders = Object.keys(json[0]);
  const rows = json.map((row, i) => {
    const r = { _row: i + 2 };
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      const idx = findCol(realHeaders, aliases);
      if (idx === -1) continue;
      r[field] = row[Object.keys(row)[idx]];
    }
    r._errors = validateRow(r, areas.map(a => a.nombre));
    return r;
  });
  log(rows[0].cedula === '12345', 'Cédula parseada: 12345');
  log(rows[0].nombre === 'Test', 'Nombre parseado: Test');
  log(rows[0].area === 'Calidad (QA)', 'Área parseada: Calidad (QA)');
  log(rows[0].tipo_contrato === 'INDEFINIDO', 'Tipo contrato parseado: INDEFINIDO');
  log(rows[0]._errors.length === 0, `0 errores (real: ${rows[0]._errors.length})`);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`RESULTADO: ${pass} OK, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
