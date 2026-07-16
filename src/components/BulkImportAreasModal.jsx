// ============================================================
// ChronosWork — Importación Masiva de Áreas (wrapper)
// Plantilla sincronizada con AreaForm.jsx (todos los campos)
// Usa BulkImportModalGeneric internamente
// ============================================================

import { useState, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { MdDomain, MdInfo } from 'react-icons/md';
import { SECTORES, TIPOS_CONTRATO, PATRONES_ROTATIVOS, TIPOS_JORNADA, getFranjasBySector, SMLV_HORA_2025 } from '../config/laborCatalog';
import BulkImportModalGeneric, { parseNumero } from './BulkImportModalGeneric';

// ═══════════════════════════════════════════════════════════════
// Catálogos para dropdowns
// ═══════════════════════════════════════════════════════════════
const SECTORES_VALUES = SECTORES.map(s => s.value);
const TIPOS_CONTRATO_VALUES = TIPOS_CONTRATO.map(t => t.value);
const PATRONES_VALUES = PATRONES_ROTATIVOS.map(p => p.value).filter(v => v !== 'PERSONALIZADO');
const JORNADAS_VALUES = TIPOS_JORNADA.map(j => j.value);
const NIVELES_ARL = [1, 2, 3, 4, 5];
const MODOS_VALUES = ['OFICINA', '24_7', '24_7_NIGHT_SPLIT'];
const ESTRATEGIAS = ['COVERAGE_FIRST', 'BALANCED', 'EMPLOYEE_PREF'];
const SNAP_VALUES = [5, 10, 15, 30, 60];

const PALETTE_DEFAULTS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316',
];

// ═══════════════════════════════════════════════════════════════
// Mapeo de columnas — sincronizado con AreaForm.jsx
// ═══════════════════════════════════════════════════════════════
const COLUMN_ALIASES = {
  nombre:                       ['nombre', 'name', 'area', 'área', 'nombre del área', 'nombre area', 'departamento'],
  codigo_area:                  ['codigo', 'código', 'codigo_area', 'codigo interno', 'id interno'],
  descripcion:                  ['descripcion', 'descripción', 'description', 'desc', 'detalle'],
  sector:                       ['sector', 'industria', 'rubro'],
  sub_sector:                   ['sub_sector', 'subsector', 'sub sector', 'especialidad'],
  centro_costo:                 ['centro_costo', 'centro de costo', 'centro coste', 'cost center'],
  modo_operacion:               ['modo_operacion', 'modo operacion', 'operacion', 'modo'],
  jornada_tipo:                 ['jornada', 'jornada_tipo', 'tipo jornada', 'jornada tipo'],
  patron_rotativo:              ['patron', 'patron_rotativo', 'rotacion', 'patrón'],
  dias_trabajo:                 ['dias_trabajo', 'dias trabajo', 'dias laborales', 'dias_laborales'],
  dias_descanso:                ['dias_descanso', 'descansos', 'dias libres'],
  horas_extras_max_dia:         ['he_max_dia', 'he_dia', 'horas extras dia', 'max he dia'],
  horas_extras_max_semana:      ['he_max_semana', 'he_semana', 'horas extras semana', 'max he semana'],
  descanso_min_entre_jornadas:  ['descanso_min', 'descanso entre jornadas', 'min horas entre'],
  tipo_contrato_predominante:   ['contrato', 'tipo_contrato', 'tipo_contrato_predominante', 'modalidad'],
  tipo_contrato_default:        ['contrato_default', 'tipo_contrato_default', 'contrato por defecto'],
  valor_hora_default:           ['valor_hora', 'valor_hora_default', 'valor hora', 'salario hora', 'hourly_rate', 'tarifa hora', 'valor/hora', 'salario', 'salario base'],
  paga_auxilio_transporte:      ['auxilio_transporte', 'aux_transporte', 'auxilio', 'subsidio transporte', 'paga_auxilio'],
  nivel_riesgo_arl:             ['nivel_arl', 'arl', 'nivel_riesgo_arl', 'nivel riesgo', 'riesgo arl'],
  estrategia_asignacion:        ['estrategia', 'estrategia_asignacion', 'estrategia asignacion'],
  min_empleados_dia:            ['min_empleados', 'min personas', 'minimo personas', 'min_empleados_dia'],
  max_empleados_dia:            ['max_empleados', 'max personas', 'maximo personas', 'max_empleados_dia'],
  hora_inicio_dia:              ['hora_inicio_dia', 'hora inicio', 'apertura', 'inicio dia'],
  hora_fin_dia:                 ['hora_fin_dia', 'hora fin', 'cierre', 'fin dia'],
  min_empleados_noche:          ['min_noche', 'min personas noche', 'min_empleados_noche'],
  night_shift_enabled:          ['nocturno', 'night_shift', 'turno_nocturno', 'night_shift_enabled'],
  night_shift_start:            ['noche_inicio', 'night_shift_start', 'inicio noche'],
  night_shift_end:              ['noche_fin', 'night_shift_end', 'fin noche'],
  noche_solo_empleados_dedicados:['noche_dedicados', 'solo_dedicados', 'noche_solo_empleados_dedicados'],
  permite_dia_cubrir_noche:     ['dia_cubre_noche', 'permite_dia_cubrir_noche'],
  permitir_horas_extras:        ['permite_extras', 'horas_extras', 'permitir_horas_extras'],
  permitir_turno_partido:       ['turno_partido', 'jornada_partida', 'permite_partido', 'permitir_turno_partido'],
  min_horas_turno_override:     ['min_horas_turno', 'min horas turno', 'min_horas_turno_override'],
  max_horas_turno_override:     ['max_horas_turno', 'max horas turno', 'max_horas_turno_override'],
  snap_turnos_minutos:          ['snap', 'snap_turnos', 'ajuste turnos', 'snap_turnos_minutos'],
  balancear_carga:              ['balancear', 'balancear_carga', 'balance carga'],
  consecutividad_horario:       ['consecutividad', 'consecutividad_horario', 'mismo horario'],
  equidad_fin_semana:           ['equidad_fin_semana', 'equidad fines', 'repartir fines'],
  peso_seniority:               ['seniority', 'peso_seniority', 'antiguedad'],
  max_domingos_mes_area:        ['max_domingos', 'max domingos', 'max_domingos_mes_area'],
  requiere_dotacion:             ['dotacion', 'requiere_dotacion', 'dotación'],
  dotacion_periodicidad_meses:  ['dotacion_periodicidad', 'frecuencia dotacion', 'dotacion_periodicidad_meses'],
  requiere_epp:                  ['epp', 'requiere_epp', 'elementos proteccion'],
  descripcion_epp:              ['descripcion_epp', 'epp_descripcion', 'detalle epp'],
  notas_operativas:             ['notas', 'observaciones', 'notas_operativas', 'comentarios'],
};

