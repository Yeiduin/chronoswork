// ============================================================
// ChronosWork — Componente Genérico de Importación Masiva
// Parametrizable para cualquier entidad (empleados, áreas, etc.)
// ============================================================

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { logger } from '../config/logger';
import {
  MdClose, MdDownload, MdCheckCircle, MdError, MdWarning,
} from 'react-icons/md';

// ═══════════════════════════════════════════════════════════════
// Helpers compartidos (exportados para que los wrappers los usen)
// ═══════════════════════════════════════════════════════════════

export function normalizeH(h) {
  return String(h || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[*\s]+$/, '').trim();
}

export function findCol(headers, aliases) {
  // 1) exacto
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h) === a);
    if (i !== -1) return i;
  }
  // 2) contiene
  for (const a of aliases) {
    const i = headers.findIndex(h => normalizeH(h).includes(a));
    if (i !== -1) return i;
  }
  return -1;
}

export function buildColumnIndexes(headers, columnAliases) {
  const map = {};
  for (const [field, aliases] of Object.entries(columnAliases)) {
    map[field] = findCol(headers, aliases);
  }
  return map;
}

export function findDataSheet(wb) {
  for (const sn of wb.SheetNames) {
    if (sn.startsWith('__')) continue;
    if (sn.toLowerCase().includes('guía') || sn.toLowerCase().includes('guia')) continue;
    if (sn.toLowerCase().includes('instrucciones')) continue;
    if (sn.toLowerCase().includes('readme')) continue;
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
    if (json.length < 2) continue;
    const headers = (json[0] || []).map(h => normalizeH(h));
    if (headers.some(h => ['nombre', 'name', 'area', 'área'].some(a => h === a || h.includes(a)))) {
      return sn;
    }
  }
  return wb.SheetNames.find(sn => !sn.startsWith('__')) || wb.SheetNames[0];
}

export function parseNumero(val) {
  if (val === null || val === undefined || val === '') return null;
  const v = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  return ['si', 'sí', 'yes', 'true', '1', 'x', '✓'].includes(String(val || '').toLowerCase().trim());
}

