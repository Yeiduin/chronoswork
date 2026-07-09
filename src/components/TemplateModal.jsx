// ============================================================
// ChronosWork — Modal crear/editar Plantilla de Turno
// Extraído de AreasPage.jsx para reutilización
// ============================================================

import { useState } from 'react';
import { MdAccessTime, MdClose } from 'react-icons/md';

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316',
];

export default function TemplateModal({ template, areaId, onClose, onSave }) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    nombre: template?.nombre || '',
    hora_inicio: template?.hora_inicio?.slice(0, 5) || '06:00',
    hora_fin: template?.hora_fin?.slice(0, 5) || '14:00',
    cruza_medianoche: template?.cruza_medianoche || false,
    color: template?.color || '#3b82f6',
    shift_kind: template?.shift_kind || 'STANDARD',
    descripcion: template?.descripcion || '',
    area_id: areaId,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calcHoras = () => {
    const [h1, m1] = form.hora_inicio.split(':').map(Number);
    const [h2, m2] = form.hora_fin.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0 || form.cruza_medianoche) mins = form.cruza_medianoche
      ? (24 * 60 - (h1 * 60 + m1) + (h2 * 60 + m2))
      : mins;
    return (Math.abs(mins) / 60).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre del turno es obligatorio.'); return; }
    setLoading(true);
    try {
      await onSave({ ...form, area_id: areaId });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 460 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            <MdAccessTime style={{ marginRight: '0.5rem' }} />
            {isEdit ? 'Editar Franja Horaria' : 'Nueva Franja Horaria'}
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {error && <div className="cw-alert cw-alert--error">🚫 {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="cw-form-group">
            <label className="cw-label">Nombre del turno <span className="required">*</span></label>
            <input className="cw-input" placeholder="Ej: Turno Mañana, Turno 8-5..."
              value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>

          <div className="cw-form-group">
            <label className="cw-label">Tipo de turno</label>
            <select className="cw-input" value={form.shift_kind} onChange={e => setForm(p => ({ ...p, shift_kind: e.target.value }))}>
              <option value="STANDARD">⏰ Estándar (corrido)</option>
              <option value="PARTIDO">⏸️ Partido (con almuerzo)</option>
              <option value="ROTATIVO">🔄 Rotativo</option>
              <option value="NOCTURNO">🌙 Nocturno (paga HON)</option>
              <option value="DISPONIBILIDAD">🛎️ Disponibilidad / Guardia</option>
              <option value="CUSTOM">🛠️ Personalizado</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="cw-form-group">
              <label className="cw-label">Hora inicio <span className="required">*</span></label>
              <input type="time" className="cw-input"
                value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))} />
            </div>
            <div className="cw-form-group">
              <label className="cw-label">Hora fin <span className="required">*</span></label>
              <input type="time" className="cw-input"
                value={form.hora_fin} onChange={e => setForm(p => ({ ...p, hora_fin: e.target.value }))} />
            </div>
          </div>

          <div className="cw-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.cruza_medianoche}
                onChange={e => setForm(p => ({ ...p, cruza_medianoche: e.target.checked }))} />
              <span className="cw-label" style={{ margin: 0 }}>Turno cruza medianoche</span>
            </label>
          </div>

          <div style={{
            background: form.color + '18', border: `1px solid ${form.color}40`,
            borderRadius: 8, padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)',
            marginBottom: '1rem',
          }}>
            ⏱ Duración: <strong style={{ color: 'var(--text-primary)' }}>{calcHoras()} horas</strong> por turno
          </div>

          <div className="cw-form-group">
            <label className="cw-label">Color del turno</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {PALETTE.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', outline: form.color === c ? `3px solid white` : 'none',
                    boxShadow: form.color === c ? `0 0 0 4px ${c}60` : 'none',
                    transition: 'all 0.15s',
                  }} />
              ))}
            </div>
          </div>

          <div className="cw-modal__footer">
            <button type="button" className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="cw-btn cw-btn--primary" disabled={loading}>
              {loading ? <><span className="cw-spinner cw-spinner--sm"></span></> : (isEdit ? '💾 Guardar' : '+ Agregar Franja')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
