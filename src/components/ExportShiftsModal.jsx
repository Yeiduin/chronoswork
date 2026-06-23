// ============================================================
// ChronosWork — Modal de Exportación de Turnos a Excel
// Genera un .xlsx multi-hoja con:
//   1) Turnos (una fila por turno, con todos los datos relevantes)
//   2) Resumen por Empleado (totales, horas, alertas)
//   3) Resumen por Día (cobertura, déficit)
//   4) __listas__ (oculta, sólo catálogos de referencia)
//
// El usuario puede elegir:
//   - Alcance: vista actual, semana pasada/actual/próxima, quincenas,
//     mes actual, próximo mes, o rango personalizado.
//   - Área: Todas o un área específica.
//   - Incluir empleados sin turnos: sí/no.
// ============================================================

import { useState, useMemo } from 'react';
import { format, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import {
  MdClose, MdDownload, MdTableChart, MdWarning, MdInfo, MdCheckCircle,
} from 'react-icons/md';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Cálculo de los días del rango según la opción ─────────────────────────
function getDateRange(option, customStart, customEnd) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (option === 'current_view') return null; // se calcula fuera

  const mkRange = (start, end) => ({
    start, end,
    days: eachDayOfInterval({ start, end }),
  });

  switch (option) {
    case 'this_week': {
      const d = new Date(hoy);
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const start = new Date(d);
      start.setDate(d.getDate() - dow + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return mkRange(start, end);
    }
    case 'next_week': {
      const d = new Date(hoy);
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const start = new Date(d);
      start.setDate(d.getDate() + (7 - dow) + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return mkRange(start, end);
    }
    case 'this_biweek': {
      const d = hoy.getDate();
      const start = new Date(hoy.getFullYear(), hoy.getMonth(), d <= 15 ? 1 : 16);
      const endDay = d <= 15
        ? 15
        : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      const end = new Date(hoy.getFullYear(), hoy.getMonth(), endDay);
      return mkRange(start, end);
    }
    case 'this_month': {
      const start = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const end = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      return mkRange(start, end);
    }
    case 'next_month': {
      const start = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      const end = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
      return mkRange(start, end);
    }
    case 'custom': {
      if (!customStart || !customEnd) return null;
      const start = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T00:00:00');
      if (end < start) return null;
      return mkRange(start, end);
    }
    default:
      return null;
  }
}

// ── Calcula horas de un turno (considera break) ──────────────────────────
function calcShiftHours(shift) {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const raw = (end - start) / 3600000;
  return Math.max(0, raw - (shift.break_minutes || 0) / 60);
}

// ── Etiqueta legible de "shift_kind" ─────────────────────────────────────
function kindLabel(kind) {
  const map = {
    STANDARD: 'Estándar',
    PARTIDO: 'Partido (almuerzo)',
    ROTATIVO: 'Rotativo',
    NOCTURNO: 'Nocturno (HON)',
    DISPONIBILIDAD: 'Disponibilidad/Guardia',
    CUSTOM: 'Personalizado',
  };
  return map[kind] || (kind || 'Estándar');
}

// ── Componente principal ─────────────────────────────────────────────────
export function ExportShiftsModal({
  areas = [],
  employees = [],
  shifts = [],
  absences = [],
  allTemplates = {},
  // props opcionales para que el padre pueda pre-configurar
  defaultAreaId = 'all',
  defaultRange = 'this_week',
  currentViewRange = null, // {start, end, days} cuando el usuario quiere exportar la vista actual
  onClose,
}) {
  const [areaId, setAreaId] = useState(defaultAreaId);
  const [rangeOption, setRangeOption] = useState(defaultRange);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [includeEmpty, setIncludeEmpty] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // ── Resolver el rango de fechas ──────────────────────────────────────
  const resolvedRange = useMemo(() => {
    if (rangeOption === 'current_view') return currentViewRange;
    return getDateRange(rangeOption, customStart, customEnd);
  }, [rangeOption, customStart, customEnd, currentViewRange]);

  // ── Pre-resumen: cuántos turnos/empleados se exportarán ──────────────
  const preview = useMemo(() => {
    if (!resolvedRange) return null;
    const { days } = resolvedRange;
    const dateStrs = new Set(days.map(d => format(d, 'yyyy-MM-dd')));

    // Filtrar turnos en rango + (opcional) área
    let relevantShifts = shifts.filter(s => {
      const dateStr = String(s.start_time || '').split('T')[0];
      if (!dateStrs.has(dateStr)) return false;
      if (areaId !== 'all' && s.area_id && s.area_id !== areaId) return false;
      return true;
    });

    // Si no hay area_id en shift, no descartamos por área (porque
    // muchos turnos ya creados no tienen area_id directo)
    if (areaId !== 'all') {
      // Filtrar por empleados del área como fallback
      const area = areas.find(a => a.id === areaId);
      const empIdsArea = new Set(
        (area?.area_employees || []).map(ae => ae.employee_id)
      );
      if (empIdsArea.size > 0) {
        relevantShifts = relevantShifts.filter(s => empIdsArea.has(s.employee_id));
      }
    }

    const empIdsConTurno = new Set(relevantShifts.map(s => s.employee_id));

    // Empleados candidatos (por área o todos)
    let empPool = employees;
    if (areaId !== 'all') {
      const area = areas.find(a => a.id === areaId);
      const empIdsArea = new Set(
        (area?.area_employees || []).map(ae => ae.employee_id)
      );
      empPool = empPool.filter(e => empIdsArea.has(e.id));
    }

    const finalEmps = includeEmpty
      ? empPool
      : empPool.filter(e => empIdsConTurno.has(e.id));

    return {
      shifts: relevantShifts.length,
      employees: finalEmps.length,
      days: days.length,
    };
  }, [resolvedRange, shifts, employees, areas, areaId, includeEmpty]);

  // ── Generar el Excel ─────────────────────────────────────────────────
  const handleExport = async () => {
    setError('');
    if (!resolvedRange) {
      setError('Selecciona un rango válido (si elegiste "Rango personalizado", llena desde y hasta).');
      return;
    }
    if (resolvedRange.days.length === 0) {
      setError('El rango seleccionado no tiene días.');
      return;
    }
    setExporting(true);
    try {
      await buildAndDownloadExcel({
        range: resolvedRange,
        areaId,
        areas,
        employees,
        shifts,
        absences,
        allTemplates,
        includeEmpty,
      });
      // Damos tiempo a que el navegador dispare la descarga antes de cerrar
      setTimeout(() => onClose?.(), 350);
    } catch (err) {
      console.error('Error generando Excel:', err);
      setError('Error generando el archivo: ' + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 520 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            <MdTableChart style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Exportar Turnos a Excel
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {error && (
          <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>
            🚫 {error}
          </div>
        )}

        {/* Selección de área */}
        <div className="cw-form-group">
          <label className="cw-label">Área</label>
          <select className="cw-select" value={areaId} onChange={e => setAreaId(e.target.value)}>
            <option value="all">🏢 Todas las áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>● {a.nombre}</option>
            ))}
          </select>
        </div>

        {/* Selección de rango */}
        <div className="cw-form-group">
          <label className="cw-label">Rango de fechas</label>
          <select
            className="cw-select"
            value={rangeOption}
            onChange={e => { setRangeOption(e.target.value); setError(''); }}
          >
            <option value="current_view">📅 Vista actual de la pantalla</option>
            <option value="this_week">Esta semana (Lun - Dom)</option>
            <option value="next_week">La próxima semana (Próx. Lun - Dom)</option>
            <option value="this_biweek">Esta quincena</option>
            <option value="this_month">Este mes</option>
            <option value="next_month">El próximo mes</option>
            <option value="custom">Rango personalizado...</option>
          </select>
        </div>

        {rangeOption === 'custom' && (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="cw-form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="cw-label">Desde</label>
              <input type="date" className="cw-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div className="cw-form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="cw-label">Hasta</label>
              <input type="date" className="cw-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        {/* Opciones adicionales */}
        <div className="cw-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeEmpty}
              onChange={e => setIncludeEmpty(e.target.checked)}
            />
            <span className="cw-label" style={{ margin: 0 }}>
              Incluir empleados sin turnos en el rango
            </span>
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem',
            fontSize: '0.82rem', color: 'var(--text-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <MdInfo style={{ color: 'var(--cw-accent)' }} />
              <strong>Vista previa del export</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Días</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{preview.days}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Empleados</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{preview.employees}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Turnos</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cw-accent)' }}>{preview.shifts}</div>
              </div>
            </div>
          </div>
        )}

        {/* Info sobre el contenido */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem',
          fontSize: '0.78rem', color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--cw-accent)' }}>El archivo incluye 3 hojas:</strong>
          <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, lineHeight: 1.6 }}>
            <li><strong>Turnos</strong> — un turno por fila con todos los detalles del empleado, área, contrato, novedades y observaciones.</li>
            <li><strong>Resumen por Empleado</strong> — totales de horas, turnos asignados, alertas (sin turnos, horas insuficientes/excedidas).</li>
            <li><strong>Resumen por Día</strong> — cobertura, déficit y turnos asignados por fecha.</li>
          </ul>
        </div>

        <div className="cw-modal__footer">
          <button className="cw-btn cw-btn--secondary" onClick={onClose} disabled={exporting}>
            Cancelar
          </button>
          <button
            className="cw-btn cw-btn--primary"
            onClick={handleExport}
            disabled={exporting || !resolvedRange}
          >
            {exporting
              ? <><span className="cw-spinner cw-spinner--sm"></span> Generando...</>
              : <><MdDownload /> Descargar Excel</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Generador del Excel (función pura, testeable)
// ──────────────────────────────────────────────────────────────────────────
async function buildAndDownloadExcel({
  range, areaId, areas, employees, shifts, absences, allTemplates, includeEmpty,
}) {
  const { days, start, end } = range;
  const dateStrs = new Set(days.map(d => format(d, 'yyyy-MM-dd')));

  // ── Determinar pool de empleados ─────────────────────────────────────
  let empPool = employees;
  let targetArea = null;
  if (areaId !== 'all') {
    targetArea = areas.find(a => a.id === areaId) || null;
    const empIdsArea = new Set(
      (targetArea?.area_employees || []).map(ae => ae.employee_id)
    );
    empPool = empPool.filter(e => empIdsArea.has(e.id));
  }

  // ── Filtrar turnos en rango (y opcionalmente por área) ──────────────
  const shiftsInRange = shifts.filter(s => {
    const dateStr = String(s.start_time || '').split('T')[0];
    if (!dateStrs.has(dateStr)) return false;
    if (areaId !== 'all' && targetArea) {
      const empEnArea = (targetArea.area_employees || []).some(ae => ae.employee_id === s.employee_id);
      if (!empEnArea) return false;
    }
    return true;
  });

  // Index de turnos por empleado
  const shiftsByEmp = new Map();
  shiftsInRange.forEach(s => {
    if (!shiftsByEmp.has(s.employee_id)) shiftsByEmp.set(s.employee_id, []);
    shiftsByEmp.get(s.employee_id).push(s);
  });

  // Empleados a incluir
  const finalEmps = includeEmpty
    ? empPool
    : empPool.filter(e => shiftsByEmp.has(e.id));

  // Mapas auxiliares
  const empById = new Map(employees.map(e => [e.id, e]));
  const areaById = new Map(areas.map(a => [a.id, a]));
  const areaByEmp = new Map();
  areas.forEach(a => {
    (a.area_employees || []).forEach(ae => {
      if (!areaByEmp.has(ae.employee_id)) areaByEmp.set(ae.employee_id, a);
    });
  });

  // Helper: ¿el empleado tiene novedad activa en una fecha?
  const novedadEnFecha = (empId, dateStr) => {
    return absences.find(a =>
      a.employee_id === empId &&
      a.fecha_inicio <= dateStr &&
      a.fecha_fin >= dateStr
    );
  };

  // ── Crear el workbook ────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ChronosWork';
  wb.created = new Date();
  wb.title = `Turnos ${format(start, 'yyyy-MM-dd')} a ${format(end, 'yyyy-MM-dd')}`;

  // ── Hoja oculta con catálogos (referencia) ──────────────────────────
  const wsListas = wb.addWorksheet('__listas__');
  wsListas.state = 'veryHidden';
  wsListas.getColumn(1).values = ['ShiftKind', 'STANDARD', 'PARTIDO', 'ROTATIVO', 'NOCTURNO', 'DISPONIBILIDAD', 'CUSTOM'];
  wsListas.getColumn(2).values = ['TipoContrato', 'INDEFINIDO', 'TERMINO_FIJO', 'OBRA_LABOR', 'POR_HORAS', 'SALARIO_FIJO', 'PRESTACION_SERVICIOS', 'APRENDIZAJE', 'OCASIONAL', 'TEMPORAL'];
  wsListas.getColumn(3).values = ['JornadaTipo', 'DIURNA', 'NOCTURNA', 'MIXTA', 'POR_TURNOS'];
  wsListas.getColumn(4).values = ['NivelARL', '1', '2', '3', '4', '5'];
  wsListas.getColumn(5).values = ['GeneradoPor', 'ChronosWork'];
  wsListas.getColumn(6).values = ['FechaGeneracion', format(new Date(), 'yyyy-MM-dd HH:mm')];
  wsListas.getColumn(7).values = ['RangoInicio', format(start, 'yyyy-MM-dd')];
  wsListas.getColumn(8).values = ['RangoFin', format(end, 'yyyy-MM-dd')];

  // ════════════════════════════════════════════════════════════════════
  // HOJA 1: TURNOS (un turno por fila)
  // ════════════════════════════════════════════════════════════════════
  const wsT = wb.addWorksheet('Turnos', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }],
  });

  const colDefs = [
    { key: 'fecha',                header: 'Fecha',                width: 12 },
    { key: 'dia_semana',           header: 'Día',                  width: 12 },
    { key: 'cedula',               header: 'Cédula',               width: 14 },
    { key: 'nombre',               header: 'Nombre',               width: 28 },
    { key: 'cargo',                header: 'Cargo',                width: 22 },
    { key: 'area',                 header: 'Área',                 width: 24 },
    { key: 'sector',               header: 'Sector',               width: 16 },
    { key: 'tipo_contrato',        header: 'Tipo Contrato',        width: 18 },
    { key: 'horas_semanales_contrato', header: 'Horas Sem. Contrato', width: 12 },
    { key: 'valor_hora',           header: 'Valor Hora (COP)',     width: 16 },
    { key: 'plantilla_nombre',     header: 'Plantilla Turno',      width: 22 },
    { key: 'plantilla_tipo',       header: 'Tipo Horario',         width: 18 },
    { key: 'hora_inicio',          header: 'Hora Inicio',          width: 12 },
    { key: 'hora_fin',             header: 'Hora Fin',             width: 12 },
    { key: 'duracion_horas',       header: 'Duración (h)',         width: 12 },
    { key: 'cruza_medianoche',     header: 'Cruza Medianoche',     width: 12 },
    { key: 'almuerzo_min',         header: 'Almuerzo (min)',       width: 13 },
    { key: 'breaks_15',            header: 'Breaks 15 (cant)',     width: 13 },
    { key: 'disponibilidad',       header: 'Disponibilidad',       width: 14 },
    { key: 'recargo_pct',          header: 'Recargo %',            width: 10 },
    { key: 'novedad_tipo',         header: 'Novedad',              width: 16 },
    { key: 'novedad_rango',        header: 'Novedad Fechas',       width: 22 },
    { key: 'novedad_obs',          header: 'Novedad Obs.',         width: 28 },
    { key: 'observaciones',        header: 'Observaciones',        width: 32 },
    { key: 'tenant_periodo',       header: 'Período',              width: 10 },
  ];

  wsT.columns = colDefs.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Estilo del header
  const hRow = wsT.getRow(1);
  hRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
  hRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  hRow.height = 24;

  // Generar las filas
  let totalRows = 0;
  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dow = getDay(day);
    const empleadosConTurnoEsteDia = new Set();

    // Turnos de este día
    const turnosDelDia = shiftsInRange.filter(s =>
      String(s.start_time || '').split('T')[0] === dateStr
    );
    turnosDelDia.sort((a, b) =>
      String(a.start_time).localeCompare(String(b.start_time))
    );

    for (const shift of turnosDelDia) {
      const emp = empById.get(shift.employee_id);
      if (!emp) continue;
      empleadosConTurnoEsteDia.add(emp.id);

      const tpl = shift.template_id ? allTemplates?.[shift.template_id] : null;
      const area = areaByEmp.get(emp.id);
      const novedad = novedadEnFecha(emp.id, dateStr);
      const horas = calcShiftHours(shift);

      const inicioStr = String(shift.start_time).split('T')[1]?.substring(0, 5) || '';
      const finStr = String(shift.end_time).split('T')[1]?.substring(0, 5) || '';

      const row = wsT.addRow({
        fecha: dateStr,
        dia_semana: DIAS_SEMANA[dow],
        cedula: emp.cedula || '',
        nombre: emp.nombre || '',
        cargo: emp.cargo || '',
        area: area?.nombre || '(sin área)',
        sector: area?.sector || '',
        tipo_contrato: emp.tipo_contrato || '',
        horas_semanales_contrato: emp.horas_semanales_contrato || '',
        valor_hora: emp.valor_hora || '',
        plantilla_nombre: tpl?.nombre || (tpl ? tpl.nombre : '(slot dinámico)'),
        plantilla_tipo: kindLabel(shift.shift_kind || tpl?.shift_kind || 'STANDARD'),
        hora_inicio: inicioStr,
        hora_fin: finStr,
        duracion_horas: Number(horas.toFixed(2)),
        cruza_medianoche: tpl?.cruza_medianoche ? 'Sí' : 'No',
        almuerzo_min: shift.almuerzo_minutos ?? shift.break_minutes ?? 0,
        breaks_15: Array.isArray(shift.descansos)
          ? shift.descansos.filter(d => d.tipo === 'BREAK').length
          : (shift.breaks_15_count ?? 0),
        disponibilidad: shift.disponibilidad ? 'Sí' : 'No',
        recargo_pct: shift.recargo_porcentaje || 0,
        novedad_tipo: novedad?.tipo || '',
        novedad_rango: novedad ? `${novedad.fecha_inicio} → ${novedad.fecha_fin}` : '',
        novedad_obs: novedad?.observaciones || '',
        observaciones: shift.observaciones || '',
        tenant_periodo: shift.periodo || '',
      });

      // Colorear fila según estado
      if (novedad) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        });
      } else if (shift.shift_kind === 'NOCTURNO' || tpl?.shift_kind === 'NOCTURNO') {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
          cell.font = { color: { argb: 'FFC7D2FE' }, size: 10 };
        });
      } else if (shift.disponibilidad) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE7F3' } };
        });
      } else if (dow === 0) {
        // Domingo
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        });
      } else if (dow === 6) {
        // Sábado
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
        });
      }

      totalRows++;
    }

    // Filas de "sin turno" para empleados del pool sin asignación en este día
    // (sólo si includeEmpty y el día es laborable para su área)
    if (includeEmpty) {
      for (const emp of empPool) {
        if (empleadosConTurnoEsteDia.has(emp.id)) continue;
        const area = areaByEmp.get(emp.id);
        const dowISO = dow === 0 ? 7 : dow; // 1=Lun...7=Dom
        const diasTrab = area?.dias_trabajo || [1, 2, 3, 4, 5, 6, 7];
        if (!diasTrab.includes(dowISO)) continue; // no es día laborable del área

        const novedad = novedadEnFecha(emp.id, dateStr);
        const row = wsT.addRow({
          fecha: dateStr,
          dia_semana: DIAS_SEMANA[dow],
          cedula: emp.cedula || '',
          nombre: emp.nombre || '',
          cargo: emp.cargo || '',
          area: area?.nombre || '(sin área)',
          sector: area?.sector || '',
          tipo_contrato: emp.tipo_contrato || '',
          horas_semanales_contrato: emp.horas_semanales_contrato || '',
          valor_hora: emp.valor_hora || '',
          plantilla_nombre: '— (sin turno)',
          plantilla_tipo: '—',
          hora_inicio: '',
          hora_fin: '',
          duracion_horas: 0,
          cruza_medianoche: '',
          almuerzo_min: '',
          breaks_15: '',
          disponibilidad: '',
          recargo_pct: '',
          novedad_tipo: novedad?.tipo || 'SIN COBERTURA',
          novedad_rango: novedad ? `${novedad.fecha_inicio} → ${novedad.fecha_fin}` : '',
          novedad_obs: novedad?.observaciones || 'No tiene turno programado en este día',
          observaciones: '',
          tenant_periodo: '',
        });
        // Rojo claro para "sin cobertura"
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { italic: true, color: { argb: 'FF991B1B' }, size: 10 };
        });
        totalRows++;
      }
    }
  }

  // Formato de moneda
  const colValor = wsT.getColumn('valor_hora');
  colValor.numFmt = '"$"#,##0';

  // Filtro automático
  wsT.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colDefs.length } };

  // ════════════════════════════════════════════════════════════════════
  // HOJA 2: RESUMEN POR EMPLEADO
  // ════════════════════════════════════════════════════════════════════
  const wsE = wb.addWorksheet('Resumen por Empleado', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
  });

  const colDefsE = [
    { key: 'cedula',             header: 'Cédula',                width: 14 },
    { key: 'nombre',             header: 'Nombre',                width: 28 },
    { key: 'cargo',              header: 'Cargo',                 width: 22 },
    { key: 'area',               header: 'Área',                  width: 24 },
    { key: 'sector',             header: 'Sector',                width: 16 },
    { key: 'tipo_contrato',      header: 'Tipo Contrato',         width: 18 },
    { key: 'valor_hora',         header: 'Valor Hora (COP)',      width: 16 },
    { key: 'horas_semanales_contrato', header: 'Horas Sem. Contrato', width: 14 },
    { key: 'turnos_asignados',   header: 'Turnos Asignados',      width: 14 },
    { key: 'horas_totales',      header: 'Horas Totales',         width: 14 },
    { key: 'horas_ordinarias',   header: 'Horas Ordinarias',      width: 14 },
    { key: 'horas_nocturnas',    header: 'Horas Nocturnas',       width: 14 },
    { key: 'horas_dominicales',  header: 'Horas Dominicales',     width: 14 },
    { key: 'horas_extras',       header: 'Horas Extras (estim.)', width: 16 },
    { key: 'valor_bruto_estim',  header: 'Valor Bruto Est. (COP)', width: 18 },
    { key: 'dias_sin_cobertura', header: 'Días Sin Cobertura',    width: 16 },
    { key: 'dias_con_novedad',   header: 'Días Con Novedad',      width: 16 },
    { key: 'estado',             header: 'Estado',                width: 22 },
  ];

  wsE.columns = colDefsE.map(c => ({ header: c.header, key: c.key, width: c.width }));

  const hRowE = wsE.getRow(1);
  hRowE.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  hRowE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  hRowE.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  hRowE.height = 24;

  // Calcular límites legales
  const horasContrato = (emp) => {
    const h = parseInt(emp.horas_semanales_contrato, 10);
    return (!isNaN(h) && h > 0 && h <= 60) ? h : 42;
  };

  for (const emp of finalEmps) {
    const area = areaByEmp.get(emp.id);
    const turnos = shiftsByEmp.get(emp.id) || [];

    let horasTotal = 0, horasOrd = 0, horasNoct = 0, horasDom = 0, horasExt = 0;
    let diasConNovedad = 0;
    const diasConTurnoSet = new Set();

    for (const s of turnos) {
      const hrs = calcShiftHours(s);
      horasTotal += hrs;
      const dateStr = String(s.start_time).split('T')[0];
      diasConTurnoSet.add(dateStr);

      // Heurísticas para clasificar
      const tpl = s.template_id ? allTemplates?.[s.template_id] : null;
      const kind = s.shift_kind || tpl?.shift_kind || 'STANDARD';
      const dow = getDay(parseISO(dateStr));
      const isNight = kind === 'NOCTURNO' || tpl?.paga_recargo_nocturno;
      const isSunday = dow === 0;

      if (isNight && isSunday) {
        horasNoct += hrs * 0.5;
        horasDom += hrs * 0.5;
      } else if (isNight) {
        horasNoct += hrs;
      } else if (isSunday) {
        horasDom += hrs;
      } else {
        horasOrd += hrs;
      }

      // Novedad ese día
      if (novedadEnFecha(emp.id, dateStr)) diasConNovedad++;
    }

    // Horas extras estimadas: lo que pase de horas_contrato * 4.33 semanas
    const horasEsperadas = horasContrato(emp) * 4.33;
    horasExt = Math.max(0, horasTotal - horasEsperadas);

    // Días sin cobertura: días laborables del área en el rango sin turno
    const diasLab = area?.dias_trabajo || [1, 2, 3, 4, 5];
    const sinCobertura = days.filter(d => {
      const dow = getDay(d);
      const dowISO = dow === 0 ? 7 : dow;
      if (!diasLab.includes(dowISO)) return false;
      const ds = format(d, 'yyyy-MM-dd');
      // Excluir días con novedad aprobada
      if (novedadEnFecha(emp.id, ds)) return false;
      return !diasConTurnoSet.has(ds);
    }).length;

    // Estado
    let estado = '✅ OK';
    let estadoColor = 'FF10B981';
    if (horasTotal === 0) {
      estado = '⚠️ SIN TURNOS';
      estadoColor = 'FFEF4444';
    } else if (horasTotal < horasEsperadas * 0.5) {
      estado = '⚠️ POCAS HORAS';
      estadoColor = 'FFF59E0B';
    } else if (horasTotal > horasEsperadas * 1.2) {
      estado = '⚠️ EXCESO DE HORAS';
      estadoColor = 'FFF59E0B';
    }

    const valorBruto = Math.round(horasTotal * (parseFloat(emp.valor_hora) || 0));

    const row = wsE.addRow({
      cedula: emp.cedula || '',
      nombre: emp.nombre || '',
      cargo: emp.cargo || '',
      area: area?.nombre || '(sin área)',
      sector: area?.sector || '',
      tipo_contrato: emp.tipo_contrato || '',
      valor_hora: parseFloat(emp.valor_hora) || 0,
      horas_semanales_contrato: horasContrato(emp),
      turnos_asignados: turnos.length,
      horas_totales: Number(horasTotal.toFixed(2)),
      horas_ordinarias: Number(horasOrd.toFixed(2)),
      horas_nocturnas: Number(horasNoct.toFixed(2)),
      horas_dominicales: Number(horasDom.toFixed(2)),
      horas_extras: Number(horasExt.toFixed(2)),
      valor_bruto_estim: valorBruto,
      dias_sin_cobertura: sinCobertura,
      dias_con_novedad: diasConNovedad,
      estado,
    });

    // Colorear celda de estado
    const estadoCell = row.getCell('estado');
    estadoCell.font = { bold: true, color: { argb: estadoColor.replace('FF', 'FF') }, size: 10 };
    estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estadoColor + '20' } };
  }

  // Formato de moneda
  wsE.getColumn('valor_hora').numFmt = '"$"#,##0';
  wsE.getColumn('valor_bruto_estim').numFmt = '"$"#,##0';
  wsE.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colDefsE.length } };

  // ════════════════════════════════════════════════════════════════════
  // HOJA 3: RESUMEN POR DÍA
  // ════════════════════════════════════════════════════════════════════
  const wsD = wb.addWorksheet('Resumen por Día', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const colDefsD = [
    { key: 'fecha',                header: 'Fecha',              width: 12 },
    { key: 'dia_semana',           header: 'Día',                width: 12 },
    { key: 'turnos_asignados',     header: 'Turnos Asignados',   width: 14 },
    { key: 'empleados_unicos',     header: 'Empleados Únicos',   width: 14 },
    { key: 'horas_totales',        header: 'Horas Totales',      width: 14 },
    { key: 'horas_nocturnas',      header: 'Horas Nocturnas',    width: 14 },
    { key: 'horas_dominicales',    header: 'Horas Dominicales',  width: 14 },
    { key: 'valor_bruto_estim',    header: 'Valor Bruto Est.',   width: 18 },
    { key: 'empleados_sin_cobertura', header: 'Emp. Sin Cobertura', width: 16 },
    { key: 'cobertura_pct',        header: 'Cobertura %',        width: 14 },
  ];

  wsD.columns = colDefsD.map(c => ({ header: c.header, key: c.key, width: c.width }));

  const hRowD = wsD.getRow(1);
  hRowD.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  hRowD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
  hRowD.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  hRowD.height = 24;

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dow = getDay(day);
    const turnosDelDia = shiftsInRange.filter(s =>
      String(s.start_time || '').split('T')[0] === dateStr
    );

    let horasTotal = 0, horasNoct = 0, horasDom = 0, valorBruto = 0;
    const empsUnicos = new Set();
    for (const s of turnosDelDia) {
      const hrs = calcShiftHours(s);
      horasTotal += hrs;
      empsUnicos.add(s.employee_id);
      const emp = empById.get(s.employee_id);
      valorBruto += Math.round(hrs * (parseFloat(emp?.valor_hora) || 0));
      const tpl = s.template_id ? allTemplates?.[s.template_id] : null;
      const kind = s.shift_kind || tpl?.shift_kind || 'STANDARD';
      if (kind === 'NOCTURNO' || tpl?.paga_recargo_nocturno) horasNoct += hrs;
      if (dow === 0) horasDom += hrs;
    }

    // Empleados sin cobertura ese día
    let sinCobertura = 0;
    if (includeEmpty) {
      for (const emp of empPool) {
        if (empsUnicos.has(emp.id)) continue;
        const area = areaByEmp.get(emp.id);
        const dowISO = dow === 0 ? 7 : dow;
        const diasLab = area?.dias_trabajo || [1, 2, 3, 4, 5];
        if (!diasLab.includes(dowISO)) continue;
        if (novedadEnFecha(emp.id, dateStr)) continue;
        sinCobertura++;
      }
    }

    const totalEsperados = empPool.filter(e => {
      const a = areaByEmp.get(e.id);
      const dowISO = dow === 0 ? 7 : dow;
      const dl = a?.dias_trabajo || [1, 2, 3, 4, 5];
      return dl.includes(dowISO);
    }).length;
    const coberturaPct = totalEsperados > 0
      ? Math.round((empsUnicos.size / totalEsperados) * 100)
      : 100;

    wsD.addRow({
      fecha: dateStr,
      dia_semana: DIAS_SEMANA_CORTO[dow],
      turnos_asignados: turnosDelDia.length,
      empleados_unicos: empsUnicos.size,
      horas_totales: Number(horasTotal.toFixed(2)),
      horas_nocturnas: Number(horasNoct.toFixed(2)),
      horas_dominicales: Number(horasDom.toFixed(2)),
      valor_bruto_estim: valorBruto,
      empleados_sin_cobertura: sinCobertura,
      cobertura_pct: coberturaPct,
    });
  }

  wsD.getColumn('valor_bruto_estim').numFmt = '"$"#,##0';
  wsD.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colDefsD.length } };

  // ════════════════════════════════════════════════════════════════════
  // Descargar
  // ════════════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = format(new Date(), 'yyyyMMdd_HHmm');
  const areaSlug = targetArea
    ? `_${targetArea.nombre.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`
    : '_TodasAreas';
  a.download = `turnos${areaSlug}_${format(start, 'yyyy-MM-dd')}_a_${format(end, 'yyyy-MM-dd')}_${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default ExportShiftsModal;
