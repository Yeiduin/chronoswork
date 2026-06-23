import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import {
  MdBusiness, MdPeople, MdCheckCircle, MdCancel, MdSchedule,
  MdWarning, MdEdit, MdRefresh, MdLogout, MdSearch,
  MdLockReset, MdMailOutline, MdPersonAdd, MdContentCopy, MdKey,
} from 'react-icons/md';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Activa',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: <MdCheckCircle /> },
  trialing:  { label: 'Trial',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: <MdSchedule /> },
  past_due:  { label: 'Vencida',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <MdWarning /> },
  canceled:  { label: 'Cancelada',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <MdCancel /> },
};

const PLAN_LABELS = {
  mensual:    '1 Mes',
  trimestral: '3 Meses',
  semestral:  '6 Meses',
  anual:      '1 Año',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.canceled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.25rem 0.65rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Helper para llamar Edge Functions ──────────────────────────────────────────
// Usa supabase.functions.invoke() en lugar de fetch() manual para evitar
// problemas con la URL y el token de autenticación.
async function callEdgeFunction(fnName, body) {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message || `Error en la función ${fnName}`);
  return data;
}

// ── Modal de Gestión de Usuarios del Tenant ──────────────────────────────
const ROL_LABELS = {
  super_admin: { label: 'Super Admin', color: '#6366f1' },
  coordinator: { label: 'Coordinador', color: '#3b82f6' },
  admin:       { label: 'Coordinador', color: '#3b82f6' },
  empleado:    { label: 'Empleado',    color: '#22c55e' },
};

