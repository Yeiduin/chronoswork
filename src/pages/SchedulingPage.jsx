import { useState, useEffect, useMemo } from 'react';
import { useShifts } from '../hooks/useShifts';
import { useEmployees } from '../hooks/useEmployees';
import { useAbsences } from '../hooks/useAbsences';
import { useAreas } from '../hooks/useAreas';
import { supabase } from '../config/supabaseClient';
import { getDiasMes, formatFecha, getNombreMes } from '../core/dateUtils';
import { formatCOP } from '../core/validators';
import {
  MdClose, MdInfo, MdCalendarMonth, MdChevronLeft, MdChevronRight,
  MdBolt, MdDelete, MdDeleteSweep, MdWarning, MdCheckCircle,
} from 'react-icons/md';
import { format } from 'date-fns';
import { AutoAssignModal } from '../components/AutoAssignModal';

// ─── Modal Asignar / Editar Turno ────────────────────────────────────────────
function ShiftModal({ employee, fecha, areaId, areaTemplates, onClose, onSave, onDelete, existingShift }) {
  const [selected, setSelected] = useState(
    existingShift?.template_id || null
  );
  const [loading, setLoading] = useState(false);
  const [extraTemplates, setExtraTemplates] = useState([]);

  // Si no hay plantillas del área, buscar globales
  useEffect(() => {
    if (!areaId && areaTemplates.length === 0) {
      supabase.from('shift_templates').select('*').is('area_id', null).then(({ data }) => {
        setExtraTemplates(data || []);
      });
    }
  }, [areaId, areaTemplates]);

  const allTemplates = areaTemplates.length > 0 ? areaTemplates : extraTemplates;

  // Pre-seleccionar la plantilla del turno existente
  useEffect(() => {
    if (existingShift && !selected) {
      // Intentar match por template_id, o por hora de inicio
      if (existingShift.template_id) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelected(existingShift.template_id);
      } else {
        const startHour = existingShift.start_time?.slice(11, 16);
        const match = allTemplates.find(t => t.hora_inicio.slice(0, 5) === startHour);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (match) setSelected(match.id);
      }
    }
  }, [existingShift, allTemplates]);

  const handleSave = async () => {
    const tpl = allTemplates.find(t => t.id === selected);
    if (!tpl) return;
    setLoading(true);
    try {
      const dateStr = format(fecha, 'yyyy-MM-dd');
      let startISO = `${dateStr}T${tpl.hora_inicio}:00`;
      let endISO;
      if (tpl.cruza_medianoche) {
        const nextDay = new Date(fecha);
        nextDay.setDate(nextDay.getDate() + 1);
        endISO = `${format(nextDay, 'yyyy-MM-dd')}T${tpl.hora_fin}:00`;
      } else {
        endISO = `${dateStr}T${tpl.hora_fin}:00`;
      }
      const confirmed = window.confirm('¿Estás seguro de que deseas asignar/modificar este turno?');
      if (!confirmed) {
        setLoading(false);
        return;
      }

      await onSave({
        employee_id: employee.id,
        start_time: startISO,
        end_time: endISO,
        shift_type: 'custom',
        periodo: dateStr.slice(0, 7),
        template_id: tpl.id,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calcular horas de la plantilla seleccionada
  const calcHoras = (tpl) => {
    if (!tpl) return null;
    const [h1, m1] = tpl.hora_inicio.split(':').map(Number);
    const [h2, m2] = tpl.hora_fin.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0) mins += 24 * 60;
    return (mins / 60).toFixed(1);
  };

  const selectedTpl = allTemplates.find(t => t.id === selected);

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 440 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">📅 Asignar Turno</h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {/* Info empleado/fecha */}
        <div style={{
          marginBottom: '1.25rem', padding: '0.875rem', background: 'var(--bg-glass)',
          borderRadius: 10, border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{employee.nombre}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            📅 {formatFecha(fecha)} &nbsp;·&nbsp; {employee.cargo}
          </div>
        </div>

        <div className="cw-form-group">
          <label className="cw-label">Franja Horaria <span className="required">*</span></label>
          {allTemplates.length === 0 ? (
            <div style={{
              fontSize: '0.82rem', color: 'var(--text-muted)', padding: '1rem',
              background: 'var(--bg-glass)', borderRadius: 8, textAlign: 'center',
            }}>
              ℹ️ No hay franjas configuradas para esta área.<br />
              <a href="/areas" style={{ color: 'var(--cw-accent)' }}>Configúralas en Áreas →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allTemplates.map(t => {
                const horas = calcHoras(t);
                const isSelected = selected === t.id;
                return (
                  <button key={t.id} type="button"
                    onClick={() => setSelected(t.id)}
                    style={{
                      padding: '0.875rem 1rem', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${isSelected ? t.color : 'var(--border-subtle)'}`,
                      background: isSelected ? t.color + '18' : 'var(--bg-glass)',
                      color: 'var(--text-primary)', transition: 'all 0.15s',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: t.color + '30', border: `1.5px solid ${t.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 800, color: t.color,
                      }}>
                        {t.hora_inicio.slice(0, 5)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {t.hora_inicio.slice(0, 5)} — {t.hora_fin.slice(0, 5)}
                          {t.cruza_medianoche && <span style={{ color: '#fbbf24', marginLeft: 4 }}> ☾ +1 día</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? t.color : 'var(--text-muted)' }}>
                        {horas}h
                      </div>
                      {isSelected && <div style={{ fontSize: '0.7rem', color: t.color }}>✓ seleccionado</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview del turno seleccionado */}
        {selectedTpl && (
          <div style={{
            marginBottom: '1rem', padding: '0.625rem 0.875rem',
            background: selectedTpl.color + '12', border: `1px solid ${selectedTpl.color}40`,
            borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)',
          }}>
            ⏱ Duración: <strong style={{ color: 'var(--text-primary)' }}>{calcHoras(selectedTpl)} horas</strong>
            {' · '}Valor estimado: <strong style={{ color: 'var(--cw-success)', fontFamily: 'var(--font-mono)' }}>
              {formatCOP((parseFloat(calcHoras(selectedTpl)) || 0) * (employee.valor_hora || 0))}
            </strong>
          </div>
        )}

        <div className="cw-modal__footer">
          {existingShift && (
            <button className="cw-btn cw-btn--danger cw-btn--sm"
              onClick={() => {
                if (window.confirm('¿Estás seguro de que deseas eliminar este turno?')) {
                  onDelete(existingShift.id);
                  onClose();
                }
              }}>
              <MdDelete /> Quitar turno
            </button>
          )}
          <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="cw-btn cw-btn--primary" onClick={handleSave}
            disabled={!selected || loading}>
            {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</> : '✅ Asignar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal confirmación limpiar período ──────────────────────────────────────
function ClearModal({ areas, employees, dias, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [scopeType, setScopeType] = useState('all'); // 'all', 'area', 'employee'
  const [scopeId, setScopeId] = useState('');
  const [rangeType, setRangeType] = useState('current_view'); // 'current_view', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleConfirm = async () => {
    if (rangeType === 'custom' && (!customStart || !customEnd)) {
      alert('Por favor selecciona la fecha de inicio y fin.');
      return;
    }
    if (scopeType !== 'all' && !scopeId) {
      alert('Por favor selecciona el área o trabajador.');
      return;
    }

    if (!window.confirm('⚠️ ¿Estás COMPLETAMENTE SEGURO de querer limpiar estos turnos? Esta acción eliminará permanentemente la programación seleccionada y NO se puede deshacer.')) {
      return;
    }

    setLoading(true);
    await onConfirm({ scopeType, scopeId, rangeType, customStart, customEnd });
    setLoading(false);
    onClose();
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 460 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title" style={{ color: '#fca5a5' }}>
            <MdDeleteSweep style={{ marginRight: '0.5rem', fontSize: '1.25rem' }} />
            Limpiar Programación
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        <div className="cw-form-group">
          <label className="cw-label">¿A quiénes aplicar?</label>
          <select className="cw-select" value={scopeType} onChange={e => { setScopeType(e.target.value); setScopeId(''); }}>
            <option value="all">Toda la empresa</option>
            <option value="area">Un área específica</option>
            <option value="employee">Un trabajador específico</option>
          </select>
        </div>

        {scopeType === 'area' && (
          <div className="cw-form-group">
            <label className="cw-label">Seleccionar Área</label>
            <select className="cw-select" value={scopeId} onChange={e => setScopeId(e.target.value)}>
              <option value="">-- Elige un área --</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        )}

        {scopeType === 'employee' && (
          <div className="cw-form-group">
            <label className="cw-label">Seleccionar Trabajador</label>
            <select className="cw-select" value={scopeId} onChange={e => setScopeId(e.target.value)}>
              <option value="">-- Elige un trabajador --</option>
              {[...employees].sort((a,b) => a.nombre.localeCompare(b.nombre)).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        )}

        <div className="cw-form-group">
          <label className="cw-label">Rango de fechas a limpiar</label>
          <select className="cw-select" value={rangeType} onChange={e => setRangeType(e.target.value)}>
            <option value="current_view">Vista actual ({dias.length > 0 ? `${formatFecha(dias[0])} al ${formatFecha(dias[dias.length-1])}` : '...'})</option>
            <option value="custom">Rango personalizado...</option>
          </select>
        </div>

        {rangeType === 'custom' && (
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

        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', marginTop: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <MdWarning style={{ color: '#fca5a5', fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.875rem' }}>
                Atención: Esta acción es permanente
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Se eliminarán todos los turnos que coincidan con tus selecciones. No se podrán recuperar.
              </p>
            </div>
          </div>
        </div>

        <div className="cw-modal__footer">
          <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="cw-btn cw-btn--danger" onClick={handleConfirm} disabled={loading}>
            {loading ? <><span className="cw-spinner cw-spinner--sm"></span></> : <><MdDeleteSweep /> Eliminar Turnos</>}
          </button>
        </div>
      </div>
    </div>
  );
}



// ─── Celda de la rejilla ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function ShiftCell({ employee, fecha, shift, blocked, blockedReason, template, onAdd, isDayOff }) {
  const [showInfo, setShowInfo] = useState(false);

  // Día de descanso del área
  if (isDayOff) {
    return (
      <td style={{ padding: '0.2rem' }}>
        <div style={{
          minHeight: 32, borderRadius: 6, opacity: 0.25,
          background: 'repeating-linear-gradient(-45deg, var(--border-subtle), var(--border-subtle) 2px, transparent 2px, transparent 8px)',
          border: '1px dashed var(--border-subtle)',
        }} title="Día de descanso" />
      </td>
    );
  }

  // Novedad activa
  if (blocked) {
    return (
      <td style={{ padding: '0.2rem' }}>
        <div className="shift-cell shift-cell--blocked"
          onClick={() => setShowInfo(!showInfo)}
          title={blockedReason}
          style={{ position: 'relative', minHeight: 32, fontSize: '0.85rem' }}>
          🚫
          {showInfo && (
            <div style={{
              position: 'absolute', zIndex: 100, top: '110%', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
              borderRadius: 8, padding: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)',
              width: 190, boxShadow: 'var(--shadow-md)', whiteSpace: 'normal', textAlign: 'left',
            }}>
              <span style={{ color: '#fca5a5', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                <MdInfo style={{ verticalAlign: 'middle' }} /> Novedad
              </span>
              {blockedReason}
            </div>
          )}
        </div>
      </td>
    );
  }

  // Turno asignado
  if (shift) {
    const color = template?.color || '#6366f1';
    const nombreCorto = template?.nombre || 'Turno';
    // Abreviatura: primeras 2 palabras o primeras 4 letras
    const abrev = nombreCorto.length > 8
      ? nombreCorto.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
      : nombreCorto;
    const inicio = template?.hora_inicio?.slice(0, 5) || shift.start_time?.slice(11, 16);
    const fin = template?.hora_fin?.slice(0, 5) || shift.end_time?.slice(11, 16);
    return (
      <td style={{ padding: '0.2rem' }}>
        <div onClick={onAdd}
          title={`${nombreCorto} · ${inicio} a ${fin}`}
          style={{
            borderRadius: 6, padding: '0.25rem 0.2rem', fontSize: '0.65rem', fontWeight: 700,
            textAlign: 'center', cursor: 'pointer', minHeight: 32, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: color + '28', border: `1.5px solid ${color}70`, color: 'var(--text-primary)',
            transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
          }}>
          {/* barra superior de color */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '6px 6px 0 0' }} />
          <div style={{ marginTop: 2, fontWeight: 800, letterSpacing: '-0.3px', color }}>{abrev}</div>
          <div style={{ fontSize: '0.58rem', opacity: 0.75, fontWeight: 400 }}>{inicio} - {fin}</div>
        </div>
      </td>
    );
  }

  // Celda vacía (se puede asignar)
  return (
    <td style={{ padding: '0.2rem' }}>
      <div className="shift-cell shift-cell--empty" onClick={onAdd}
        title="Click para asignar turno"
        style={{ minHeight: 32, fontSize: '1rem', opacity: 0.4 }}>
        +
      </div>
    </td>
  );
}

// ─── Leyenda de plantillas ────────────────────────────────────────────────────
function TemplatesLegend({ templates }) {
  if (!templates.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TURNOS:</span>
      {templates.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          background: t.color + '18', border: `1px solid ${t.color}50`,
          borderRadius: 100, padding: '0.2rem 0.6rem', fontSize: '0.72rem',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.nombre}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
const DIAS_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function SchedulingPage() {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [selectedAreaId, setSelectedAreaId] = useState('all');
  const [viewMode, setViewMode] = useState(() => {
    const today = new Date();
    const d = today.getDate();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
    const weekIndex = Math.floor(((startDow - 1) + (d - 1)) / 7) + 1;
    return `weekly_${weekIndex}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alfabetico');
  const [shiftModal, setShiftModal] = useState(null);
  const [autoAssignModal, setAutoAssignModal] = useState(null); // Modal para opciones de auto-asignación
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);

  const periodos = useMemo(() => {
    const prevMes = mes === 1 ? 12 : mes - 1;
    const prevAnio = mes === 1 ? anio - 1 : anio;
    const nextMes = mes === 12 ? 1 : mes + 1;
    const nextAnio = mes === 12 ? anio + 1 : anio;
    return [
      `${prevAnio}-${String(prevMes).padStart(2, '0')}`,
      `${anio}-${String(mes).padStart(2, '0')}`,
      `${nextAnio}-${String(nextMes).padStart(2, '0')}`
    ];
  }, [mes, anio]);

  const { shifts, createShift, updateShift, deleteShift, autoAssignShifts, clearShiftsByPeriodo, clearShiftsByDateRange } = useShifts(periodos);
  const { employees } = useEmployees();
  const { absences, tieneNovedad, getNovedad } = useAbsences();
  const { areas } = useAreas();

  const diasTodos = getDiasMes(anio, mes);
  
  // Agrupar por semanas naturales (terminan en domingo, siempre 7 días)
  const naturalWeeks = useMemo(() => {
    const weeks = [];
    let currentWeek = [];
    diasTodos.forEach(d => {
      // pad missing days at start of month
      if (currentWeek.length === 0 && d.getDay() !== 1) { // 1 = Lunes
        const prevDaysCount = (d.getDay() === 0 ? 7 : d.getDay()) - 1;
        for (let i = prevDaysCount; i > 0; i--) {
          const prevDay = new Date(d);
          prevDay.setDate(d.getDate() - i);
          currentWeek.push(prevDay);
        }
      }
      currentWeek.push(d);
      if (d.getDay() === 0 || d.getDate() === diasTodos[diasTodos.length - 1].getDate()) {
        // pad missing days at end of month
        if (currentWeek[currentWeek.length - 1].getDay() !== 0) {
          const lastDow = currentWeek[currentWeek.length - 1].getDay();
          const nextDaysCount = 7 - (lastDow === 0 ? 7 : lastDow);
          for (let i = 1; i <= nextDaysCount; i++) {
             const nextDay = new Date(currentWeek[currentWeek.length - 1]);
             nextDay.setDate(nextDay.getDate() + 1);
             currentWeek.push(nextDay);
          }
        }
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    return weeks;
  }, [diasTodos]);

  let dias = diasTodos;
  if (viewMode === 'biweekly_1') {
    dias = diasTodos.filter(d => d.getDate() <= 15);
  } else if (viewMode === 'biweekly_2') {
    dias = diasTodos.filter(d => d.getDate() > 15);
  } else if (viewMode.startsWith('weekly_')) {
    const weekIdx = parseInt(viewMode.split('_')[1], 10) - 1;
    dias = naturalWeeks[weekIdx] || diasTodos;
  }

  // Área seleccionada (objeto completo)
  const selectedArea = selectedAreaId !== 'all' ? areas.find(a => a.id === selectedAreaId) : null;

  // Días de trabajo del área seleccionada (1=Lun...7=Dom)
  const diasTrabajoArea = selectedArea?.dias_trabajo || [1, 2, 3, 4, 5, 6, 7];

  // Plantillas del área seleccionada — cargadas reactivamente
  const [areaTemplates, setAreaTemplates] = useState([]);
  useEffect(() => {
    if (selectedAreaId && selectedAreaId !== 'all') {
      supabase.from('shift_templates')
        .select('*')
        .eq('area_id', selectedAreaId)
        .eq('activo', true)
        .order('hora_inicio')
        // eslint-disable-next-line react-hooks/set-state-in-effect
        .then(({ data }) => setAreaTemplates(data || []));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAreaTemplates([]);
    }
  }, [selectedAreaId, shifts]); // re-fetch cuando cambian turnos (post auto-asignar)

  // Caché de todas las plantillas de todas las áreas para resolver colores
  const [allTemplatesMap, setAllTemplatesMap] = useState({}); // id -> template
  useEffect(() => {
    supabase.from('shift_templates').select('*').eq('activo', true).then(({ data }) => {
      const map = {};
      (data || []).forEach(t => { map[t.id] = t; });
      setAllTemplatesMap(map);
    });
  }, []);

  // Empleados filtrados por área, búsqueda y ordenamiento
  const filteredEmployees = useMemo(() => {
    let result = employees;
    
    // 1. Filtrar por área
    if (selectedAreaId !== 'all') {
      const area = areas.find(a => a.id === selectedAreaId);
      if (area) {
        const areaEmpIds = area.area_employees?.map(ae => ae.employee_id) || [];
        result = result.filter(e => areaEmpIds.includes(e.id));
      }
    }

    // 2. Filtrar por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.nombre?.toLowerCase().includes(term) || 
        e.cedula?.toLowerCase().includes(term)
      );
    }

    // 3. Ordenar
    result = [...result].sort((a, b) => {
      if (sortBy === 'alfabetico') {
        return (a.nombre || '').localeCompare(b.nombre || '');
      } else if (sortBy === 'salario_desc') {
        return (b.valor_hora || 0) - (a.valor_hora || 0);
      } else if (sortBy === 'area') {
        const getAreaName = (empId) => areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId))?.nombre || '';
        const areaA = getAreaName(a.id);
        const areaB = getAreaName(b.id);
        if (areaA === areaB) {
          return (a.nombre || '').localeCompare(b.nombre || '');
        }
        return areaA.localeCompare(areaB);
      }
      return 0;
    });

    return result;
  }, [selectedAreaId, areas, employees, searchTerm, sortBy]);

  // Turno de un empleado en una fecha
  const getShiftForEmployeeDate = (empId, dateStr) =>
    shifts.find(s => s.employee_id === empId && s.start_time.startsWith(dateStr));

  // Área de un empleado
  const getEmployeeArea = (empId) =>
    areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId));

  // Plantillas del área de un empleado
  const getTemplatesForEmployee = (empId) => {
    const area = getEmployeeArea(empId);
    if (!area) return [];
    return Object.values(allTemplatesMap).filter(t => t.area_id === area.id);
  };

  // Horas acumuladas por empleado en el período (para tooltip)
  const horasPorEmpleado = useMemo(() => {
    const map = {};
    shifts.forEach(s => {
      if (!s.employee_id) return;
      const horas = (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
      map[s.employee_id] = (map[s.employee_id] || 0) + horas;
    });
    return map;
  }, [shifts]);

  // ── Auto-asignar ──────────────────────────────────────────────────────────
  const handleAutoAssign = async (scope, strategyOptions) => {
    setAutoAssignLoading(true);
    setAutoResult(null);
    try {
      const areasToProcess = scope === 'all'
        ? areas
        : areas.filter(a => a.id === scope);

      let totalInserted = 0;
      let allAlertaDias = [];
      let erroresValidacion = [];

      let processedDays = diasTodos;
      if (strategyOptions.dateRangeOption === 'current_view') {
        processedDays = dias;
      } else if (strategyOptions.dateRangeOption === 'next_week') {
        const hoy = new Date();
        const nextMonday = new Date(hoy);
        nextMonday.setDate(hoy.getDate() + ((1 + 7 - hoy.getDay()) % 7 || 7));
        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextMonday.getDate() + 6);
        const nwDays = [];
        for (let d = new Date(nextMonday); d <= nextSunday; d.setDate(d.getDate() + 1)) {
           nwDays.push(new Date(d));
        }
        processedDays = nwDays;
      } else if (strategyOptions.dateRangeOption === 'custom') {
        const dStart = new Date(strategyOptions.customStart + 'T00:00:00');
        const dEnd = new Date(strategyOptions.customEnd + 'T00:00:00');
        const customDays = [];
        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
           customDays.push(new Date(d));
        }
        processedDays = customDays;
      }

      if (strategyOptions.reprogramar && processedDays.length > 0) {
        const dStartStr = format(processedDays[0], 'yyyy-MM-dd');
        const dEndStr = format(processedDays[processedDays.length - 1], 'yyyy-MM-dd');
        const empIdsToClear = areasToProcess.flatMap(a => a.area_employees?.map(ae => ae.employee_id) || []);
        if (empIdsToClear.length > 0) {
          await clearShiftsByDateRange(dStartStr, dEndStr, empIdsToClear);
        }
      }

      for (const area of areasToProcess) {
        const areaEmps = area.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
        if (!areaEmps.length) {
          erroresValidacion.push(`${area.nombre}: Sin empleados asignados.`);
          continue;
        }

        const { data: templates } = await supabase
          .from('shift_templates').select('*').eq('area_id', area.id).eq('activo', true);

        if (!templates?.length) {
          erroresValidacion.push(`${area.nombre}: No tiene plantillas de turno configuradas.`);
          continue;
        }

        const empIds = areaEmps.map(e => e.id);
        const result = await autoAssignShifts({
          employees: areaEmps,
          templates,
          absences: absences.filter(a => empIds.includes(a.employee_id)),
          existingShifts: shifts.filter(s => empIds.includes(s.employee_id)),
          year: anio, month: mes,
          diasTrabajo: area.dias_trabajo || [1, 2, 3, 4, 5],
          strategyOptions, // Pasa las opciones (tipo estrategia, días procesables)
          diasToProcess: processedDays // Pasamos processedDays, que incluye custom ranges
        });
        
        if (result.error) {
          throw new Error(`Error en base de datos: ${result.error}`);
        }

        totalInserted += result.inserted;
        allAlertaDias = [...new Set([...allAlertaDias, ...result.alertaDias])];
      }

      setAutoResult({ inserted: totalInserted, alertaDias: allAlertaDias, scope, warn: erroresValidacion.join(' | ') });
    } catch (err) {
      setAutoResult({ error: err.message });
    } finally {
      setAutoAssignLoading(false);
    }
  };

  // ── Limpiar período ───────────────────────────────────────────────────────
  const handleClearPeriod = async (options) => {
    const { scopeType, scopeId, rangeType, customStart, customEnd } = options;
    
    let empIds = [];
    if (scopeType === 'area') {
      const area = areas.find(a => a.id === scopeId);
      empIds = area?.area_employees?.map(ae => ae.employee_id) || [];
    } else if (scopeType === 'employee') {
      empIds = [scopeId];
    } // si es 'all', empIds queda vacío (aplica a todos)

    let dStartStr, dEndStr;
    if (rangeType === 'custom') {
      dStartStr = customStart;
      dEndStr = customEnd;
    } else {
      // current_view
      if (dias.length === 0) return;
      dStartStr = format(dias[0], 'yyyy-MM-dd');
      dEndStr = format(dias[dias.length - 1], 'yyyy-MM-dd');
    }

    await clearShiftsByDateRange(dStartStr, dEndStr, empIds);
    setAutoResult(null);
  };

  // ── Navegación mes/semana ────────────────────────────────────────────────────────
  const handlePrev = () => {
    setAutoResult(null);
    if (viewMode === 'monthly') {
      if (mes === 1) { setMes(12); setAnio(anio - 1); } else setMes(mes - 1);
    } else if (viewMode === 'biweekly_1') {
      setViewMode('biweekly_2');
      if (mes === 1) { setMes(12); setAnio(anio - 1); } else setMes(mes - 1);
    } else if (viewMode === 'biweekly_2') {
      setViewMode('biweekly_1');
    } else if (viewMode.startsWith('weekly_')) {
      const wIdx = parseInt(viewMode.split('_')[1], 10);
      if (wIdx > 1) {
        setViewMode(`weekly_${wIdx - 1}`);
      } else {
        const prevMes = mes === 1 ? 12 : mes - 1;
        const prevAnio = mes === 1 ? anio - 1 : anio;
        setMes(prevMes);
        setAnio(prevAnio);
        const prevDiasTodos = getDiasMes(prevAnio, prevMes);
        let prevWeeksCount = 0;
        prevDiasTodos.forEach(d => {
          if (d.getDay() === 0 || d.getDate() === prevDiasTodos[prevDiasTodos.length - 1].getDate()) {
            prevWeeksCount++;
          }
        });
        setViewMode(`weekly_${prevWeeksCount}`);
      }
    }
  };

  const handleNext = () => {
    setAutoResult(null);
    if (viewMode === 'monthly') {
      if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1);
    } else if (viewMode === 'biweekly_1') {
      setViewMode('biweekly_2');
    } else if (viewMode === 'biweekly_2') {
      setViewMode('biweekly_1');
      if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1);
    } else if (viewMode.startsWith('weekly_')) {
      const wIdx = parseInt(viewMode.split('_')[1], 10);
      if (wIdx < naturalWeeks.length) {
        setViewMode(`weekly_${wIdx + 1}`);
      } else {
        setViewMode('weekly_1');
        if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1);
      }
    }
  };

  const handleToday = () => {
    setAutoResult(null);
    const today = new Date();
    setAnio(today.getFullYear());
    setMes(today.getMonth() + 1);
    setViewMode('weekly_1');
  };

  // ── Verificar si un día es de descanso para el área seleccionada ──────────
  const isDayOffForArea = (dia) => {
    if (!selectedArea) return false; // "Todas" no filtra días
    const dow = dia.getDay() === 0 ? 7 : dia.getDay(); // 1=Lun...7=Dom
    return !diasTrabajoArea.includes(dow);
  };

  // Contar turnos asignados del período
  const turnosAsignados = shifts.length;
  const diasSinCobertura = dias.filter(dia => {
    if (isDayOffForArea(dia)) return false;
    const dateStr = format(dia, 'yyyy-MM-dd');
    return !filteredEmployees.some(emp => getShiftForEmployeeDate(emp.id, dateStr));
  }).length;

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '100%' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'block', marginBottom: '1.25rem' }}>
        <div className="page-header__info" style={{ marginBottom: '1rem' }}>
          <h1 className="page-title">📅 Programación de Turnos</h1>
          <p className="page-subtitle">
            Gestión visual de turnos por área · CST Colombia 2026 (máx 42h/sem)
          </p>
        </div>

        {/* Toolbar */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          background: 'var(--bg-glass)', padding: '0.8rem 1rem', borderRadius: 10,
          border: '1px solid var(--border-subtle)'
        }}>
          {/* Selector de Mes y Año explícito */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <select 
              value={mes} 
              onChange={e => { setMes(Number(e.target.value)); setAutoResult(null); }} 
              className="cw-input" 
              style={{ width: 'auto', padding: '0.45rem 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={i+1}>{getNombreMes(i+1)}</option>
              ))}
            </select>
            <select 
              value={anio} 
              onChange={e => { setAnio(Number(e.target.value)); setAutoResult(null); }} 
              className="cw-input" 
              style={{ width: 'auto', padding: '0.45rem 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {[anio-2, anio-1, anio, anio+1, anio+2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="cw-btn cw-btn--secondary" onClick={handleToday} style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}>Hoy</button>
          </div>

          <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

          {/* Controles de vista (Semana/Quincena/Mes) con flechas adjuntas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'var(--bg-primary)', borderRadius: '8px', padding: '0.2rem', border: '1px solid var(--border-medium)' }}>
            <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={handlePrev} title="Anterior" style={{ border: 'none', background: 'transparent' }}><MdChevronLeft size={20} /></button>
            <select className="cw-input"
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.5rem', width: 'auto', minWidth: 150, border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--cw-accent)' }}
              value={viewMode}
              onChange={e => { setViewMode(e.target.value); setAutoResult(null); }}>
              <option value="monthly">📅 Mes completo</option>
              <option value="biweekly_1">📅 Quincena 1 (1-15)</option>
              <option value="biweekly_2">📅 Quincena 2 (16-fin)</option>
              {naturalWeeks.map((w, i) => (
                <option key={i} value={`weekly_${i + 1}`}>
                  📅 Sem {i + 1} ({w[0].getDate()} al {w[w.length - 1].getDate()})
                </option>
              ))}
            </select>
            <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={handleNext} title="Siguiente" style={{ border: 'none', background: 'transparent' }}><MdChevronRight size={20} /></button>
          </div>

          <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

          {/* Filtro área */}
          <select className="cw-input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', width: 'auto', minWidth: 160 }}
            value={selectedAreaId}
            onChange={e => { setSelectedAreaId(e.target.value); setAutoResult(null); }}>
            <option value="all">🏢 Todas las áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>● {a.nombre}</option>
            ))}
          </select>

          {/* Barra de Búsqueda */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '0.2rem 0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Buscar colaborador..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: 140 }}
            />
          </div>

          {/* Filtro Ordenar */}
          <select className="cw-input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', width: 'auto', minWidth: 140 }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}>
            <option value="alfabetico">🔤 Orden Alfabético</option>
            <option value="area">🏢 Agrupar por Área</option>
            <option value="salario_desc">💰 Mayor Salario</option>
          </select>

          <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

          {/* Auto-asignar */}
          <button className="cw-btn cw-btn--primary" onClick={() => setAutoAssignModal(selectedAreaId)}
            disabled={autoAssignLoading}
            title="Asignar turnos automáticamente">
            {autoAssignLoading ? <span className="cw-spinner cw-spinner--sm"></span> : <MdBolt />}
            Auto-asignar...
          </button>

          {/* Limpiar período */}
          <button className="cw-btn cw-btn--danger" onClick={() => setShowClearModal(true)}
            title={`Eliminar todos los turnos de ${getNombreMes(mes)} ${anio}${selectedArea ? ` (${selectedArea.nombre})` : ''}`}
            disabled={turnosAsignados === 0}>
            <MdDeleteSweep /> Limpiar
          </button>
        </div>
      </div>

      {/* ── Estadísticas rápidas ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Turnos asignados:</span>
          <strong style={{ color: 'var(--cw-accent)' }}>{turnosAsignados}</strong>
        </div>
        <div style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Colaboradores:</span>
          <strong style={{ color: 'var(--text-primary)' }}>{filteredEmployees.length}</strong>
        </div>
        {diasSinCobertura > 0 && (
          <div style={{
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <MdWarning style={{ color: '#fbbf24' }} />
            <span style={{ color: '#fcd34d' }}>
              <strong>{diasSinCobertura}</strong> días sin cobertura
            </span>
          </div>
        )}
        {selectedArea && (
          <div style={{
            background: selectedArea.color + '15', border: `1px solid ${selectedArea.color}40`,
            borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedArea.color }} />
            <span style={{ color: 'var(--text-muted)' }}>Días laborables:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {diasTrabajoArea.map(d => ['L', 'M', 'X', 'J', 'V', 'S', 'D'][d - 1]).join(' · ')}
            </strong>
          </div>
        )}
      </div>

      {/* ── Resultado auto-asignación ───────────────────────────────────────── */}
      {autoResult && (
        <div className={`cw-alert ${autoResult.error ? 'cw-alert--error' : autoResult.alertaDias?.length ? 'cw-alert--warning' : 'cw-alert--success'}`}
          style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {autoResult.error ? (
              <><MdWarning /> <span>🚫 {autoResult.error}</span></>
            ) : (
              <>
                {autoResult.alertaDias?.length ? <MdWarning style={{ color: '#fbbf24' }} /> : <MdCheckCircle style={{ color: '#10b981' }} />}
                <span>
                  <strong>{autoResult.inserted}</strong> turnos asignados para {getNombreMes(mes)} {anio}.
                  {autoResult.alertaDias?.length > 0 && (
                    <> &nbsp;⚠️ <strong style={{ color: '#fcd34d' }}>{autoResult.alertaDias.length} días sin cobertura completa</strong> — considera contratar más personal.</>
                  )}
                </span>
              </>
            )}
          </div>
          <button onClick={() => setAutoResult(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* ── Leyenda plantillas del área ─────────────────────────────────────── */}
      {areaTemplates.length > 0 && <TemplatesLegend templates={areaTemplates} />}

      {/* ── Rejilla ────────────────────────────────────────────────────────── */}
      {filteredEmployees.length === 0 ? (
        <div className="cw-card">
          <div className="empty-state">
            <div className="empty-state__icon"><MdCalendarMonth /></div>
            <div className="empty-state__title">
              {employees.length === 0 ? 'No hay empleados registrados' : 'Sin empleados en esta área'}
            </div>
            <div className="empty-state__desc">
              {employees.length === 0
                ? 'Registre empleados primero en la sección de Personal.'
                : 'Asigne empleados a esta área en la página de Áreas.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="cw-card" style={{ padding: '1rem' }}>
          <div className="shift-grid-wrapper">
            <table className="shift-grid">
              <thead>
                <tr>
                  {/* Columna empleado */}
                  <th style={{ minWidth: 170, textAlign: 'left', paddingLeft: '0.875rem', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      Colaborador
                    </div>
                  </th>
                  {/* Columnas de días */}
                  {dias.map(dia => {
                    const dow = dia.getDay(); // 0=Dom,6=Sab
                    const dowISO = dow === 0 ? 7 : dow; // 1=Lun...7=Dom
                    const esDom = dow === 0;
                    const esSab = dow === 6;
                    const isHoy = format(dia, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const isDayOff = selectedArea && !diasTrabajoArea.includes(dowISO);
                    return (
                      <th key={dia.toISOString()} style={{
                        minWidth: 42, textAlign: 'center',
                        color: isDayOff ? 'var(--text-muted)' : esDom ? '#fca5a5' : esSab ? '#fcd34d' : undefined,
                        opacity: isDayOff ? 0.4 : 1,
                        background: isHoy ? 'rgba(59,130,246,0.12)' : undefined,
                        borderBottom: isHoy ? '2px solid var(--cw-accent)' : undefined,
                        padding: '0.5rem 0.1rem',
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600 }}>
                          {DIAS_LABELS[(dow + 6) % 7]}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>{dia.getDate()}</div>
                        {isDayOff && <div style={{ fontSize: '0.5rem', opacity: 0.7 }}>🌙</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const empArea = getEmployeeArea(emp.id);
                  const empTemplates = getTemplatesForEmployee(emp.id);
                  const horasTotal = horasPorEmpleado[emp.id] || 0;
                  const porcentajeHoras = Math.min((horasTotal / (42 * 4)) * 100, 100); // 42h × 4 semanas
                  const horasColor = horasTotal > 160 ? '#ef4444' : horasTotal > 130 ? '#f59e0b' : '#10b981';

                  return (
                    <tr key={emp.id}>
                      {/* Celda empleado — sticky */}
                      <td className="shift-grid__employee-cell"
                        style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, borderRight: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {empArea && (
                            <div style={{ width: 7, height: 32, borderRadius: 4, background: empArea.color, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="shift-grid__employee-name" title={emp.nombre}
                              style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.nombre}
                            </div>
                            <div className="shift-grid__employee-cargo" style={{ fontSize: '0.68rem' }}>{emp.cargo}</div>
                            {/* Barra de horas */}
                            <div title={`${horasTotal.toFixed(0)}h en el período`}
                              style={{ marginTop: '0.2rem', height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${porcentajeHoras}%`, height: '100%', background: horasColor, borderRadius: 2, transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Celdas de días */}
                      {dias.map(dia => {
                        const dateStr = format(dia, 'yyyy-MM-dd');
                        const dow = dia.getDay() === 0 ? 7 : dia.getDay();
                        const shift = getShiftForEmployeeDate(emp.id, dateStr);
                        const novedad = tieneNovedad(emp.id, dateStr);
                        const novedadInfo = novedad ? getNovedad(emp.id, dateStr) : null;
                        const blockedReason = novedadInfo
                          ? `${novedadInfo.tipo}: ${novedadInfo.fecha_inicio} al ${novedadInfo.fecha_fin}` : '';

                        // Resolver plantilla del turno para mostrar color correcto
                        let shiftTemplate = null;
                        if (shift) {
                          if (shift.template_id && allTemplatesMap[shift.template_id]) {
                            shiftTemplate = allTemplatesMap[shift.template_id];
                          } else {
                            // Fallback: buscar por hora de inicio
                            const startHour = shift.start_time?.slice(11, 16);
                            shiftTemplate = empTemplates.find(t => t.hora_inicio.slice(0, 5) === startHour) || null;
                          }
                        }

                        // ¿Es día de descanso del área del empleado?
                        const empDiasDescanso = empArea?.dias_trabajo || null;
                        const isDayOff = empDiasDescanso ? !empDiasDescanso.includes(dow) : false;

                        return (
                          <ShiftCell
                            key={dateStr}
                            employee={emp}
                            fecha={dia}
                            shift={shift}
                            blocked={novedad}
                            blockedReason={blockedReason}
                            template={shiftTemplate}
                            isDayOff={isDayOff}
                            onAdd={() => setShiftModal({
                              employee: emp,
                              fecha: dia,
                              areaId: empArea?.id,
                              areaTemplates: empTemplates,
                              existingShift: shift,
                            })}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Leyenda inferior */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span>🌙 Día de descanso del área</span>

            <span>🚫 Novedad (licencia/vacación)</span>
            <span style={{ color: '#fca5a5' }}>Dom</span>
            <span style={{ color: '#fcd34d' }}>Sáb</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 12, height: 3, background: 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)', borderRadius: 2 }} />
              Barra de horas (verde = normal, amarillo = alto, rojo = límite 42h/sem)
            </span>
          </div>
        </div>
      )}

      {/* ── Modal turno ──────────────────────────────────────────────────────── */}
      {shiftModal && (
        <ShiftModal
          employee={shiftModal.employee}
          fecha={shiftModal.fecha}
          areaId={shiftModal.areaId}
          areaTemplates={shiftModal.areaTemplates || []}
          existingShift={shiftModal.existingShift}
          onClose={() => setShiftModal(null)}
          onSave={async (data) => {
            if (shiftModal.existingShift) {
              await updateShift(shiftModal.existingShift.id, data);
            } else {
              await createShift(data);
            }
          }}
          onDelete={deleteShift}
        />
      )}

      {/* ── Modal Auto-asignar ─────────────────────────────────────────── */}
      {autoAssignModal && (
        <AutoAssignModal
          scope={autoAssignModal}
          areas={areas}
          onClose={() => setAutoAssignModal(null)}
          onConfirm={handleAutoAssign}
        />
      )}

      {/* ── Modal limpiar período ─────────────────────────────────────────── */}
      {showClearModal && (
        <ClearModal
          areas={areas}
          employees={employees}
          dias={dias}
          onClose={() => setShowClearModal(false)}
          onConfirm={handleClearPeriod}
        />
      )}
    </div>
  );
}