// ═══════════════════════════════════════════════════════════════
// Paso de Upload (zona de drop + botón plantilla + info + extras)
// ═══════════════════════════════════════════════════════════════
function UploadStep({
  fileName, parseError, dragOver, setDragOver,
  onFileDrop, onFileSelect, fileInputRef,
  uploadInfoContent, uploadExtras,
  generateTemplate, templateButtonLabel, templateButtonDisabled,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Info box */}
      {uploadInfoContent && (
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '0.85rem 1rem' }}>
          {uploadInfoContent}
        </div>
      )}

      {/* Extras (checkboxes, alerts, etc.) */}
      {uploadExtras}

      {/* Botón de plantilla */}
      {generateTemplate && (
        <button
          className="cw-btn cw-btn--secondary"
          onClick={generateTemplate}
          style={{ alignSelf: 'flex-start' }}
          disabled={templateButtonDisabled}
        >
          <MdDownload /> {templateButtonLabel || 'Descargar plantilla'}
        </button>
      )}

      {/* Zona de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onFileDrop}
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={e => onFileSelect(e.target.files[0])}
        />
      </div>

      {parseError && (
        <div className="cw-alert cw-alert--error">🚫 {parseError}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// StatBox (exportado para reutilización)
// ═══════════════════════════════════════════════════════════════
export function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-glass)', border: `1px solid ${color}30`, borderRadius: 8, padding: '0.5rem 0.75rem' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tabs de pasos
// ═══════════════════════════════════════════════════════════════
const STEPS = [
  { key: 'upload',    label: '1. Subir' },
  { key: 'preview',   label: '2. Revisar' },
  { key: 'importing', label: '3. Importando' },
  { key: 'done',      label: '4. Resultado' },
];
const STEP_ORDER = ['upload', 'preview', 'importing', 'done'];

function StepTabs({ currentStep }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 1.5rem', flexShrink: 0 }}>
      {STEPS.map(s => {
        const active = currentStep === s.key;
        const passed = STEP_ORDER.indexOf(currentStep) > STEP_ORDER.indexOf(s.key);
        return (
          <div key={s.key} style={{
            padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: active ? 700 : 400,
            color: active ? '#10b981' : passed ? 'var(--cw-success)' : 'var(--text-muted)',
            borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
          }}>{passed ? '✓ ' : ''}{s.label}</div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
/**
 * @param {object} props
 * @param {string} props.title - Título del modal (ej: "Importación Masiva de Empleados")
 * @param {React.ReactNode} props.icon - Ícono junto al título
 * @param {string} props.entityName - Nombre singular (ej: "empleado")
 * @param {string} props.entityNamePlural - Nombre plural (ej: "empleados")
 * @param {object} props.columnAliases - Mapeo { field: [aliases...] } para parseo de columnas
 * @param {function} props.validateRow - (row) => [{ campo, msg }]
 * @param {function} props.normFn - (field, val) => normalizedVal (opcional, usado por el wrapper en onImport)
 * @param {function} props.generateTemplate - async () => void — genera y descarga plantilla Excel
 * @param {string} props.templateButtonLabel - Label del botón de plantilla
 * @param {boolean} props.templateButtonDisabled - Deshabilitar botón de plantilla
 * @param {function} props.onImport - async (validRows, setProgress) => { success, errors, total }
 * @param {React.ReactNode} props.uploadInfoContent - Contenido del info box en el paso upload
 * @param {React.ReactNode} props.uploadExtras - Contenido extra en el paso upload (checkboxes, alerts)
 * @param {Array<{key:string, label:string, format?:function}>} props.previewColumns - Columnas para tabla preview
 * @param {string} props.previewRowKey - Campo a usar como identificador en mensajes de error (ej: 'nombre')
 * @param {string} props.importingMessage - Mensaje durante la importación
 * @param {function} props.onClose - (hasChanges: boolean) => void
 * @param {number} props.maxWidth - Ancho máximo del modal (default: 880)
 */
export default function BulkImportModalGeneric({
  title,
  icon,
  entityName = 'registro',
  entityNamePlural = 'registros',
  columnAliases = {},
  validateRow = () => [],
  generateTemplate,
  templateButtonLabel = 'Descargar plantilla',
  templateButtonDisabled = false,
  onImport,
  uploadInfoContent = null,
  uploadExtras = null,
  previewColumns = [],
  previewRowKey = 'nombre',
  importingMessage,
  onClose,
  maxWidth = 880,
}) {
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  // ── Manejo de archivo ──────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = findDataSheet(wb);
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) {
          setParseError(`La hoja "${wsname}" no contiene filas con datos.`);
          return;
        }
        const headers = Object.keys(json[0]);
        const idxMap = buildColumnIndexes(headers, columnAliases);
        const fields = Object.keys(columnAliases);
        const rows = json.map((row, i) => {
          const r = { _row: i + 2 };
          fields.forEach(field => {
            const colIdx = idxMap[field];
            if (colIdx === -1) return;
            const headerName = Object.keys(row)[colIdx];
            r[field] = headerName != null ? row[headerName] : '';
          });
          r._errors = validateRow(r);
          return r;
        });
        setParsedRows(rows);
        setStep('preview');
      } catch (err) {
        setParseError('No se pudo leer el archivo. Verifica que sea .xlsx, .xls o .csv válido.');
        logger.error('BulkImportModalGeneric', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [columnAliases, validateRow]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleFileSelect = useCallback((file) => {
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Filas válidas / inválidas ──────────────────────────────
  const validRows = parsedRows.filter(r => r._errors.length === 0);
  const invalidRows = parsedRows.filter(r => r._errors.length > 0);

  // ── Ejecutar importación ───────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!onImport || validRows.length === 0) return;
    setStep('importing');
    setProgress(0);
    try {
      const result = await onImport(validRows, setProgress);
      setResults({ ...result, total: parsedRows.length });
      setStep('done');
    } catch (err) {
      setResults({
        success: 0,
        errors: [{ row: 0, nombre: 'Error', msg: err?.message || String(err) }],
        total: parsedRows.length,
      });
      setStep('done');
    }
  }, [onImport, validRows, parsedRows.length]);

  // ── Cerrar ─────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (onClose) onClose(results?.success > 0);
  }, [onClose, results]);

  // ── UI ─────────────────────────────────────────────────────
  return (
    <div className="cw-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="cw-modal animate-slide-up" style={{
        maxWidth, width: '96vw', maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            {icon && <span style={{ marginRight: 8, color: '#10b981' }}>{icon}</span>}
            {title}
            {fileName && (
              <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                {fileName}
              </span>
            )}
          </h3>
          <button className="cw-modal__close" onClick={handleClose}><MdClose /></button>
        </div>

        {/* Tabs de pasos */}
        <StepTabs currentStep={step} />

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

          {/* ══ UPLOAD ══ */}
          {step === 'upload' && (
            <UploadStep
              fileName={fileName}
              parseError={parseError}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onFileDrop={handleDrop}
              onFileSelect={handleFileSelect}
              fileInputRef={fileInputRef}
              uploadInfoContent={uploadInfoContent}
              uploadExtras={uploadExtras}
              generateTemplate={generateTemplate}
              templateButtonLabel={templateButtonLabel}
              templateButtonDisabled={templateButtonDisabled}
            />
          )}

          {/* ══ PREVIEW ══ */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <StatBox label="Filas" value={parsedRows.length} color="#6366f1" />
                <StatBox label="Válidas" value={validRows.length} color="#10b981" />
                <StatBox label="Con errores" value={invalidRows.length} color={invalidRows.length ? '#ef4444' : 'var(--text-muted)'} />
              </div>

              {/* Errores */}
              {invalidRows.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                    <MdWarning style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {invalidRows.length} fila(s) con errores:
                  </div>
                  {invalidRows.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      <strong>Fila {r._row}:</strong> {r[previewRowKey] || r.cedula || '(sin nombre)'}
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

              {/* Tabla de filas válidas */}
              {validRows.length > 0 && (
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <table className="cw-table" style={{ fontSize: '0.72rem' }}>
                    <thead>
                      <tr>
                        <th>✓</th>
                        <th>Fila</th>
                        {previewColumns.map(col => (
                          <th key={col.key}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((r, i) => (
                        <tr key={i}>
                          <td><MdCheckCircle style={{ color: '#10b981' }} /></td>
                          <td>{r._row}</td>
                          {previewColumns.map(col => (
                            <td key={col.key}>
                              {col.format ? col.format(r[col.key], r) : (r[col.key] != null ? String(r[col.key]) : '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer buttons */}
              <div className="cw-modal__footer" style={{ padding: 0, borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <button className="cw-btn cw-btn--secondary" onClick={() => { setStep('upload'); setParsedRows([]); setFileName(''); }}>
                  ← Cambiar archivo
                </button>
                <button className="cw-btn cw-btn--primary" onClick={handleImport} disabled={validRows.length === 0}>
                  <MdCheckCircle style={{ marginRight: 4 }} />
                  Importar {validRows.length} {validRows.length !== 1 ? entityNamePlural : entityName}
                </button>
              </div>
            </div>
          )}

          {/* ══ IMPORTING ══ */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div className="cw-spinner" style={{ margin: '0 auto 1rem' }}></div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Importando {entityNamePlural}...
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {progress}% completado{importingMessage ? ` · ${importingMessage}` : ''}
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
                <strong style={{ color: '#10b981' }}>{results.success}</strong> {results.success !== 1 ? entityNamePlural : entityName} creado(s) ·
                {' '}<strong style={{ color: results.errors.length ? '#ef4444' : 'var(--text-muted)' }}>{results.errors.length}</strong> error(es)
              </div>
              {results.errors.length > 0 && (
                <div style={{ marginTop: '0.75rem', textAlign: 'left', maxHeight: 180, overflowY: 'auto', background: 'rgba(239,68,68,0.05)', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.75rem' }}>
                  {results.errors.map((e, i) => (
                    <div key={i} style={{ color: '#fca5a5' }}>
                      {e.row ? `Fila ${e.row}` : 'Error'} ({e.nombre || '—'}): {e.msg}
                    </div>
                  ))}
                </div>
              )}
              <button className="cw-btn cw-btn--primary" onClick={handleClose} style={{ marginTop: '1rem' }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
