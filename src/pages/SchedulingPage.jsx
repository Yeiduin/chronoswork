import { useState, useEffect, useMemo } from 'react';
import { useShifts } from '../hooks/useShifts';
import { useEmployees } from '../hooks/useEmployees';
import { useAbsences } from '../hooks/useAbsences';
import { useAreas } from '../hooks/useAreas';
import { supabase } from '../config/supabaseClient';
import { getDiasMes, getNombreMes, getDatesByOption } from '../core/dateUtils';
import { MdWarning, MdCheckCircle } from 'react-icons/md';
import { format } from 'date-fns';
import { ErrorBoundary } from '../components/ErrorBoundary';

import SchedulingToolbar from '../components/scheduling/SchedulingToolbar';
import SchedulingGrid from '../components/scheduling/SchedulingGrid';
import TemplatesLegend from '../components/scheduling/TemplatesLegend';
import ShiftModal from '../components/scheduling/ShiftModal';
import ClearModal from '../components/scheduling/ClearModal';
import { getShiftBreakdown } from '../components/scheduling/getShiftBreakdown';

import { AutoAssignModal } from '../components/AutoAssignModal';
import { ExportShiftsModal } from '../components/ExportShiftsModal';
import { HourlyCoverageView } from '../components/HourlyCoverageView';

