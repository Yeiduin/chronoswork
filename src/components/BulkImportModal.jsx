import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { MdClose, MdUpload, MdDownload, MdCheckCircle, MdError, MdWarning, MdInfo, MdTableChart } from 'react-icons/md';

// ─── Constantes de valores fijos ──────────────────────────────────────────────
const TIPOS_CONTRATO = ['POR_HORAS', 'SALARIO_FIJO'];
const DIAS_DESCANSO  = ['1', '2'];
const ES_ESPECIAL    = ['No', 'Si'];

const TIPO_CONTRATO_MAP = {
  'por horas': 'POR_HORAS', 'horas': 'POR_HORAS',
  'por_horas': 'POR_HORAS', 'hora': 'POR_HORAS',
  'salario fijo': 'SALARIO_FIJO', 'fijo': 'SALARIO_FIJO',
  'salario_fijo': 'SALARIO_FIJO', 'mensual': 'SALARIO_FIJO',
  'mes': 'SALARIO_FIJO',
};

// ─── Mapeo de nombres de columnas aceptadas ───────────────────────────────────
const COLUMN_MAP = {
  cedula:               ['cedula', 'cédula', 'documento', 'cc', 'identificacion', 'identificación', 'dni'],
  nombre:               ['nombre', 'nombre completo', 'nombres', 'name', 'empleado', 'colaborador'],
  cargo:                ['cargo', 'puesto', 'position', 'rol', 'job'],
  area:                 ['area', 'área', 'departamento', 'department', 'seccion', 'sección'],
  valor_hora:           ['valor_hora', 'valor hora', 'salario hora', 'hourly_rate', 'tarifa hora', 'valor/hora'],
  tipo_contrato:        ['tipo_contrato', 'tipo contrato', 'contrato', 'contract_type', 'modalidad'],
  dias_descanso_semana: ['dias_descanso', 'dias descanso', 'días descanso', 'dias_descanso_semana', 'descansos', 'dias libres'],
  es_especial:          ['es_especial', 'especial', 'salario especial', 'personalizado'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeHeader(h) {
  return String(h || '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex(h => normalizeHeader(h) === alias);
    if (idx !== -1) return idx;
  }
  return -1;
}
function buildColumnIndexes(headers) {
  const map = {};
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    map[field] = findColumn(headers, aliases);
  }
  return map;
}
function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  return ['si', 'sí', 'yes', 'true', '1', 'x'].includes(String(val || '').toLowerCase().trim());
}
function parseTipoContrato(val) {
  const s = String(val || '').toLowerCase().trim();
  return TIPO_CONTRATO_MAP[s] || null;
}

