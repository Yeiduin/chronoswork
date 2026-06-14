import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { MdClose, MdUpload, MdDownload, MdCheckCircle, MdError, MdInfo, MdDomain } from 'react-icons/md';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeH = h => String(h || '').toLowerCase().trim().replace(/\s+/g, ' ');

function findCol(headers, aliases) {
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h) === a);
    if (i !== -1) return i;
  }
  return -1;
}

// Aliases de cada columna (tolerantes a variaciones)
const COLUMN_ALIASES = {
  nombre:                ['nombre', 'name', 'area', 'área', 'nombre del área', 'nombre del area', 'nombre area'],
  descripcion:           ['descripcion', 'descripción', 'description', 'desc', 'detalle'],
  valor_hora_default:    ['valor_hora_default', 'valor hora', 'valor_hora', 'salario', 'salario hora', 'hourly_rate', 'valor/hora', 'tarifa hora', 'salario base'],
  tipo_contrato_default: ['tipo_contrato_default', 'tipo contrato', 'tipo_contrato', 'contrato', 'contract_type', 'modalidad'],
};

function buildIdx(headers) {
  const m = {};
  for (const [f, aliases] of Object.entries(COLUMN_ALIASES)) m[f] = findCol(headers, aliases);
  return m;
}

// ─── Validación de fila ───────────────────────────────────────────────────────
function validateAreaRow(row, tiposContrato) {
  const errors = [];

  if (!String(row.nombre || '').trim())
    errors.push({ campo: 'nombre', msg: 'El nombre del área es obligatorio' });

  const vhora = parseFloat(String(row.valor_hora_default || '').replace(/[^0-9.]/g, ''));
  if (!row.valor_hora_default || isNaN(vhora) || vhora <= 0)
    errors.push({ campo: 'valor_hora_default', msg: 'El salario base (valor hora) es obligatorio y debe ser un número mayor a 0' });

  if (row.tipo_contrato_default && String(row.tipo_contrato_default).trim() !== '') {
    if (!tiposContrato.includes(String(row.tipo_contrato_default).trim().toUpperCase())) {
      errors.push({
        campo: 'tipo_contrato_default',
        msg: `Tipo de contrato inválido "${row.tipo_contrato_default}". Opciones válidas: ${tiposContrato.join(', ')}`,
      });
    }
  }

  return errors;
}

