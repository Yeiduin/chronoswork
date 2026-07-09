import { useMemo } from 'react';
import { MdCalendarMonth } from 'react-icons/md';
import { format } from 'date-fns';
import ShiftCell from './ShiftCell';
import { toISODay } from '../../core/dateUtils';

const DIAS_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function SchedulingGrid({
  filteredEmployees, dias, shifts, selectedArea,
  diasTrabajoArea, allTemplatesMap, resumenPorEmpleado,
  areas, tieneNovedad, getNovedad,
  onShiftCellClick,
}) {
  const getShiftsForEmployeeDate = (empId, dateStr) =>
    shifts.filter(s => s.employee_id === empId && s.start_time.startsWith(dateStr));

  const getEmployeeArea = (empId) =>
    areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId));

  const getTemplatesForEmployee = (empId) => {
    const area = getEmployeeArea(empId);
    if (!area) return [];
    return Object.values(allTemplatesMap).filter(t => t.area_id === area.id);
  };

  if (filteredEmployees.length === 0) {
    const hasEmployees = areas?.some(a => a.area_employees?.length > 0);
    return (
      <div className="cw-card">
        <div className="empty-state">
          <div className="empty-state__icon"><MdCalendarMonth /></div>
          <div className="empty-state__title">
            {!hasEmployees ? 'No hay empleados registrados' : 'Sin empleados en esta área'}
          </div>
          <div className="empty-state__desc">
            {!hasEmployees ? 'Registre empleados primero en la sección de Personal.' : 'Asigne empleados a esta área en la página de Áreas.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cw-card" style={{ padding: '1rem' }}>
      <div className="shift-grid-wrapper">
        <table className="shift-grid">
          <thead>
            <tr>
              <th style={{ minWidth: 170, textAlign: 'left', paddingLeft: '0.875rem', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Colaborador
                </div>
              </th>
              {dias.map(dia => {
                const dow = dia.getDay();
                const dowISO = dow === 0 ? 7 : dow;
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
              const resumen = resumenPorEmpleado[emp.id] || { bruto: 0, neto: 0, almuerzoMin: 0, breaks15: 0, breaks15Min: 0, turnos: 0 };
              const horasTotal = resumen.neto;
              // Ajustar el límite de referencia al período visualizado
              const limitRef = dias.length <= 7 ? 42 : dias.length <= 16 ? 84 : 168;
              const porcentajeHoras = Math.min((horasTotal / limitRef) * 100, 100);
              const horasColor = horasTotal > (limitRef * 0.95) ? '#ef4444' : horasTotal > (limitRef * 0.8) ? '#f59e0b' : '#10b981';
              // Usar minutos reales de breaks si están disponibles
              const breaks15MinReal = resumen.breaks15Min > 0 ? resumen.breaks15Min : resumen.breaks15 * 15;
              const descansoTotalMin = resumen.almuerzoMin + breaks15MinReal;
              const resumenTooltip = `${resumen.turnos} turno(s) en vista actual · Netas ${resumen.neto.toFixed(1)}h · Brutas ${resumen.bruto.toFixed(1)}h · Almuerzo ${resumen.almuerzoMin}min · Breaks: ${resumen.breaks15} (${breaks15MinReal}min) · Descanso total ${descansoTotalMin}min`;

              return (
                <tr key={emp.id}>
                  <td className="shift-grid__employee-cell"
                    style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, borderRight: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {empArea && (
                        <div style={{ width: 7, height: 32, borderRadius: 4, background: empArea.color, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {(emp.solo_nocturno || emp.jornada_preferida === 'NOCTURNA') && (
                            <span title="Turno Nocturno" style={{ fontSize: '0.6rem', flexShrink: 0 }}>🌙</span>
                          )}
                          {(emp.solo_diurno || emp.jornada_preferida === 'DIURNA') && (
                            <span title="Turno Diurno" style={{ fontSize: '0.6rem', flexShrink: 0 }}>☀️</span>
                          )}
                          {(!emp.solo_nocturno && !emp.solo_diurno && emp.jornada_preferida === 'MIXTA') && (
                            <span title="Turno Mixto" style={{ fontSize: '0.6rem', flexShrink: 0 }}>🌓</span>
                          )}
                          <div className="shift-grid__employee-name" title={emp.nombre}
                            style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {emp.nombre}
                          </div>
                        </div>
                        <div className="shift-grid__employee-cargo" style={{ fontSize: '0.68rem' }}>{emp.cargo}</div>
                        <div title={resumenTooltip}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem', fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: horasColor, fontFamily: 'var(--font-mono)' }}>
                            {Number.isInteger(resumen.neto) ? resumen.neto.toFixed(0) : resumen.neto.toFixed(1)}h
                          </strong>
                          {resumen.almuerzoMin > 0 && (
                            <span title={`Almuerzo acumulado: ${resumen.almuerzoMin} min`}>
                              🍴{resumen.almuerzoMin}m
                            </span>
                          )}
                          {resumen.breaks15 > 0 && (
                            <span title={`${resumen.breaks15} break(s) · ${breaks15MinReal}min total`}>
                              ☕{resumen.breaks15}
                            </span>
                          )}
                          <span title={`${resumen.turnos} turno(s) en esta vista`} style={{ opacity: 0.65 }}>📋{resumen.turnos}</span>
                        </div>
                        <div title={resumenTooltip}
                          style={{ marginTop: '0.2rem', height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${porcentajeHoras}%`, height: '100%', background: horasColor, borderRadius: 2, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  {dias.map(dia => {
                    const dateStr = format(dia, 'yyyy-MM-dd');
                    const dow = toISODay(dia);
                    const shiftsOnDate = getShiftsForEmployeeDate(emp.id, dateStr);
                    const novedad = tieneNovedad(emp.id, dateStr);
                    const novedadInfo = novedad ? getNovedad(emp.id, dateStr) : null;
                    const blockedReason = novedadInfo ? `${novedadInfo.tipo}: ${novedadInfo.fecha_inicio} al ${novedadInfo.fecha_fin}` : '';

                    const shiftsWithTemplates = shiftsOnDate.map(s => {
                      let tpl = null;
                      if (s.template_id && allTemplatesMap[s.template_id]) {
                        tpl = allTemplatesMap[s.template_id];
                      } else {
                        const startHour = s.start_time?.slice(11, 16);
                        tpl = empTemplates.find(t => t.hora_inicio.slice(0, 5) === startHour) || null;
                      }
                      return { shift: s, template: tpl };
                    });

                    const empDiasDescanso = empArea?.dias_trabajo || null;
                    const isDayOff = empDiasDescanso ? !empDiasDescanso.includes(dow) : false;

                    return (
                      <ShiftCell
                        key={dateStr}
                        employee={emp}
                        fecha={dia}
                        shifts={shiftsWithTemplates}
                        blocked={novedad}
                        blockedReason={blockedReason}
                        isDayOff={isDayOff}
                        onAdd={(selectedShift) => onShiftCellClick(emp, dia, empArea, empTemplates, selectedShift)}
                      />
                    );
                  })}
                </tr>
              );

            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>🌙 Turno / día nocturno</span>
        <span>🚫 Novedad (licencia/vacación)</span>
        <span>🍴 Almuerzo</span>
        <span>☕ Breaks de 15 min</span>
        <span>⏱ <strong>Xh</strong> = horas netas (sin almuerzo)</span>
        <span>📟 Disponibilidad</span>
        <span style={{ color: 'var(--text-muted)' }}>Pasa el cursor sobre un turno para ver el detalle</span>
        <span style={{ color: '#fca5a5' }}>Dom</span>
        <span style={{ color: '#fcd34d' }}>Sáb</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 3, background: 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)', borderRadius: 2 }} />
          Barra de horas (verde = normal, amarillo = alto, rojo = límite 42h/sem)
        </span>
      </div>
    </div>
  );
}
