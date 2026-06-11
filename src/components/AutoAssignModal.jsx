import { useState } from 'react';
import { MdClose } from 'react-icons/md';

export function AutoAssignModal({ scope, areas = [], area, onClose, onConfirm }) {
  // scope puede ser un area.id (string UUID) cuando viene desde AreasPage
  const [targetScope, setTargetScope] = useState(scope === 'area' ? 'all' : scope || 'all');
  const [dateRangeOption, setDateRangeOption] = useState('this_week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reprogramar, setReprogramar] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detectar si el área seleccionada es 24/7
  const selectedArea = area || (targetScope !== 'all' ? areas.find(a => a.id === targetScope) : null);
  const is24_7 = selectedArea?.modo_operacion === '24_7';

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
    await onConfirm(targetScope, { reprogramar, dateRangeOption, customStart, customEnd });
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

        {/* Estrategia — eliminada para evitar confusión ya que el algoritmo se basa en score */}

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