// ─── Validación estricta por fila ─────────────────────────────────────────────
function validateRow(row, areas, rowNum) {
  const errors = [];

  // Cédula
  const ced = String(row.cedula || '').trim();
  if (!ced) {
    errors.push({ campo: 'cedula', msg: 'La cédula es obligatoria' });
  } else if (!/^\d{5,12}$/.test(ced)) {
    errors.push({ campo: 'cedula', msg: `Cédula inválida "${ced}": debe tener entre 5 y 12 dígitos numéricos` });
  }

  // Nombre
  if (!String(row.nombre || '').trim()) {
    errors.push({ campo: 'nombre', msg: 'El nombre es obligatorio' });
  }

  // Cargo
  if (!String(row.cargo || '').trim()) {
    errors.push({ campo: 'cargo', msg: 'El cargo es obligatorio' });
  }

  // Área
  const areaNombre = String(row.area || '').trim();
  if (!areaNombre) {
    errors.push({ campo: 'area', msg: 'El área es obligatoria' });
  } else {
    const areaMatch = areas.find(a => a.nombre.toLowerCase() === areaNombre.toLowerCase());
    if (!areaMatch) {
      const disponibles = areas.map(a => `"${a.nombre}"`).join(', ');
      errors.push({ campo: 'area', msg: `Área "${areaNombre}" no existe. Disponibles: ${disponibles}` });
    }
  }

  // Tipo contrato (si se especificó)
  if (row.tipo_contrato !== undefined && row.tipo_contrato !== '') {
    const tc = parseTipoContrato(row.tipo_contrato);
    if (!tc) {
      errors.push({ campo: 'tipo_contrato', msg: `Tipo de contrato inválido "${row.tipo_contrato}". Use: POR_HORAS o SALARIO_FIJO` });
    }
  }

  // Días de descanso (si se especificó)
  if (row.dias_descanso_semana !== undefined && row.dias_descanso_semana !== '') {
    const d = parseInt(row.dias_descanso_semana);
    if (![1, 2].includes(d)) {
      errors.push({ campo: 'dias_descanso_semana', msg: `Días de descanso inválido "${row.dias_descanso_semana}". Use: 1 o 2` });
    }
  }

  // Valor hora (si se especificó)
  if (row.valor_hora !== undefined && row.valor_hora !== '' && row.valor_hora !== null) {
    const v = parseFloat(String(row.valor_hora).replace(/[^0-9.]/g, ''));
    if (isNaN(v) || v <= 0) {
      errors.push({ campo: 'valor_hora', msg: `Valor hora inválido "${row.valor_hora}": debe ser un número mayor a 0` });
    }
  }

  return errors;
}

