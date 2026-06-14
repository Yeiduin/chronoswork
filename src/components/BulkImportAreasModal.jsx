// ============================================================
// ChronosWork — Importación Masiva de Áreas v3
// Soporta TODOS los campos laborales colombianos
// ============================================================

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  MdClose, MdUpload, MdDownload, MdCheckCircle, MdError, MdInfo, MdDomain, MdWarning,
} from 'react-icons/md';
import { SECTORES, TIPOS_CONTRATO, PATRONES_ROTATIVOS, TIPOS_JORNADA, getAreasBySector, getFranjasBySector } from '../config/laborCatalog';

// ─── Catálogos para dropdowns ───────────────────────────────────────────────
const SECTORES_VALUES = SECTORES.map(s => s.value);
const TIPOS_CONTRATO_VALUES = TIPOS_CONTRATO.map(t => t.value);
const PATRONES_VALUES = PATRONES_ROTATIVOS.map(p => p.value).filter(v => v !== 'PERSONALIZADO');
const JORNADAS_VALUES = TIPOS_JORNADA.map(j => j.value);
const NIVELES_ARL = [1, 2, 3, 4, 5];
const DIAS_OPCIONES = ['L-V', 'L-S', 'L-D', 'Personalizado'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const PALETTE_DEFAULTS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316',
];

// ─── Normalización y mapeo de columnas ──────────────────────────────────────
const COLUMN_ALIASES = {
  nombre:                       ['nombre', 'name', 'area', 'área', 'nombre del área', 'nombre area', 'departamento'],
  codigo_area:                  ['codigo', 'código', 'codigo_area', 'codigo interno', 'id interno'],
  descripcion:                  ['descripcion', 'descripción', 'description', 'desc', 'detalle'],
  sector:                       ['sector', 'industria', 'rubro'],
  sub_sector:                   ['sub_sector', 'subsector', 'sub sector', 'especialidad'],
  centro_costo:                 ['centro_costo', 'centro de costo', 'centro coste', 'cost center'],
  modo_operacion:               ['modo_operacion', 'modo operacion', 'operacion', 'modo'],
  jornada_tipo:                 ['jornada', 'jornada_tipo', 'tipo jornada', 'jornada tipo'],
  duracion_jornada_horas:       ['duracion_jornada', 'duracion horas', 'horas turno', 'duracion_horas'],
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
  requiere_dotacion:            ['dotacion', 'requiere_dotacion', 'dotación'],
  requiere_epp:                 ['epp', 'requiere_epp', 'elementos proteccion'],
  break_minutos:                ['break', 'break_minutos', 'almuerzo', 'minutos break'],
  permite_turno_partido:        ['turno_partido', 'jornada_partida', 'permite_partido'],
  notas_operativas:             ['notas', 'observaciones', 'notas_operativas', 'comentarios'],
};

// Normaliza header: minúscula, sin espacios extras, SIN asterisco final
function normalizeH(h) { return String(h || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[*\s]+$/, '').trim(); }

function findCol(headers, aliases) {
  // Intento 1: match exacto con el header normalizado (sin asterisco)
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h) === a);
    if (i !== -1) return i;
  }
  // Intento 2: match que CONTENGA el alias (ej. "nombre *" contiene "nombre")
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h).includes(a));
    if (i !== -1) return i;
  }
  return -1;
}
function buildIdx(headers) {
  const m = {};
  for (const [f, aliases] of Object.entries(COLUMN_ALIASES)) m[f] = findCol(headers, aliases);
  return m;
}

// ─── Helpers de parseo ─────────────────────────────────────────────────────
function parseDiasTrabajo(val) {
  if (!val) return [1, 2, 3, 4, 5];
  const v = String(val).toUpperCase().trim();
  if (v === 'L-V' || v === 'L-V') return [1, 2, 3, 4, 5];
  if (v === 'L-S') return [1, 2, 3, 4, 5, 6];
  if (v === 'L-D' || v === 'TODOS') return [1, 2, 3, 4, 5, 6, 7];
  // "L,M,X,J,V" o "LMXJV"
  if (v.includes(',') || v.match(/[LMXJVSD]/)) {
    const map = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 7 };
    const result = [];
    const chars = v.replace(/[\s,]/g, '').split('');
    chars.forEach(c => { if (map[c] && !result.includes(map[c])) result.push(map[c]); });
    return result.sort();
  }
  return [1, 2, 3, 4, 5];
}

