import { useState, useEffect } from 'react';
import { MdClose, MdWarning, MdInfo } from 'react-icons/md';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getDatesByOption } from '../core/dateUtils';
import { format } from 'date-fns';

export function AutoAssignModal({ scope, areas = [], area, onClose, onConfirm }) {
  const { tenant } = useAuth();
  // scope puede ser un area.id (string UUID) cuando viene desde AreasPage
  const [targetScope, setTargetScope] = useState(scope === 'area' ? 'all' : scope || 'all');
  const [dateRangeOption, setDateRangeOption] = useState('this_week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);

  const [hasExistingShifts, setHasExistingShifts] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [resolutionMode, setResolutionMode] = useState('only_new'); // 'reprogram' | 'only_new'

  // Detectar si el área seleccionada es 24/7
  const selectedArea = area || (targetScope !== 'all' ? areas.find(a => a.id === targetScope) : null);
  const is24_7 = selectedArea?.modo_operacion === '24_7';

  // Buscar conflictos de turnos existentes
  useEffect(() => {
    let active = true;
    const checkConflicts = async () => {
      const tenantId = tenant?.id || selectedArea?.tenant_id;
      if (!tenantId) return;

      const processedDays = getDatesByOption(dateRangeOption, customStart, customEnd);
      if (processedDays.length === 0) {
        if (active) setHasExistingShifts(false);
        return;
      }

      const startStr = format(processedDays[0], 'yyyy-MM-dd');
      const endStr = format(processedDays[processedDays.length - 1], 'yyyy-MM-dd');

      if (targetScope === 'all') {
        setConflictLoading(true);
        try {
          const { data } = await supabase
            .from('shifts')
            .select('id')
            .eq('tenant_id', tenantId)
            .gte('start_time', `${startStr}T00:00:00`)
            .lte('start_time', `${endStr}T23:59:59`)
            .limit(1);
          if (active) setHasExistingShifts(!!data?.length);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setConflictLoading(false);
        }
        return;
      }

      if (!targetScope) {
        setHasExistingShifts(false);
        return;
      }

      setConflictLoading(true);
      try {
        const { data: areaEmps } = await supabase
          .from('area_employees')
          .select('employee_id')
          .eq('area_id', targetScope);
        
        const empIds = areaEmps?.map(ae => ae.employee_id) || [];
        if (empIds.length > 0) {
          const { data } = await supabase
            .from('shifts')
            .select('id')
            .in('employee_id', empIds)
            .gte('start_time', `${startStr}T00:00:00`)
            .lte('start_time', `${endStr}T23:59:59`)
            .limit(1);
          if (active) setHasExistingShifts(!!data?.length);
        } else {
          if (active) setHasExistingShifts(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setConflictLoading(false);
      }
    };

    checkConflicts();
    return () => { active = false; };
  }, [targetScope, dateRangeOption, customStart, customEnd, selectedArea, tenant]);

  const handleConfirm = async () => {
    if (dateRangeOption === 'custom' && (!customStart || !customEnd)) {
      alert('Por favor selecciona la fecha de inicio y fin.');
      return;
    }

    let confirmMsg = '¿Estás seguro de que deseas asignar automáticamente estos turnos?';
    if (hasExistingShifts) {
      if (resolutionMode === 'reprogram') {
        confirmMsg = '⚠️ ¡ATENCIÓN! Has seleccionado REPROGRAMAR. Esto borrará todos los turnos existentes en el rango antes de asignar los nuevos. ¿Deseas continuar?';
      } else {
        confirmMsg = '¿Estás seguro de que deseas asignar turnos solo a los colaboradores nuevos sin programación?';
      }
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setLoading(true);
    await onConfirm(targetScope, {
      reprogramar: hasExistingShifts ? resolutionMode === 'reprogram' : false,
      onlyNewEmployees: hasExistingShifts ? resolutionMode === 'only_new' : false,
      dateRangeOption,
      customStart,
      customEnd
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 500 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">🤖 Asignación Inteligente</h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>
        
        {areas && areas.length > 0 && (
          <div className="cw-form-group">
            <label className="cw-label">Aplicar a</label>
            <select className="cw-select" value={targetScope} onChange={e => setTargetScope(e.target.value)}>
              <option value="all">🏢 Todas las áreas de la empresa</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>● Área: {a.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="cw-form-group">
          <label className="cw-label">Rango de fechas</label>
          <select className="cw-select" value={dateRangeOption} onChange={e => setDateRangeOption(e.target.value)}>
            <option value="this_week">Esta semana (Lun - Dom actual)</option>
            <option value="rest_of_week">Resto de la semana (Desde hoy hasta Dom)</option>
            <option value="next_week">La próxima semana (Próx. Lun - Dom)</option>
            <option value="this_biweek">Esta quincena (Día 1-15 o 16-Fin actual)</option>
            <option value="next_biweek">La próxima quincena</option>
            <option value="this_month">Este mes</option>
            <option value="next_month">El próximo mes</option>
            <option value="custom">Rango personalizado...</option>
          </select>
        </div>

        {dateRangeOption === 'custom' && (
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

        {/* Info modo operación */}
        {is24_7 && (
          <div style={{ marginBottom: '1.25rem', padding: '0.875rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706', marginBottom: '0.4rem' }}>🔄 Área en Operación 24/7</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              El algoritmo cubrirá <strong>todos los días del rango</strong> incluyendo domingos y festivos.
              Los recargos por HON, HOD y HCDN se calcularán automáticamente en la prenómina según el CST colombiano.
              Cada empleado tendrá al menos <strong>1 día de descanso por semana</strong>, evitando los días de mayor demanda.
            </div>
          </div>
        )}

        {/* Opciones de resolución de conflictos si ya existen turnos */}
        {hasExistingShifts && !conflictLoading && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1.25rem',
          }}>
            <h4 style={{ color: '#d97706', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <MdWarning /> Ya existen turnos programados en este período
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
              ¿Qué deseas hacer con la programación existente?
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <input type="radio" name="conflict_resolution" value="only_new" checked={resolutionMode === 'only_new'} onChange={() => setResolutionMode('only_new')} style={{ marginTop: 2 }} />
                <div>
                  <strong>Solo programar a colaboradores nuevos</strong>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    Mantiene los turnos de las personas ya programadas y solo genera turnos para los nuevos colaboradores agregados.
                  </span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <input type="radio" name="conflict_resolution" value="reprogram" checked={resolutionMode === 'reprogram'} onChange={() => setResolutionMode('reprogram')} style={{ marginTop: 2 }} />
                <div>
                  <strong>Reprogramar todo (Sobrescribir)</strong>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    Borra todos los turnos existentes de la semana/período para esta área y los vuelve a programar desde cero.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {conflictLoading && (
          <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
            Verificando turnos existentes...
          </div>
        )}

        <div className="cw-modal__footer" style={{ marginTop: '1.5rem' }}>
          <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="cw-btn cw-btn--primary" onClick={handleConfirm} disabled={loading || conflictLoading}>
            {loading ? <><span className="cw-spinner cw-spinner--sm"></span></> : 'Confirmar Asignación'}
          </button>
        </div>
      </div>
    </div>
  );
}
