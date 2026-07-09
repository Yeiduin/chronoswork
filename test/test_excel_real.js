// Test E2E: simula exactamente la importación del Excel que enviaste

import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

const SECTORES_VALUES = ['RETAIL','HOTELERIA','RESTAURANTE','SALUD','SEGURIDAD','INDUSTRIA','CONSTRUCCION','LOGISTICA','OFICINA','EDUCACION','AGRO','TECNOLOGIA','CALL_CENTER','OTRO'];
const TIPOS_CONTRATO_VALUES = ['INDEFINIDO','TERMINO_FIJO','OBRA_LABOR','POR_HORAS','SALARIO_FIJO','PRESTACION_SERVICIOS','APRENDIZAJE','OCASIONAL','TEMPORAL'];
const JORNADAS_VALUES = ['DIURNA','NOCTURNA','MIXTA','POR_TURNOS'];
const PATRONES_VALUES = ['2x1','3x2','4x3','5x2','6x1','7x7','10x5','14x14','PERSONALIZADO'];

function norm(field, val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  switch (field) {
    case 'modo_operacion': {
      const u = s.toUpperCase().replace(/[\/\-]/g, '_');
      return ['OFICINA', '24_7'].includes(u) ? u : null;
    }
    case 'jornada_tipo': {
      const u = s.toUpperCase();
      return JORNADAS_VALUES.includes(u) ? u : null;
    }
    case 'sector': {
      const u = s.toUpperCase();
      return SECTORES_VALUES.includes(u) ? u : null;
    }
    case 'patron_rotativo':
      return PATRONES_VALUES.includes(s) ? s : null;
    case 'tipo_contrato_predominante':
    case 'tipo_contrato_default': {
      const u = s.toUpperCase().replace(/\s+/g, '_');
      if (TIPOS_CONTRATO_VALUES.includes(u)) return u;
      if (u.includes('INDEFINIDO')) return 'INDEFINIDO';
      if (u.includes('TERMINO') && u.includes('FIJO')) return 'TERMINO_FIJO';
      if (u.includes('OBRA')) return 'OBRA_LABOR';
      if (u.includes('HORA')) return 'POR_HORAS';
      if (u.includes('FIJO') || u === 'FIJO' || u === 'MENSUAL') return 'SALARIO_FIJO';
      if (u.includes('PRESTACION')) return 'PRESTACION_SERVICIOS';
      if (u.includes('APRENDIZ')) return 'APRENDIZAJE';
      if (u.includes('OCASIONAL')) return 'OCASIONAL';
      if (u.includes('TEMPORAL')) return 'TEMPORAL';
      return null;
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
}

// ── Ruta del Excel a probar ──
const excelPath = process.argv[2];
if (!excelPath) {
  console.error('❌ ERROR: Debes pasar la ruta del archivo Excel como argumento.');
  console.error('   Uso: node test/test_excel_real.js <ruta/al/archivo.xlsx>');
  process.exit(1);
}

// ── Simular la lectura del Excel ──
const data = readFileSync(excelPath);
const wb = XLSX.read(data, { type: 'buffer' });
console.log('Hojas del archivo:', wb.SheetNames);

// Encontrar la hoja correcta
const findDataSheet = (wb) => {
  for (const sn of wb.SheetNames) {
    if (sn.startsWith('__')) continue;
    if (sn.toLowerCase().includes('guía') || sn.toLowerCase().includes('guia')) continue;
    if (sn.toLowerCase().includes('instrucciones')) continue;
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
    if (json.length < 2) continue;
    const headers = (json[0] || []).map(h => String(h || '').toLowerCase().trim().replace(/\s+/g, ' '));
    const hasNombre = headers.some(h => h === 'nombre' || h === 'name' || h === 'área' || h === 'area');
    if (hasNombre) return sn;
  }
  return wb.SheetNames.find(sn => !sn.startsWith('__')) || wb.SheetNames[0];
};

const sheetName = findDataSheet(wb);
console.log(`\n📄 Hoja detectada: "${sheetName}"`);

const ws = wb.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
console.log(`Filas de datos: ${json.length}\n`);

// Mostrar cada fila normalizada
let pass = 0, fail = 0;
for (let i = 0; i < json.length; i++) {
  const row = json[i];
  const result = {
    nombre: row['nombre *'] || row.nombre,
    sector: norm('sector', row.sector),
    modo: norm('modo_operacion', row['modo_operacion']),
    jornada: norm('jornada_tipo', row['jornada_tipo']),
    patron: norm('patron_rotativo', row['patron_rotativo']),
    dias_descanso: norm('dias_descanso', row['dias_descanso']),
    tipo_contrato: norm('tipo_contrato_predominante', row['tipo_contrato'] || row['tipo_contrato_predominante']),
    valor_hora: row['valor_hora_default *'] || row.valor_hora_default,
    nivel_arl: row.nivel_arl,
  };
  
  // Validar
  const errors = [];
  if (!result.nombre) errors.push('falta nombre');
  if (!result.valor_hora || result.valor_hora <= 0) errors.push('falta valor_hora');
  if (row.sector && !result.sector) errors.push(`sector inválido: "${row.sector}"`);
  if (row['modo_operacion'] && !result.modo) errors.push(`modo inválido: "${row['modo_operacion']}"`);
  if (row['jornada_tipo'] && !result.jornada) errors.push(`jornada inválida: "${row['jornada_tipo']}"`);
  if (row['patron_rotativo'] && !result.patron) errors.push(`patrón inválido: "${row['patron_rotativo']}"`);
  if (row['tipo_contrato'] && !result.tipo_contrato) errors.push(`tipo contrato inválido: "${row['tipo_contrato']}"`);
  if (row['dias_descanso'] && !result.dias_descanso) errors.push(`dias_descanso inválido: "${row['dias_descanso']}"`);
  
  if (errors.length === 0) {
    pass++;
    console.log(`✅ Fila ${i+2}: "${result.nombre}"`);
    console.log(`   sector=${result.sector} | modo=${result.modo} | jornada=${result.jornada} | patron=${result.patron}`);
    console.log(`   dias_descanso=${result.dias_descanso} | contrato=${result.tipo_contrato} | $${result.valor_hora}/h`);
  } else {
    fail++;
    console.log(`❌ Fila ${i+2}: "${result.nombre}" → ${errors.join(', ')}`);
  }
}

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`📊 RESULTADO: ${pass} pasaron · ${fail} fallaron de ${json.length} filas`);
console.log('═══════════════════════════════════════════════════════════');
