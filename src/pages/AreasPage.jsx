// ============================================================
// ChronosWork — Página de Gestión de Áreas
// Con AreaForm v3 (wizard 3 pasos) + Bulk Import
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import { useAreas } from '../hooks/useAreas';
import { useEmployees } from '../hooks/useEmployees';
import { useShiftTemplates } from '../hooks/useShiftTemplates';
import { useShifts } from '../hooks/useShifts';
import { useAbsences } from '../hooks/useAbsences';
import {
  MdAdd, MdEdit, MdDelete, MdClose,
  MdBolt, MdDomain, MdWarning, MdUpload, MdInfo, MdPeople,
} from 'react-icons/md';
import BulkImportAreasModal from '../components/BulkImportAreasModal';
import { getPeriodoActual, getDatesByOption, toISODay } from '../core/dateUtils';
import { format } from 'date-fns';
import { AutoAssignModal } from '../components/AutoAssignModal';
import { DemandCurveEditor } from '../components/DemandCurveEditor';
import { LaborLimitsConfig } from '../components/LaborLimitsConfig';
import { BreakPolicyConfig } from '../components/BreakPolicyConfig';
import { CollapsibleSection } from '../components/CollapsibleSection';
import AreaForm from '../components/AreaForm';
import TemplateModal from '../components/TemplateModal.jsx';

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

