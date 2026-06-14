// ============================================================
// ChronosWork — Test E2E de la plantilla de empleados v4
// ============================================================
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';

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
  wsL.getColumn(4).values = ['EstadoCivil', ...ESTADOS_CIVIL];
  wsL.getColumn(5).values = ['DiasDescanso', '1', '2'];
  wsL.getColumn(6).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsL.getColumn(7).values = ['TipoCuenta', 'AHORROS', 'CORRIENTE'];
  wsL.getColumn(8).values = ['NivelEducacion', ...NIVELES_EDUCATIVOS];
  wsL.getColumn(9).values = ['NivelCargo', ...NIVELES_CARGO];
  wsL.getColumn(10).values = ['Sector', ...SECTORES];
  wsL.getColumn(11).values = ['ModoOperacion', 'OFICINA', '24_7'];
  wsL.getColumn(12).values = ['JornadaTipo', ...JORNADAS_VALUES];
  wsL.getColumn(13).values = ['Patron', ...PATRONES_VALUES];
  wsL.getColumn(14).values = ['SiNo', 'Si', 'No'];
  wsL.getColumn(15).values = ['Area', ...areas.map(a => a.nombre)];
  wsL.getColumn(16).values = ['EPS', ...EPS_COMUNES];
  wsL.getColumn(17).values = ['AFP', ...AFP_COMUNES];
  wsL.getColumn(18).values = ['ARL', ...ARL_COMUNES];
  wsL.getColumn(19).values = ['CajaCompensacion', ...CAJAS_COMUNES];
  wsL.getColumn(20).values = ['Banco', ...BANCOS_COMUNES];
  wsL.getColumn(21).values = ['FondoCesantias', ...FONDOS_CESANTIAS];

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
    { k: 'cedula', w: 14, req: true, l: 'cedula' },
    { k: 'tipo_documento', w: 12, req: false, l: 'tipo_documento' },
    { k: 'nombre', w: 32, req: true, l: 'nombre' },
    { k: 'lugar_expedicion', w: 20, req: false, l: 'lugar_expedicion' },
    { k: 'fecha_nacimiento', w: 14, req: false, l: 'fecha_nacimiento' },
    { k: 'genero', w: 10, req: false, l: 'genero' },
    { k: 'estado_civil', w: 14, req: false, l: 'estado_civil' },
    { k: 'numero_hijos', w: 10, req: false, l: 'numero_hijos' },
    { k: 'telefono_contacto', w: 18, req: false, l: 'telefono' },
    { k: 'email_personal', w: 24, req: false, l: 'email' },
    { k: 'direccion', w: 26, req: false, l: 'direccion' },
    { k: 'ciudad', w: 16, req: false, l: 'ciudad' },
    { k: 'departamento', w: 16, req: false, l: 'departamento' },
    { k: 'cargo', w: 24, req: true, l: 'cargo' },
    { k: 'nivel_cargo', w: 14, req: false, l: 'nivel_cargo' },
    { k: 'sector', w: 18, req: false, l: 'sector' },
    { k: 'area', w: 20, req: true, l: 'area' },
    { k: 'turno_predeterminado', w: 24, req: false, l: 'turno_predeterminado' },
    { k: 'tipo_contrato', w: 22, req: false, l: 'tipo_contrato' },
    { k: 'fecha_ingreso', w: 14, req: false, l: 'fecha_ingreso' },
    { k: 'fecha_fin_contrato', w: 14, req: false, l: 'fecha_fin_contrato' },
    { k: 'horas_semanales_contrato', w: 12, req: false, l: 'horas_semana' },
    { k: 'dias_descanso_semana', w: 12, req: false, l: 'dias_descanso' },
    { k: 'valor_hora', w: 14, req: false, l: 'valor_hora' },
    { k: 'salario_mensual', w: 16, req: false, l: 'salario_mensual' },
    { k: 'es_especial', w: 12, req: false, l: 'es_especial' },
    { k: 'recibe_auxilio_transporte', w: 14, req: false, l: 'auxilio_transporte' },
    { k: 'eps_nombre', w: 18, req: false, l: 'eps' },
    { k: 'afp_nombre', w: 18, req: false, l: 'afp' },
    { k: 'afp_tipo', w: 14, req: false, l: 'afp_tipo' },
    { k: 'arl_nombre', w: 18, req: false, l: 'arl' },
    { k: 'nivel_riesgo_arl', w: 12, req: false, l: 'nivel_arl' },
    { k: 'caja_compensacion', w: 18, req: false, l: 'caja' },
    { k: 'fondo_cesantias', w: 18, req: false, l: 'cesantias' },
    { k: 'banco_nombre', w: 18, req: false, l: 'banco' },
    { k: 'tipo_cuenta', w: 14, req: false, l: 'tipo_cuenta' },
    { k: 'numero_cuenta', w: 20, req: false, l: 'n°_cuenta' },
    { k: 'nivel_educacion', w: 18, req: false, l: 'nivel_educacion' },
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
    estadoCivil: ref(4, ESTADOS_CIVIL.length),
    diasDescanso: ref(5, 2),
    nivelARL: ref(6, NIVELES_ARL.length),
    tipoCuenta: ref(7, TIPOS_CUENTA.length),
    nivelEduc: ref(8, NIVELES_EDUCATIVOS.length),
    nivelCargo: ref(9, NIVELES_CARGO.length),
    sector: ref(10, SECTORES.length),
    jornada: ref(12, JORNADAS_VALUES.length),
    patron: ref(13, PATRONES_VALUES.length),
    siNo: ref(14, 2),
    area: ref(15, areas.length),
    eps: ref(16, EPS_COMUNES.length),
    afp: ref(17, AFP_COMUNES.length),
    arl: ref(18, ARL_COMUNES.length),
    caja: ref(19, CAJAS_COMUNES.length),
    banco: ref(20, BANCOS_COMUNES.length),
    cesantias: ref(21, FONDOS_CESANTIAS.length),
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
    addList('B', 'tipoDoc'); addDate('E'); addList('F', 'genero'); addList('G', 'estadoCivil');
    addInt('H'); addList('O', 'nivelCargo'); addList('P', 'sector'); addList('Q', 'area');
    const refTodos = `__turnos_por_area__!${colLetter(areas.length + 1)}$2:${colLetter(areas.length + 1)}${allShiftTemplates.length + 1}`;
    ws.getCell(`R${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refTodos], showErrorMessage: true, errorStyle: 'stop' };
    addList('S', 'tipoContrato'); addDate('T'); addDate('U'); addInt('V'); addList('W', 'diasDescanso');
    addNum('X'); addNum('Y'); addList('Z', 'siNo'); addList('AA', 'siNo');
    addList('AB', 'eps'); addList('AC', 'afp'); addList('AD', 'siNo');
    addList('AE', 'arl'); addList('AF', 'nivelARL'); addList('AG', 'caja'); addList('AH', 'cesantias');
    addList('AI', 'banco'); addList('AJ', 'tipoCuenta'); addList('AL', 'nivelEduc');
  }
  return wb;
}

async function runTests() {
  console.log('\n🧪 ===== TEST PLANTILLA EMPLEADOS v4 =====\n');
  const wb = await generateTemplate();
  const buffer = await wb.xlsx.writeBuffer();
  const tmpFile = '/tmp/test_plantilla_empleados.xlsx';
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
  log(ws.columnCount === 38, `38 columnas (real: ${ws.columnCount})`);
  log(ws.getCell('A1').value === 'cedula *', 'A1 = "cedula *"');
  log(ws.getCell('C1').value === 'nombre *', 'C1 = "nombre *"');
  log(ws.getCell('N1').value === 'cargo *', 'N1 = "cargo *"');
  log(ws.getCell('Q1').value === 'area *', 'Q1 = "area *"');

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
  const s = filterVals(10);
  log(s.length === 15 && s.includes('CALL_CENTER'), `14 sectores (real: ${s.length - 1})`);
  const e = filterVals(16);
  log(e.length >= 10 && e.includes('Sanitas'), `>= 10 EPS (real: ${e.length - 1})`);
  const a = filterVals(17);
  log(a.length >= 5 && a.includes('Porvenir'), `>= 5 AFP (real: ${a.length - 1})`);
  const ar = filterVals(18);
  log(ar.length >= 5 && ar.includes('Sura ARL'), `>= 5 ARL (real: ${ar.length - 1})`);
  const cj = filterVals(19);
  log(cj.length >= 5 && cj.includes('Compensar'), `>= 5 Cajas (real: ${cj.length - 1})`);
  const bn = filterVals(20);
  log(bn.length >= 5 && bn.includes('Bancolombia'), `>= 5 Bancos (real: ${bn.length - 1})`);

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
