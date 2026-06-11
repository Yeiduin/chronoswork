import { useState } from 'react';
import { MdClose } from 'react-icons/md';

export function AutoAssignModal({ scope, areas = [], onClose, onConfirm }) {
  // If scope is 'area' and we are in SchedulingPage, we should probably default to the currently selected area
  // We'll let the parent pass the default scope or we manage it here.
  const [targetScope, setTargetScope] = useState(scope === 'area' ? 'all' : scope || 'all');
  const [strategy, setStrategy] = useState('fijo');
  const [dateRangeOption, setDateRangeOption] = useState('current_view');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reprogramar, setReprogramar] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (dateRangeOption === 'custom' && (!customStart || !customEnd)) {
      alert('Por favor selecciona la fecha de inicio y fin.');
      return;
    }

    let confirmMsg = '¿Estás seguro de que deseas asignar automáticamente estos turnos?';
    if (reprogramar) {
      confirmMsg = '⚠️ ¡ATENCIÓN! Has seleccionado REPROGRAMAR. Esto borrará todos los turnos existentes en el rango antes de asignar los nuevos. ¿Deseas continuar?';
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setLoading(true);
    await onConfirm(targetScope, { strategy, reprogramar, dateRangeOption, customStart, customEnd });
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
            <option value="current_view">Aplicar a la vista actual (Fondo)</option>
            <option value="full_month">Mes completo</option>
            <option value="next_week">Próxima semana (Lun - Dom)</option>
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

        <div className="cw-form-group">
          <label className="cw-label">Estrategia de asignación</label>
          <select className="cw-select" value={strategy} onChange={e => setStrategy(e.target.value)}>
            <option value="fijo">Mismo turno toda la semana</option>
            <option value="intercalado_dias">Intercalado Día a Día</option>
            <option value="intercalado_mitad">Mitad de Semana (3 días / resto)</option>
            <option value="rotacion_semanal">Rotación Semanal (Invierte turno previo)</option>
          </select>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', background: 'var(--bg-glass)', padding: '0.75rem', borderRadius: 8 }}>
            {strategy === 'fijo' && 'Se asignará un turno por defecto según la rotación básica. Todos recibirán turno si hay disponibilidad.'}
            {strategy === 'intercalado_dias' && 'Alterna el turno cada día laborable (ej. Mañana, Tarde, Mañana).'}
            {strategy === 'intercalado_mitad' && 'Asigna un turno la primera mitad de la semana y otro diferente la segunda mitad.'}
            {strategy === 'rotacion_semanal' && 'Revisa el historial de la semana anterior para asignar el turno opuesto esta semana.'}
          </div>
        </div>

        <div className="cw-form-group" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '0.5rem', background: reprogramar ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-glass)', padding: '1rem', borderRadius: 8, border: reprogramar ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-subtle)', transition: 'all 0.2s' }}>
          <input type="checkbox" id="reprogramar" checked={reprogramar} onChange={e => setReprogramar(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }} />
          <div>
            <label htmlFor="reprogramar" style={{ display: 'block', cursor: 'pointer', fontSize: '0.9rem', color: reprogramar ? '#fca5a5' : 'var(--text-primary)', fontWeight: 600 }}>
              Reprogramación completa (Sobrescribir)
            </label>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Si activas esto, se borrarán todos los turnos del rango seleccionado antes de asignar los nuevos.
            </div>
          </div>
        </div>

        <div className="cw-modal__footer" style={{ marginTop: '1.5rem' }}>
          <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="cw-btn cw-btn--primary" onClick={handleConfirm} disabled={loading}>
            {loading ? <><span className="cw-spinner cw-spinner--sm"></span></> : 'Confirmar Asignación'}
          </button>
        </div>
      </div>
    </div>
  );
}
