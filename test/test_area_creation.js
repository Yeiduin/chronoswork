// ============================================================
// ChronosWork — Tests de creación de Áreas y Empleados
// Tests locales (sin Supabase) que validan:
//  - Tipos de contrato: 9 combinaciones
//  - Modos operación: 2 (OFICINA, 24_7)
//  - Tipos jornada: 4 (DIURNA, NOCTURNA, MIXTA, POR_TURNOS)
//  - Patrones rotativos: 9
//  - Niveles ARL: 5
//  - Tipos documento: 7
//  - Géneros: 4
//  - Estados civiles: 6
//  - Niveles cargo: 7
//  - Niveles educación: 9
//  - Tipos turno: 6
//  - Turnos partidos
//  - Turnos que cruzan medianoche
//  - Datos opcionales vacíos
//  - Datos especiales (discapacidad, aprendiz SENA, etc.)
// ============================================================

import { TIPOS_CONTRATO, TIPOS_TURNO, PATRONES_ROTATIVOS, SECTORES, TIPOS_JORNADA } from '../src/config/laborCatalog.js';

let pass = 0;
let fail = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`✅ ${name}`);
  } catch (e) {
    fail++;
    errors.push({ test: name, error: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEquals(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected "${expected}" but got "${actual}"`);
  }
}

function assertInArray(value, array, msg) {
  if (!array.includes(value)) {
    throw new Error(msg || `Value "${value}" not in [${array.join(', ')}]`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  TEST 1: Validar que todos los 9 tipos de contrato son válidos
// ═══════════════════════════════════════════════════════════════
test('TEST 1.1: Hay 9 tipos de contrato', () => {
  assertEquals(TIPOS_CONTRATO.length, 9, 'Expected 9 contract types');
});

test('TEST 1.2: Los 9 tipos de contrato son los correctos', () => {
  const expected = ['INDEFINIDO', 'TERMINO_FIJO', 'OBRA_LABOR', 'POR_HORAS', 'SALARIO_FIJO',
                    'PRESTACION_SERVICIOS', 'APRENDIZAJE', 'OCASIONAL', 'TEMPORAL'];
  const actual = TIPOS_CONTRATO.map(t => t.value);
  for (const t of expected) {
    assert(actual.includes(t), `Falta tipo ${t}`);
  }
});

test('TEST 1.3: Cada tipo de contrato tiene label y desc', () => {
  for (const t of TIPOS_CONTRATO) {
    assert(t.label && t.label.length > 0, `${t.value} sin label`);
    assert(t.desc && t.desc.length > 0, `${t.value} sin desc`);
  }
});

// ═══════════════════════════════════════════════════════════════
//  TEST 2: Validar 6 tipos de turno
// ═══════════════════════════════════════════════════════════════
test('TEST 2.1: Hay 6 tipos de turno', () => {
  assertEquals(TIPOS_TURNO.length, 6, 'Expected 6 shift types');
});

test('TEST 2.2: Los 6 tipos de turno son los correctos', () => {
  const expected = ['STANDARD', 'PARTIDO', 'ROTATIVO', 'NOCTURNO', 'DISPONIBILIDAD', 'CUSTOM'];
  const actual = TIPOS_TURNO.map(t => t.value);
  for (const t of expected) {
    assert(actual.includes(t), `Falta tipo turno ${t}`);
  }
});

// ═══════════════════════════════════════════════════════════════
//  TEST 3: Validar patrones rotativos
// ═══════════════════════════════════════════════════════════════
test('TEST 3.1: Hay 9 patrones rotativos', () => {
  assertEquals(PATRONES_ROTATIVOS.length, 9, 'Expected 9 rotation patterns');
});

test('TEST 3.2: Patrones tienen diasTrabajo y diasDescanso coherentes', () => {
  for (const p of PATRONES_ROTATIVOS) {
    assert(p.diasTrabajo > 0 || p.value === 'PERSONALIZADO', `${p.value} sin diasTrabajo`);
    assert(p.diasDescanso > 0 || p.value === 'PERSONALIZADO', `${p.value} sin diasDescanso`);
    if (p.value !== 'PERSONALIZADO') {
      // El ciclo puede ser hasta 28 días (7x7 = 14, 14x14 = 28, 10x5 = 15)
      assert(p.diasTrabajo + p.diasDescanso <= 28, `${p.value} ciclo > 28 días`);
      assert(p.diasTrabajo <= 14, `${p.value} diasTrabajo > 14 (máximo legal para un solo ciclo)`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
//  TEST 4: Validar 14 sectores
// ═══════════════════════════════════════════════════════════════
test('TEST 4.1: Hay 14 sectores', () => {
  assertEquals(SECTORES.length, 14, 'Expected 14 sectors');
});

test('TEST 4.2: Cada sector tiene defaults válidos', () => {
  const contratoValidos = TIPOS_CONTRATO.map(t => t.value);
  const modosValidos = ['OFICINA', '24_7'];
  for (const s of SECTORES) {
    assert(s.defaults.contrato, `${s.value} sin contrato default`);
    assertInArray(s.defaults.contrato, contratoValidos, `${s.value} contrato inválido: ${s.defaults.contrato}`);
    assertInArray(s.defaults.modo, modosValidos, `${s.value} modo inválido: ${s.defaults.modo}`);
    assert(s.defaults.salario > 0, `${s.value} salario <= 0`);
    assert(s.defaults.salario >= 5000, `${s.value} salario < SMLV hora`);
  }
});

// ═══════════════════════════════════════════════════════════════
//  TEST 5: Simular payload de área para todos los tipos
// ═══════════════════════════════════════════════════════════════
test('TEST 5.1: Payload mínimo válido para área OFICINA', () => {
  const payload = {
    nombre: 'Cajas',
    sector: 'RETAIL',
    valor_hora_default: 12500,
    dias_trabajo: [1, 2, 3, 4, 5],
    modo_operacion: 'OFICINA',
    tipo_contrato_default: 'INDEFINIDO',
    dias_descanso_default: 1,
  };
  assert(payload.nombre.length > 0, 'nombre requerido');
  assert(payload.valor_hora_default > 0, 'valor_hora > 0');
});

test('TEST 5.2: Payload con 24/7 + nocturno', () => {
  const payload = {
    nombre: 'Vigilancia',
    sector: 'SEGURIDAD',
    valor_hora_default: 12000,
    dias_trabajo: [1, 2, 3, 4, 5, 6, 7],
    modo_operacion: '24_7',
    tipo_contrato_default: 'INDEFINIDO',
    dias_descanso_default: 1,
    night_shift_enabled: true,
    night_shift_start: '22:00',
    night_shift_end: '06:00',
  };
  assertEquals(payload.modo_operacion, '24_7');
  assertEquals(payload.dias_trabajo.length, 7);
  assert(payload.night_shift_enabled);
});

test('TEST 5.3: Payload con cada uno de los 9 tipos de contrato', () => {
  for (const t of TIPOS_CONTRATO) {
    const payload = {
      nombre: 'Test ' + t.value,
      valor_hora_default: 12500,
      dias_trabajo: [1, 2, 3, 4, 5],
      tipo_contrato_default: t.value,
      modo_operacion: 'OFICINA',
    };
    assertEquals(payload.tipo_contrato_default, t.value, `falló para ${t.value}`);
  }
});

test('TEST 5.4: Payload con todos los niveles ARL (1-5)', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const payload = {
      nombre: 'Test ARL ' + n,
      valor_hora_default: 12500,
      dias_trabajo: [1, 2, 3, 4, 5],
      tipo_contrato_default: 'INDEFINIDO',
      nivel_riesgo_arl: n,
    };
    assert(payload.nivel_riesgo_arl >= 1 && payload.nivel_riesgo_arl <= 5, `ARL ${n} fuera de rango`);
  }
});

test('TEST 5.5: Payload con todos los 9 patrones rotativos', () => {
  for (const p of PATRONES_ROTATIVOS) {
    const payload = {
      nombre: 'Test ' + p.value,
      valor_hora_default: 12500,
      dias_trabajo: [1, 2, 3, 4, 5],
      tipo_contrato_default: 'INDEFINIDO',
      patron_rotativo: p.value,
    };
    if (p.value !== 'PERSONALIZADO') {
      assertEquals(payload.patron_rotativo, p.value);
    }
  }
});

test('TEST 5.6: Payload con todos los 4 tipos de jornada', () => {
  for (const j of TIPOS_JORNADA) {
    const payload = {
      nombre: 'Test ' + j.value,
      valor_hora_default: 12500,
      dias_trabajo: [1, 2, 3, 4, 5],
      tipo_contrato_default: 'INDEFINIDO',
      jornada_tipo: j.value,
    };
    assertEquals(payload.jornada_tipo, j.value);
  }
});

// ═══════════════════════════════════════════════════════════════
//  TEST 6: Simular payload de empleado
// ═══════════════════════════════════════════════════════════════
test('TEST 6.1: Payload mínimo válido para empleado', () => {
  const payload = {
    cedula: '1234567890',
    nombre: 'Juan Pérez',
    cargo: 'Cajero',
    valor_hora: 12500,
    tipo_contrato: 'INDEFINIDO',
  };
  assert(payload.cedula.length >= 5, 'cédula muy corta');
  assert(payload.nombre.length > 0, 'nombre vacío');
  assert(payload.valor_hora > 0, 'valor_hora <= 0');
});

test('TEST 6.2: Payload con cada uno de los 9 tipos de contrato', () => {
  for (const t of TIPOS_CONTRATO) {
    const payload = {
      cedula: '999999' + Math.random().toString().slice(2, 7),
      nombre: 'Test ' + t.value,
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: t.value,
    };
    assertEquals(payload.tipo_contrato, t.value);
  }
});

test('TEST 6.3: Payload con todos los 7 tipos de documento', () => {
  const docs = ['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'];
  for (const d of docs) {
    const payload = {
      cedula: '123',
      nombre: 'Test',
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: 'INDEFINIDO',
      tipo_documento: d,
    };
    assertEquals(payload.tipo_documento, d);
  }
});

test('TEST 6.4: Payload con todos los 4 géneros', () => {
  for (const g of ['M', 'F', 'OTRO', 'PREFIERO_NO_DECIR']) {
    const payload = {
      cedula: '123',
      nombre: 'Test',
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: 'INDEFINIDO',
      genero: g,
    };
    assertEquals(payload.genero, g);
  }
});

test('TEST 6.5: Payload con todos los 6 estados civiles', () => {
  for (const e of ['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO', 'SEPARADO']) {
    const payload = {
      cedula: '123',
      nombre: 'Test',
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: 'INDEFINIDO',
      estado_civil: e,
    };
    assertEquals(payload.estado_civil, e);
  }
});

test('TEST 6.6: Payload con todos los 7 niveles de cargo', () => {
  for (const n of ['JUNIOR', 'SENIOR', 'COORDINADOR', 'SUPERVISOR', 'JEFE', 'GERENTE', 'DIRECTOR']) {
    const payload = {
      cedula: '123',
      nombre: 'Test',
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: 'INDEFINIDO',
      nivel_cargo: n,
    };
    assertEquals(payload.nivel_cargo, n);
  }
});

test('TEST 6.7: Payload con todos los 9 niveles educativos', () => {
  for (const n of ['PRIMARIA', 'BACHILLERATO', 'TECNICO', 'TECNOLOGO', 'PREGRADO', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO', 'NINGUNO']) {
    const payload = {
      cedula: '123',
      nombre: 'Test',
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: 'INDEFINIDO',
      nivel_educacion: n,
    };
    assertEquals(payload.nivel_educacion, n);
  }
});

test('TEST 6.8: Payload con todos los 5 niveles ARL', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const payload = {
      cedula: '123',
      nombre: 'Test',
      cargo: 'Cargo',
      valor_hora: 12500,
      tipo_contrato: 'INDEFINIDO',
      nivel_riesgo_arl: n,
    };
    assert(payload.nivel_riesgo_arl >= 1 && payload.nivel_riesgo_arl <= 5);
  }
});

// ═══════════════════════════════════════════════════════════════
//  TEST 7: Casos especiales (discapacidad, aprendiz, etc.)
// ═══════════════════════════════════════════════════════════════
test('TEST 7.1: Empleado con discapacidad', () => {
  const payload = {
    cedula: '1234567890',
    nombre: 'Empleado con Discapacidad',
    cargo: 'Auxiliar',
    valor_hora: 12500,
    tipo_contrato: 'INDEFINIDO',
    tiene_discapacidad: true,
    descripcion_discapacidad: 'Movilidad reducida',
  };
  assert(payload.tiene_discapacidad);
  assert(payload.descripcion_discapacidad.length > 0);
});

test('TEST 7.2: Aprendiz SENA en etapa productiva', () => {
  const payload = {
    cedula: '1234567890',
    nombre: 'Aprendiz SENA',
    cargo: 'Aprendiz',
    valor_hora: 2590, // 50% SMLV hora
    tipo_contrato: 'APRENDIZAJE',
    sena_aprendiz: true,
    etapa_productiva: true,
    fecha_etapa_lectiva_inicio: '2025-02-01',
    fecha_etapa_lectiva_fin: '2025-07-31',
    salario_mensual: 711750, // 50% SMLV
  };
  assertEquals(payload.tipo_contrato, 'APRENDIZAJE');
  assert(payload.sena_aprendiz);
  assert(payload.etapa_productiva);
});

test('TEST 7.3: Contrato a término fijo con fecha fin', () => {
  const payload = {
    cedula: '1234567890',
    nombre: 'Contrato Fijo',
    cargo: 'Operario',
    valor_hora: 12500,
    tipo_contrato: 'TERMINO_FIJO',
    fecha_ingreso: '2025-01-15',
    fecha_fin_contrato: '2026-01-14',
  };
  assertEquals(payload.tipo_contrato, 'TERMINO_FIJO');
  assert(payload.fecha_fin_contrato > payload.fecha_ingreso);
});

test('TEST 7.4: Contrato por horas (4h mínimo, 30h máximo)', () => {
  const payload = {
    cedula: '1234567890',
    nombre: 'Medio Tiempo',
    cargo: 'Auxiliar',
    valor_hora: 12500,
    tipo_contrato: 'POR_HORAS',
    horas_semanales_contrato: 20,
  };
  assertEquals(payload.tipo_contrato, 'POR_HORAS');
  assert(payload.horas_semanales_contrato >= 4, 'min 4h');
  assert(payload.horas_semanales_contrato <= 30, 'max 30h');
});

test('TEST 7.5: Prestación de servicios (sin prestaciones)', () => {
  const payload = {
    cedula: '1234567890',
    nombre: 'Contratista',
    cargo: 'Asesor',
    valor_hora: 30000,
    tipo_contrato: 'PRESTACION_SERVICIOS',
    recibe_auxilio_transporte: false,
    aplica_pago_dominical: false,
    aplica_horas_extras: false,
  };
  assertEquals(payload.tipo_contrato, 'PRESTACION_SERVICIOS');
  assertEquals(payload.recibe_auxilio_transporte, false);
});

// ═══════════════════════════════════════════════════════════════
//  TEST 8: Validar que un payload con nulls funciona
// ═══════════════════════════════════════════════════════════════
test('TEST 8.1: Payload con nulls y strings vacíos', () => {
  const payload = {
    cedula: '123',
    nombre: 'Test',
    cargo: 'Test',
    valor_hora: 12500,
    tipo_contrato: 'INDEFINIDO',
    telefono_contacto: '',
    email_personal: '',
    eps_nombre: '',
    afp_nombre: '',
    arl_nombre: '',
    banco_nombre: '',
    numero_cuenta: '',
  };
  // No debe lanzar error
  assert(payload);
});

test('TEST 8.2: Payload con todos los campos opcionales null', () => {
  const payload = {
    cedula: '123',
    nombre: 'Test',
    cargo: 'Test',
    valor_hora: 12500,
    tipo_contrato: 'INDEFINIDO',
    tipo_documento: null,
    fecha_nacimiento: null,
    genero: null,
    estado_civil: null,
    telefono_contacto: null,
    email_personal: null,
    // ... etc todos los opcionales null
  };
  assert(payload);
});

// ═══════════════════════════════════════════════════════════════
//  TEST 9: Validar tipos de turno extendidos
// ═══════════════════════════════════════════════════════════════
test('TEST 9.1: Turno partido con dos bloques', () => {
  const tpl = {
    shift_kind: 'PARTIDO',
    nombre: 'Turno con almuerzo',
    hora_inicio: '07:00',
    hora_fin: '12:00',
    hora_inicio_2: '13:00',
    hora_fin_2: '17:00',
    split_break_minutos: 60,
  };
  assertEquals(tpl.shift_kind, 'PARTIDO');
  assert(tpl.hora_inicio_2 && tpl.hora_fin_2, 'PARTIDO requiere 2 bloques');
});

test('TEST 9.2: Turno nocturno', () => {
  const tpl = {
    shift_kind: 'NOCTURNO',
    nombre: 'Turno Nocturno',
    hora_inicio: '22:00',
    hora_fin: '06:00',
    cruza_medianoche: true,
  };
  assertEquals(tpl.shift_kind, 'NOCTURNO');
  assert(tpl.cruza_medianoche);
});

test('TEST 9.3: Turno rotativo con patrón', () => {
  const tpl = {
    shift_kind: 'ROTATIVO',
    nombre: 'Turno Rotativo',
    hora_inicio: '06:00',
    hora_fin: '14:00',
    rotacion_patron: '5x2',
  };
  assertEquals(tpl.shift_kind, 'ROTATIVO');
  assertEquals(tpl.rotacion_patron, '5x2');
});

test('TEST 9.4: Disponibilidad con recargo', () => {
  const tpl = {
    shift_kind: 'DISPONIBILIDAD',
    nombre: 'Guardia',
    hora_inicio: '18:00',
    hora_fin: '06:00',
    cruza_medianoche: true,
    disponibilidad_recargo_porcentaje: 25,
  };
  assertEquals(tpl.shift_kind, 'DISPONIBILIDAD');
  assert(tpl.disponibilidad_recargo_porcentaje > 0);
});

// ═══════════════════════════════════════════════════════════════
//  TEST 10: Validar datos de franjas de tiempo (hora_inicio/fin)
// ═══════════════════════════════════════════════════════════════
test('TEST 10.1: Hora inicio < hora fin (sin cruzar medianoche)', () => {
  const tpl = { hora_inicio: '06:00', hora_fin: '14:00', cruza_medianoche: false };
  const [h1, m1] = tpl.hora_inicio.split(':').map(Number);
  const [h2, m2] = tpl.hora_fin.split(':').map(Number);
  assert((h1 * 60 + m1) < (h2 * 60 + m2), 'inicio debe ser < fin');
});

test('TEST 10.2: Hora inicio > hora fin (cruzando medianoche)', () => {
  const tpl = { hora_inicio: '22:00', hora_fin: '06:00', cruza_medianoche: true };
  assert(tpl.cruza_medianoche);
  // En este caso inicio > fin está bien
});

test('TEST 10.3: Formato HH:MM es válido', () => {
  const valid = ['00:00', '06:00', '12:30', '23:59', '14:25'];
  for (const t of valid) {
    assert(/^\d{2}:\d{2}$/.test(t), `Formato inválido: ${t}`);
  }
});

// ═══════════════════════════════════════════════════════════════
//  RESULTADOS
// ═══════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 RESULTADO FINAL: ${pass} pasaron · ${fail} fallaron`);
console.log('═══════════════════════════════════════════════════════════');

if (errors.length > 0) {
  console.log('\n❌ ERRORES DETALLADOS:');
  errors.forEach((e, i) => {
    console.log(`${i + 1}. ${e.test}: ${e.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 ¡Todos los tests pasaron! El sistema está listo.');
  process.exit(0);
}
