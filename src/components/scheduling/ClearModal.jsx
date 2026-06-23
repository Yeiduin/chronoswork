import { useState } from 'react';
import { MdClose, MdDeleteSweep, MdWarning } from 'react-icons/md';
import { formatFecha } from '../../core/dateUtils';

export default function ClearModal({ areas, employees, dias, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [scopeType, setScopeType] = useState('all');
  const [scopeId, setScopeId] = useState('');
  const [rangeType, setRangeType] = useState('current_view');
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
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <MdWarning style={{ color: '#fca5a5', fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.875rem' }}>Atención: Esta acción es permanente</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Se eliminarán todos los turnos que coincidan con tus selecciones. No se podrán recuperar.</p>
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
