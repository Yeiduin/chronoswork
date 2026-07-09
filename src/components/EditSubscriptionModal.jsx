import { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import { MdEdit } from 'react-icons/md';

export default function EditSubscriptionModal({ tenant, onClose, onSaved }) {
  const [form, setForm] = useState({
    plan_type: tenant.sub_plan_type || 'mensual',
    status:    tenant.sub_status    || 'active',
    expires_at: tenant.sub_expires_at
      ? new Date(tenant.sub_expires_at).toISOString().slice(0, 10)
      : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notas: tenant.sub_notas || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('update_tenant_subscription', {
        p_tenant_id:  tenant.tenant_id,
        p_plan_type:  form.plan_type,
        p_status:     form.status,
        p_expires_at: new Date(form.expires_at).toISOString(),
        p_notas:      form.notas || null,
      });
      if (rpcError) throw rpcError;
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al actualizar la suscripción.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cw-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cw-modal" style={{ maxWidth: 480 }}>
        <div className="cw-modal__header">
          <div className="cw-modal__title">
            <MdEdit /> Editar Suscripción
          </div>
          <button className="cw-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="cw-modal__body">
          <div style={{
            padding: '0.75rem 1rem', borderRadius: 8,
            background: 'var(--surface-2)', marginBottom: '1.25rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {tenant.razon_social}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>NIT: {tenant.nit}</div>
          </div>

          {error && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {error}</div>}

          <form onSubmit={handleSubmit} id="edit-subscription-form">
            <div className="cw-form-group">
              <label className="cw-label">Plan de Suscripción</label>
              <select
                className="cw-input"
                value={form.plan_type}
                onChange={(e) => setForm(p => ({ ...p, plan_type: e.target.value }))}
              >
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral (3 meses)</option>
                <option value="semestral">Semestral (6 meses)</option>
                <option value="anual">Anual (12 meses)</option>
              </select>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Estado</label>
              <select
                className="cw-input"
                value={form.status}
                onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}
              >
                <option value="active">Activa ✓</option>
                <option value="trialing">Trial (Prueba)</option>
                <option value="past_due">Vencida (Past Due)</option>
                <option value="canceled">Cancelada</option>
              </select>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Fecha de vencimiento</label>
              <input
                type="date"
                className="cw-input"
                value={form.expires_at}
                onChange={(e) => setForm(p => ({ ...p, expires_at: e.target.value }))}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Notas internas</label>
              <textarea
                className="cw-input"
                rows={2}
                placeholder="Observaciones del pago, acuerdos, etc..."
                value={form.notas}
                onChange={(e) => setForm(p => ({ ...p, notas: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="cw-btn cw-btn--secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                id="btn-save-subscription"
                type="submit"
                className="cw-btn cw-btn--primary"
                style={{ flex: 2 }}
                disabled={loading}
              >
                {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</> : '💾 Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