// ── Helpers de jornada para UI ──────────────────────────────────────
function getJornadaBadge(emp) {
  if (emp.solo_nocturno || emp.jornada_preferida === 'NOCTURNA') {
    return { icon: '🌙', label: 'Nocturno', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' };
  }
  if (emp.solo_diurno || emp.jornada_preferida === 'DIURNA') {
    return { icon: '☀️', label: 'Diurno', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  }
  if (emp.jornada_preferida === 'MIXTA') {
    return { icon: '🌓', label: 'Mixto', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
  }
  return { icon: '🔄', label: 'Cualquiera', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
}

// ── Panel de empleados del área ──────────────────────────────────
function EmployeeAssignPanel({ area, allEmployees, onAssign, onRemove, onJornadaUpdate, hideHeader }) {
  const areaEmployeeIds = area.area_employees?.map(ae => ae.employee_id) || [];
  const areaEmps = area.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
  const unassigned = allEmployees.filter(e => !areaEmployeeIds.includes(e.id));

  // Contadores de jornada para visibilidad rápida
  const nocturnoCount = areaEmps.filter(e => e.solo_nocturno || e.jornada_preferida === 'NOCTURNA').length;
  const diurnoCount = areaEmps.filter(e => e.solo_diurno || e.jornada_preferida === 'DIURNA').length;
  const mixtoCount = areaEmps.filter(e => e.jornada_preferida === 'MIXTA').length;
  const cualquieraCount = areaEmps.length - nocturnoCount - diurnoCount - mixtoCount;
  const is247 = area.modo_operacion === '24_7' || area.modo_operacion === '24_7_NIGHT_SPLIT';

  // Cambiar jornada preferida de un empleado directamente desde áreas
  const [updatingEmp, setUpdatingEmp] = useState(null);
  const handleJornadaChange = async (empId, nuevaJornada) => {
    setUpdatingEmp(empId);
    try {
      await supabase
        .from('employees')
        .update({
          jornada_preferida: nuevaJornada,
          solo_diurno:   nuevaJornada === 'DIURNA',
          solo_nocturno: nuevaJornada === 'NOCTURNA',
        })
        .eq('id', empId);
      // Refrescar los datos reactivamente sin recargar
      if (onJornadaUpdate) await onJornadaUpdate();
    } catch (e) {
      logger.error('AreasPage', 'Error actualizando jornada:', e);
    } finally {
      setUpdatingEmp(null);
    }
  };

  return (
    <div>
      {!hideHeader && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          👥 COLABORADORES ({areaEmps.length})
        </div>
        {/* Contador de jornadas */}
        {areaEmps.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {nocturnoCount > 0 && (
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 700 }}>
                🌙 {nocturnoCount}
              </span>
            )}
            {diurnoCount > 0 && (
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#d97706', fontWeight: 700 }}>
                ☀️ {diurnoCount}
              </span>
            )}
            {mixtoCount > 0 && (
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#059669', fontWeight: 700 }}>
                🌓 {mixtoCount}
              </span>
            )}
            {cualquieraCount > 0 && (
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(148,163,184,0.15)', color: '#64748b', fontWeight: 700 }}>
                🔄 {cualquieraCount}
              </span>
            )}
          </div>
        )}
      </div>
      )}

      {/* Alerta si área 24/7 sin empleados nocturnos */}
      {is247 && areaEmps.length > 0 && nocturnoCount === 0 && mixtoCount === 0 && (
        <div style={{
          marginBottom: '0.6rem', padding: '0.5rem 0.75rem',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 6, fontSize: '0.72rem', color: '#fca5a5',
        }}>
          ⚠️ Área 24/7 sin empleados nocturnos. Usa los botones 🌙 / 🌓 para asignar jornada a cada colaborador.
        </div>
      )}

      {/* Hint para el usuario en modo 24/7 */}
      {is247 && areaEmps.length > 0 && (
        <div style={{
          marginBottom: '0.6rem', padding: '0.4rem 0.75rem',
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 6, fontSize: '0.7rem', color: 'var(--text-muted)',
        }}>
          💡 Haz clic en 🌙 / 🌓 / ☀️ de cada colaborador para definir si trabaja de noche, mixto o solo de día.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {areaEmps.map(emp => {
          const badge = getJornadaBadge(emp);
          const jornada = emp.jornada_preferida || 'CUALQUIERA';
          const isUpdating = updatingEmp === emp.id;
          return (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '0.4rem 0.6rem',
            }}>
              {/* Barra de color del área */}
              <div style={{ width: 4, height: 28, borderRadius: 2, background: area.color, flexShrink: 0 }} />

              {/* Nombre */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {emp.nombre}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{emp.cargo}</div>
              </div>

              {/* Toggles de jornada — solo en modo 24/7 */}
              {is247 && (
                <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                  {[['NOCTURNA','🌙','rgba(99,102,241,0.2)','#6366f1'],
                    ['MIXTA','🌓','rgba(16,185,129,0.2)','#059669'],
                    ['DIURNA','☀️','rgba(245,158,11,0.2)','#d97706'],
                  ].map(([tipo, icon, bg, color]) => (
                    <button
                      key={tipo}
                      title={`${icon} ${tipo}`}
                      disabled={isUpdating}
                      onClick={() => handleJornadaChange(emp.id, jornada === tipo ? 'CUALQUIERA' : tipo)}
                      style={{
                        fontSize: '0.78rem', padding: '0.2rem 0.35rem', borderRadius: 6,
                        border: `1.5px solid ${jornada === tipo ? color : 'var(--border-subtle)'}`,
                        background: jornada === tipo ? bg : 'transparent',
                        cursor: isUpdating ? 'not-allowed' : 'pointer',
                        opacity: isUpdating ? 0.5 : 1,
                        transition: 'all 0.15s',
                        transform: jornada === tipo ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              )}

              {/* Badge jornada (modo no-247) */}
              {!is247 && (
                <span title={`Jornada: ${badge.label}`} style={{
                  fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                  background: badge.bg, color: badge.color, fontWeight: 700, flexShrink: 0,
                }}>
                  {badge.icon}
                </span>
              )}

              {/* Quitar empleado del área */}
              <button onClick={() => onRemove(emp.id)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '1rem', padding: '0 0.1rem', lineHeight: 1, flexShrink: 0,
              }}>×</button>
            </div>
          );
        })}
        {areaEmps.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Sin colaboradores asignados. Regístralos en Personal y asígnalos aquí.
          </span>
        )}
      </div>
      {unassigned.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Agregar colaborador:
          </div>
          <select className="cw-input" style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
            defaultValue=""
            onChange={e => { if (e.target.value) { onAssign(area.id, e.target.value); e.target.value = ''; } }}>
            <option value="" disabled>Seleccionar empleado...</option>
            {unassigned.map(e => (
              <option key={e.id} value={e.id}>{e.nombre} — {e.cargo}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Panel de plantillas de turno del área ──────────────────────────────────
function TemplatesPanel({ area, shifts, periodo, onAutoAssign, autoAssignLoading, embedded }) {
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useShiftTemplates(area.id);
  const { templates: globalTemplates } = useShiftTemplates('global');
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [hasDemandSlots, setHasDemandSlots] = useState(false);

  useEffect(() => {
    if (area?.id) {
      supabase
        .from('area_demand_slots')
        .select('id')
        .eq('area_id', area.id)
        .limit(1)
        .then(({ data }) => {
          setHasDemandSlots(!!data?.length);
        });
    } else {
      setHasDemandSlots(false);
    }
  }, [area.id, shifts]);

  const handleImport = async (globalTpl) => {
    await createTemplate({
      nombre: globalTpl.nombre,
      hora_inicio: globalTpl.hora_inicio,
      hora_fin: globalTpl.hora_fin,
      cruza_medianoche: globalTpl.cruza_medianoche,
      color: globalTpl.color,
      area_id: area.id,
    });
    setShowImport(false);
  };

  const cobertura = useMemo(() => {
    if (!area || !templates.length || !shifts) return null;
    let turnosTotales = 0;
    let turnosCubiertos = 0;
    let horasFaltantes = 0;

    const [y, m] = periodo.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const areaDias = area.dias_trabajo || [];

    const getLocalYYYYMMDD = (d) => {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(y, m - 1, i);
      const dow = toISODay(d);
      if (!areaDias.includes(dow)) continue;

      const dateStr = getLocalYYYYMMDD(d);

      templates.forEach(t => {
        turnosTotales++;
        const isCovered = shifts.some(s => s.template_id === t.id && getLocalYYYYMMDD(new Date(s.start_time)) === dateStr);
        if (isCovered) {
          turnosCubiertos++;
        } else {
          const hIni = new Date(`${dateStr}T${t.hora_inicio.slice(0,5)}:00`);
          const nextDay = new Date(d);
          if (t.cruza_medianoche) nextDay.setDate(nextDay.getDate() + 1);
          const hFin = new Date(`${getLocalYYYYMMDD(nextDay)}T${t.hora_fin.slice(0,5)}:00`);
          const diffHrs = (hFin - hIni) / 3600000;
          horasFaltantes += diffHrs;
        }
      });
    }

    const faltantes = turnosTotales - turnosCubiertos;
    const personalNecesario = Math.ceil(horasFaltantes / 182);

    return { turnosTotales, turnosCubiertos, faltantes, horasFaltantes, personalNecesario };
  }, [area, templates, shifts, periodo]);

  const getShiftKindIcon = (kind) => {
    const map = { STANDARD: '⏰', PARTIDO: '⏸️', ROTATIVO: '🔄', NOCTURNO: '🌙', DISPONIBILIDAD: '🛎️', CUSTOM: '🛠️' };
    return map[kind] || '⏰';
  };

  const is247Area = area.modo_operacion === '24_7' || area.modo_operacion === '24_7_NIGHT_SPLIT';

  // En áreas 24/7: el algoritmo genera turnos dinámicos — las franjas horarias
  // son opcionales (se usan como guia de color en la grilla pero no limitan la asignación)
  if (is247Area) {
    return (
      <div style={{ marginTop: embedded ? 0 : '1.25rem' }}>
        <div style={{
          padding: '0.875rem 1rem',
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d97706', marginBottom: '0.4rem' }}>
                Asignación dinámica (Algoritmo v4)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Esta área opera en modo <strong>24/7</strong>. El algoritmo genera los turnos automáticamente
                basado en la <strong>curva de demanda horaria</strong> y la <strong>jornada preferida</strong> de cada colaborador.
                No es necesario definir franjas manualmente.
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 600 }}>
                  🌙 Nocturnos → 22:00 a 06:00
                </div>
                <div style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 6, background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontWeight: 600 }}>
                  ☀️ Diurnos → 06:00 a 22:00
                </div>
                <div style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 600 }}>
                  🌓 Mixtos → Ambas franjas según déficit
                </div>
              </div>
              {templates.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Tienes {templates.length} franja{templates.length !== 1 ? 's' : ''} configurada{templates.length !== 1 ? 's' : ''} — se usarán
                  como referencia de color en la vista de grilla, pero el algoritmo puede generar turnos fuera de ellas.
                </div>
              )}
              <button
                className="cw-btn cw-btn--primary"
                style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.45rem 1rem' }}
                disabled={autoAssignLoading}
                onClick={() => onAutoAssign(area)}
              >
                {autoAssignLoading
                  ? <><span className="cw-spinner cw-spinner--sm" /> Asignando...</>
                  : <>🤖 Auto-asignar turnos</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: embedded ? 0 : '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {embedded ? `${templates.length} franja(s)` : `⏰ FRANJAS HORARIAS (${templates.length})`}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', position: 'relative' }}>
          {globalTemplates.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button className="cw-btn cw-btn--secondary cw-btn--sm" onClick={() => setShowImport(!showImport)}>
                Importar...
              </button>
              {showImport && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem', zIndex: 50,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                  borderRadius: 8, padding: '0.4rem', width: 240, boxShadow: 'var(--shadow-md)',
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', padding: '0 0.3rem' }}>
                    Desde Globales:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: 200, overflowY: 'auto' }}>
                    {globalTemplates.map(gt => (
                      <button key={gt.id} onClick={() => handleImport(gt)} style={{
                        background: 'transparent', border: 'none', textAlign: 'left',
                        padding: '0.4rem', borderRadius: 6, cursor: 'pointer',
                        fontSize: '0.78rem', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: gt.color }} />
                        {getShiftKindIcon(gt.shift_kind)} {gt.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button className="cw-btn cw-btn--secondary cw-btn--sm" onClick={() => { setEditTemplate(null); setShowModal(true); }}>
            <MdAdd style={{ fontSize: '0.9rem' }} /> Agregar
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
          Sin franjas horarias. Agrega al menos una para auto-asignar turnos.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {templates.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: t.color + '15', border: `1px solid ${t.color}40`,
              borderRadius: 8, padding: '0.5rem 0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {getShiftKindIcon(t.shift_kind)} {t.nombre}
                    {t.shift_kind && t.shift_kind !== 'STANDARD' && (
                      <span style={{
                        fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: 4,
                        background: t.color + '30', color: t.color, fontWeight: 700,
                      }}>{t.shift_kind}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t.hora_inicio.slice(0, 5)} — {t.hora_fin.slice(0, 5)}
                    {t.cruza_medianoche && ' (+1 día)'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="cw-btn cw-btn--secondary cw-btn--sm cw-btn--icon"
                  onClick={() => { setEditTemplate(t); setShowModal(true); }} title="Editar">
                  <MdEdit style={{ fontSize: '0.9rem' }} />
                </button>
                <button className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                  onClick={() => { if (window.confirm(`¿Eliminar la franja "${t.nombre}"? Esta acción no se puede deshacer.`)) deleteTemplate(t.id); }} title="Eliminar">
                  <MdDelete style={{ fontSize: '0.9rem' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cobertura && cobertura.faltantes > 0 && (
        <div style={{
          marginTop: '1rem', padding: '0.875rem', background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid #fca5a5', borderRadius: 8,
        }}>
          <h4 style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
            <MdWarning /> Faltan {cobertura.faltantes} turnos por cubrir en {periodo}
          </h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            Quedan por programar aprox. <strong>{Math.round(cobertura.horasFaltantes)} horas</strong>.
            <br />
            <span style={{ color: '#ef4444' }}>
              Equivale a ~<strong>{cobertura.personalNecesario} empleado{cobertura.personalNecesario !== 1 ? 's' : ''}</strong> a tiempo completo.
            </span>
          </div>
        </div>
      )}
      {cobertura && cobertura.faltantes === 0 && templates.length > 0 && (
        <div style={{
          marginTop: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid #6ee7b7', borderRadius: 8, fontSize: '0.75rem', color: '#059669',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          ✅ Todos los turnos de este mes están cubiertos.
        </div>
      )}

      <button
        className="cw-btn cw-btn--primary"
        style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
        onClick={() => onAutoAssign(area)}
        disabled={autoAssignLoading || (!templates.length && !hasDemandSlots) || !area.area_employees?.length}
        title={(!templates.length && !hasDemandSlots) ? 'Agrega franjas horarias o una curva de demanda primero' : !area.area_employees?.length ? 'Asigna empleados primero' : ''}
      >
        {autoAssignLoading ? (
          <><span className="cw-spinner cw-spinner--sm"></span> Asignando...</>
        ) : (
          <><MdBolt /> Asignar Turnos — {area.nombre}</>
        )}
      </button>

      {showModal && (
        <TemplateModal
          template={editTemplate}
          areaId={area.id}
          onClose={() => { setShowModal(false); setEditTemplate(null); }}
          onSave={editTemplate ? (data) => updateTemplate(editTemplate.id, data) : createTemplate}
        />
      )}
    </div>
  );
}

// ─── Panel de plantillas globales ──────────────────────────────────────────
function GlobalTemplatesPanel() {
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useShiftTemplates('global');
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);

  const getShiftKindIcon = (kind) => {
    const map = { STANDARD: '⏰', PARTIDO: '⏸️', ROTATIVO: '🔄', NOCTURNO: '🌙', DISPONIBILIDAD: '🛎️', CUSTOM: '🛠️' };
    return map[kind] || '⏰';
  };

  return (
    <div className="cw-card" style={{ padding: '1.25rem' }}>
      <h3 className="cw-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>🌐</span> Franjas Horarias Predeterminadas
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Estas franjas actúan como un catálogo. Se copiarán automáticamente a las nuevas áreas que crees,
        y podrás importarlas fácilmente a las áreas ya existentes para ahorrar tiempo.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          CATÁLOGO GLOBAL ({templates.length})
        </div>
        <button className="cw-btn cw-btn--primary cw-btn--sm" onClick={() => { setEditTemplate(null); setShowModal(true); }}>
          <MdAdd style={{ fontSize: '0.9rem' }} /> Agregar Predeterminada
        </button>
      </div>

      {templates.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 8 }}>
          No tienes franjas predeterminadas. Crea algunas para usarlas como molde en tus áreas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {templates.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: t.color + '15', border: `1px solid ${t.color}40`,
              borderRadius: 8, padding: '0.75rem 1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {getShiftKindIcon(t.shift_kind)} {t.nombre}
                    {t.shift_kind && t.shift_kind !== 'STANDARD' && (
                      <span style={{
                        fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: 4,
                        background: t.color + '30', color: t.color, fontWeight: 700,
                      }}>{t.shift_kind}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {t.hora_inicio.slice(0, 5)} — {t.hora_fin.slice(0, 5)}
                    {t.cruza_medianoche && ' (+1 día)'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="cw-btn cw-btn--secondary cw-btn--sm cw-btn--icon"
                  onClick={() => { setEditTemplate(t); setShowModal(true); }} title="Editar">
                  <MdEdit style={{ fontSize: '0.9rem' }} />
                </button>
                <button className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                  onClick={() => {
                    if (window.confirm('¿Seguro que deseas eliminar esta franja global? No afectará a las áreas que ya la copiaron.')) {
                      deleteTemplate(t.id);
                    }
                  }} title="Eliminar">
                  <MdDelete style={{ fontSize: '0.9rem' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateModal
          template={editTemplate}
          areaId={null}
          onClose={() => { setShowModal(false); setEditTemplate(null); }}
          onSave={editTemplate ? (data) => updateTemplate(editTemplate.id, data) : createTemplate}
        />
      )}
    </div>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────
export default function AreasPage() {
  const { areas, loading, createArea, updateArea, deleteArea, deleteAllAreas, assignEmployee, removeEmployee, fetchAreas } = useAreas();
  const { employees } = useEmployees();
  const { absences } = useAbsences();
  const periodoActual = getPeriodoActual();
  const { shifts, autoAssignShifts, clearShiftsByDateRange } = useShifts(periodoActual);

  const [selectedArea, setSelectedArea] = useState(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [autoAssignModalArea, setAutoAssignModalArea] = useState(null);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Seleccionar primera área por defecto
  useEffect(() => {
    if (areas.length && !selectedArea) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedArea(areas[0]);
    }
    if (selectedArea && selectedArea !== 'global') {
      const updated = areas.find(a => a.id === selectedArea.id);
      if (updated) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedArea(updated);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas]);

  const handleAutoAssign = async (scope, strategyOptions) => {
    setAutoAssignLoading(true);
    setAutoAssignResult(null);
    try {
      const area = areas.find(a => a.id === scope);
      if (!area) return;

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const areaEmps = area.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
      const empIds = areaEmps.map(e => e.id);

      // Cargar plantillas del área
      const { data: templates } = await supabase
        .from('shift_templates').select('*').eq('area_id', area.id).eq('activo', true);

      const areaAbsences = absences.filter(a => empIds.includes(a.employee_id));

      const processedDays = getDatesByOption(strategyOptions.dateRangeOption, strategyOptions.customStart, strategyOptions.customEnd);

      let finalEmployees = [...areaEmps];
      if (strategyOptions.onlyNewEmployees && processedDays.length > 0) {
        if (!(processedDays[0] instanceof Date) || isNaN(processedDays[0].getTime())) {
          throw new Error('Invalid time value: processedDays[0] is Invalid Date (onlyNewEmployees in AreasPage)');
        }
        const dStartStr = format(processedDays[0], 'yyyy-MM-dd');
        const dEndStr = format(processedDays[processedDays.length - 1], 'yyyy-MM-dd');

        const { data: existing } = await supabase
          .from('shifts')
          .select('employee_id')
          .in('employee_id', empIds)
          .gte('start_time', `${dStartStr}T00:00:00`)
          .lte('start_time', `${dEndStr}T23:59:59`);

        const empIdsWithShifts = new Set(existing?.map(s => s.employee_id) || []);
        finalEmployees = finalEmployees.filter(emp => !empIdsWithShifts.has(emp.id));

        if (finalEmployees.length === 0) {
          throw new Error('Todos los colaboradores ya tienen turnos programados en este período.');
        }
      }

      if (strategyOptions.reprogramar && processedDays.length > 0) {
        if (!(processedDays[0] instanceof Date) || isNaN(processedDays[0].getTime())) {
          throw new Error('Invalid time value: processedDays[0] is Invalid Date (reprogramar in AreasPage)');
        }
        const dStartStr = format(processedDays[0], 'yyyy-MM-dd');
        const dEndStr = format(processedDays[processedDays.length - 1], 'yyyy-MM-dd');
        if (empIds.length > 0) {
          await clearShiftsByDateRange(dStartStr, dEndStr, empIds);
        }
      }

      const areaShifts = shifts.filter(s => empIds.includes(s.employee_id));

      // v4.2: Activar config nocturna para CUALQUIER modo 24/7, igual que
      // SchedulingPage. Antes se requireía night_shift_enabled===true, lo que
      // dejaba áreas en modo 24_7 sin cobertura nocturna si el checkbox no estaba marcado.
      const areaEs247 = area.modo_operacion === '24_7' || area.modo_operacion === '24_7_NIGHT_SPLIT';
      const nightShiftConfig = areaEs247
        ? {
            enabled: true,
            start: area.night_shift_start || '22:00',
            end: area.night_shift_end || '06:00',
            employeeIds: area.night_shift_employee_ids || [],
          }
        : null;

      const result = await autoAssignShifts({
        employees: finalEmployees,
        templates: templates || [],
        absences: areaAbsences,
        existingShifts: areaShifts,
        year, month,
        diasTrabajo: areaEs247 ? [1, 2, 3, 4, 5, 6, 7] : (area.dias_trabajo || [1, 2, 3, 4, 5]),
        diasToProcess: processedDays,
        modoOperacion: area.modo_operacion || 'OFICINA',
        laborLimits: area.labor_limits || null,
        areaId: area.id,
        nightShiftConfig,
        patronRotativo: area.patron_rotativo || null,
      });
      setAutoAssignResult({ ...result, areaName: area.nombre });
    } catch (err) {
      setAutoAssignResult({ error: err.message });
    } finally {
      setAutoAssignLoading(false);
    }
  };

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Modal Bulk Import */}
      {showBulkModal && (
        <BulkImportAreasModal
          onClose={async (refresh) => {
            setShowBulkModal(false);
            if (refresh) await fetchAreas();
          }}
          onBulkSave={async (areaData) => {
            await createArea(areaData);
          }}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">🏢 Gestión de Áreas</h1>
          <p className="page-subtitle">
            Define departamentos, franjas horarias y asigna colaboradores · Catálogo laboral Colombia 2026
          </p>
        </div>
        <div className="page-header__actions">
          {areas.length > 0 && (
            <button
              className="cw-btn cw-btn--danger"
              onClick={() => setDeleteAllConfirm(true)}
              title="Eliminar todas las áreas"
            >
              <MdDelete /> Eliminar Todas
            </button>
          )}
          <button
            id="btn-bulk-import-areas"
            className="cw-btn cw-btn--secondary"
            onClick={() => setShowBulkModal(true)}
            title="Importar áreas y franjas desde Excel/CSV"
          >
            <MdUpload /> Importar Excel
          </button>
          <button
            id="btn-new-area"
            className="cw-btn cw-btn--primary"
            onClick={() => { setEditArea(null); setShowAreaModal(true); }}
          >
            <MdAdd /> Nueva Área
          </button>
        </div>
      </div>

      {/* Resultado auto-asignación */}
      {autoAssignResult && (
        <div className={`cw-alert ${autoAssignResult.error ? 'cw-alert--error' : autoAssignResult.alertaDias?.length ? 'cw-alert--warning' : 'cw-alert--success'}`}
          style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {autoAssignResult.error ? (
              <>🚫 Error: {autoAssignResult.error}</>
            ) : (
              <>
                {autoAssignResult.alertaDias?.length ? '⚠️' : '✅'}{' '}
                <strong>{autoAssignResult.areaName}</strong>: {autoAssignResult.inserted} turnos asignados.
                {autoAssignResult.alertaDias?.length > 0 && (
                  <> <span style={{ color: '#fbbf24' }}>⚠ Sin cobertura en {autoAssignResult.alertaDias.length} días — considera contratar más personal.</span></>
                )}
              </>
            )}
          </div>
          <button onClick={() => setAutoAssignResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="cw-spinner"></div><span>Cargando áreas...</span></div>
      ) : areas.length === 0 ? (
        <div className="cw-card">
          <div className="empty-state">
            <div className="empty-state__icon">🏢</div>
            <div className="empty-state__title">No hay áreas creadas</div>
            <div className="empty-state__desc">
              Crea la primera área de tu empresa. Solo necesitas el nombre — el sistema
              autollenará salario, jornada, franjas y tipo de contrato según el sector que elijas.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="cw-btn cw-btn--secondary" onClick={() => setShowBulkModal(true)}>
                <MdUpload /> Importar desde Excel
              </button>
              <button className="cw-btn cw-btn--primary" onClick={() => { setEditArea(null); setShowAreaModal(true); }}>
                <MdAdd /> Crear primera área
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Lista de áreas y Globales */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              onClick={() => setSelectedArea('global')}
              style={{
                padding: '0.875rem 1rem', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${selectedArea === 'global' ? '#8b5cf6' : 'var(--border-subtle)'}`,
                background: selectedArea === 'global' ? '#8b5cf618' : 'var(--bg-glass)',
                transition: 'all 0.15s ease',
              }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: selectedArea === 'global' ? '#8b5cf6' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🌐</span> Franjas Globales
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Moldes para nuevas áreas
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

            {areas.map(area => {
              const empCount = area.area_employees?.length || 0;
              const isSelected = selectedArea?.id === area.id;
              return (
                <div key={area.id}
                  onClick={() => setSelectedArea(area)}
                  style={{
                    padding: '0.875rem 1rem', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${isSelected ? area.color : 'var(--border-subtle)'}`,
                    background: isSelected ? area.color + '18' : 'var(--bg-glass)',
                    transition: 'all 0.15s ease',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: area.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{area.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {empCount} colaborador{empCount !== 1 ? 'es' : ''}
                        {area.modo_operacion === '24_7' && (
                          <span style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 4, padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 700 }}>24/7</span>
                        )}
                        {area.sector && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            · {area.sector}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem' }} onClick={e => e.stopPropagation()}>
                    <button className="cw-btn cw-btn--secondary cw-btn--sm cw-btn--icon"
                      onClick={() => { setEditArea(area); setShowAreaModal(true); }}
                      title="Editar área">
                      <MdEdit style={{ fontSize: '0.85rem' }} />
                    </button>
                    <button className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                      onClick={() => setDeleteConfirm(area)}
                      title="Eliminar área">
                      <MdDelete style={{ fontSize: '0.85rem' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Panel detalle */}
          {selectedArea === 'global' ? (
            <GlobalTemplatesPanel />
          ) : selectedArea ? (
            <div className="cw-card">
              <div className="cw-card__header">
                <h3 className="cw-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: selectedArea.color }} />
                  {selectedArea.nombre}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(selectedArea.dias_trabajo || []).map(d => {
                    const dia = DIAS_SEMANA.find(x => x.value === d);
                    return dia ? (
                      <span key={d} style={{
                        fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: 12,
                        background: selectedArea.color + '25', color: 'var(--text-primary)', fontWeight: 600,
                      }}>{dia.label}</span>
                    ) : null;
                  })}
                </div>
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                {selectedArea.descripcion && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    {selectedArea.descripcion}
                  </p>
                )}

                {/* Resumen del área con datos laborales */}
                <div style={{
                  marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: 8,
                  background: selectedArea.modo_operacion === '24_7' ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.06)',
                  border: `1px solid ${selectedArea.modo_operacion === '24_7' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.25)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{selectedArea.modo_operacion === '24_7' ? '🔄' : '🏢'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {selectedArea.modo_operacion === '24_7' ? 'Operación 24/7' : 'Horario de Oficina'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {selectedArea.modo_operacion === '24_7'
                          ? 'Cobertura 7 días · Dom/Festivos incluidos · Recargos CST automáticos (HON, HOD, HCDN)'
                          : `${(selectedArea.dias_trabajo || []).length} días laborables · Máx. 42h/semana (Ley 2101/2021)`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {selectedArea.sector && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Sector:</span>{' '}
                        <strong>{selectedArea.sector}</strong>
                      </div>
                    )}
                    {selectedArea.tipo_contrato_predominante && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Contrato:</span>{' '}
                        <strong>{selectedArea.tipo_contrato_predominante}</strong>
                      </div>
                    )}
                    {selectedArea.valor_hora_default && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Valor hora:</span>{' '}
                        <strong>${parseFloat(selectedArea.valor_hora_default).toLocaleString('es-CO')}</strong>
                      </div>
                    )}
                    {selectedArea.nivel_riesgo_arl && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>ARL:</span>{' '}
                        <strong>Nivel {selectedArea.nivel_riesgo_arl}</strong>
                      </div>
                    )}
                    {selectedArea.patron_rotativo && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Patrón:</span>{' '}
                        <strong>{selectedArea.patron_rotativo}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Empleados del área — colapsable */}
                <CollapsibleSection
                  title="👥 Colaboradores"
                  right={<span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 20, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{selectedArea.area_employees?.length || 0}</span>}
                >
                  <EmployeeAssignPanel
                    area={selectedArea}
                    allEmployees={employees}
                    onAssign={assignEmployee}
                    onRemove={removeEmployee}
                    onJornadaUpdate={fetchAreas}
                    hideHeader
                  />
                </CollapsibleSection>

                {/* Franjas horarias — colapsable */}
                <CollapsibleSection title="⏰ Franjas horarias / turnos">
                  <TemplatesPanel
                    area={selectedArea}
                    shifts={shifts}
                    periodo={periodoActual}
                    onAutoAssign={(area) => setAutoAssignModalArea(area.id)}
                    autoAssignLoading={autoAssignLoading}
                    embedded
                  />
                </CollapsibleSection>

                {/* Límites de jornada laboral */}
                <LaborLimitsConfig
                  value={selectedArea.labor_limits}
                  onChange={async (newLimits) => {
                    await updateArea(selectedArea.id, { labor_limits: newLimits });
                  }}
                />

                {/* Política de descansos (breaks y almuerzo) */}
                <BreakPolicyConfig
                  value={selectedArea.break_policy}
                  onChange={async (newPolicy) => {
                    await updateArea(selectedArea.id, { break_policy: newPolicy });
                  }}
                />

                {/* Curvas de Demanda WFM — colapsable */}
                <CollapsibleSection title="📈 Curva de demanda (WFM)">
                  <DemandCurveEditor area={selectedArea} embedded />
                </CollapsibleSection>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Modal crear/editar área con el NUEVO wizard */}
      {showAreaModal && (
        <AreaForm
          area={editArea}
          onClose={async (refresh) => {
            setShowAreaModal(false);
            setEditArea(null);
            if (refresh) await fetchAreas();
          }}
        />
      )}

      {/* Confirmar eliminar */}
      {deleteConfirm && (
        <div className="cw-modal-overlay">
          <div className="cw-modal animate-slide-up" style={{ maxWidth: 400 }}>
            <div className="cw-modal__header">
              <h3 className="cw-modal__title">⚠️ Eliminar Área</h3>
              <button className="cw-modal__close" onClick={() => setDeleteConfirm(null)}><MdClose /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0 1.25rem' }}>
              ¿Eliminar el área <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.nombre}</strong>?
              Los empleados quedarán sin área asignada. Los turnos existentes no se eliminan.
            </p>
            <div className="cw-modal__footer">
              <button className="cw-btn cw-btn--secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="cw-btn cw-btn--danger" onClick={async () => {
                await deleteArea(deleteConfirm.id);
                setDeleteConfirm(null);
                if (selectedArea?.id === deleteConfirm.id) setSelectedArea(null);
              }}>
                <MdDelete /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar TODAS */}
      {deleteAllConfirm && (
        <div className="cw-modal-overlay">
          <div className="cw-modal animate-slide-up" style={{ maxWidth: 400 }}>
            <div className="cw-modal__header">
              <h3 className="cw-modal__title">⚠️ Eliminar TODAS las Áreas</h3>
              <button className="cw-modal__close" onClick={() => setDeleteAllConfirm(false)}><MdClose /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0 1.25rem' }}>
              ¿Está seguro que desea eliminar <strong>todas las áreas</strong>?
              Los empleados quedarán sin área asignada. Esta acción no se puede deshacer.
            </p>
            <div className="cw-modal__footer">
              <button className="cw-btn cw-btn--secondary" onClick={() => setDeleteAllConfirm(false)}>Cancelar</button>
              <button className="cw-btn cw-btn--danger" onClick={async () => {
                await deleteAllAreas();
                setDeleteAllConfirm(false);
                setSelectedArea(null);
              }}>
                <MdDelete /> Sí, eliminar todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Auto-asignar */}
      {autoAssignModalArea && (
        <AutoAssignModal
          scope={autoAssignModalArea}
          area={areas.find(a => a.id === autoAssignModalArea)}
          onClose={() => setAutoAssignModalArea(null)}
          onConfirm={handleAutoAssign}
        />
      )}
    </div>
  );
}