// ═══════════════════════════════════════════════════════════════
// Helpers específicos de áreas
// ═══════════════════════════════════════════════════════════════
function parseDiasTrabajo(val) {
  if (!val) return [1, 2, 3, 4, 5];
  const v = String(val).toUpperCase().trim();
  if (v === 'L-V') return [1, 2, 3, 4, 5];
  if (v === 'L-S') return [1, 2, 3, 4, 5, 6];
  if (v === 'L-D' || v === 'TODOS') return [1, 2, 3, 4, 5, 6, 7];
  if (v.includes(',') || v.match(/[LMXJVSD]/)) {
    const map = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 7 };
    const result = [];
    const chars = v.replace(/[\s,]/g, '').split('');
    chars.forEach(c => { if (map[c] && !result.includes(map[c])) result.push(map[c]); });
    return result.sort();
  }
  return [1, 2, 3, 4, 5];
}

// ═══════════════════════════════════════════════════════════════
// Validación por fila
// ═══════════════════════════════════════════════════════════════
function validateAreaRow(row) {
  const errors = [];

  if (!String(row.nombre || '').trim()) {
    errors.push({ campo: 'nombre', msg: 'El nombre del área es obligatorio' });
  }

  const vhora = parseNumero(row.valor_hora_default);
  if (!row.valor_hora_default || vhora === null || vhora <= 0) {
    errors.push({ campo: 'valor_hora_default', msg: 'Valor hora es obligatorio y debe ser > 0' });
  }

  if (row.sector) {
    const u = String(row.sector).trim().toUpperCase();
    if (!SECTORES_VALUES.includes(u)) {
      errors.push({ campo: 'sector', msg: `Sector "${row.sector}" no es válido. Válidos: ${SECTORES_VALUES.join(', ')}` });
    }
  }

  if (row.modo_operacion) {
    const u = String(row.modo_operacion).trim().toUpperCase().replace(/[\/\-]/g, '_');
    if (!MODOS_VALUES.includes(u)) {
      errors.push({ campo: 'modo_operacion', msg: `Modo "${row.modo_operacion}" no es válido. Use: ${MODOS_VALUES.join(', ')}` });
    }
  }

  if (row.estrategia_asignacion) {
    const u = String(row.estrategia_asignacion).trim().toUpperCase();
    if (!ESTRATEGIAS.includes(u)) {
      errors.push({ campo: 'estrategia_asignacion', msg: `Estrategia "${row.estrategia_asignacion}" no es válida. Use: ${ESTRATEGIAS.join(', ')}` });
    }
  }

  if (row.jornada_tipo) {
    const u = String(row.jornada_tipo).trim().toUpperCase();
    if (!JORNADAS_VALUES.includes(u)) {
      errors.push({ campo: 'jornada_tipo', msg: `Jornada "${row.jornada_tipo}" no es válida. Válidas: ${JORNADAS_VALUES.join(', ')}` });
    }
  }

  if (row.patron_rotativo) {
    if (!PATRONES_VALUES.includes(String(row.patron_rotativo).trim())) {
      errors.push({ campo: 'patron_rotativo', msg: `Patrón "${row.patron_rotativo}" no es válido. Válidos: ${PATRONES_VALUES.join(', ')}` });
    }
  }

  if (row.tipo_contrato_predominante) {
    const u = String(row.tipo_contrato_predominante).trim().toUpperCase();
    if (!TIPOS_CONTRATO_VALUES.includes(u)) {
      const recoverable = TIPOS_CONTRATO_VALUES.some(t => u.includes(t.replace(/_/g, ' ')) || u.includes(t));
      if (!recoverable) {
        errors.push({ campo: 'tipo_contrato_predominante', msg: `"${row.tipo_contrato_predominante}" no es válido. Use: ${TIPOS_CONTRATO_VALUES.join(', ')}` });
      }
    }
  }

  if (row.nivel_riesgo_arl) {
    const n = parseInt(row.nivel_riesgo_arl, 10);
    if (isNaN(n) || n < 1 || n > 5) {
      errors.push({ campo: 'nivel_riesgo_arl', msg: 'Nivel ARL debe ser 1, 2, 3, 4 o 5' });
    }
  }

  if (row.min_empleados_dia && row.max_empleados_dia) {
    const min = parseInt(row.min_empleados_dia, 10);
    const max = parseInt(row.max_empleados_dia, 10);
    if (!isNaN(min) && !isNaN(max) && min > max) {
      errors.push({ campo: 'min_empleados_dia', msg: 'El mínimo de personas no puede ser mayor al máximo' });
    }
  }

  if (row.hora_inicio_dia && row.hora_fin_dia) {
    if (row.hora_inicio_dia >= row.hora_fin_dia) {
      errors.push({ campo: 'hora_inicio_dia', msg: 'La hora de inicio debe ser anterior a la hora de cierre' });
    }
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════
// Genera plantilla Excel de áreas — sincronizada con AreaForm
// ═══════════════════════════════════════════════════════════════
async function generateTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  const wsL = wb.addWorksheet('__listas__');
  wsL.state = 'veryHidden';
  wsL.getColumn(1).values = ['Sector', ...SECTORES_VALUES];
  wsL.getColumn(2).values = ['TipoContrato', ...TIPOS_CONTRATO_VALUES];
  wsL.getColumn(3).values = ['ModoOperacion', ...MODOS_VALUES];
  wsL.getColumn(4).values = ['JornadaTipo', ...JORNADAS_VALUES];
  wsL.getColumn(5).values = ['Patron', ...PATRONES_VALUES];
  wsL.getColumn(6).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsL.getColumn(7).values = ['DiasDescanso', '1', '2'];
  wsL.getColumn(8).values = ['DiasTrabajo', 'L-V', 'L-S', 'L-D', 'L,M,X,J,V', 'L,M,X,J,V,S', 'L,M,X,J,V,S,D'];
  wsL.getColumn(9).values = ['SiNo', 'Si', 'No'];
  wsL.getColumn(10).values = ['Estrategia', ...ESTRATEGIAS];
  wsL.getColumn(11).values = ['Snap', ...SNAP_VALUES.map(String)];

  const ws = wb.addWorksheet('Áreas', { views: [{ state: 'frozen', ySplit: 1 }] });

  const columns = [
    // Identidad
    { key: 'nombre',                       width: 28, required: true,  label: 'nombre' },
    { key: 'codigo_area',                  width: 14, required: false, label: 'codigo_area' },
    { key: 'descripcion',                  width: 30, required: false, label: 'descripcion' },
    { key: 'sector',                       width: 22, required: false, label: 'sector' },
    { key: 'sub_sector',                   width: 22, required: false, label: 'sub_sector' },
    { key: 'centro_costo',                 width: 14, required: false, label: 'centro_costo' },
    // Jornada
    { key: 'modo_operacion',               width: 18, required: false, label: 'modo_operacion' },
    { key: 'jornada_tipo',                 width: 14, required: false, label: 'jornada_tipo' },
    { key: 'patron_rotativo',              width: 12, required: false, label: 'patron_rotativo' },
    { key: 'dias_trabajo',                 width: 14, required: false, label: 'dias_trabajo' },
    { key: 'dias_descanso',                width: 12, required: false, label: 'dias_descanso' },
    { key: 'horas_extras_max_dia',         width: 14, required: false, label: 'he_max_dia' },
    { key: 'horas_extras_max_semana',      width: 14, required: false, label: 'he_max_semana' },
    { key: 'descanso_min_entre_jornadas',  width: 14, required: false, label: 'descanso_min_horas' },
    // Contrato y salario
    { key: 'tipo_contrato_predominante',   width: 22, required: false, label: 'tipo_contrato' },
    { key: 'valor_hora_default',           width: 18, required: true,  label: 'valor_hora_default' },
    { key: 'paga_auxilio_transporte',      width: 16, required: false, label: 'paga_auxilio' },
    { key: 'nivel_riesgo_arl',             width: 14, required: false, label: 'nivel_arl' },
    // Headcount y horario
    { key: 'min_empleados_dia',            width: 14, required: false, label: 'min_empleados_dia' },
    { key: 'max_empleados_dia',            width: 14, required: false, label: 'max_empleados_dia' },
    { key: 'hora_inicio_dia',              width: 14, required: false, label: 'hora_inicio_dia' },
    { key: 'hora_fin_dia',                 width: 14, required: false, label: 'hora_fin_dia' },
    // Nocturno
    { key: 'night_shift_enabled',          width: 14, required: false, label: 'nocturno' },
    { key: 'night_shift_start',            width: 14, required: false, label: 'noche_inicio' },
    { key: 'night_shift_end',              width: 14, required: false, label: 'noche_fin' },
    { key: 'min_empleados_noche',          width: 14, required: false, label: 'min_noche' },
    { key: 'noche_solo_empleados_dedicados',width: 16, required: false, label: 'noche_dedicados' },
    { key: 'permite_dia_cubrir_noche',     width: 16, required: false, label: 'dia_cubre_noche' },
    // Estrategia de asignación
    { key: 'estrategia_asignacion',        width: 18, required: false, label: 'estrategia' },
    { key: 'permitir_horas_extras',        width: 14, required: false, label: 'permite_extras' },
    { key: 'permitir_turno_partido',       width: 16, required: false, label: 'permite_partido' },
    { key: 'min_horas_turno_override',     width: 14, required: false, label: 'min_horas_turno' },
    { key: 'max_horas_turno_override',     width: 14, required: false, label: 'max_horas_turno' },
    { key: 'snap_turnos_minutos',           width: 14, required: false, label: 'snap' },
    { key: 'balancear_carga',              width: 14, required: false, label: 'balancear' },
    // Optimización avanzada
    { key: 'consecutividad_horario',       width: 16, required: false, label: 'consecutividad' },
    { key: 'equidad_fin_semana',           width: 16, required: false, label: 'equidad_fines' },
    { key: 'peso_seniority',               width: 14, required: false, label: 'seniority' },
    { key: 'max_domingos_mes_area',        width: 14, required: false, label: 'max_domingos' },
    // Dotación y EPP
    { key: 'requiere_dotacion',            width: 14, required: false, label: 'requiere_dotacion' },
    { key: 'dotacion_periodicidad_meses',  width: 14, required: false, label: 'dotacion_periodicidad' },
    { key: 'requiere_epp',                 width: 14, required: false, label: 'requiere_epp' },
    { key: 'descripcion_epp',              width: 22, required: false, label: 'descripcion_epp' },
    // Otros
    { key: 'notas_operativas',             width: 30, required: false, label: 'notas' },
  ];

  ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: c.width }));

  const hRow = ws.getRow(1);
  columns.forEach((c, i) => {
    const cell = ws.getCell(1, i + 1);
    if (c.required) {
      cell.value = c.label + ' *';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFBBF24' }, size: 11 };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FFD1D5DB' }, size: 11 };
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };
  });
  hRow.height = 28;

  const maxRow = 202;
  const ref = (colIdx, n) => `__listas__!${String.fromCharCode(64 + colIdx)}$2:${String.fromCharCode(64 + colIdx)}$${n + 1}`;
  const refs = {
    sector: ref(1, SECTORES_VALUES.length),
    tipoC: ref(2, TIPOS_CONTRATO_VALUES.length),
    modo: ref(3, MODOS_VALUES.length),
    jornada: ref(4, JORNADAS_VALUES.length),
    patron: ref(5, PATRONES_VALUES.length),
    arl: ref(6, 5),
    diasDesc: ref(7, 2),
    diasTrab: ref(8, 6),
    siNo: ref(9, 2),
    estrategia: ref(10, ESTRATEGIAS.length),
    snap: ref(11, SNAP_VALUES.length),
  };

  const valNumPos = (promptMsg) => ({
    type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0],
    showErrorMessage: true, errorStyle: 'stop',
    errorTitle: 'Valor inválido', error: 'Debe ser un numero mayor a 0',
    showInputMessage: true, promptTitle: 'Valor numerico', prompt: promptMsg,
  });

  const valList = (refsKey, errorMsg, promptMsg) => ({
    type: 'list', allowBlank: true, formulae: [refs[refsKey]],
    showErrorMessage: true, errorStyle: 'stop',
    errorTitle: 'Valor invalido', error: errorMsg,
    showInputMessage: true, promptTitle: 'Seleccion', prompt: promptMsg,
  });

  const valTime = (promptMsg) => ({
    type: 'text', allowBlank: true,
    showInputMessage: true, promptTitle: 'Hora', prompt: promptMsg,
  });

  // Mapear columnas a su letra
  const colLetter = (idx) => {
    let s = '';
    let n = idx;
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };

  for (let r = 2; r <= maxRow; r++) {
    // D = sector, G = modo, H = jornada, I = patron, J = dias_trabajo, K = dias_descanso
    ws.getCell(`D${r}`).dataValidation = valList('sector', `Validos: ${SECTORES_VALUES.join(', ')}`, 'Sector economico (RETAIL, SALUD, etc.)');
    ws.getCell(`G${r}`).dataValidation = valList('modo', `Use: ${MODOS_VALUES.join(', ')}`, 'OFICINA, 24_7 o 24_7_NIGHT_SPLIT');
    ws.getCell(`H${r}`).dataValidation = valList('jornada', `Validas: ${JORNADAS_VALUES.join(', ')}`, 'Tipo de jornada CST');
    ws.getCell(`I${r}`).dataValidation = valList('patron', `Patrones: ${PATRONES_VALUES.join(', ')}`, 'Patron trabajo/descanso');
    ws.getCell(`J${r}`).dataValidation = valList('diasTrab', 'L-V, L-S, L-D', 'Dias laborables');
    ws.getCell(`K${r}`).dataValidation = valList('diasDesc', '1 o 2', 'Dias de descanso por semana');
    // M = he_max_dia, N = he_max_semana, O = descanso_min
    ws.getCell(`M${r}`).dataValidation = valNumPos('Max horas extra por dia. CST: 2');
    ws.getCell(`N${r}`).dataValidation = valNumPos('Max horas extra por semana. CST: 12');
    ws.getCell(`O${r}`).dataValidation = valNumPos('Min horas descanso entre jornadas. Recomendado: 9');
    // P = tipo_contrato, Q = valor_hora
    ws.getCell(`P${r}`).dataValidation = valList('tipoC', `Validos: ${TIPOS_CONTRATO_VALUES.join(', ')}`, 'Tipo de contrato predominante');
    ws.getCell(`Q${r}`).dataValidation = valNumPos('Salario base por hora en COP. OBLIGATORIO.');
    // R = auxilio, S = nivel_arl
    ws.getCell(`R${r}`).dataValidation = valList('siNo', 'Si o No', 'Auxilio transporte (sueldos <= 2 SMLV)');
    ws.getCell(`S${r}`).dataValidation = valList('arl', '1 a 5', 'Nivel riesgo ARL');
    // T = min_empleados_dia, U = max_empleados_dia
    ws.getCell(`T${r}`).dataValidation = valNumPos('Minimo de personas distintas por dia (piso). Opcional.');
    ws.getCell(`U${r}`).dataValidation = valNumPos('Maximo de personas distintas por dia (objetivo). Opcional.');
    // V = hora_inicio_dia, W = hora_fin_dia
    ws.getCell(`V${r}`).dataValidation = valTime('Formato HH:MM. Ej: 08:00');
    ws.getCell(`W${r}`).dataValidation = valTime('Formato HH:MM. Ej: 18:00');
    // X = nocturno (Si/No), Y = noche_inicio, Z = noche_fin, AA = min_noche
    ws.getCell(`X${r}`).dataValidation = valList('siNo', 'Si o No', 'Habilitar turno nocturno dedicado (solo 24/7)');
    ws.getCell(`Y${r}`).dataValidation = valTime('Formato HH:MM. Ej: 22:00');
    ws.getCell(`Z${r}`).dataValidation = valTime('Formato HH:MM. Ej: 06:00');
    ws.getCell(`AA${r}`).dataValidation = valNumPos('Minimo personas en la noche. Default: 1');
    // AB = noche_dedicados, AC = dia_cubre_noche
    ws.getCell(`AB${r}`).dataValidation = valList('siNo', 'Si o No', 'Solo empleados dedicados a la noche');
    ws.getCell(`AC${r}`).dataValidation = valList('siNo', 'Si o No', 'Permitir diurnos cubrir noche (emergencia)');
    // AD = estrategia
    ws.getCell(`AD${r}`).dataValidation = valList('estrategia', `Validas: ${ESTRATEGIAS.join(', ')}`, 'COVERAGE_FIRST (24/7), BALANCED (oficina), EMPLOYEE_PREF');
    // AE = permite_extras, AF = permite_partido
    ws.getCell(`AE${r}`).dataValidation = valList('siNo', 'Si o No', 'Permitir horas extra');
    ws.getCell(`AF${r}`).dataValidation = valList('siNo', 'Si o No', 'Permitir turnos partidos');
    // AG = min_horas_turno, AH = max_horas_turno
    ws.getCell(`AG${r}`).dataValidation = valNumPos('Min horas por turno. Default legal: 4');
    ws.getCell(`AH${r}`).dataValidation = valNumPos('Max horas por turno. Default: 9');
    // AI = snap
    ws.getCell(`AI${r}`).dataValidation = valList('snap', `Validos: ${SNAP_VALUES.join(', ')}`, 'Ajuste de turnos en minutos');
    // AJ = balancear
    ws.getCell(`AJ${r}`).dataValidation = valList('siNo', 'Si o No', 'Balancear carga semanal al final');
    // AK = consecutividad, AL = equidad, AM = seniority
    ws.getCell(`AK${r}`).dataValidation = valList('siNo', 'Si o No', 'Mantener mismo horario dias seguidos');
    ws.getCell(`AL${r}`).dataValidation = valList('siNo', 'Si o No', 'Repartir fines de semana parejo');
    ws.getCell(`AM${r}`).dataValidation = valList('siNo', 'Si o No', 'Priorizar por antiguedad');
    // AN = max_domingos
    ws.getCell(`AN${r}`).dataValidation = valNumPos('Max domingos por mes. CST: minimo 2');
    // AO = requiere_dotacion, AP = dotacion_periodicidad
    ws.getCell(`AO${r}`).dataValidation = valList('siNo', 'Si o No', 'Requiere dotacion (Art. 230 CST)');
    ws.getCell(`AP${r}`).dataValidation = valNumPos('Cada cuantos meses. Default: 4');
    // AQ = requiere_epp
    ws.getCell(`AQ${r}`).dataValidation = valList('siNo', 'Si o No', 'Requiere EPP');
  }

  ws.autoFilter = { from: 'A1', to: `${colLetter(columns.length)}1` };

  const wsInfo = wb.addWorksheet('Guia de uso');
  wsInfo.getColumn(1).width = 35;
  wsInfo.getColumn(2).width = 70;

  const guia = [
    ['CHRONOSWORK — Importacion Masiva de Areas v4', ''],
    ['', ''],
    ['COLUMNAS OBLIGATORIAS', 'nombre, valor_hora_default'],
    ['', ''],
    ['COLUMNA', 'DESCRIPCION'],
    ['nombre *', 'Nombre del area. Ej: Cajas, Bodega, Produccion, Cocina, Recepcion.'],
    ['codigo_area', 'Codigo interno. Ej: CAJ-01. Opcional.'],
    ['descripcion', 'Descripcion breve del area. Opcional.'],
    ['sector', `Sector economico. Validos: ${SECTORES_VALUES.join(', ')}. Define defaults automaticos.`],
    ['sub_sector', 'Sub-sector o especialidad. Opcional.'],
    ['centro_costo', 'Centro de costo contable. Opcional.'],
    ['modo_operacion', `OFICINA, 24_7 o 24_7_NIGHT_SPLIT. Default: OFICINA.`],
    ['jornada_tipo', `Tipo de jornada CST: ${JORNADAS_VALUES.join(', ')}.`],
    ['patron_rotativo', `Patron trabajo/descanso: ${PATRONES_VALUES.join(', ')}.`],
    ['dias_trabajo', 'Dias laborables. L-V, L-S, L-D, o L,M,X,J,V.'],
    ['dias_descanso', 'Dias de descanso por semana. 1 o 2.'],
    ['he_max_dia', 'Max horas extra por dia. CST: 2.'],
    ['he_max_semana', 'Max horas extra por semana. CST: 12.'],
    ['descanso_min_horas', 'Minimo horas descanso entre jornadas. Recomendado: 9.'],
    ['tipo_contrato', `Tipo de contrato predominante: ${TIPOS_CONTRATO_VALUES.join(', ')}.`],
    ['valor_hora_default *', 'Salario base por hora en COP. OBLIGATORIO.'],
    ['paga_auxilio', 'Si/No. Auxilio transporte para sueldos <= 2 SMLV.'],
    ['nivel_arl', 'Nivel riesgo ARL (1-5). 1=oficinas, 5=mineria.'],
    ['min_empleados_dia', 'Minimo de personas distintas por dia (piso). Dejar vacio si no hay minimo.'],
    ['max_empleados_dia', 'Maximo de personas distintas por dia (objetivo). Dejar vacio para usar curva de demanda.'],
    ['hora_inicio_dia', 'Hora a la que puede empezar el primer turno. Formato HH:MM. Ej: 08:00'],
    ['hora_fin_dia', 'Hora a la que debe terminar el ultimo turno. Formato HH:MM. Ej: 18:00'],
    ['nocturno', 'Si/No. Habilitar turno nocturno dedicado (solo 24/7).'],
    ['noche_inicio', 'Hora inicio turno nocturno. Ej: 22:00'],
    ['noche_fin', 'Hora fin turno nocturno. Ej: 06:00'],
    ['min_noche', 'Minimo personas en la noche. Default: 1'],
    ['noche_dedicados', 'Si/No. Solo empleados dedicados a la noche.'],
    ['dia_cubre_noche', 'Si/No. Permitir diurnos en noche (emergencia).'],
    ['estrategia', `Estrategia del algoritmo: COVERAGE_FIRST (24/7), BALANCED (oficina), EMPLOYEE_PREF. Default: BALANCED.`],
    ['permite_extras', 'Si/No. Permitir horas extra (max 2/dia).'],
    ['permite_partido', 'Si/No. Permitir turnos partidos (con almuerzo).'],
    ['min_horas_turno', 'Min horas por turno. Default legal: 4. Dejar vacio.'],
    ['max_horas_turno', 'Max horas por turno. Default: 9. Dejar vacio.'],
    ['snap', 'Ajuste de turnos en minutos. 5, 10, 15, 30 o 60. Default: 15.'],
    ['balancear', 'Si/No. Balancear carga semanal. Default: Si.'],
    ['consecutividad', 'Si/No. Mantener mismo horario dias seguidos. Default: Si.'],
    ['equidad_fines', 'Si/No. Repartir fines de semana parejo. Default: Si.'],
    ['seniority', 'Si/No. Priorizar por antiguedad. Default: No.'],
    ['max_domingos', 'Max domingos por mes. CST: minimo 2. Default: 2.'],
    ['requiere_dotacion', 'Si/No. Entregar dotacion cada N meses (Art. 230 CST).'],
    ['dotacion_periodicidad', 'Cada cuantos meses entregar dotacion. Default: 4.'],
    ['requiere_epp', 'Si/No. Requiere Elementos de Proteccion Personal.'],
    ['descripcion_epp', 'Descripcion del EPP. Ej: Casco, botas, gafas.'],
    ['notas', 'Notas operativas libres.'],
    ['', ''],
    ['NOTAS', ''],
    ['1.', 'Solo nombre y valor_hora_default son obligatorios. Todo lo demas tiene defaults.'],
    ['2.', 'Al elegir sector, se autocompletan salario, contrato, modo y franjas si los dejas vacios.'],
    ['3.', 'Los descansos (almuerzo/breaks) se configuran desde la app, no desde el Excel.'],
    ['4.', 'Para 24/7 con turno nocturno: marca nocturno=Si y define noche_inicio/noche_fin.'],
  ];

  guia.forEach((row, i) => {
    const r = wsInfo.addRow(row);
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
      r.height = 26;
    } else if (row[0] === 'COLUMNAS OBLIGATORIAS' || row[0] === 'COLUMNA' || row[0] === 'NOTAS') {
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
  a.download = 'plantilla_areas_chronoswork_v4.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// Preview columns
// ═══════════════════════════════════════════════════════════════
const PREVIEW_COLUMNS = [
  { key: 'nombre',    label: 'Nombre' },
  { key: 'sector',    label: 'Sector',    format: (v) => v || '—' },
  { key: 'modo_operacion', label: 'Modo', format: (v) => v || '—' },
  { key: 'estrategia_asignacion', label: 'Estrategia', format: (v) => v || '—' },
  { key: 'valor_hora_default', label: '$/h', format: (v) => parseNumero(v)?.toLocaleString('es-CO') || '—' },
  { key: 'tipo_contrato_predominante', label: 'Contrato', format: (v) => v || '—' },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENTE WRAPPER
// ═══════════════════════════════════════════════════════════════
export default function BulkImportAreasModal({ onClose, onBulkSave }) {
  const [applySector, setApplySector] = useState(true);
  const [applyFranjas, setApplyFranjas] = useState(true);

  const validateRow = useCallback((row) => validateAreaRow(row), []);

  const normFn = useCallback((field, val) => {
    if (val === null || val === undefined || val === '') return null;
    const s = String(val).trim();
    switch (field) {
      case 'modo_operacion': {
        const u = s.toUpperCase().replace(/[\/\-]/g, '_');
        if (MODOS_VALUES.includes(u)) return u;
        return null;
      }
      case 'estrategia_asignacion': {
        const u = s.toUpperCase();
        return ESTRATEGIAS.includes(u) ? u : null;
      }
      case 'jornada_tipo': {
        const u = s.toUpperCase();
        return JORNADAS_VALUES.includes(u) ? u : null;
      }
      case 'sector': {
        const u = s.toUpperCase();
        return SECTORES_VALUES.includes(u) ? u : null;
      }
      case 'patron_rotativo': {
        return PATRONES_VALUES.includes(s) ? s : null;
      }
      case 'tipo_contrato_predominante':
      case 'tipo_contrato_default': {
        const u = s.toUpperCase().replace(/\s+/g, '_');
        if (TIPOS_CONTRATO_VALUES.includes(u)) return u;
        if (u.includes('INDEFINIDO')) return 'INDEFINIDO';
        if (u.includes('TERMINO') && u.includes('FIJO')) return 'TERMINO_FIJO';
        if (u.includes('OBRA') || u.includes('LABOR')) return 'OBRA_LABOR';
        if (u.includes('HORA')) return 'POR_HORAS';
        if (u.includes('FIJO') || u === 'MENSUAL' || u === 'SALARIO_FIJO') return 'SALARIO_FIJO';
        if (u.includes('PRESTACION') || u === 'CONTRATISTA' || u === 'OPS') return 'PRESTACION_SERVICIOS';
        if (u.includes('APRENDIZ') || u === 'SENA') return 'APRENDIZAJE';
        if (u.includes('OCASIONAL')) return 'OCASIONAL';
        if (u.includes('TEMPORAL') || u === 'EST') return 'TEMPORAL';
        return null;
      }
      case 'dias_descanso': {
        const u = s.toUpperCase();
        if (['1', 'D', 'DOMINGO'].includes(u)) return 1;
        if (['2', 'S-D', 'SAB-DOM', 'FIN_DE_SEMANA', 'FIN SEMANA'].includes(u)) return 2;
        const n = parseInt(u, 10);
        return (n === 1 || n === 2) ? n : null;
      }
      case 'snap_turnos_minutos': {
        const n = parseInt(s, 10);
        return SNAP_VALUES.includes(n) ? n : null;
      }
      case 'paga_auxilio_transporte':
      case 'requiere_dotacion':
      case 'requiere_epp':
      case 'permite_turno_partido':
      case 'night_shift_enabled':
      case 'noche_solo_empleados_dedicados':
      case 'permite_dia_cubrir_noche':
      case 'permitir_horas_extras':
      case 'balancear_carga':
      case 'consecutividad_horario':
      case 'equidad_fin_semana':
      case 'peso_seniority': {
        const u = s.toLowerCase();
        if (['no', 'false', '0'].includes(u)) return false;
        return true;
      }
      default:
        return val;
    }
  }, []);

  const handleImport = useCallback(async (validRows, setProgress) => {
    let successCount = 0;
    const errorList = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const sector = normFn('sector', row.sector) || '';
        const franjasAuto = (applyFranjas && sector) ? getFranjasBySector(sector) : [];

        const modoOperacion = normFn('modo_operacion', row.modo_operacion)
          || (applySector && sector ? (SECTORES.find(s => s.value === sector)?.defaults.modo || 'OFICINA') : 'OFICINA');
        const es247 = modoOperacion === '24_7' || modoOperacion === '24_7_NIGHT_SPLIT';
        const estrategiaDefault = es247 ? 'COVERAGE_FIRST' : 'BALANCED';

        const areaData = {
          nombre: String(row.nombre).trim(),
          codigo_area: row.codigo_area ? String(row.codigo_area).trim() : null,
          descripcion: row.descripcion ? String(row.descripcion).trim() : '',
          sector: sector || null,
          sub_sector: row.sub_sector ? String(row.sub_sector).trim() : null,
          centro_costo: row.centro_costo ? String(row.centro_costo).trim() : null,
          modo_operacion: modoOperacion,
          jornada_tipo: normFn('jornada_tipo', row.jornada_tipo) || 'DIURNA',
          patron_rotativo: normFn('patron_rotativo', row.patron_rotativo),
          dias_trabajo: row.dias_trabajo ? parseDiasTrabajo(row.dias_trabajo) : (es247 ? [1,2,3,4,5,6,7] : [1,2,3,4,5]),
          dias_descanso: normFn('dias_descanso', row.dias_descanso) || 1,
          horas_extras_max_dia: row.horas_extras_max_dia ? parseInt(row.horas_extras_max_dia, 10) : 2,
          horas_extras_max_semana: row.horas_extras_max_semana ? parseInt(row.horas_extras_max_semana, 10) : 12,
          descanso_min_entre_jornadas: row.descanso_min_entre_jornadas ? parseInt(row.descanso_min_entre_jornadas, 10) : 9,
          tipo_contrato_predominante: normFn('tipo_contrato_predominante', row.tipo_contrato_predominante)
            || (applySector && sector ? (SECTORES.find(s => s.value === sector)?.defaults.contrato || 'INDEFINIDO') : 'INDEFINIDO'),
          tipo_contrato_default: normFn('tipo_contrato_default', row.tipo_contrato_default)
            || normFn('tipo_contrato_predominante', row.tipo_contrato_predominante)
            || 'INDEFINIDO',
          dias_descanso_default: normFn('dias_descanso', row.dias_descanso) || 1,
          valor_hora_default: parseNumero(row.valor_hora_default),
          paga_auxilio_transporte: normFn('paga_auxilio_transporte', row.paga_auxilio_transporte) ?? true,
          nivel_riesgo_arl: row.nivel_riesgo_arl ? (parseInt(row.nivel_riesgo_arl, 10) || 1) : 1,
          // Headcount
          min_empleados_dia: row.min_empleados_dia ? parseInt(row.min_empleados_dia, 10) : null,
          max_empleados_dia: row.max_empleados_dia ? parseInt(row.max_empleados_dia, 10) : null,
          hora_inicio_dia: row.hora_inicio_dia || (es247 ? '04:00' : '08:00'),
          hora_fin_dia: row.hora_fin_dia || (es247 ? '22:00' : '18:00'),
          // Nocturno
          night_shift_enabled: normFn('night_shift_enabled', row.night_shift_enabled) ?? es247,
          night_shift_start: row.night_shift_start || '22:00',
          night_shift_end: row.night_shift_end || '06:00',
          min_empleados_noche: row.min_empleados_noche ? parseInt(row.min_empleados_noche, 10) : 1,
          noche_solo_empleados_dedicados: normFn('noche_solo_empleados_dedicados', row.noche_solo_empleados_dedicados) ?? true,
          permite_dia_cubrir_noche: normFn('permite_dia_cubrir_noche', row.permite_dia_cubrir_noche) ?? false,
          // Estrategia
          estrategia_asignacion: normFn('estrategia_asignacion', row.estrategia_asignacion) || estrategiaDefault,
          permitir_horas_extras: normFn('permitir_horas_extras', row.permitir_horas_extras) ?? false,
          permitir_turno_partido: normFn('permitir_turno_partido', row.permitir_turno_partido) ?? false,
          min_horas_turno_override: row.min_horas_turno_override ? parseFloat(row.min_horas_turno_override) : null,
          max_horas_turno_override: row.max_horas_turno_override ? parseFloat(row.max_horas_turno_override) : null,
          snap_turnos_minutos: normFn('snap_turnos_minutos', row.snap_turnos_minutos) || 15,
          balancear_carga: normFn('balancear_carga', row.balancear_carga) ?? true,
          // Optimización
          consecutividad_horario: normFn('consecutividad_horario', row.consecutividad_horario) ?? true,
          equidad_fin_semana: normFn('equidad_fin_semana', row.equidad_fin_semana) ?? true,
          peso_seniority: normFn('peso_seniority', row.peso_seniority) ?? false,
          max_domingos_mes_area: row.max_domingos_mes_area ? parseInt(row.max_domingos_mes_area, 10) : 2,
          // Dotación
          requiere_dotacion: normFn('requiere_dotacion', row.requiere_dotacion) ?? false,
          dotacion_periodicidad_meses: row.dotacion_periodicidad_meses ? parseInt(row.dotacion_periodicidad_meses, 10) : 4,
          requiere_epp: normFn('requiere_epp', row.requiere_epp) ?? false,
          descripcion_epp: row.descripcion_epp ? String(row.descripcion_epp).trim() : '',
          // Otros
          notas_operativas: row.notas_operativas ? String(row.notas_operativas).trim() : '',
          color: PALETTE_DEFAULTS[i % PALETTE_DEFAULTS.length],
          night_shift_employee_ids: [],
          franjas_iniciales: franjasAuto,
        };

        await onBulkSave(areaData);
        successCount++;
      } catch (err) {
        errorList.push({ row: row._row, nombre: row.nombre, msg: err.message });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    return { success: successCount, errors: errorList };
  }, [applySector, applyFranjas, onBulkSave, normFn]);

  const uploadInfoContent = (
    <>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
        <MdInfo style={{ color: '#34d399' }} /> 44 columnas con todos los campos del AreaForm
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Solo <strong>nombre</strong> y <strong>valor_hora_default</strong> son obligatorios. El resto usa defaults del sector.
        Incluye estrategia de asignacion, headcount, turno nocturno y optimizacion avanzada.
      </div>
    </>
  );

  const uploadExtras = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={applySector} onChange={e => setApplySector(e.target.checked)} />
        <span>Aplicar defaults del sector (salario, contrato, modo)</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={applyFranjas} onChange={e => setApplyFranjas(e.target.checked)} />
        <span>Crear franjas horarias tipicas del sector</span>
      </label>
    </div>
  );

  return (
    <BulkImportModalGeneric
      title="Importacion Masiva de Areas"
      icon={<MdDomain />}
      entityName="area"
      entityNamePlural="areas"
      columnAliases={COLUMN_ALIASES}
      validateRow={validateRow}
      generateTemplate={generateTemplate}
      templateButtonLabel="Descargar plantilla Excel con catalogos"
      templateButtonDisabled={false}
      onImport={handleImport}
      uploadInfoContent={uploadInfoContent}
      uploadExtras={uploadExtras}
      previewColumns={PREVIEW_COLUMNS}
      previewRowKey="nombre"
      importingMessage="Creando franjas y aplicando defaults"
      onClose={onClose}
      maxWidth={820}
    />
  );
}
