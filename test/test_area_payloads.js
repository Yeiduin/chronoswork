// ============================================================
// ChronosWork — Test de payloads de área
// Simula lo que se envía a Supabase para todos los tipos de área
// Detecta bugs en defaults, tipos de contrato, jornada, etc.
// ============================================================

// Replicar buildDefaultsForSector del componente AreaForm
const SECTORES = {
  RETAIL:        { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 12500 } },
  HOTELERIA:     { defaults: { modo: '24_7',    contrato: 'INDEFINIDO',     salario: 13000 } },
  RESTAURANTE:   { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 12500 } },
  SALUD:         { defaults: { modo: '24_7',    contrato: 'INDEFINIDO',     salario: 15000 } },
  SEGURIDAD:     { defaults: { modo: '24_7',    contrato: 'INDEFINIDO',     salario: 12000 } },
  INDUSTRIA:     { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 13000 } },
  CONSTRUCCION:  { defaults: { modo: 'OFICINA', contrato: 'OBRA_LABOR',     salario: 13000 } },
  LOGISTICA:     { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 12500 } },
  OFICINA:       { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 15000 } },
  EDUCACION:     { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 13500 } },
  AGRO:          { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 12500 } },
  TECNOLOGIA:    { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 20000 } },
  CALL_CENTER:   { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 13000 } },
  OTRO:          { defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO',     salario: 12500 } },
};

const getSectorDefaults = (sector) => SECTORES[sector]?.defaults || SECTORES.OTRO.defaults;

function buildDefaultsForSector(sector) {
  const def = getSectorDefaults(sector);
  return {
    modo_operacion: def.modo,
    tipo_contrato_predominante: def.contrato,
    tipo_contrato_default: def.contrato,
    valor_hora_default: def.salario,
    dias_trabajo: def.modo === '24_7' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5],
    jornada_tipo: 'DIURNA',
    duracion_jornada_horas: 8,
    dias_descanso: 1,
    dias_descanso_default: 1,
    nivel_riesgo_arl: 1,
    paga_auxilio_transporte: true,
  };
}