// ─── Genera plantilla Excel con dropdowns ────────────────────────────────────
async function generateTemplate(tiposContrato) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();

  // Hoja oculta con lista de tipos de contrato (dinámica)
  const wsL = wb.addWorksheet('__listas__');
  wsL.state = 'veryHidden';
  wsL.getColumn(1).values = ['TipoContrato', ...tiposContrato];

  // Hoja principal
  const ws = wb.addWorksheet('Áreas', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'nombre',                key: 'nombre',                width: 28 },
    { header: 'descripcion',           key: 'descripcion',           width: 40 },
    { header: 'valor_hora_default',    key: 'valor_hora_default',    width: 24 },
    { header: 'tipo_contrato_default', key: 'tipo_contrato_default', width: 26 },
  ];

  // ── Estilo de encabezados ──
  const hRow = ws.getRow(1);

  // nombre — encabezado con marcador de obligatorio
  const cellNombre = ws.getCell('A1');
  cellNombre.value  = 'nombre *';
  cellNombre.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  cellNombre.font   = { bold: true, color: { argb: 'FFFBBF24' }, size: 11 };
  cellNombre.alignment = { vertical: 'middle', horizontal: 'center' };
  cellNombre.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };

  // valor_hora_default — encabezado con marcador de obligatorio
  const cellValor = ws.getCell('C1');
  cellValor.value  = 'valor_hora_default *';
  cellValor.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  cellValor.font   = { bold: true, color: { argb: 'FFFBBF24' }, size: 11 };
  cellValor.alignment = { vertical: 'middle', horizontal: 'center' };
  cellValor.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };

  // Columnas opcionales
  ['B', 'D'].forEach(col => {
    const cell = ws.getCell(`${col}1`);
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font      = { bold: true, color: { argb: 'FFD1D5DB' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };
  });
  hRow.height = 24;

  // ── Validaciones de datos (filas 2–502) ──
  const maxRow = 502;

  // valor_hora — solo números positivos
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`C${r}`).dataValidation = {
      type: 'decimal', operator: 'greaterThan', allowBlank: false, formulae: [0],
      showErrorMessage: true, errorStyle: 'stop',
      errorTitle: '⛔ Salario inválido',
      error: 'Ingrese un número mayor a 0. Ej: 12500. Este campo es obligatorio.',
      showInputMessage: true, promptTitle: '💰 Salario base por hora (COP)',
      prompt: 'Valor en pesos colombianos por hora ordinaria. Se aplicará a todos los empleados del área.',
    };
  }

  // tipo_contrato — dropdown dinámico con los tipos de la app
  const tipoRef = `__listas__!$A$2:$A$${tiposContrato.length + 1}`;
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [tipoRef],
      showErrorMessage: true, errorStyle: 'stop',
      errorTitle: '⛔ Tipo de contrato inválido',
      error: `Seleccione una opción de la lista. Tipos disponibles: ${tiposContrato.join(', ')}`,
      showInputMessage: true, promptTitle: '📋 Tipo de contrato predeterminado',
      prompt: `Seleccione el tipo de contrato para esta área.\nDisponibles: ${tiposContrato.join(', ')}\nSi lo deja vacío, se usará POR_HORAS por defecto.`,
    };
  }

  // Agregar auto-filter
  ws.autoFilter = { from: 'A1', to: 'D1' };

  // ── Segunda hoja: instrucciones ──
  const wsInfo = wb.addWorksheet('📋 Guía de uso');
  wsInfo.getColumn(1).width = 30;
  wsInfo.getColumn(2).width = 60;

  const guia = [
    ['CHRONOSWORK — Plantilla de Importación de Áreas', ''],
    ['', ''],
    ['COLUMNAS', 'DESCRIPCIÓN'],
    ['nombre  ✦ OBLIGATORIO', 'Nombre del área. Ej: Cajeros, Bodega, Producción, Supervisores'],
    ['descripcion  (opcional)', 'Descripción breve del área. Puede dejarse vacío.'],
    ['valor_hora_default  ✦ OBLIGATORIO', 'Salario base por hora en COP. Ej: 12500. Solo números.'],
    ['tipo_contrato_default  (opcional)', `Tipo de contrato. Opciones: ${tiposContrato.join(' / ')}. Vacío = POR_HORAS`],
    ['', ''],
    ['LO QUE SE CONFIGURA AUTOMÁTICAMENTE', ''],
    ['Color del área', 'Se asigna uno automáticamente. Cámbielo desde la app.'],
    ['Modo de operación', 'OFICINA por defecto. Configúrelo en la app (puede ser 24/7).'],
    ['Días de trabajo', 'Lunes a Viernes por defecto. Ajústelos en la app.'],
    ['Días de descanso', '1 día por defecto. Cámbielo en la configuración del área.'],
    ['Turno nocturno', 'Desactivado por defecto. Actívelo desde la app si aplica.'],
    ['', ''],
    ['INSTRUCCIONES', ''],
    ['1.', 'Llene la hoja "Áreas" con sus datos. Solo use esa hoja.'],
    ['2.', 'El campo "nombre" y "valor_hora_default" son obligatorios.'],
    ['3.', 'En "tipo_contrato_default" haga clic en la celda para ver el menú desplegable.'],
    ['4.', 'Guarde el archivo y súbalo en la aplicación.'],
    ['5.', 'Una vez importadas, configure los detalles de cada área desde la plataforma.'],
  ];

  guia.forEach((row, i) => {
    const wsRow = wsInfo.addRow(row);
    if (i === 0) {
      wsRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF10B981' } };
      wsRow.height = 24;
    } else if (i === 2) {
      wsRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      });
      wsRow.height = 20;
    } else if (['LO QUE SE CONFIGURA AUTOMÁTICAMENTE', 'INSTRUCCIONES'].includes(row[0])) {
      wsRow.getCell(1).font = { bold: true, color: { argb: 'FF34D399' }, size: 10 };
      wsRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
      wsRow.height = 20;
    } else if (row[0].includes('OBLIGATORIO')) {
      wsRow.getCell(1).font = { bold: true, color: { argb: 'FFFBBF24' }, size: 10 };
      wsRow.getCell(2).font = { color: { argb: 'FFD1D5DB' }, size: 10 };
      wsRow.height = 18;
    } else if (row[0] !== '') {
      wsRow.getCell(1).font = { color: { argb: 'FF9CA3AF' }, size: 10 };
      wsRow.getCell(2).font = { color: { argb: 'FFD1D5DB' }, size: 10 };
      wsRow.height = 18;
    }
  });

  // Generar y descargar
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = 'plantilla_areas_chronoswork.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Colores por defecto rotativos para las áreas importadas ─────────────────
const PALETTE_DEFAULTS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#3b82f6','#ef4444','#14b8a6','#f97316',
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function BulkImportAreasModal({ onClose, onBulkSave, tiposContrato = ['POR_HORAS', 'SALARIO_FIJO'] }) {
  const [step, setStep]               = useState('upload');
  const [rows, setRows]               = useState([]);
  const [fileName, setFileName]       = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [parseError, setParseError]   = useState('');
  const [progress, setProgress]       = useState(0);
  const [results, setResults]         = useState({ success: 0, errors: [] });
  const [downloading, setDownloading] = useState(false);
  const fileInputRef                  = useRef();

  // ─── Parse ───────────────────────────────────────────────────────────────
  const parseFile = useCallback((file) => {
    setParseError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data   = new Uint8Array(e.target.result);
        const wb     = XLSX.read(data, { type: 'array' });
        const wsName = wb.SheetNames.find(n => !n.startsWith('__') && !n.startsWith('📋')) || wb.SheetNames[0];
        const ws     = wb.Sheets[wsName];
        const raw    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) {
          setParseError('El archivo está vacío o solo tiene encabezados sin datos.'); return;
        }

        // Limpiar encabezados (quitar * si los hay)
        const headers = raw[0].map(h => String(h).replace(/\s*\*\s*/g, '').trim());
        const idx     = buildIdx(headers);

        const required = ['nombre', 'valor_hora_default'];
        const missing  = required.filter(f => idx[f] === -1);
        if (missing.length > 0) {
          setParseError(`Columnas obligatorias no encontradas: ${missing.map(m => `"${m}"`).join(', ')}. Use la plantilla oficial.`);
          return;
        }

        const get = (row, field) => idx[field] !== -1 ? row[idx[field]] : undefined;

        const parsed = raw.slice(1).map((row, i) => {
          const nombre               = String(get(row, 'nombre')               || '').trim();
          const descripcion          = String(get(row, 'descripcion')          || '').trim();
          const valor_hora_default   = String(get(row, 'valor_hora_default')   || '').trim();
          const tipo_contrato_raw    = String(get(row, 'tipo_contrato_default')|| '').trim().toUpperCase();
          const tipo_contrato_default = tipo_contrato_raw || '';

          return {
            _row: i + 2,
            nombre, descripcion, valor_hora_default, tipo_contrato_default,
            _errors: validateAreaRow({ nombre, valor_hora_default, tipo_contrato_default }, tiposContrato),
          };
        }).filter(r => r.nombre !== '' || r.valor_hora_default !== '');

        if (parsed.length === 0) {
          setParseError('No se encontraron filas con datos. Verifique que está usando la hoja "Áreas".'); return;
        }

        setRows(parsed);
        setFileName(file.name);
        setStep('preview');
      } catch (err) {
        setParseError(`Error al leer el archivo: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [tiposContrato]);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Solo se aceptan archivos .xlsx, .xls o .csv'); return;
    }
    parseFile(file);
  };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const handleDownload = async () => {
    setDownloading(true);
    try { await generateTemplate(tiposContrato); } catch (err) { console.error(err); } finally { setDownloading(false); }
  };

  // ─── Estadísticas ────────────────────────────────────────────────────────
  const validRows   = rows.filter(r => r._errors.length === 0);
  const invalidRows = rows.filter(r => r._errors.length > 0);
  const hayErrores  = invalidRows.length > 0;

  // ─── Importación ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (hayErrores || validRows.length === 0) return;
    setStep('importing');
    setProgress(0);

    let successCount = 0;
    const errorList  = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const color = PALETTE_DEFAULTS[i % PALETTE_DEFAULTS.length];
        const areaData = {
          nombre:                row.nombre,
          descripcion:           row.descripcion || '',
          color,
          // Todo lo demás: valores por defecto — se configura desde la app
          modo_operacion:        'OFICINA',
          dias_trabajo:          [1, 2, 3, 4, 5],
          valor_hora_default:    parseFloat(String(row.valor_hora_default).replace(/[^0-9.]/g, '')),
          tipo_contrato_default: row.tipo_contrato_default || 'POR_HORAS',
          dias_descanso_default: 1,
          night_shift_enabled:   false,
          night_shift_start:     '22:00',
          night_shift_end:       '06:00',
          night_shift_employee_ids: [],
        };
        await onBulkSave(areaData);
        successCount++;
      } catch (err) {
        errorList.push({ row: row._row, nombre: row.nombre, msg: err.message });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResults({ success: successCount, errors: errorList });
    setStep('done');
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="cw-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 680, width: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            <MdDomain style={{ marginRight: 8, color: '#10b981' }} />
            Importación Masiva de Áreas
            {fileName && <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>{fileName}</span>}
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 1.5rem' }}>
          {[
            { key: 'upload',    label: '1. Subir archivo' },
            { key: 'preview',   label: '2. Revisar datos' },
            { key: 'importing', label: '3. Importando' },
            { key: 'done',      label: '4. Resultado' },
          ].map(s => {
            const order  = ['upload','preview','importing','done'];
            const active = step === s.key;
            const passed = order.indexOf(step) > order.indexOf(s.key);
            return (
              <div key={s.key} style={{
                padding: '0.65rem 1.1rem', fontSize: '0.78rem', fontWeight: active ? 700 : 400,
                color: active ? '#10b981' : passed ? 'var(--cw-success)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid #10b981' : '2px solid transparent', transition: 'all 0.2s',
              }}>
                {passed ? '✓ ' : ''}{s.label}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* ══ UPLOAD ══ */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Info de columnas — simple */}
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '1rem 1.25rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                  <MdInfo style={{ color: '#34d399' }} /> La plantilla tiene 4 columnas simples
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {[
                    {
                      col: 'nombre', req: true,
                      desc: 'Nombre del área',
                      ejemplo: 'Cajeros, Bodega, Supervisores',
                      tipo: 'Texto libre',
                    },
                    {
                      col: 'descripcion', req: false,
                      desc: 'Descripción breve (puede dejarse vacío)',
                      ejemplo: 'Área de atención al cliente',
                      tipo: 'Texto libre',
                    },
                    {
                      col: 'valor_hora_default', req: true,
                      desc: 'Salario base por hora en COP',
                      ejemplo: '12500, 18000, 25000',
                      tipo: 'Número positivo',
                    },
                    {
                      col: 'tipo_contrato_default', req: false,
                      desc: 'Tipo de contrato predeterminado',
                      ejemplo: tiposContrato.join(' / '),
                      tipo: `Selección: ${tiposContrato.join(' o ')}`,
                    },
                  ].map(({ col, req, desc, ejemplo, tipo }) => (
                    <div key={col} style={{
                      display: 'grid', gridTemplateColumns: '180px 1fr',
                      gap: '0.5rem', alignItems: 'start',
                      padding: '0.55rem 0.75rem',
                      background: req ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
                      borderRadius: 8,
                      border: `1px solid ${req ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ fontSize: '0.78rem', color: req ? '#34d399' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {col}
                        </code>
                        {req
                          ? <span style={{ fontSize: '0.65rem', color: '#fbbf24', background: 'rgba(245,158,11,0.12)', borderRadius: 100, padding: '0.05rem 0.35rem', border: '1px solid rgba(245,158,11,0.25)' }}>requerido</span>
                          : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', borderRadius: 100, padding: '0.05rem 0.35rem', border: '1px solid var(--border-subtle)' }}>opcional</span>
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>{desc}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Tipo: </span>
                          <span style={{ color: col === 'tipo_contrato_default' ? '#818cf8' : 'var(--text-secondary)' }}>{tipo}</span>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Ej: </span>
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{ejemplo}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(16,185,129,0.15)',
                  fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>⚙️</span>
                  <span>
                    <strong style={{ color: 'var(--text-secondary)' }}>Lo demás se configura desde la app:</strong>{' '}
                    color, modo de operación (OFICINA / 24/7), días de trabajo, días de descanso y turno nocturno
                    se asignan con valores por defecto y se ajustan área por área en la plataforma.
                  </span>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#10b981' : 'var(--border-subtle)'}`,
                  borderRadius: 16, padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(16,185,129,0.06)' : 'var(--bg-glass)',
                  transition: 'all 0.25s',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Arrastra tu archivo aquí o haz clic para seleccionarlo
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Acepta <strong>.xlsx</strong>, <strong>.xls</strong> y <strong>.csv</strong>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])} />
              </div>

              {parseError && (
                <div style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', gap: 8, fontSize: '0.84rem' }}>
                  <MdError style={{ color: '#ef4444', flexShrink: 0, marginTop: 2, fontSize: '1.1rem' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '0.2rem' }}>Error al leer el archivo</div>
                    <span style={{ color: '#fca5a5' }}>{parseError}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ PREVIEW ══ */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Resumen */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                {[
                  { icon: '🏢', label: 'Total áreas',  value: rows.length,        color: '#10b981' },
                  { icon: '✅', label: 'Sin errores',  value: validRows.length,    color: 'var(--cw-success)' },
                  { icon: '❌', label: 'Con errores',  value: invalidRows.length,  color: invalidRows.length > 0 ? '#f87171' : 'var(--text-muted)' },
                ].map(c => (
                  <div key={c.label} style={{ background: 'var(--bg-glass)', border: `1px solid ${c.color}30`, borderRadius: 12, padding: '0.85rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem' }}>{c.icon}</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Bloqueo por errores */}
              {hayErrores && (
                <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdError style={{ color: '#f87171', fontSize: '1.2rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem' }}>
                        ⛔ Importación bloqueada — {invalidRows.length} fila{invalidRows.length !== 1 ? 's' : ''} con errores
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Corrija <strong style={{ color: '#fca5a5' }}>todos los errores</strong> en el archivo y vuelva a subirlo.
                      </div>
                    </div>
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {invalidRows.map((row, i) => (
                      <div key={i} style={{ padding: '0.6rem 1.1rem', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <span style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 6, padding: '0.05rem 0.45rem', fontWeight: 700, flexShrink: 0, fontFamily: 'monospace' }}>Fila {row._row}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.nombre || '(sin nombre)'}</span>
                        </div>
                        <div style={{ paddingLeft: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {row._errors.map((err, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.76rem', color: '#fca5a5' }}>
                              <span style={{ color: '#f87171', flexShrink: 0 }}>▸</span>
                              <span><strong style={{ color: '#fb923c' }}>[{err.campo}]</strong> {err.msg}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Todo OK */}
              {!hayErrores && validRows.length > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontSize: '0.85rem' }}>
                  <MdCheckCircle style={{ fontSize: '1.2rem', flexShrink: 0 }} />
                  <div>
                    <strong>Todos los registros son válidos.</strong>{' '}
                    Haga clic en "Crear áreas" para registrar las {validRows.length} áreas.
                  </div>
                </div>
              )}

              {/* Tabla preview — simple, solo las 4 columnas */}
              <div style={{ overflowX: 'auto', maxHeight: hayErrores ? 160 : 360, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Fila', 'Estado', 'Nombre del Área', 'Descripción', 'Salario/hora', 'Tipo Contrato'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.85rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const ok    = row._errors.length === 0;
                      const color = PALETTE_DEFAULTS[i % PALETTE_DEFAULTS.length];
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', background: ok ? 'transparent' : 'rgba(239,68,68,0.04)' }}>
                          <td style={{ padding: '0.45rem 0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{row._row}</td>
                          <td style={{ padding: '0.45rem 0.85rem' }}>
                            {ok
                              ? <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><MdCheckCircle style={{ fontSize: '0.95rem' }} /> OK</span>
                              : <span title={row._errors.map(e => `[${e.campo}] ${e.msg}`).join('\n')}
                                  style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 3, cursor: 'help', whiteSpace: 'nowrap' }}>
                                  <MdError style={{ fontSize: '0.95rem' }} /> {row._errors.length} error{row._errors.length !== 1 ? 'es' : ''}
                                </span>
                            }
                          </td>
                          <td style={{ padding: '0.45rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                              {row.nombre || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.45rem 0.85rem', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.descripcion || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>—</span>}
                          </td>
                          <td style={{ padding: '0.45rem 0.85rem', color: 'var(--cw-success)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {row.valor_hora_default
                              ? `$${Number(String(row.valor_hora_default).replace(/[^0-9.]/g,'')).toLocaleString('es-CO')}/h`
                              : <span style={{ color: '#f87171' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.45rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {row.tipo_contrato_default || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.74rem' }}>POR_HORAS (defecto)</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>⚙️</span>
                <span>Los colores se asignan automáticamente en rotación. El modo de operación, días y turno nocturno se configuran después desde la app.</span>
              </div>
            </div>
          )}

          {/* ══ IMPORTING ══ */}
          {step === 'importing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2.5rem 0' }}>
              <div style={{ fontSize: '2.8rem' }}>⚙️</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                Creando {validRows.length} áreas...
              </div>
              <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{ background: 'var(--bg-glass)', borderRadius: 100, height: 14, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ height: '100%', borderRadius: 100, background: 'linear-gradient(90deg,#10b981,#34d399)', width: `${progress}%`, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {progress}% completado — No cierre esta ventana
                </div>
              </div>
            </div>
          )}

          {/* ══ DONE ══ */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '2.8rem' }}>{results.errors.length === 0 ? '🎉' : '⚠️'}</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  {results.errors.length === 0 ? '¡Áreas creadas exitosamente!' : 'Importación completada con algunos errores'}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, padding: '0.5rem 1.25rem', color: '#4ade80', fontWeight: 700, fontSize: '0.9rem' }}>
                    ✅ {results.success} área{results.success !== 1 ? 's' : ''} creada{results.success !== 1 ? 's' : ''}
                  </span>
                  {results.errors.length > 0 && (
                    <span style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.5rem 1.25rem', color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                      ❌ {results.errors.length} fallaron
                    </span>
                  )}
                </div>
              </div>
              {results.success > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#34d399' }}>
                  💡 Ahora puede ingresar a cada área para configurar su modo de operación, días de trabajo y franjas horarias.
                </div>
              )}
              {results.errors.length > 0 && (
                <div style={{ border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.08)', fontWeight: 600, fontSize: '0.82rem', color: '#f87171' }}>
                    Áreas que no pudieron crearse
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {results.errors.map((e, i) => (
                      <div key={i} style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.79rem', display: 'flex', gap: '0.6rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>Fila {e.row}</span>
                        <span style={{ color: 'var(--text-primary)', flexShrink: 0 }}>{e.nombre}</span>
                        <span style={{ color: '#fca5a5', flex: 1 }}>{e.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cw-modal__footer">
          {step === 'upload' && (
            <>
              <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
              <button className="cw-btn cw-btn--secondary" onClick={handleDownload} disabled={downloading} id="btn-download-areas-template">
                {downloading ? <><span className="cw-spinner cw-spinner--sm" /> Generando...</> : <><MdDownload /> Descargar plantilla Excel</>}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button className="cw-btn cw-btn--secondary" onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}>
                ← Volver
              </button>
              {hayErrores ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#f87171' }}>
                  <MdError /> Corrija los errores antes de importar
                </div>
              ) : (
                <button id="btn-import-areas" className="cw-btn cw-btn--primary" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }} onClick={handleImport} disabled={validRows.length === 0}>
                  <MdUpload /> Crear {validRows.length} área{validRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}
          {step === 'done' && (
            <button className="cw-btn cw-btn--primary" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', minWidth: 120 }} onClick={onClose}>
              ✓ Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