function parseBool(val) {
  const s = String(val || '').toLowerCase().trim();
  return ['si', 'sí', 'yes', 'true', '1', 'x', '✓'].includes(s);
}

function parseNumero(val) {
  const v = String(val || '').replace(/[^0-9.-]/g, '');
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ─── Validación por fila ───────────────────────────────────────────────────
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
    if (!['OFICINA', '24_7'].includes(u)) {
      errors.push({ campo: 'modo_operacion', msg: `Modo "${row.modo_operacion}" no es válido. Use OFICINA o 24_7 (acepta 24/7, 24-7)` });
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
    // Si no está en la lista exacta, pero contiene un alias válido (ej. "TERMINO_INDEFINIDO" contiene "INDEFINIDO"),
    // se considerará un warning (no error) y se normalizará durante el import.
    if (!TIPOS_CONTRATO_VALUES.includes(u)) {
      // Mapeo flexible: si contiene la palabra clave, es recuperable
      const recoverable = TIPOS_CONTRATO_VALUES.some(t => u.includes(t.replace(/_/g, ' ')) || u.includes(t));
      if (!recoverable) {
        errors.push({ campo: 'tipo_contrato_predominante', msg: `"${row.tipo_contrato_predominante}" no es válido. Use: ${TIPOS_CONTRATO_VALUES.join(', ')}` });
      }
    }
  }

  if (row.tipo_contrato_default) {
    const u = String(row.tipo_contrato_default).trim().toUpperCase();
    if (!TIPOS_CONTRATO_VALUES.includes(u)) {
      const recoverable = TIPOS_CONTRATO_VALUES.some(t => u.includes(t.replace(/_/g, ' ')) || u.includes(t));
      if (!recoverable) {
        errors.push({ campo: 'tipo_contrato_default', msg: `"${row.tipo_contrato_default}" no es válido. Use: ${TIPOS_CONTRATO_VALUES.join(', ')}` });
      }
    }
  }

  if (row.nivel_riesgo_arl) {
    const n = parseInt(row.nivel_riesgo_arl, 10);
    if (isNaN(n) || n < 1 || n > 5) {
      errors.push({ campo: 'nivel_riesgo_arl', msg: 'Nivel ARL debe ser 1, 2, 3, 4 o 5' });
    }
  }

  if (row.dias_descanso) {
    const u = String(row.dias_descanso).toUpperCase().trim();
    // Acepta "1", "2", "D", "S-D", "FIN DE SEMANA", "SAB-DOM"
    const validAliases = ['1', '2', 'D', 'S-D', 'SAB-DOM', 'FIN_DE_SEMANA', 'FIN SEMANA', 'DOMINGO'];
    if (!validAliases.includes(u)) {
      const n = parseInt(u, 10);
      if (isNaN(n) || (n !== 1 && n !== 2)) {
        errors.push({ campo: 'dias_descanso', msg: `dias_descanso "${row.dias_descanso}" no es válido. Use 1, 2, "D" o "S-D"` });
      }
    }
  }

  return errors;
}

