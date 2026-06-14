// Test unitario de cleanEmployeeData — replica la función del hook
// (sin React ni useAuth)

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

function cleanEmployeeData(data) {
  const out = { ...data };
  const fieldsWithZeroDefault = ['numero_hijos', 'numero_dependientes'];
  Object.keys(out).forEach(k => {
    if (out[k] === undefined) out[k] = null;
    else if (out[k] === '' && !fieldsWithZeroDefault.includes(k)) out[k] = null;
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
  if (out.nivel_riesgo_arl === '' || out.nivel_riesgo_arl === null) {
    out.nivel_riesgo_arl = 1;
  } else {
    const n = parseInt(String(out.nivel_riesgo_arl), 10);
    out.nivel_riesgo_arl = (isNaN(n) || n < 1 || n > 5) ? 1 : n;
  }
  if (out.tipo_contrato && !TIPOS_CONTRATO_VALIDOS.has(String(out.tipo_contrato).toUpperCase())) {
    out.tipo_contrato = 'INDEFINIDO';
  }
  if (out.tipo_documento && !TIPOS_DOC_VALIDOS.has(String(out.tipo_documento).toUpperCase())) {
    out.tipo_documento = 'CC';
  }
  if (out.genero && !GENEROS_VALIDOS.has(String(out.genero).toUpperCase())) out.genero = null;
  if (out.estado_civil && !ESTADOS_CIVIL_VALIDOS.has(String(out.estado_civil).toUpperCase())) out.estado_civil = null;
  if (out.nivel_cargo && !NIVELES_CARGO_VALIDOS.has(String(out.nivel_cargo).toUpperCase())) out.nivel_cargo = 'JUNIOR';
  if (out.nivel_educacion && !NIVELES_EDUCACION_VALIDOS.has(String(out.nivel_educacion).toUpperCase())) out.nivel_educacion = null;
  if (out.jornada_tipo && !TIPOS_JORNADA_VALIDOS.has(String(out.jornada_tipo).toUpperCase())) out.jornada_tipo = 'DIURNA';
  if (out.tipo_cuenta && !TIPOS_CUENTA_VALIDOS.has(String(out.tipo_cuenta).toUpperCase())) out.tipo_cuenta = 'AHORROS';
  if (out.afp_tipo && !AFP_TIPOS_VALIDOS.has(String(out.afp_tipo).toUpperCase())) out.afp_tipo = 'RAZON';
  const dateFields = ['fecha_nacimiento','fecha_ingreso','fecha_fin_contrato','periodo_prueba_hasta','fecha_etapa_lectiva_inicio','fecha_etapa_lectiva_fin','vencimiento_licencia'];
  dateFields.forEach(f => {
    if (out[f] === '' || out[f] === undefined) out[f] = null;
    else if (typeof out[f] === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(out[f])) out[f] = null;
  });
  return out;
}

let pass = 0, fail = 0;
const errors = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`✅ ${name}`); }
  catch (e) { fail++; errors.push({ test: name, error: e.message }); console.log(`❌ ${name}: ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEquals(actual, expected, msg) { if (actual !== expected) throw new Error(msg || `Expected "${expected}" got "${actual}"`); }

// Test bugs originales
test('FIX 1: numero_hijos "" → 0', () => { const r = cleanEmployeeData({ numero_hijos: '' }); assertEquals(r.numero_hijos, 0); });
test('FIX 2: numero_hijos "3" → 3', () => { const r = cleanEmployeeData({ numero_hijos: '3' }); assertEquals(r.numero_hijos, 3); });
test('FIX 3: horas_semanales_contrato "" → 42', () => { const r = cleanEmployeeData({ horas_semanales_contrato: '' }); assertEquals(r.horas_semanales_contrato, 42); });
test('FIX 4: horas_semanales_contrato null → 42', () => { const r = cleanEmployeeData({ horas_semanales_contrato: null }); assertEquals(r.horas_semanales_contrato, 42); });
test('FIX 5: horas_semanales_contrato "0" → 42', () => { const r = cleanEmployeeData({ horas_semanales_contrato: '0' }); assertEquals(r.horas_semanales_contrato, 42); });
test('FIX 6: horas_semanales_contrato "200" → 168', () => { const r = cleanEmployeeData({ horas_semanales_contrato: '200' }); assertEquals(r.horas_semanales_contrato, 168); });
test('FIX 7: nivel_riesgo_arl 99 → 1', () => { const r = cleanEmployeeData({ nivel_riesgo_arl: 99 }); assertEquals(r.nivel_riesgo_arl, 1); });
test('FIX 8: nivel_riesgo_arl 0 → 1', () => { const r = cleanEmployeeData({ nivel_riesgo_arl: 0 }); assertEquals(r.nivel_riesgo_arl, 1); });
test('FIX 9: nivel_riesgo_arl 3 → 3', () => { const r = cleanEmployeeData({ nivel_riesgo_arl: 3 }); assertEquals(r.nivel_riesgo_arl, 3); });
test('FIX 10: tipo_contrato inválido → INDEFINIDO', () => { const r = cleanEmployeeData({ tipo_contrato: 'TIPO_LOCO' }); assertEquals(r.tipo_contrato, 'INDEFINIDO'); });
test('FIX 11: tipo_documento inválido → CC', () => { const r = cleanEmployeeData({ tipo_documento: 'XYZ' }); assertEquals(r.tipo_documento, 'CC'); });
test('FIX 12: genero inválido → null', () => { const r = cleanEmployeeData({ genero: 'BINARIO' }); assertEquals(r.genero, null); });
test('FIX 13: jornada_tipo inválido → DIURNA', () => { const r = cleanEmployeeData({ jornada_tipo: 'LOCA' }); assertEquals(r.jornada_tipo, 'DIURNA'); });
test('FIX 14: nivel_cargo inválido → JUNIOR', () => { const r = cleanEmployeeData({ nivel_cargo: 'PATRON' }); assertEquals(r.nivel_cargo, 'JUNIOR'); });
test('FIX 15: tipo_cuenta inválido → AHORROS', () => { const r = cleanEmployeeData({ tipo_cuenta: 'PLAZO_FIJO' }); assertEquals(r.tipo_cuenta, 'AHORROS'); });
test('FIX 16: afp_tipo inválido → RAZON', () => { const r = cleanEmployeeData({ afp_tipo: 'LOCO' }); assertEquals(r.afp_tipo, 'RAZON'); });
test('FIX 17: fecha "abc" → null', () => { const r = cleanEmployeeData({ fecha_nacimiento: 'abc' }); assertEquals(r.fecha_nacimiento, null); });
test('FIX 18: fecha formato incorrecto → null', () => { const r = cleanEmployeeData({ fecha_ingreso: '01/15/2025' }); assertEquals(r.fecha_ingreso, null); });
test('FIX 19: fecha ISO válida se mantiene', () => { const r = cleanEmployeeData({ fecha_ingreso: '2025-01-15' }); assertEquals(r.fecha_ingreso, '2025-01-15'); });
test('FIX 20: valor_hora string → number', () => { const r = cleanEmployeeData({ valor_hora: '12500' }); assertEquals(r.valor_hora, 12500); });
test('FIX 21: valor_hora "abc" → null', () => { const r = cleanEmployeeData({ valor_hora: 'abc' }); assertEquals(r.valor_hora, null); });
test('FIX 22: dias_descanso_semana 3 → 1 (no válido)', () => { const r = cleanEmployeeData({ dias_descanso_semana: 3 }); assertEquals(r.dias_descanso_semana, 1); });
test('FIX 23: dias_descanso_semana 2 se mantiene', () => { const r = cleanEmployeeData({ dias_descanso_semana: 2 }); assertEquals(r.dias_descanso_semana, 2); });
test('FIX 24: 9 tipos de contrato válidos', () => {
  for (const t of ['INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO','PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL']) {
    const r = cleanEmployeeData({ tipo_contrato: t });
    assertEquals(r.tipo_contrato, t, `falló para ${t}`);
  }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 RESULTADO: ${pass} pasaron · ${fail} fallaron`);
console.log('═══════════════════════════════════════════════════════════');
if (errors.length > 0) { errors.forEach((e, i) => console.log(`${i+1}. ${e.test}: ${e.error}`)); process.exit(1); }