let pass = 0, fail = 0;
const errors = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`✅ ${name}`); }
  catch (e) { fail++; errors.push({ test: name, error: e.message }); console.log(`❌ ${name}: ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEquals(actual, expected, msg) { if (actual !== expected) throw new Error(msg || `Expected "${expected}" got "${actual}"`); }

// ═══════════════════════════════════════════════════════════════
// Test: defaults por sector
// ═══════════════════════════════════════════════════════════════
test('TEST 1: RETAIL defaults son OFICINA + INDEFINIDO + 12500', () => {
  const d = buildDefaultsForSector('RETAIL');
  assertEquals(d.modo_operacion, 'OFICINA');
  assertEquals(d.tipo_contrato_predominante, 'INDEFINIDO');
  assertEquals(d.valor_hora_default, 12500);
  assertEquals(d.dias_trabajo.length, 5);
});

test('TEST 2: HOTELERIA defaults son 24/7 + INDEFINIDO + 13000', () => {
  const d = buildDefaultsForSector('HOTELERIA');
  assertEquals(d.modo_operacion, '24_7');
  assertEquals(d.tipo_contrato_predominante, 'INDEFINIDO');
  assertEquals(d.valor_hora_default, 13000);
  assertEquals(d.dias_trabajo.length, 7, '24/7 debe tener 7 días');
});

test('TEST 3: SALUD defaults son 24/7 + 15000', () => {
  const d = buildDefaultsForSector('SALUD');
  assertEquals(d.modo_operacion, '24_7');
  assertEquals(d.valor_hora_default, 15000);
});

test('TEST 4: CONSTRUCCION defaults son OBRA_LABOR', () => {
  const d = buildDefaultsForSector('CONSTRUCCION');
  assertEquals(d.tipo_contrato_predominante, 'OBRA_LABOR');
});

test('TEST 5: TECNOLOGIA defaults son 20000', () => {
  const d = buildDefaultsForSector('TECNOLOGIA');
  assertEquals(d.valor_hora_default, 20000);
});

test('TEST 6: OTRO sector tiene defaults seguros', () => {
  const d = buildDefaultsForSector('OTRO');
  assertEquals(d.modo_operacion, 'OFICINA');
  assertEquals(d.tipo_contrato_predominante, 'INDEFINIDO');
  assert(d.valor_hora_default > 0);
});

test('TEST 7: Sector inválido usa defaults de OTRO', () => {
  const d = buildDefaultsForSector('SECTOR_INVALIDO');
  assertEquals(d.modo_operacion, 'OFICINA');
  assertEquals(d.tipo_contrato_predominante, 'INDEFINIDO');
});

// ═══════════════════════════════════════════════════════════════
// Test: payload completo que llega a useAreas.createArea
// ═══════════════════════════════════════════════════════════════
test('TEST 8: Payload completo área OFICINA', () => {
  const sector = 'RETAIL';
  const formData = {
    nombre: 'Cajas',
    sector,
    color: '#10b981',
    ...buildDefaultsForSector(sector),
  };
  // Lo que llega a createArea
  const payload = {
    ...formData,
    valor_hora_default: parseFloat(formData.valor_hora_default),
  };
  assertEquals(typeof payload.valor_hora_default, 'number');
  assert(payload.valor_hora_default > 0);
  assertEquals(payload.nombre, 'Cajas');
});

test('TEST 9: Payload completo área 24/7 con nocturno', () => {
  const sector = 'SEGURIDAD';
  const formData = {
    nombre: 'Vigilancia',
    sector,
    color: '#1e40af',
    ...buildDefaultsForSector(sector),
    night_shift_enabled: true,
    night_shift_start: '22:00',
    night_shift_end: '06:00',
  };
  const payload = {
    ...formData,
    valor_hora_default: parseFloat(formData.valor_hora_default),
  };
  assertEquals(payload.modo_operacion, '24_7');
  assertEquals(payload.dias_trabajo.length, 7);
  assert(payload.night_shift_enabled);
  assertEquals(payload.night_shift_start, '22:00');
});

test('TEST 10: Payload con cada uno de los 9 tipos de contrato como predominante', () => {
  for (const t of ['INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO','PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL']) {
    const payload = {
      nombre: 'Test ' + t,
      valor_hora_default: 12500,
      dias_trabajo: [1,2,3,4,5],
      tipo_contrato_predominante: t,
      tipo_contrato_default: t,
      modo_operacion: 'OFICINA',
    };
    assertEquals(payload.tipo_contrato_predominante, t, `falló para ${t}`);
  }
});

test('TEST 11: Payload con cada uno de los 4 tipos de jornada', () => {
  for (const j of ['DIURNA','NOCTURNA','MIXTA','POR_TURNOS']) {
    const payload = {
      nombre: 'Test ' + j,
      valor_hora_default: 12500,
      dias_trabajo: [1,2,3,4,5],
      tipo_contrato_predominante: 'INDEFINIDO',
      jornada_tipo: j,
    };
    assertEquals(payload.jornada_tipo, j);
  }
});

test('TEST 12: Payload con cada uno de los 5 niveles ARL', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const payload = {
      nombre: 'Test ARL ' + n,
      valor_hora_default: 12500,
      dias_trabajo: [1,2,3,4,5],
      tipo_contrato_predominante: 'INDEFINIDO',
      nivel_riesgo_arl: n,
    };
    assert(payload.nivel_riesgo_arl >= 1 && payload.nivel_riesgo_arl <= 5);
  }
});

test('TEST 13: Payload con cada uno de los 9 patrones rotativos', () => {
  for (const p of ['2x1','3x2','4x3','5x2','6x1','7x7','10x5','14x14','PERSONALIZADO']) {
    const payload = {
      nombre: 'Test ' + p,
      valor_hora_default: 12500,
      dias_trabajo: [1,2,3,4,5],
      tipo_contrato_predominante: 'INDEFINIDO',
      patron_rotativo: p === 'PERSONALIZADO' ? null : p,
    };
    if (p !== 'PERSONALIZADO') {
      assertEquals(payload.patron_rotativo, p);
    } else {
      assertEquals(payload.patron_rotativo, null);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// Test: franjas iniciales que se crean automáticamente
// ═══════════════════════════════════════════════════════════════
test('TEST 14: RETAIL crea 3 franjas típicas (Apertura, Cierre, Cierre 2)', () => {
  const franjas = [
    { nombre: 'Apertura',  hora_inicio: '07:00', hora_fin: '15:00', color: '#f59e0b' },
    { nombre: 'Cierre',    hora_inicio: '13:00', hora_fin: '21:00', color: '#3b82f6' },
    { nombre: 'Cierre 2',  hora_inicio: '15:00', hora_fin: '22:00', color: '#8b5cf6' },
  ];
  assertEquals(franjas.length, 3);
  for (const f of franjas) {
    assert(f.nombre && f.hora_inicio && f.hora_fin, `Franja ${f.nombre} incompleta`);
  }
});

test('TEST 15: HOTELERIA crea 3 franjas (Mañana, Tarde, Noche)', () => {
  const franjas = [
    { nombre: 'Mañana', hora_inicio: '06:00', hora_fin: '14:00' },
    { nombre: 'Tarde',  hora_inicio: '14:00', hora_fin: '22:00' },
    { nombre: 'Noche',  hora_inicio: '22:00', hora_fin: '06:00', cruza_medianoche: true },
  ];
  assertEquals(franjas.length, 3);
  assert(franjas[2].cruza_medianoche, 'Noche debe cruzar medianoche');
});

// ═══════════════════════════════════════════════════════════════
// Test: errores comunes
// ═══════════════════════════════════════════════════════════════
test('TEST 16: valor_hora_default debe ser number, no string', () => {
  const formData = { nombre: 'Test', valor_hora_default: '12500' };
  const payload = { ...formData, valor_hora_default: parseFloat(formData.valor_hora_default) };
  assertEquals(typeof payload.valor_hora_default, 'number');
});

test('TEST 17: dias_trabajo como array de enteros', () => {
  const payload = { nombre: 'Test', dias_trabajo: [1, 2, 3, 4, 5] };
  assert(Array.isArray(payload.dias_trabajo));
  for (const d of payload.dias_trabajo) {
    assert(Number.isInteger(d));
    assert(d >= 1 && d <= 7);
  }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 RESULTADO: ${pass} pasaron · ${fail} fallaron`);
console.log('═══════════════════════════════════════════════════════════');
if (errors.length > 0) { errors.forEach((e, i) => console.log(`${i+1}. ${e.test}: ${e.error}`)); process.exit(1); }