// ─── Genera plantilla Excel con TODOS los campos ────────────────────────────
async function generateTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  // ── Hoja oculta con listas desplegables ──
  const wsL = wb.addWorksheet('__listas__');
  wsL.state = 'veryHidden';
  wsL.getColumn(1).values = ['Sector', ...SECTORES_VALUES];
  wsL.getColumn(2).values = ['TipoContrato', ...TIPOS_CONTRATO_VALUES];
  wsL.getColumn(3).values = ['ModoOperacion', 'OFICINA', '24_7'];
  wsL.getColumn(4).values = ['JornadaTipo', ...JORNADAS_VALUES];
  wsL.getColumn(5).values = ['Patron', ...PATRONES_VALUES];
  wsL.getColumn(6).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsL.getColumn(7).values = ['DiasDescanso', '1', '2'];
  wsL.getColumn(8).values = ['DiasTrabajo', 'L-V', 'L-S', 'L-D', 'L,M,X,J,V', 'L,M,X,J,V,S', 'L,M,X,J,V,S,D'];
  wsL.getColumn(9).values = ['SiNo', 'Si', 'No'];

  // ── Hoja principal ──
  const ws = wb.addWorksheet('Áreas', { views: [{ state: 'frozen', ySplit: 1 }] });

  const columns = [
    { key: 'nombre',                       width: 28, required: true,  label: 'nombre' },
    { key: 'codigo_area',                  width: 14, required: false, label: 'codigo_area' },
    { key: 'descripcion',                  width: 30, required: false, label: 'descripcion' },
    { key: 'sector',                       width: 22, required: false, label: 'sector' },
    { key: 'sub_sector',                   width: 22, required: false, label: 'sub_sector' },
    { key: 'centro_costo',                 width: 14, required: false, label: 'centro_costo' },
    { key: 'modo_operacion',               width: 16, required: false, label: 'modo_operacion' },
    { key: 'jornada_tipo',                 width: 14, required: false, label: 'jornada_tipo' },
    { key: 'patron_rotativo',              width: 12, required: false, label: 'patron_rotativo' },
    { key: 'dias_trabajo',                 width: 14, required: false, label: 'dias_trabajo' },
    { key: 'dias_descanso',                width: 12, required: false, label: 'dias_descanso' },
    { key: 'duracion_jornada_horas',       width: 14, required: false, label: 'duracion_jornada_horas' },
    { key: 'horas_extras_max_dia',         width: 14, required: false, label: 'he_max_dia' },
    { key: 'horas_extras_max_semana',      width: 14, required: false, label: 'he_max_semana' },
    { key: 'descanso_min_entre_jornadas',  width: 14, required: false, label: 'descanso_min_horas' },
    { key: 'tipo_contrato_predominante',   width: 22, required: false, label: 'tipo_contrato' },
    { key: 'valor_hora_default',           width: 18, required: true,  label: 'valor_hora_default' },
    { key: 'paga_auxilio_transporte',      width: 16, required: false, label: 'paga_auxilio' },
    { key: 'nivel_riesgo_arl',             width: 14, required: false, label: 'nivel_arl' },
    { key: 'requiere_dotacion',            width: 14, required: false, label: 'requiere_dotacion' },
    { key: 'requiere_epp',                 width: 14, required: false, label: 'requiere_epp' },
    { key: 'break_minutos',                width: 12, required: false, label: 'break_minutos' },
    { key: 'permite_turno_partido',        width: 16, required: false, label: 'permite_partido' },
    { key: 'notas_operativas',             width: 30, required: false, label: 'notas' },
  ];

  ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: c.width }));

  // Estilo de encabezados
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

  // ── Data validations (filas 2-202) ──
  const maxRow = 202;
  const refSector = `__listas__!$A$2:$A$${SECTORES_VALUES.length + 1}`;
  const refTipoC = `__listas__!$B$2:$B$${TIPOS_CONTRATO_VALUES.length + 1}`;
  const refModo = `__listas__!$C$2:$C$3`;
  const refJornada = `__listas__!$D$2:$D$${JORNADAS_VALUES.length + 1}`;
  const refPatron = `__listas__!$E$2:$E$${PATRONES_VALUES.length + 1}`;
  const refARL = `__listas__!$F$2:$F$6`;
  const refDiasDesc = `__listas__!$G$2:$G$3`;
  const refDiasTrab = `__listas__!$H$2:$H$7`;
  const refSiNo = `__listas__!$I$2:$I$3`;

  const valNumPos = (promptMsg) => ({
    type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0],
    showErrorMessage: true, errorStyle: 'stop',
    errorTitle: '⛔ Valor inválido',
    error: 'Debe ser un número mayor a 0',
    showInputMessage: true, promptTitle: '💰 Valor numérico',
    prompt: promptMsg,
  });

  const valList = (refs, errorMsg, promptMsg) => ({
    type: 'list', allowBlank: true, formulae: [refs],
    showErrorMessage: true, errorStyle: 'stop',
    errorTitle: '⛔ Valor inválido',
    error: errorMsg,
    showInputMessage: true, promptTitle: '📋 Selección',
    prompt: promptMsg,
  });

  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`Q${r}`).dataValidation = valNumPos('Salario base por hora ordinaria en COP. Ej: 12500. Este campo es OBLIGATORIO.');
    ws.getCell(`D${r}`).dataValidation = valList(refSector, `Sectores válidos: ${SECTORES_VALUES.join(', ')}`, 'Sector económico (RETAIL, SALUD, HOTELERIA, etc.). Determina defaults y franjas típicas.');
    ws.getCell(`G${r}`).dataValidation = valList(refModo, 'OFICINA o 24_7', 'Modo de operación. OFICINA = jornada normal. 24_7 = operación continua.');
    ws.getCell(`H${r}`).dataValidation = valList(refJornada, `Válidas: ${JORNADAS_VALUES.join(', ')}`, 'Tipo de jornada según CST art. 158-164.');
    ws.getCell(`I${r}`).dataValidation = valList(refPatron, `Patrones válidos: ${PATRONES_VALUES.join(', ')}`, 'Patrón de trabajo/descanso. Ej: 5x2 (L-V), 7x7 (mineras).');
    ws.getCell(`J${r}`).dataValidation = valList(refDiasTrab, 'L-V, L-S, L-D o L,M,X,J,V (formato)', 'Días laborables. L-V, L-S, L-D, o los días separados por coma.');
    ws.getCell(`K${r}`).dataValidation = valList(refDiasDesc, '1 o 2', 'Días de descanso por semana. 1 o 2.');
    ws.getCell(`L${r}`).dataValidation = valNumPos('Duración del turno en horas. Ej: 8, 10, 12.');
    ws.getCell(`M${r}`).dataValidation = valNumPos('Máx. horas extra por día. Límite CST: 2');
    ws.getCell(`N${r}`).dataValidation = valNumPos('Máx. horas extra por semana. Límite CST: 12');
    ws.getCell(`O${r}`).dataValidation = valNumPos('Mínimo de horas de descanso entre jornadas. Recomendado: 9.');
    ws.getCell(`P${r}`).dataValidation = valList(refTipoC, `Tipos válidos: ${TIPOS_CONTRATO_VALUES.join(', ')}`, 'Tipo de contrato predominante para esta área.');
    ws.getCell(`R${r}`).dataValidation = valList(refSiNo, 'Si o No', '¿Aplica auxilio de transporte? (sueldos ≤ 2 SMLV, monto 2025: $200.000)');
    ws.getCell(`S${r}`).dataValidation = valList(refARL, '1 a 5', 'Nivel de riesgo ARL. I=oficinas, V=minería/petróleos.');
    ws.getCell(`T${r}`).dataValidation = valList(refSiNo, 'Si o No', '¿Se entrega dotación cada 4 meses? (Art. 230 CST)');
    ws.getCell(`U${r}`).dataValidation = valList(refSiNo, 'Si o No', '¿Requiere EPP?');
    ws.getCell(`V${r}`).dataValidation = valNumPos('Minutos de break/almuerzo. 0 = sin break.');
    ws.getCell(`W${r}`).dataValidation = valList(refSiNo, 'Si o No', '¿Permite turnos partidos (con hora de almuerzo)?');
  }

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };

  // ── Hoja de instrucciones ──
  const wsInfo = wb.addWorksheet('📋 Guía de uso');
  wsInfo.getColumn(1).width = 35;
  wsInfo.getColumn(2).width = 70;

  const guia = [
    ['CHRONOSWORK — Importación Masiva de Áreas v3', ''],
    ['', ''],
    ['⚠️ COLUMNAS OBLIGATORIAS', 'nombre, valor_hora_default'],
    ['', ''],
    ['COLUMNA', 'DESCRIPCIÓN'],
    ['nombre *', 'Nombre del área. Ej: Cajas, Bodega, Producción, Cocina, Recepción.'],
    ['codigo_area', 'Código interno. Ej: CAJ-01, BOD-02. Opcional.'],
    ['descripcion', 'Descripción breve del área. Opcional.'],
    ['sector', `Sector económico. Válidos: ${SECTORES_VALUES.join(', ')}. El sector define los defaults.`],
    ['sub_sector', 'Sub-sector o especialidad. Ej: "Cajas rápidas". Opcional.'],
    ['centro_costo', 'Centro de costo contable. Ej: CC-1001. Opcional.'],
    ['modo_operacion', 'OFICINA (L-V normal) o 24_7 (operación continua con turnos rotativos). Default: OFICINA.'],
    ['jornada_tipo', `Tipo de jornada CST. Válidas: ${JORNADAS_VALUES.join(', ')}.`],
    ['patron_rotativo', `Patrón trabajo/descanso. Válidos: ${PATRONES_VALUES.join(', ')}. Ej: 5x2 = trabaja 5, descansa 2.`],
    ['dias_trabajo', `Días laborables. L-V, L-S, L-D, o personalizado: L,M,X,J,V.`],
    ['dias_descanso', 'Días de descanso por semana. 1 o 2.'],
    ['duracion_jornada_horas', 'Duración del turno en horas. Sin almuerzo. Ej: 8, 10, 12.'],
    ['he_max_dia', 'Máx. horas extra por día. CST: 2.'],
    ['he_max_semana', 'Máx. horas extra por semana. CST: 12.'],
    ['descanso_min_horas', 'Mínimo de horas descanso entre jornadas. Recomendado: 9.'],
    ['tipo_contrato', `Tipo de contrato predominante del área. Válidos: ${TIPOS_CONTRATO_VALUES.join(', ')}.`],
    ['valor_hora_default *', 'Salario base por hora en COP. Ej: 12500. Este campo es OBLIGATORIO.'],
    ['paga_auxilio', 'Si/No. ¿Aplica auxilio de transporte ($200.000 para sueldos ≤ 2 SMLV)?'],
    ['nivel_arl', `Nivel de riesgo ARL (Decreto 1295/94). 1=oficinas, 5=minería. Válidos: 1-5.`],
    ['requiere_dotacion', 'Si/No. ¿Se entrega dotación cada 4 meses? (Art. 230 CST, sueldos ≤ 2 SMLV).'],
    ['requiere_epp', 'Si/No. ¿Requiere Elementos de Protección Personal?'],
    ['break_minutos', 'Minutos de break/almuerzo. No se paga.'],
    ['permite_partido', 'Si/No. ¿Permite turnos partidos? (7-12 + 14-18)'],
    ['notas', 'Notas operativas libres.'],
    ['', ''],
    ['⭐ DEFAULTS AUTOMÁTICOS POR SECTOR', ''],
    ...SECTORES.slice(0, 8).map(s => [
      `${s.value} (${s.icono})`,
      `Salario típico: $${s.defaults.salario.toLocaleString('es-CO')}/h · Contrato: ${s.defaults.contrato} · Modo: ${s.defaults.modo}`,
    ]),
    ['', ''],
    ['INSTRUCCIONES', ''],
    ['1.', 'Llene la hoja "Áreas" con sus datos. Solo use esa hoja.'],
    ['2.', 'Las celdas con dropdown (sector, contrato, etc.) muestran opciones al hacer clic.'],
    ['3.', 'Solo "nombre" y "valor_hora_default" son obligatorios. Lo demás tiene defaults.'],
    ['4.', 'Guarde el archivo (.xlsx) y súbala en la aplicación.'],
    ['5.', 'Tras importar, ajuste detalles como color, franjas y empleados desde la app.'],
  ];

  guia.forEach((row, i) => {
    const r = wsInfo.addRow(row);
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
      r.height = 26;
    } else if (i === 2 || i === 4 || row[0] === 'INSTRUCCIONES' || row[0]?.startsWith('⭐ DEFAULTS')) {
      r.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      r.height = 20;
    } else if (row[0] && (row[0].includes('*') || row[0].match(/^\d+\./))) {
      r.getCell(1).font = { color: { argb: 'FFFBBF24' }, bold: row[0].includes('*') };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_areas_chronoswork_v3.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function BulkImportAreasModal({ onClose, onBulkSave }) {
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [applySector, setApplySector] = useState(true);
  const [applyFranjas, setApplyFranjas] = useState(true);
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
        // 🐛 FIX: Elegir la hoja que tenga los datos correctos
        // Prioridad: hoja con "nombre" + "valor_hora_default" como columnas
        // Excluir __listas__ y hojas de guía
        const findDataSheet = (wb) => {
          for (const sn of wb.SheetNames) {
            if (sn.startsWith('__')) continue;
            if (sn.toLowerCase().includes('guía') || sn.toLowerCase().includes('guia')) continue;
            if (sn.toLowerCase().includes('instrucciones')) continue;
            if (sn.toLowerCase().includes('readme')) continue;
            const ws = wb.Sheets[sn];
            if (!ws) continue;
            const json = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
            if (json.length < 2) continue;
            const headers = (json[0] || []).map(h => String(h || '').toLowerCase().trim().replace(/\s+/g, ' '));
            // Debe tener al menos "nombre" como columna (acepta "nombre *", "nombre", "area", etc.)
            const hasNombre = headers.some(h => {
              const norm = h.toLowerCase().trim().replace(/[*\s]+$/, '').trim();
              return ['nombre', 'name', 'area', 'área'].includes(norm);
            });
            if (hasNombre) return sn;
          }
          // Si no encontró, devuelve la primera no oculta
          return wb.SheetNames.find(sn => !sn.startsWith('__')) || wb.SheetNames[0];
        };
        const wsname = findDataSheet(wb);
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) {
          setParseError(`La hoja "${wsname}" no contiene filas con datos.`);
          return;
        }

        const headers = Object.keys(json[0]);
        const idxMap = buildIdx(headers);

        const rows = json.map((row, i) => {
          const r = { _row: i + 2 };
          Object.keys(COLUMN_ALIASES).forEach(field => {
            const colIdx = idxMap[field];
            if (colIdx === -1) return;
            // Busca el valor usando el nombre de la columna
            const headerName = Object.keys(row)[colIdx];
            r[field] = headerName != null ? row[headerName] : '';
          });
          r._errors = validateAreaRow(r);
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
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const validRows = parsedRows.filter(r => r._errors.length === 0);
  const invalidRows = parsedRows.filter(r => r._errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setStep('importing');
    setProgress(0);
    let successCount = 0;
    const errorList = [];

    // Helper local: normaliza valores del Excel a los del CHECK constraint
    const norm = (field, val) => {
      if (val === null || val === undefined || val === '') return null;
      const s = String(val).trim();
      switch (field) {
        case 'modo_operacion': {
          const u = s.toUpperCase().replace(/[\/\-]/g, '_');
          if (['OFICINA', '24_7'].includes(u)) return u;
          return null;
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
          // Intentar recuperar errores comunes del usuario
          if (u.includes('INDEFINIDO')) return 'INDEFINIDO';
          if (u.includes('TERMINO') && u.includes('FIJO')) return 'TERMINO_FIJO';
          if (u.includes('OBRA') || u.includes('LABOR')) return 'OBRA_LABOR';
          if (u.includes('HORA')) return 'POR_HORAS';
          if (u.includes('FIJO') || u === 'FIJO' || u === 'MENSUAL' || u === 'SALARIO_FIJO') return 'SALARIO_FIJO';
          if (u.includes('PRESTACION') || u.includes('PRESTACIÓN') || u === 'CONTRATISTA' || u === 'OPS') return 'PRESTACION_SERVICIOS';
          if (u.includes('APRENDIZ') || u === 'SENA') return 'APRENDIZAJE';
          if (u.includes('OCASIONAL')) return 'OCASIONAL';
          if (u.includes('TEMPORAL') || u === 'EST') return 'TEMPORAL';
          return null; // Inválido — usar el default del sector
        }
        case 'dias_descanso': {
          const u = s.toUpperCase();
          if (['1', 'D', 'DOMINGO'].includes(u)) return 1;
          if (['2', 'S-D', 'SAB-DOM', 'FIN_DE_SEMANA', 'FIN SEMANA'].includes(u)) return 2;
          const n = parseInt(u, 10);
          return (n === 1 || n === 2) ? n : null;
        }
        case 'paga_auxilio_transporte':
        case 'requiere_dotacion':
        case 'requiere_epp':
        case 'permite_turno_partido': {
          const u = s.toLowerCase();
          if (['no', 'false', '0'].includes(u)) return false;
          return true;
        }
        default:
          return val;
      }
    };

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const sector = norm('sector', row.sector) || '';
        const franjasAuto = (applyFranjas && sector) ? getFranjasBySector(sector) : [];

        // Aplicar defaults del sector si la opción está activa
        const modoOperacion = norm('modo_operacion', row.modo_operacion)
          || (applySector && sector ? SECTORES.find(s => s.value === sector)?.defaults.modo : 'OFICINA');
        const jornadaTipo = norm('jornada_tipo', row.jornada_tipo) || 'DIURNA';
        const patronRotativo = norm('patron_rotativo', row.patron_rotativo);
        const diasDescanso = norm('dias_descanso', row.dias_descanso) || 1;
        const nivelArl = row.nivel_riesgo_arl ? (parseInt(row.nivel_riesgo_arl, 10) || 1) : 1;
        const tipoContratoPredom = norm('tipo_contrato_predominante', row.tipo_contrato_predominante)
          || (applySector && sector ? SECTORES.find(s => s.value === sector)?.defaults.contrato : 'INDEFINIDO');
        const tipoContratoDefault = norm('tipo_contrato_default', row.tipo_contrato_default)
          || tipoContratoPredom;

        let areaData = {
          nombre: String(row.nombre).trim(),
          codigo_area: row.codigo_area ? String(row.codigo_area).trim() : null,
          descripcion: row.descripcion ? String(row.descripcion).trim() : '',
          sector: sector || null,
          sub_sector: row.sub_sector ? String(row.sub_sector).trim() : null,
          centro_costo: row.centro_costo ? String(row.centro_costo).trim() : null,
          modo_operacion: modoOperacion,
          jornada_tipo: jornadaTipo,
          patron_rotativo: patronRotativo,
          dias_trabajo: row.dias_trabajo ? parseDiasTrabajo(row.dias_trabajo) : (applySector && sector ? (SECTORES.find(s => s.value === sector)?.defaults.modo === '24_7' ? [1,2,3,4,5,6,7] : [1,2,3,4,5]) : [1,2,3,4,5]),
          dias_descanso: diasDescanso,
          duracion_jornada_horas: row.duracion_jornada_horas ? parseFloat(row.duracion_jornada_horas) : 8,
          horas_extras_max_dia: row.horas_extras_max_dia ? parseInt(row.horas_extras_max_dia, 10) : 2,
          horas_extras_max_semana: row.horas_extras_max_semana ? parseInt(row.horas_extras_max_semana, 10) : 12,
          descanso_min_entre_jornadas: row.descanso_min_entre_jornadas ? parseInt(row.descanso_min_entre_jornadas, 10) : 9,
          tipo_contrato_predominante: tipoContratoPredom,
          tipo_contrato_default: tipoContratoDefault,
          dias_descanso_default: diasDescanso,
          valor_hora_default: parseNumero(row.valor_hora_default),
          paga_auxilio_transporte: norm('paga_auxilio_transporte', row.paga_auxilio_transporte),
          nivel_riesgo_arl: nivelArl,
          requiere_dotacion: norm('requiere_dotacion', row.requiere_dotacion),
          requiere_epp: norm('requiere_epp', row.requiere_epp),
          break_minutos: row.break_minutos ? parseInt(row.break_minutos, 10) : 0,
          permite_turno_partido: norm('permite_turno_partido', row.permite_turno_partido),
          notas_operativas: row.notas_operativas ? String(row.notas_operativas).trim() : '',
          color: PALETTE_DEFAULTS[i % PALETTE_DEFAULTS.length],
          night_shift_enabled: false,
          night_shift_start: '22:00',
          night_shift_end: '06:00',
          night_shift_employee_ids: [],
          franjas_iniciales: franjasAuto,
        };

        // Si el sector es 24/7 por defecto, ajustamos
        if (applySector && sector) {
          const sec = SECTORES.find(s => s.value === sector);
          if (sec?.defaults.modo === '24_7' && !row.modo_operacion) {
            areaData.dias_trabajo = [1, 2, 3, 4, 5, 6, 7];
            if (!row.patron_rotativo) areaData.patron_rotativo = '6x1';
          }
        }

        await onBulkSave(areaData);
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
            <MdDomain style={{ marginRight: 8, color: '#10b981' }} />
            Importación Masiva de Áreas
            {fileName && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{fileName}</span>}
          </h3>
          <button className="cw-modal__close" onClick={() => onClose(results?.success > 0)}><MdClose /></button>
        </div>

        {/* Tabs */}
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
                  <MdInfo style={{ color: '#34d399' }} /> 24 columnas disponibles con catálogos laborales colombianos
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Solo <strong>nombre</strong> y <strong>valor_hora_default</strong> son obligatorios. El resto usa defaults inteligentes del sector.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={applySector} onChange={e => setApplySector(e.target.checked)} />
                  <span>Aplicar defaults del sector (salario, contrato, modo operación)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={applyFranjas} onChange={e => setApplyFranjas(e.target.checked)} />
                  <span>Crear franjas horarias típicas del sector</span>
                </label>
              </div>

              <button className="cw-btn cw-btn--secondary" onClick={() => generateTemplate()} style={{ alignSelf: 'flex-start' }}>
                <MdDownload /> Descargar plantilla Excel con catálogos
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
                      <strong>Fila {r._row}:</strong> {r.nombre || '(sin nombre)'}
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
                        <th>✓</th><th>Fila</th><th>Nombre</th><th>Sector</th><th>Modo</th><th>Patrón</th><th>$/h</th><th>Contrato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((r, i) => (
                        <tr key={i}>
                          <td><MdCheckCircle style={{ color: '#10b981' }} /></td>
                          <td>{r._row}</td>
                          <td>{r.nombre}</td>
                          <td>{r.sector || '—'}</td>
                          <td>{r.modo_operacion || (applySector && r.sector ? SECTORES.find(s => s.value === String(r.sector).toUpperCase())?.defaults.modo : '—')}</td>
                          <td>{r.patron_rotativo || '—'}</td>
                          <td>${parseNumero(r.valor_hora_default)?.toLocaleString('es-CO')}</td>
                          <td>{r.tipo_contrato_predominante || (applySector && r.sector ? SECTORES.find(s => s.value === String(r.sector).toUpperCase())?.defaults.contrato : '—')}</td>
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
                  ✅ Importar {validRows.length} área{validRows.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* ══ IMPORTING ══ */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div className="cw-spinner" style={{ margin: '0 auto 1rem' }}></div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Importando áreas...</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {progress}% completado · Creando franjas y aplicando defaults
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
                <strong style={{ color: '#10b981' }}>{results.success}</strong> área(s) creada(s) ·
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