export default function SchedulingPage() {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [selectedAreaId, setSelectedAreaId] = useState('all');
  const [viewType, setViewType] = useState('grid');
  const [viewMode, setViewMode] = useState(() => {
    const d = now.getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
    const weekIndex = Math.floor(((startDow - 1) + (d - 1)) / 7) + 1;
    return `weekly_${weekIndex}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alfabetico');
  const [shiftModal, setShiftModal] = useState(null);
  const [autoAssignModal, setAutoAssignModal] = useState(null);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

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

  const { shifts, createShift, updateShift, deleteShift, autoAssignShifts, clearShiftsByDateRange } = useShifts(periodos);
  const { employees } = useEmployees();
  const { absences, tieneNovedad, getNovedad } = useAbsences();
  const { areas } = useAreas();

  const diasTodos = getDiasMes(anio, mes);

  const naturalWeeks = useMemo(() => {
    const weeks = [];
    let currentWeek = [];
    diasTodos.forEach(d => {
      if (currentWeek.length === 0 && d.getDay() !== 1) {
        const prevDaysCount = (d.getDay() === 0 ? 7 : d.getDay()) - 1;
        for (let i = prevDaysCount; i > 0; i--) {
          const prevDay = new Date(d);
          prevDay.setDate(d.getDate() - i);
          currentWeek.push(prevDay);
        }
      }
      currentWeek.push(d);
      if (d.getDay() === 0 || d.getDate() === diasTodos[diasTodos.length - 1].getDate()) {
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

  const selectedArea = selectedAreaId !== 'all' ? areas.find(a => a.id === selectedAreaId) : null;
  const diasTrabajoArea = selectedArea?.dias_trabajo || [1, 2, 3, 4, 5, 6, 7];

  const [areaTemplates, setAreaTemplates] = useState([]);
  useEffect(() => {
    if (selectedAreaId && selectedAreaId !== 'all') {
      supabase.from('shift_templates').select('*').eq('area_id', selectedAreaId).eq('activo', true)
        .order('hora_inicio').then(({ data }) => setAreaTemplates(data || []));
    } else {
      setAreaTemplates([]);
    }
  }, [selectedAreaId, shifts]);

  const [allTemplatesMap, setAllTemplatesMap] = useState({});
  useEffect(() => {
    supabase.from('shift_templates').select('*').eq('activo', true).then(({ data }) => {
      const map = {};
      (data || []).forEach(t => { map[t.id] = t; });
      setAllTemplatesMap(map);
    });
  }, []);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (selectedAreaId !== 'all') {
      const area = areas.find(a => a.id === selectedAreaId);
      if (area) {
        const areaEmpIds = area.area_employees?.map(ae => ae.employee_id) || [];
        result = result.filter(e => areaEmpIds.includes(e.id));
      }
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => e.nombre?.toLowerCase().includes(term) || e.cedula?.toLowerCase().includes(term));
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'alfabetico') return (a.nombre || '').localeCompare(b.nombre || '');
      if (sortBy === 'salario_desc') return (b.valor_hora || 0) - (a.valor_hora || 0);
      if (sortBy === 'area') {
        const getAreaName = (empId) => areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId))?.nombre || '';
        const areaA = getAreaName(a.id), areaB = getAreaName(b.id);
        return areaA === areaB ? (a.nombre || '').localeCompare(b.nombre || '') : areaA.localeCompare(areaB);
      }
      return 0;
    });
    return result;
  }, [selectedAreaId, areas, employees, searchTerm, sortBy]);

  const resumenPorEmpleado = useMemo(() => {
    const diasVisibles = new Set(dias.map(d => format(d, 'yyyy-MM-dd')));
    const map = {};
    shifts.forEach(s => {
      if (!s.employee_id) return;
      const shiftDate = s.start_time?.slice(0, 10);
      if (!diasVisibles.has(shiftDate)) return;
      const bd = getShiftBreakdown(s);
      const r = map[s.employee_id] || { bruto: 0, neto: 0, almuerzoMin: 0, breaks15: 0, breaks15Min: 0, turnos: 0 };
      r.bruto      += bd.grossH;
      r.neto       += bd.netH;
      r.almuerzoMin += bd.almuerzo;
      r.breaks15   += bd.breaks15;
      r.breaks15Min += bd.breaks15Min;
      r.turnos     += 1;
      map[s.employee_id] = r;
    });
    return map;
  }, [shifts, dias]);

  const handleAutoAssign = async (scope, strategyOptions) => {
    setAutoAssignLoading(true);
    setAutoResult(null);
    try {
      const areasToProcess = scope === 'all' ? areas : areas.filter(a => a.id === scope);
      if (!areasToProcess.length) throw new Error('No hay áreas para procesar.');

      let totalInserted = 0;
      const allAlertaDias = [];
      const erroresValidacion = [];
      const areasProcesadas = [];
      const processedDays = getDatesByOption(strategyOptions.dateRangeOption, strategyOptions.customStart, strategyOptions.customEnd);
      if (processedDays.length === 0) throw new Error('El rango seleccionado no tiene días.');

      if (strategyOptions.reprogramar && processedDays.length > 0) {
        const dStartStr = format(processedDays[0], 'yyyy-MM-dd');
        const dEndStr = format(processedDays[processedDays.length - 1], 'yyyy-MM-dd');
        const empIdsToClear = areasToProcess.flatMap(a => a.area_employees?.map(ae => ae.employee_id) || []);
        if (empIdsToClear.length > 0) await clearShiftsByDateRange(dStartStr, dEndStr, empIdsToClear);
      }

      for (const area of areasToProcess) {
        const areaEmpsRaw = area.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
        const areaEmps = areaEmpsRaw.filter(e => e.activo !== false);
        if (!areaEmps.length) { erroresValidacion.push(`${area.nombre}: sin empleados activos.`); continue; }

        const areaEs247 = area.modo_operacion === '24_7' || area.modo_operacion === '24_7_NIGHT_SPLIT';
        const { data: templates } = await supabase.from('shift_templates').select('*').eq('area_id', area.id).eq('activo', true);
        if (!areaEs247 && (!templates || templates.length === 0)) {
          erroresValidacion.push(`${area.nombre}: sin franjas horarias.`); continue;
        }

        const empIds = areaEmps.map(e => e.id);
        let finalEmployees = [...areaEmps];

        if (strategyOptions.onlyNewEmployees && processedDays.length > 0) {
          const dStartStr = format(processedDays[0], 'yyyy-MM-dd');
          const dEndStr = format(processedDays[processedDays.length - 1], 'yyyy-MM-dd');
          const { data: existing } = await supabase.from('shifts').select('employee_id')
            .in('employee_id', empIds).gte('start_time', `${dStartStr}T00:00:00`).lte('start_time', `${dEndStr}T23:59:59`);
          const empIdsWithShifts = new Set(existing?.map(s => s.employee_id) || []);
          finalEmployees = finalEmployees.filter(emp => !empIdsWithShifts.has(emp.id));
          if (!finalEmployees.length) { erroresValidacion.push(`${area.nombre}: todos ya tienen turnos.`); continue; }
        }

        const areaConfig = {};
        try {
          const { data: ad } = await supabase.from('areas')
            .select('modo_operacion, estrategia_asignacion, min_empleados_noche, noche_solo_empleados_dedicados, permite_dia_cubrir_noche, slots_por_hora, snap_turnos_minutos, balancear_carga, rotar_slots_entre_asesores, permitir_horas_extras, permitir_turno_partido, min_horas_turno_override, max_horas_turno_override')
            .eq('id', area.id).single();
          Object.assign(areaConfig, ad || {});
        } catch (e) { /* continuar sin config */ }
        try {
          const { data: hc } = await supabase.from('areas')
            .select('min_empleados_dia, max_empleados_dia, hora_inicio_dia, hora_fin_dia').eq('id', area.id).single();
          if (hc) Object.assign(areaConfig, hc);
        } catch (e) { /* ok */ }
        try {
          const { data: bp } = await supabase.from('areas').select('break_policy').eq('id', area.id).single();
          if (bp) Object.assign(areaConfig, bp);
        } catch (e) { /* ok */ }

        const nightShiftConfig = areaEs247 ? {
          enabled: true,
          start: area.night_shift_start || '22:00',
          end: area.night_shift_end || '06:00',
          employeeIds: area.night_shift_employee_ids || [],
        } : null;

        try {
          const result = await autoAssignShifts({
            employees: finalEmployees, templates, absences: absences.filter(a => empIds.includes(a.employee_id)),
            existingShifts: shifts.filter(s => empIds.includes(s.employee_id)),
            year: anio, month: mes,
            diasTrabajo: areaEs247 ? [1,2,3,4,5,6,7] : (area.dias_trabajo || [1,2,3,4,5]),
            diasToProcess: processedDays, areaId: area.id, modoOperacion: area.modo_operacion,
            laborLimits: area.labor_limits || null, nightShiftConfig,
            patronRotativo: area.patron_rotativo || null,
            overrideMinEmpleadosDia: strategyOptions.minEmpleadosDia ?? null,
            overrideMaxEmpleadosDia: strategyOptions.maxEmpleadosDia ?? null,
            overrideMinEmpleadosNoche: strategyOptions.minEmpleadosNoche ?? null,
          });
          if (result?.error) {
            if (result.error.includes('schema cache') || result.error.includes('column'))
              throw new Error(`La tabla 'shifts' no tiene las columnas requeridas. Aplica la migración en Supabase. Detalle: ${result.error}`);
            erroresValidacion.push(`${area.nombre}: ${result.error}`); continue;
          }
          totalInserted += result.inserted || 0;
          areasProcesadas.push(area.nombre);
          if (Array.isArray(result.alertaDias)) allAlertaDias.push(...result.alertaDias);
        } catch (innerErr) {
          erroresValidacion.push(`${area.nombre}: ${innerErr.message || 'error desconocido'}`); continue;
        }
      }
      setAutoResult({ inserted: totalInserted, alertaDias: [...new Set(allAlertaDias)], scope, areasProcesadas, warn: erroresValidacion.join(' | ') });
    } catch (err) {
      setAutoResult({ error: err.message });
    } finally {
      setAutoAssignLoading(false);
    }
  };

  const handleClearPeriod = async (options) => {
    const { scopeType, scopeId, rangeType, customStart, customEnd } = options;
    let empIds = [];
    if (scopeType === 'area') {
      const area = areas.find(a => a.id === scopeId);
      empIds = area?.area_employees?.map(ae => ae.employee_id) || [];
    } else if (scopeType === 'employee') {
      empIds = [scopeId];
    }
    let dStartStr, dEndStr;
    if (rangeType === 'custom') { dStartStr = customStart; dEndStr = customEnd; }
    else {
      if (dias.length === 0) return;
      dStartStr = format(dias[0], 'yyyy-MM-dd');
      dEndStr = format(dias[dias.length - 1], 'yyyy-MM-dd');
    }
    await clearShiftsByDateRange(dStartStr, dEndStr, empIds);
    setAutoResult(null);
  };

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
      if (wIdx > 1) { setViewMode(`weekly_${wIdx - 1}`); }
      else {
        const prevMes = mes === 1 ? 12 : mes - 1;
        const prevAnio = mes === 1 ? anio - 1 : anio;
        setMes(prevMes); setAnio(prevAnio);
        const prevDiasTodos = getDiasMes(prevAnio, prevMes);
        let prevWeeksCount = 0;
        prevDiasTodos.forEach(d => {
          if (d.getDay() === 0 || d.getDate() === prevDiasTodos[prevDiasTodos.length - 1].getDate()) prevWeeksCount++;
        });
        setViewMode(`weekly_${prevWeeksCount}`);
      }
    }
  };

  const handleNext = () => {
    setAutoResult(null);
    if (viewMode === 'monthly') {
      if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1);
    } else if (viewMode === 'biweekly_1') { setViewMode('biweekly_2'); }
    else if (viewMode === 'biweekly_2') { setViewMode('biweekly_1'); if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1); }
    else if (viewMode.startsWith('weekly_')) {
      const wIdx = parseInt(viewMode.split('_')[1], 10);
      if (wIdx < naturalWeeks.length) { setViewMode(`weekly_${wIdx + 1}`); }
      else { setViewMode('weekly_1'); if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1); }
    }
  };

  const handleToday = () => {
    setAutoResult(null);
    const today = new Date();
    setAnio(today.getFullYear()); setMes(today.getMonth() + 1); setViewMode('weekly_1');
  };

  const turnosAsignados = shifts.length;
  const diasSinCobertura = dias.filter(dia => {
    const dowISO = dia.getDay() === 0 ? 7 : dia.getDay();
    if (selectedArea && !diasTrabajoArea.includes(dowISO)) return false;
    const dateStr = format(dia, 'yyyy-MM-dd');
    return !filteredEmployees.some(emp => shifts.some(s => s.employee_id === emp.id && s.start_time.startsWith(dateStr)));
  }).length;

  const handleShiftCellClick = (emp, dia, empArea, empTemplates, existingShift) => {
    setShiftModal({
      employee: emp, fecha: dia,
      areaId: empArea?.id,
      areaTemplates: empTemplates,
      breakPolicy: empArea?.break_policy || null,
      existingShift,
    });
  };

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '100%' }}>
      <div className="page-header" style={{ display: 'block', marginBottom: '1.25rem' }}>
        <div className="page-header__info" style={{ marginBottom: '1rem' }}>
          <h1 className="page-title">📅 Programación de Turnos</h1>
          <p className="page-subtitle">Gestión visual de turnos por área · CST Colombia</p>
        </div>

        <SchedulingToolbar
          mes={mes} anio={anio}
          viewMode={viewMode} viewType={viewType}
          selectedAreaId={selectedAreaId}
          searchTerm={searchTerm} sortBy={sortBy}
          naturalWeeks={naturalWeeks} areas={areas}
          shifts={shifts} employees={employees}
          autoAssignLoading={autoAssignLoading}
          onSetMes={v => { setMes(v); setAutoResult(null); }}
          onSetAnio={v => { setAnio(v); setAutoResult(null); }}
          onSetViewMode={v => { setViewMode(v); setAutoResult(null); }}
          onSetViewType={() => setViewType(t => t === 'grid' ? 'coverage' : 'grid')}
          onSetSelectedAreaId={v => { setSelectedAreaId(v); setAutoResult(null); }}
          onSetSearchTerm={setSearchTerm}
          onSetSortBy={setSortBy}
          onPrev={handlePrev} onNext={handleNext} onToday={handleToday}
          onAutoAssign={() => setAutoAssignModal(selectedAreaId)}
          onExport={() => setShowExportModal(true)}
          onClear={() => setShowClearModal(true)}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Turnos asignados:</span>
          <strong style={{ color: 'var(--cw-accent)' }}>{turnosAsignados}</strong>
        </div>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Colaboradores:</span>
          <strong style={{ color: 'var(--text-primary)' }}>{filteredEmployees.length}</strong>
        </div>
        {diasSinCobertura > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MdWarning style={{ color: '#fbbf24' }} />
            <span style={{ color: '#fcd34d' }}><strong>{diasSinCobertura}</strong> días sin cobertura</span>
          </div>
        )}
        {selectedArea && (
          <div style={{ background: selectedArea.color + '15', border: `1px solid ${selectedArea.color}40`, borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedArea.color }} />
            <span style={{ color: 'var(--text-muted)' }}>Días laborables:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{diasTrabajoArea.map(d => ['L','M','X','J','V','S','D'][d-1]).join(' · ')}</strong>
          </div>
        )}
      </div>

      {/* Resultado auto-asignación */}
      {autoResult && (
        <div className={`cw-alert ${autoResult.error ? 'cw-alert--error' : autoResult.alertaDias?.length ? 'cw-alert--warning' : 'cw-alert--success'}`}
          style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
            {autoResult.error ? (
              <><MdWarning style={{ marginTop: 2, flexShrink: 0 }} />
                <div><div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🚫 Error en la auto-asignación</div><div style={{ fontSize: '0.85rem' }}>{autoResult.error}</div></div></>
            ) : (
              <>{autoResult.alertaDias?.length ? <MdWarning style={{ color: '#fbbf24', marginTop: 2, flexShrink: 0 }} /> : <MdCheckCircle style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div><strong>{autoResult.inserted}</strong> turnos asignados.{autoResult.areasProcesadas?.length > 0 && <> · {autoResult.areasProcesadas.join(', ')}</>}</div>
                  {autoResult.alertaDias?.length > 0 && <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: '#fcd34d' }}>⚠️ {autoResult.alertaDias.slice(0, 3).join(' · ')}{autoResult.alertaDias.length > 3 ? ` … (+${autoResult.alertaDias.length - 3} más)` : ''}</div>}
                  {autoResult.warn && <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: '#fca5a5' }}>❗ {autoResult.warn}</div>}
                </div></>
            )}
          </div>
          <button onClick={() => setAutoResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {areaTemplates.length > 0 && viewType === 'grid' && <TemplatesLegend templates={areaTemplates} />}

      {viewType === 'coverage' ? (
        <HourlyCoverageView shifts={shifts} employees={filteredEmployees}
          demandSlots={selectedArea ? (selectedArea.area_demand_slots || []) : areas.flatMap(a => a.area_demand_slots || [])}
          areas={areas} selectedAreaId={selectedAreaId} />
      ) : (
        <ErrorBoundary>
          <SchedulingGrid
            filteredEmployees={filteredEmployees}
            dias={dias}
            shifts={shifts}
            selectedArea={selectedArea}
            diasTrabajoArea={diasTrabajoArea}
            allTemplatesMap={allTemplatesMap}
            resumenPorEmpleado={resumenPorEmpleado}
            areas={areas}
            tieneNovedad={tieneNovedad}
            getNovedad={getNovedad}
            onShiftCellClick={handleShiftCellClick}
          />
        </ErrorBoundary>
      )}

      {viewType === 'grid' && shiftModal && (
        <ShiftModal {...shiftModal} onClose={() => setShiftModal(null)}
          onSave={async (data) => {
            if (shiftModal.existingShift) await updateShift(shiftModal.existingShift.id, data);
            else await createShift(data);
          }}
          onDelete={deleteShift} />
      )}

      {autoAssignModal && (
        <AutoAssignModal scope={autoAssignModal} areas={areas} onClose={() => setAutoAssignModal(null)} onConfirm={handleAutoAssign} />
      )}

      {showClearModal && (
        <ClearModal areas={areas} employees={employees} dias={dias} onClose={() => setShowClearModal(false)} onConfirm={handleClearPeriod} />
      )}

      {showExportModal && (
        <ExportShiftsModal areas={areas} employees={filteredEmployees} shifts={shifts} absences={absences} allTemplates={allTemplatesMap}
          defaultAreaId={selectedAreaId} defaultRange="this_week"
          currentViewRange={dias?.length > 0 ? { start: dias[0], end: dias[dias.length - 1], days: dias } : null}
          onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
