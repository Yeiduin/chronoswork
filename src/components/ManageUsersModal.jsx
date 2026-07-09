import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  MdPeople, MdCheckCircle, MdLockReset, MdMailOutline,
  MdPersonAdd, MdContentCopy, MdKey, MdRefresh,
} from 'react-icons/md';

const ROL_LABELS = {
  super_admin: { label: 'Super Admin', color: '#6366f1' },
  coordinator: { label: 'Coordinador', color: '#3b82f6' },
  admin:       { label: 'Coordinador', color: '#3b82f6' },
  empleado:    { label: 'Empleado',    color: '#22c55e' },
};

async function callEdgeFunction(fnName, body) {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message || `Error en la función ${fnName}`);
  return data;
}

export default function ManageUsersModal({ tenant, onClose }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [view, setView]         = useState('list');
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