function ManageUsersModal({ tenant, onClose }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [view, setView]         = useState('list'); // 'list' | 'reset' | 'email' | 'create'
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm]         = useState({ email: '', password: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState('');
  const [result, setResult]     = useState(null);
  const [copied, setCopied]     = useState({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callEdgeFunction('manage-tenant-user', {
        action: 'list_users',
        tenant_id: tenant.tenant_id,
      });
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant.tenant_id]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const copyToClipboard = async (field, value) => {
    await navigator.clipboard.writeText(value);
    setCopied(p => ({ ...p, [field]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [field]: false })), 2000);
  };

  const handleAction = async () => {
    setActionLoading(true);
    setActionError('');
    setResult(null);
    try {
      let data;
      if (view === 'reset') {
        data = await callEdgeFunction('manage-tenant-user', {
          action: 'reset_password',
          user_id: selectedUser.user_id,
          new_password: form.password || undefined,
        });
      } else if (view === 'email') {
        data = await callEdgeFunction('manage-tenant-user', {
          action: 'update_email',
          user_id: selectedUser.user_id,
          new_email: form.email,
        });
      } else if (view === 'create') {
        data = await callEdgeFunction('manage-tenant-user', {
          action: 'create_admin',
          tenant_id: tenant.tenant_id,
          new_email: form.email,
          new_password: form.password || undefined,
        });
      }
      setResult(data);
      loadUsers();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const goBack = () => {
    setView('list');
    setSelectedUser(null);
    setForm({ email: '', password: '' });
    setActionError('');
    setResult(null);
  };

  const viewConfig = {
    reset:  { title: 'Resetear Contraseña', icon: <MdLockReset />, btnLabel: '🔑 Resetear Contraseña', color: '#f59e0b' },
    email:  { title: 'Cambiar Correo',       icon: <MdMailOutline />, btnLabel: '📧 Actualizar Correo', color: '#3b82f6' },
    create: { title: 'Nuevo Administrador',  icon: <MdPersonAdd />, btnLabel: '👤 Crear Administrador', color: '#22c55e' },
  };

  return (
    <div className="cw-modal-overlay" onClick={(e) => e.target === e.currentTarget && !result && onClose()}>
      <div className="cw-modal" style={{ maxWidth: 540 }}>
        <div className="cw-modal__header">
          <div className="cw-modal__title">
            <MdPeople /> Usuarios — {tenant.razon_social}
          </div>
          <button className="cw-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="cw-modal__body">

          {/* ── Vista: Lista de usuarios ── */}
          {view === 'list' && (
            <>
              {error && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {error}</div>}

              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="cw-spinner" style={{ margin: '0 auto' }}></div>
                </div>
              ) : users.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <MdPeople style={{ fontSize: '2rem', opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
                  No hay usuarios vinculados a esta empresa
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {users.map(u => {
                    const rolCfg = ROL_LABELS[u.rol] || { label: u.rol, color: '#6b7280' };
                    return (
                      <div key={u.user_id} style={{
                        padding: '0.85rem 1rem', borderRadius: 10,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--surface-1)',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: `${rolCfg.color}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 700, color: rolCfg.color,
                        }}>
                          {u.email?.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.7rem', color: rolCfg.color, fontWeight: 600 }}>{rolCfg.label}</span>
                            {u.last_sign_in_at && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Último acceso: {new Date(u.last_sign_in_at).toLocaleDateString('es-CO')}
                              </span>
                            )}
                            {!u.email_confirmed && (
                              <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>⚠️ Sin confirmar</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            id={`btn-reset-${u.user_id}`}
                            className="cw-btn cw-btn--secondary cw-btn--sm"
                            onClick={() => { setSelectedUser(u); setView('reset'); }}
                            title="Resetear contraseña"
                            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <MdLockReset /> Pass
                          </button>
                          <button
                            id={`btn-email-${u.user_id}`}
                            className="cw-btn cw-btn--secondary cw-btn--sm"
                            onClick={() => { setSelectedUser(u); setForm({ email: u.email, password: '' }); setView('email'); }}
                            title="Cambiar correo"
                            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <MdMailOutline /> Email
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  id="btn-create-admin"
                  className="cw-btn cw-btn--primary"
                  onClick={() => { setView('create'); setForm({ email: '', password: '' }); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <MdPersonAdd /> Crear nuevo administrador
                </button>
                <button className="cw-btn cw-btn--secondary" onClick={loadUsers} title="Recargar">
                  <MdRefresh />
                </button>
              </div>
            </>
          )}

          {/* ── Vista: Acción (reset/email/create) ── */}
          {view !== 'list' && (() => {
            const cfg = viewConfig[view];
            if (!cfg) return null;

            if (result) {
              const creds = result.credentials || (result.new_password ? { password: result.new_password, email: result.user_email || selectedUser?.email } : null);
              const newEmail = result.new_email;
              return (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <MdCheckCircle style={{ fontSize: '3rem', color: '#22c55e' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                      {result.message}
                    </h3>
                  </div>
                  {creds && (
                    <>
                      <div className="cw-alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                        ⚠️ Esta información solo se muestra UNA VEZ. Cópiela antes de cerrar.
                      </div>
                      {creds.email && (
                        <div className="cw-form-group">
                          <label className="cw-label">Correo</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input className="cw-input" readOnly value={creds.email} style={{ fontFamily: 'monospace', flex: 1 }} />
                            <button className="cw-btn cw-btn--secondary" style={{ flexShrink: 0, minWidth: 80, fontSize: '0.78rem' }} onClick={() => copyToClipboard('email', creds.email)}>
                              {copied.email ? <><MdCheckCircle /> Copiado</> : <><MdContentCopy /> Copiar</>}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="cw-form-group">
                        <label className="cw-label">Nueva Contraseña</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="cw-input" readOnly value={creds.password} style={{ fontFamily: 'monospace', flex: 1 }} />
                          <button className="cw-btn cw-btn--secondary" style={{ flexShrink: 0, minWidth: 80, fontSize: '0.78rem' }} onClick={() => copyToClipboard('password', creds.password)}>
                            {copied.password ? <><MdCheckCircle /> Copiado</> : <><MdContentCopy /> Copiar</>}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  {newEmail && (
                    <div className="cw-alert" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                      ✅ Correo actualizado a: <strong>{newEmail}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button className="cw-btn cw-btn--secondary" onClick={goBack} style={{ flex: 1 }}>Ver usuarios</button>
                    <button className="cw-btn cw-btn--primary" onClick={onClose} style={{ flex: 1 }}>✓ Cerrar</button>
                  </div>
                </>
              );
            }

            return (
              <>
                <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                  ← Volver a la lista
                </button>

                {selectedUser && (
                  <div style={{ padding: '0.6rem 0.9rem', borderRadius: 8, background: 'var(--surface-2)', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                    👤 <strong>{selectedUser.email}</strong> · <span style={{ color: 'var(--text-muted)' }}>{ROL_LABELS[selectedUser.rol]?.label || selectedUser.rol}</span>
                  </div>
                )}

                {actionError && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {actionError}</div>}

                {(view === 'email' || view === 'create') && (
                  <div className="cw-form-group">
                    <label className="cw-label">{view === 'create' ? 'Correo del nuevo administrador' : 'Nuevo correo electrónico'} <span className="required">*</span></label>
                    <input
                      type="email"
                      className="cw-input"
                      placeholder="admin@empresa.com"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                )}

                <div className="cw-form-group">
                  <label className="cw-label">
                    {view === 'reset' ? 'Nueva contraseña (opcional — se genera si queda vacío)' : 'Contraseña inicial (opcional)'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MdKey style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="cw-input"
                      placeholder="Se generará automáticamente..."
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      style={{ paddingLeft: '2.5rem', fontFamily: 'monospace' }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" className="cw-btn cw-btn--secondary" onClick={goBack} style={{ flex: 1 }}>Cancelar</button>
                  <button
                    id={`btn-action-${view}`}
                    type="button"
                    className="cw-btn cw-btn--primary"
                    style={{ flex: 2 }}
                    onClick={handleAction}
                    disabled={actionLoading || ((view === 'email' || view === 'create') && !form.email)}
                  >
                    {actionLoading ? <><span className="cw-spinner cw-spinner--sm"></span> Procesando...</> : cfg.btnLabel}
                  </button>
                </div>
              </>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

// ── Modal de edición de suscripción ──────────────────────────────────
function EditSubscriptionModal({ tenant, onClose, onSaved }) {
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

// ── Página principal SaasDashboard ────────────────────────────────────────────
export default function SaasDashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = typeof window !== 'undefined' ? { push: (p) => window.history.pushState({}, '', p) } : null;

  const [tenants, setTenants]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingTenant, setEditingTenant]       = useState(null);
  const [managingTenant, setManagingTenant]     = useState(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_all_tenants_with_subscriptions');
      if (rpcError) throw rpcError;
      setTenants(data || []);
    } catch (err) {
      setError('Error al cargar los tenants: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total:    tenants.length,
    active:   tenants.filter(t => t.sub_status === 'active').length,
    trialing: tenants.filter(t => t.sub_status === 'trialing').length,
    past_due: tenants.filter(t => t.sub_status === 'past_due').length,
    canceled: tenants.filter(t => t.sub_status === 'canceled').length,
    expiring: tenants.filter(t => {
      if (!t.sub_expires_at) return false;
      const daysLeft = (new Date(t.sub_expires_at) - Date.now()) / 86400000;
      return daysLeft >= 0 && daysLeft <= 7;
    }).length,
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtered = tenants.filter(t => {
    const matchSearch = !search || [t.razon_social, t.nit].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === 'all' || t.sub_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '0' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
        padding: '1.5rem 2rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '1.8rem' }}>⏱️</div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>
              ChronosWork — Panel de Control SaaS
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
              Administrador de Plataforma · {user?.email}
            </div>
          </div>
        </div>
        <button
          className="cw-btn cw-btn--secondary"
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}
        >
          <MdLogout /> Cerrar sesión
        </button>
      </div>

      <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
        {/* ── Stats Cards ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem', marginBottom: '2rem',
        }}>
          {[
            { label: 'Total Empresas',  value: stats.total,    icon: <MdBusiness />,     color: '#6366f1' },
            { label: 'Activas',         value: stats.active,   icon: <MdCheckCircle />,  color: '#22c55e' },
            { label: 'En Trial',        value: stats.trialing, icon: <MdSchedule />,     color: '#3b82f6' },
            { label: 'Vencidas',        value: stats.past_due, icon: <MdWarning />,      color: '#f59e0b' },
            { label: 'Canceladas',      value: stats.canceled, icon: <MdCancel />,       color: '#ef4444' },
            { label: 'Por vencer (7d)', value: stats.expiring, icon: <MdWarning />,      color: '#f97316' },
          ].map(stat => (
            <div key={stat.label} className="cw-card" style={{
              padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
              borderLeft: `3px solid ${stat.color}`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${stat.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', color: stat.color, flexShrink: 0,
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtros y búsqueda ───────────────────────────────────────────── */}
        <div className="cw-card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <MdSearch style={{
                position: 'absolute', left: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
              }} />
              <input
                id="search-tenants"
                type="text"
                className="cw-input"
                placeholder="Buscar empresa o NIT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
            <select
              id="filter-status"
              className="cw-input"
              style={{ flex: '0 0 180px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="trialing">En Trial</option>
              <option value="past_due">Vencidas</option>
              <option value="canceled">Canceladas</option>
            </select>
            <button
              className="cw-btn cw-btn--secondary"
              onClick={loadTenants}
              title="Recargar"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <MdRefresh /> Recargar
            </button>
          </div>
        </div>

        {/* ── Tabla de tenants ─────────────────────────────────────────────── */}
        {error && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {error}</div>}

        <div className="cw-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="cw-table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>NIT</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Notas</th>
                  <th style={{ textAlign: 'center', minWidth: 160 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="cw-spinner" style={{ margin: '0 auto' }}></div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <MdBusiness style={{ fontSize: '2rem', opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
                      No se encontraron empresas
                    </td>
                  </tr>
                ) : (
                  filtered.map(t => {
                    const expiresAt = t.sub_expires_at ? new Date(t.sub_expires_at) : null;
                    const daysLeft = expiresAt ? Math.ceil((expiresAt - Date.now()) / 86400000) : null;
                    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

                    return (
                      <tr key={t.tenant_id} style={{ opacity: t.activo ? 1 : 0.55 }}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                            {t.razon_social}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Registrada: {t.created_at ? new Date(t.created_at).toLocaleDateString('es-CO') : '—'}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{t.nit}</td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600,
                            color: 'var(--primary)',
                          }}>
                            {PLAN_LABELS[t.sub_plan_type] || t.sub_plan_type || '—'}
                          </span>
                        </td>
                        <td><StatusBadge status={t.sub_status || 'canceled'} /></td>
                        <td>
                          {expiresAt ? (
                            <span style={{ color: isExpiringSoon ? '#f59e0b' : 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: isExpiringSoon ? 600 : 400 }}>
                              {isExpiringSoon && '⚠️ '}
                              {expiresAt.toLocaleDateString('es-CO')}
                              {daysLeft !== null && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                                  {daysLeft > 0 ? `En ${daysLeft} días` : daysLeft === 0 ? 'Hoy' : `Hace ${Math.abs(daysLeft)} días`}
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ maxWidth: 180, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {t.sub_notas ? (
                            <span title={t.sub_notas} style={{
                              display: 'block', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {t.sub_notas}
                            </span>
                          ) : <span style={{ opacity: 0.4 }}>Sin notas</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              id={`btn-users-tenant-${t.tenant_id}`}
                              className="cw-btn cw-btn--secondary cw-btn--sm"
                              onClick={() => setManagingTenant(t)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                              title="Gestionar usuarios y accesos"
                            >
                              <MdPeople /> Usuarios
                            </button>
                            <button
                              id={`btn-edit-tenant-${t.tenant_id}`}
                              className="cw-btn cw-btn--secondary cw-btn--sm"
                              onClick={() => setEditingTenant(t)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                            >
                              <MdEdit /> Plan
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.78rem', color: 'var(--text-muted)',
            }}>
              Mostrando {filtered.length} de {tenants.length} empresas
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de edición ───────────────────────────────────────────────── */}
      {editingTenant && (
        <EditSubscriptionModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSaved={() => { setEditingTenant(null); loadTenants(); }}
        />
      )}

      {managingTenant && (
        <ManageUsersModal
          tenant={managingTenant}
          onClose={() => setManagingTenant(null)}
        />
      )}
    </div>
  );
}