// ─── Genera plantilla Excel con dropdowns (ExcelJS) ───────────────────────────
async function generateTemplate(areas) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  // ── Hoja oculta con listas de validación ──
  const wsListas = wb.addWorksheet('__listas__');
  wsListas.state = 'veryHidden';

  const areaNames = areas.map(a => a.nombre);
  // Col A: áreas
  wsListas.getColumn(1).values = ['Area', ...areaNames];
  // Col B: tipos de contrato
  wsListas.getColumn(2).values = ['TipoContrato', ...TIPOS_CONTRATO];
  // Col C: días descanso
  wsListas.getColumn(3).values = ['DiasDescanso', ...DIAS_DESCANSO];
  // Col D: es_especial
  wsListas.getColumn(4).values = ['EsEspecial', ...ES_ESPECIAL];

  // ── Hoja principal de empleados ──
  const ws = wb.addWorksheet('Empleados', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Definir columnas
  ws.columns = [
    { header: 'cedula',               key: 'cedula',               width: 16 },
    { header: 'nombre',               key: 'nombre',               width: 34 },
    { header: 'cargo',                key: 'cargo',                width: 30 },
    { header: 'area',                 key: 'area',                 width: 22 },
    { header: 'valor_hora',           key: 'valor_hora',           width: 16 },
    { header: 'tipo_contrato',        key: 'tipo_contrato',        width: 20 },
    { header: 'dias_descanso_semana', key: 'dias_descanso_semana', width: 26 },
    { header: 'es_especial',          key: 'es_especial',          width: 16 },
  ];

  // Estilo de encabezado
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF6366F1' } },
    };
  });
  headerRow.height = 22;
  // Sin datos de ejemplo — la plantilla queda vacía lista para llenar

  // ── Aplicar validaciones de datos (filas 2–1002) ──
  const maxRow = 1002;

  // Área — dropdown dinámico desde hoja oculta
  if (areaNames.length > 0) {
    const areaRef = `__listas__!$A$2:$A$${areaNames.length + 1}`;
    for (let r = 2; r <= maxRow; r++) {
      ws.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`${areaRef}`],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: '⛔ Área inválida',
        error: `Seleccione un área de la lista. Las áreas disponibles son: ${areaNames.join(', ')}`,
        showInputMessage: true,
        promptTitle: '📌 Área de trabajo',
        prompt: 'Seleccione el área a la que pertenece este empleado.',
      };
    }
  }

  // Tipo de contrato — dropdown fijo
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"POR_HORAS,SALARIO_FIJO"'],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: '⛔ Tipo de contrato inválido',
      error: 'Seleccione "POR_HORAS" o "SALARIO_FIJO".',
      showInputMessage: true,
      promptTitle: '📋 Tipo de contrato',
      prompt: 'POR_HORAS: pago según horas trabajadas.\nSALARIO_FIJO: salario mensual fijo.',
    };
  }

  // Días de descanso — dropdown 1 o 2
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"1,2"'],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: '⛔ Días de descanso inválido',
      error: 'Solo se permite 1 o 2 días de descanso por semana.',
      showInputMessage: true,
      promptTitle: '📅 Días de descanso',
      prompt: 'Ingrese 1 o 2 días de descanso por semana.',
    };
  }

  // Es especial — Si / No
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`H${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"No,Si"'],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: '⛔ Valor inválido',
      error: 'Seleccione "Si" o "No".',
      showInputMessage: true,
      promptTitle: '⭐ Empleado especial',
      prompt: '"Si" = salario personalizado (no se toma del área).\n"No" = salario estándar del área.',
    };
  }

  // Valor hora — solo números positivos
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`E${r}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThan',
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: '⛔ Valor hora inválido',
      error: 'Ingrese un número mayor a 0. Ej: 12500. Puede dejarlo vacío si el área ya tiene un salario definido.',
      showInputMessage: true,
      promptTitle: '💰 Valor por hora',
      prompt: 'Ingrese el valor en COP por hora ordinaria. Si lo deja vacío, se usará el salario del área.',
    };
  }

  // Cédula — solo números
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: 'whole',
      operator: 'between',
      allowBlank: false,
      formulae: [10000, 999999999999],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: '⛔ Cédula inválida',
      error: 'La cédula debe ser un número entre 5 y 12 dígitos.',
      showInputMessage: true,
      promptTitle: '🪪 Cédula',
      prompt: 'Ingrese el número de cédula sin puntos ni espacios.',
    };
  }

  // Ancho fijo de fila 1
  ws.autoFilter = { from: 'A1', to: 'H1' };

  // Generar buffer y descargar
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = 'plantilla_empleados_chronoswork.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function BulkImportModal({ areas, onClose, onBulkSave }) {
  const [step, setStep]             = useState('upload');
  const [rows, setRows]             = useState([]);
  const [fileName, setFileName]     = useState('');
  const [dragOver, setDragOver]     = useState(false);
  const [parseError, setParseError] = useState('');
  const [progress, setProgress]     = useState(0);
  const [results, setResults]       = useState({ success: 0, errors: [] });
  const [downloading, setDownloading] = useState(false);
  const fileInputRef                = useRef();

  // ─── Parse del archivo ─────────────────────────────────────────────────────
  const parseFile = useCallback((file) => {
    setParseError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const wsName = wb.SheetNames.find(n => !n.startsWith('__')) || wb.SheetNames[0];
        const ws   = wb.Sheets[wsName];
        const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) {
          setParseError('El archivo está vacío o solo tiene encabezados sin datos.');
          return;
        }

        const headers = raw[0].map(String);
        const colIdx  = buildColumnIndexes(headers);

        const required = ['cedula', 'nombre', 'cargo', 'area'];
        const missing  = required.filter(f => colIdx[f] === -1);
        if (missing.length > 0) {
          setParseError(`Columnas obligatorias no encontradas: ${missing.map(m => `"${m}"`).join(', ')}. Descargue la plantilla oficial para ver el formato correcto.`);
          return;
        }

        const parsed = raw.slice(1)
          .map((row, i) => {
            const get = (field) => {
              const idx = colIdx[field];
              return idx !== -1 ? row[idx] : undefined;
            };
            const cedula     = String(get('cedula') || '').trim();
            const nombre     = String(get('nombre') || '').trim();
            const cargo      = String(get('cargo') || '').trim();
            const area       = String(get('area') || '').trim();
            const valorRaw   = get('valor_hora');
            const valor_hora = valorRaw !== undefined && valorRaw !== ''
              ? String(valorRaw).replace(/[^0-9.]/g, '')
              : '';
            const tipoRaw         = get('tipo_contrato');
            const tipo_contrato   = tipoRaw !== undefined && tipoRaw !== ''
              ? (parseTipoContrato(tipoRaw) || String(tipoRaw)) // si es inválido, pasa el string crudo para que la validación lo marque
              : 'POR_HORAS';
            const diasRaw              = get('dias_descanso_semana');
            const dias_descanso_semana = diasRaw !== undefined && diasRaw !== ''
              ? String(diasRaw).trim()
              : '1';
            const esEspRaw  = get('es_especial');
            const es_especial = esEspRaw !== undefined ? parseBoolean(esEspRaw) : false;

            return {
              _row: i + 2,
              cedula, nombre, cargo, area, valor_hora,
              tipo_contrato, dias_descanso_semana, es_especial,
              // Guardamos el raw de tipo_contrato para validación de display
              _tipo_raw: tipoRaw,
              _errors: validateRow({ cedula, nombre, cargo, area, valor_hora, tipo_contrato: tipoRaw, dias_descanso_semana: diasRaw, es_especial }, areas, i + 2),
            };
          })
          .filter(r => r.cedula !== '' || r.nombre !== '');

        if (parsed.length === 0) {
          setParseError('No se encontraron filas de datos en el archivo. Asegúrese de que la primera hoja tenga datos debajo del encabezado.');
          return;
        }

        setRows(parsed);
        setFileName(file.name);
        setStep('preview');
      } catch (err) {
        setParseError(`Error al leer el archivo: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [areas]);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Solo se aceptan archivos .xlsx, .xls o .csv');
      return;
    }
    parseFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await generateTemplate(areas);
    } catch (err) {
      console.error('Error generando plantilla:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ─── Estadísticas ──────────────────────────────────────────────────────────
  const validRows   = rows.filter(r => r._errors.length === 0);
  const invalidRows = rows.filter(r => r._errors.length > 0);
  const totalRows   = rows.length;
  const hayErrores  = invalidRows.length > 0;

  // ─── Importación ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (hayErrores || validRows.length === 0) return;
    setStep('importing');
    setProgress(0);

    const errorList = [];
    let successCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row    = validRows[i];
      const areaObj = areas.find(a => a.nombre.toLowerCase() === row.area.toLowerCase().trim());

      try {
        let vHora = row.valor_hora !== '' ? parseFloat(row.valor_hora) : (areaObj?.valor_hora_default || 0);
        if (!vHora || vHora <= 0) throw new Error('Valor hora no definido y el área tampoco tiene un valor hora configurado');

        const tipoContrato = parseTipoContrato(row._tipo_raw || row.tipo_contrato) || 'POR_HORAS';
        const diasDescanso = parseInt(row.dias_descanso_semana) || 1;

        await onBulkSave({
          employeeData: {
            cedula: row.cedula,
            nombre: row.nombre,
            cargo:  row.cargo,
            valor_hora:           vHora,
            tipo_contrato:        tipoContrato,
            dias_descanso_semana: diasDescanso,
            es_especial:          row.es_especial,
            turno_predeterminado_id: null,
          },
          areaId:    areaObj?.id || null,
          esEspecial: row.es_especial,
        });
        successCount++;
      } catch (err) {
        errorList.push({ row: row._row, nombre: row.nombre, cedula: row.cedula, msg: err.message });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResults({ success: successCount, errors: errorList });
    setStep('done');
  };

  return (
    <div className="cw-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 820, width: '96vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            <MdTableChart style={{ marginRight: 8, color: 'var(--cw-accent)' }} />
            Importación Masiva de Empleados
            {fileName && <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>{fileName}</span>}
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {/* ── Steps bar ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 1.5rem', gap: 0 }}>
          {[
            { key: 'upload',    label: '1. Subir archivo' },
            { key: 'preview',   label: '2. Revisar datos' },
            { key: 'importing', label: '3. Importando' },
            { key: 'done',      label: '4. Resultado' },
          ].map((s, idx) => {
            const order   = ['upload', 'preview', 'importing', 'done'];
            const active  = step === s.key;
            const passed  = order.indexOf(step) > order.indexOf(s.key);
            return (
              <div key={s.key} style={{
                padding: '0.65rem 1.1rem', fontSize: '0.78rem', fontWeight: active ? 700 : 400,
                color: active ? 'var(--cw-accent)' : passed ? 'var(--cw-success)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--cw-accent)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}>
                {passed ? '✓ ' : ''}{s.label}
              </div>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* ══════════ STEP: upload ══════════ */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Info de formato */}
              <div style={{
                background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.22)',
                borderRadius: 12, padding: '1rem 1.25rem',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                  <MdInfo style={{ color: '#818cf8' }} /> Columnas del archivo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem' }}>
                  {[
                    { col: 'cedula',               req: true,  desc: 'Solo dígitos, 5–12 caracteres' },
                    { col: 'nombre',               req: true,  desc: 'Nombre completo del empleado' },
                    { col: 'cargo',                req: true,  desc: 'Cargo o puesto de trabajo' },
                    { col: 'area',                 req: true,  desc: 'Nombre exacto de un área existente' },
                    { col: 'valor_hora',           req: false, desc: 'Número en COP. Vacío = usa el del área' },
                    { col: 'tipo_contrato',        req: false, desc: 'POR_HORAS o SALARIO_FIJO' },
                    { col: 'dias_descanso_semana', req: false, desc: '1 o 2 (predeterminado: 1)' },
                    { col: 'es_especial',          req: false, desc: 'Si o No (salario personalizado)' },
                  ].map(({ col, req, desc }) => (
                    <div key={col} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        background: req ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${req ? 'rgba(99,102,241,0.35)' : 'var(--border-subtle)'}`,
                        borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.73rem',
                        color: req ? '#a5b4fc' : 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace',
                      }}>
                        {col}
                        {req && <span style={{ color: '#f87171', fontSize: '0.65rem' }}>*</span>}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.15rem' }}>{desc}</span>
                    </div>
                  ))}
                </div>

                {/* Áreas disponibles */}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(99,102,241,0.18)', fontSize: '0.78rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Áreas disponibles en el sistema: </span>
                  {areas.length === 0
                    ? <span style={{ color: '#f87171' }}>⚠ No hay áreas creadas aún. Cree áreas primero.</span>
                    : areas.map(a => (
                        <span key={a.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: a.color + '18', border: `1px solid ${a.color}45`,
                          borderRadius: 100, padding: '0.1rem 0.65rem', marginRight: 5, marginTop: 4,
                          fontSize: '0.74rem', color: 'var(--text-primary)',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
                          {a.nombre}
                        </span>
                      ))}
                </div>
              </div>

              {/* Zona Drag & Drop */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--cw-accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 16, padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(99,102,241,0.07)' : 'var(--bg-glass)',
                  transition: 'all 0.25s',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Arrastra tu archivo aquí o haz clic para seleccionarlo
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Acepta archivos <strong>.xlsx</strong>, <strong>.xls</strong> y <strong>.csv</strong>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])} />
              </div>

              {/* Error de parseo */}
              {parseError && (
                <div style={{
                  background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10, padding: '0.85rem 1rem', color: '#fca5a5',
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.84rem',
                }}>
                  <MdError style={{ color: '#ef4444', flexShrink: 0, marginTop: 2, fontSize: '1.1rem' }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#f87171' }}>Error al leer el archivo</div>
                    {parseError}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ STEP: preview ══════════ */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Resumen */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  { icon: '📋', label: 'Total filas',  value: totalRows,        color: 'var(--cw-accent)' },
                  { icon: '✅', label: 'Sin errores',  value: validRows.length,  color: 'var(--cw-success)' },
                  { icon: '❌', label: 'Con errores',  value: invalidRows.length, color: invalidRows.length > 0 ? '#f87171' : 'var(--text-muted)' },
                ].map(c => (
                  <div key={c.label} style={{
                    background: 'var(--bg-glass)', border: `1px solid ${c.color}30`, borderRadius: 12,
                    padding: '0.85rem', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.4rem' }}>{c.icon}</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* ⛔ BLOQUEO TOTAL si hay errores */}
              {hayErrores && (
                <div style={{
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '0.85rem 1.1rem', background: 'rgba(239,68,68,0.12)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <MdError style={{ color: '#f87171', fontSize: '1.2rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem' }}>
                        ⛔ Importación bloqueada — Se encontraron {invalidRows.length} fila{invalidRows.length !== 1 ? 's' : ''} con errores
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Corrija <strong style={{ color: '#fca5a5' }}>todos los errores</strong> en el archivo y vuelva a subirlo antes de poder importar.
                      </div>
                    </div>
                  </div>

                  {/* Lista de errores detallada */}
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {invalidRows.map((row, i) => (
                      <div key={i} style={{
                        padding: '0.6rem 1.1rem', borderBottom: '1px solid rgba(239,68,68,0.15)',
                        display: 'flex', flexDirection: 'column', gap: '0.2rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <span style={{
                            background: 'rgba(239,68,68,0.2)', color: '#f87171',
                            borderRadius: 6, padding: '0.05rem 0.45rem', fontWeight: 700, flexShrink: 0, fontFamily: 'monospace',
                          }}>
                            Fila {row._row}
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {row.nombre || row.cedula || '(vacío)'}
                          </span>
                          {row.cedula && <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.74rem' }}>— CC {row.cedula}</span>}
                        </div>
                        <div style={{ paddingLeft: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {row._errors.map((err, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.76rem', color: '#fca5a5' }}>
                              <span style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }}>▸</span>
                              <span><strong style={{ color: '#fb923c' }}>[{err.campo}]</strong> {err.msg}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ✅ Todo OK */}
              {!hayErrores && validRows.length > 0 && (
                <div style={{
                  background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)',
                  borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 8,
                  color: '#4ade80', fontSize: '0.85rem',
                }}>
                  <MdCheckCircle style={{ fontSize: '1.2rem', flexShrink: 0 }} />
                  <div>
                    <strong>Todos los registros son válidos.</strong>
                    {' '}Haga clic en "Importar" para registrar los {validRows.length} empleados.
                  </div>
                </div>
              )}

              {/* Tabla de preview */}
              <div style={{ overflowX: 'auto', maxHeight: hayErrores ? 180 : 320, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Fila', 'Estado', 'Cédula', 'Nombre', 'Cargo', 'Área', 'Valor/h', 'Contrato', 'Desc.'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.7rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const ok = row._errors.length === 0;
                      const areaObj = areas.find(a => a.nombre.toLowerCase() === String(row.area || '').toLowerCase().trim());
                      return (
                        <tr key={i} style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: ok ? 'transparent' : 'rgba(239,68,68,0.05)',
                        }}>
                          <td style={{ padding: '0.4rem 0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row._row}</td>
                          <td style={{ padding: '0.4rem 0.7rem' }}>
                            {ok
                              ? <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><MdCheckCircle /> OK</span>
                              : <span title={row._errors.map(e => `[${e.campo}] ${e.msg}`).join('\n')} style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 3, cursor: 'help', whiteSpace: 'nowrap' }}>
                                  <MdError /> {row._errors.length} error{row._errors.length !== 1 ? 'es' : ''}
                                </span>
                            }
                          </td>
                          <td style={{ padding: '0.4rem 0.7rem', fontFamily: 'monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.cedula || '—'}</td>
                          <td style={{ padding: '0.4rem 0.7rem', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nombre || '—'}</td>
                          <td style={{ padding: '0.4rem 0.7rem', color: 'var(--text-secondary)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.cargo || '—'}</td>
                          <td style={{ padding: '0.4rem 0.7rem' }}>
                            {areaObj
                              ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: areaObj.color, flexShrink: 0 }} />
                                  {areaObj.nombre}
                                </span>
                              : <span style={{ color: '#f87171' }}>{row.area || '—'}</span>
                            }
                          </td>
                          <td style={{ padding: '0.4rem 0.7rem', color: 'var(--cw-success)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {row.valor_hora !== '' ? `$${Number(row.valor_hora).toLocaleString('es-CO')}` : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>del área</span>}
                          </td>
                          <td style={{ padding: '0.4rem 0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {row.tipo_contrato === 'SALARIO_FIJO' ? 'Fijo' : row.tipo_contrato === 'POR_HORAS' ? 'Por horas' : <span style={{ color: '#f87171' }}>{String(row._tipo_raw || '—')}</span>}
                          </td>
                          <td style={{ padding: '0.4rem 0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{row.dias_descanso_semana}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ STEP: importing ══════════ */}
          {step === 'importing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2.5rem 0' }}>
              <div style={{ fontSize: '2.8rem' }}>⚙️</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                Importando {validRows.length} empleados...
              </div>
              <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{
                  background: 'var(--bg-glass)', borderRadius: 100, height: 14,
                  overflow: 'hidden', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    background: 'linear-gradient(90deg, var(--cw-accent), #818cf8)',
                    width: `${progress}%`, transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {progress}% completado — No cierre esta ventana
                </div>
              </div>
            </div>
          )}

          {/* ══════════ STEP: done ══════════ */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '2.8rem' }}>{results.errors.length === 0 ? '🎉' : '⚠️'}</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  {results.errors.length === 0 ? '¡Importación exitosa!' : 'Importación completada con algunos errores'}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{
                    background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                    borderRadius: 10, padding: '0.5rem 1.25rem', color: '#4ade80', fontWeight: 700, fontSize: '0.9rem',
                  }}>✅ {results.success} importados exitosamente</span>
                  {results.errors.length > 0 && (
                    <span style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 10, padding: '0.5rem 1.25rem', color: '#f87171', fontWeight: 700, fontSize: '0.9rem',
                    }}>❌ {results.errors.length} fallaron durante la inserción</span>
                  )}
                </div>
              </div>

              {results.errors.length > 0 && (
                <div style={{ border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', fontWeight: 600, fontSize: '0.82rem', color: '#f87171' }}>
                    Registros que fallaron al guardar en el sistema
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {results.errors.map((e, i) => (
                      <div key={i} style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.79rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace' }}>Fila {e.row}</span>
                        <span style={{ color: 'var(--text-primary)', flexShrink: 0 }}>{e.nombre || e.cedula}</span>
                        <span style={{ color: '#fca5a5', flex: 1 }}>{e.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="cw-modal__footer">
          {step === 'upload' && (
            <>
              <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
              <button
                className="cw-btn cw-btn--secondary"
                onClick={handleDownloadTemplate}
                disabled={downloading}
                id="btn-download-template"
              >
                {downloading
                  ? <><span className="cw-spinner cw-spinner--sm" /> Generando...</>
                  : <><MdDownload /> Descargar plantilla Excel</>
                }
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button className="cw-btn cw-btn--secondary" onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}>
                ← Volver y corregir
              </button>
              {hayErrores ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#f87171' }}>
                  <MdError /> Corrija los errores antes de importar
                </div>
              ) : (
                <button
                  id="btn-start-import"
                  className="cw-btn cw-btn--primary"
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                >
                  <MdUpload /> Importar {validRows.length} empleado{validRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}

          {step === 'done' && (
            <button className="cw-btn cw-btn--primary" style={{ minWidth: 120 }} onClick={onClose}>
              ✓ Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
