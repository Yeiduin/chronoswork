import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDragScroll } from '../hooks/useDragScroll';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import {
  MdBusiness, MdPeople, MdCheckCircle, MdCancel, MdSchedule,
  MdWarning, MdEdit, MdRefresh, MdLogout, MdSearch,
} from 'react-icons/md';
import StatGrid from '../components/StatGrid';
import KpiCard from '../components/KpiCard';
import TrendChart from '../components/TrendChart';
import MiniBarChart from '../components/MiniBarChart';
import EditSubscriptionModal from '../components/EditSubscriptionModal';
import ManageUsersModal from '../components/ManageUsersModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Activa',     cls: 'cw-badge--green' },
  trialing:  { label: 'Trial',      cls: 'cw-badge--blue' },
  past_due:  { label: 'Vencida',    cls: 'cw-badge--yellow' },
  canceled:  { label: 'Cancelada',  cls: 'cw-badge--red' },
};

const PLAN_LABELS = {
  mensual:    'Mensual',
  trimestral: 'Trimestral',
  semestral:  'Semestral',
  anual:      'Anual',
};

const PLAN_COLORS = { mensual: 'blue', trimestral: 'purple', semestral: 'teal', anual: 'amber' };

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.canceled;
  return <span className={`cw-badge ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Página principal SaasDashboard ────────────────────────────────────────────

export default function SaasDashboardPage() {
  const { user, signOut } = useAuth();
  const { ref: tableRef, handlers, style: dragStyle } = useDragScroll();

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
  const stats = useMemo(() => ({
    total:    tenants.length,
    active:   tenants.filter(t => t.sub_status === 'active').length,
    trialing: tenants.filter(t => t.sub_status === 'trialing').length,
    past_due: tenants.filter(t => t.sub_status === 'past_due').length,
    canceled: tenants.filter(t => t.sub_status === 'canceled').length,
    expiring: tenants.filter(t => {
      if (!t.sub_expires_at) return false;
      const d = (new Date(t.sub_expires_at) - Date.now()) / 86400000;
      return d >= 0 && d <= 7;
    }).length,
  }), [tenants]);

  // ── Datos para gráfico de crecimiento (agrupado por mes) ──────────────────
  const growthData = useMemo(() => {
    const byMonth = {};
    tenants.forEach(t => {
      if (t.created_at) {
        const d = new Date(t.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    });
    const months = Object.keys(byMonth).sort();
    if (months.length < 2) return null;
    return months.map(m => {
      const [y, mo] = m.split('-');
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return { name: `${monthNames[+mo - 1]} ${y.slice(2)}`, empresas: byMonth[m] };
    });
  }, [tenants]);

  // ── Distribución por plan ─────────────────────────────────────────────────
  const planDistribution = useMemo(() => {
    const counts = { mensual: 0, trimestral: 0, semestral: 0, anual: 0 };
    tenants.forEach(t => {
      if (counts[t.sub_plan_type] !== undefined) counts[t.sub_plan_type]++;
    });
    return Object.entries(counts).map(([key, val]) => ({
      label: PLAN_LABELS[key],
      value: val,
      color: PLAN_COLORS[key],
    }));
  }, [tenants]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => tenants.filter(t => {
    const matchSearch = !search || [t.razon_social, t.nit].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === 'all' || t.sub_status === filterStatus;
    return matchSearch && matchStatus;
  }), [tenants, search, filterStatus]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* ── Header Premium ─────────────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 30%, #c7d2fe 60%, #e0e7ff 100%)',
        borderBottom: '1px solid rgba(79,70,229,0.1)',
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          padding: '1.15rem 2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
        <Link to="/landing" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem', boxShadow: '0 2px 14px rgba(79,70,229,0.2)',
              flexShrink: 0,
            }}>
              ⏱️
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                ChronosWork
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Panel de Administración SaaS
              </div>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'none' }} className="header-email">
              {user?.email}
            </span>
            <button
              className="cw-btn cw-btn--secondary"
              onClick={handleSignOut}
              style={{
                fontSize: '0.78rem', padding: '0.4rem 1rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
            >
              <MdLogout /> Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '1.75rem 2rem', maxWidth: 1400, margin: '0 auto' }}>
        {/* ── KPIs — Fila 1 (4 columnas) ───────────────────────────────────── */}
        <StatGrid columns={4}>
          <KpiCard title="Total Empresas" value={stats.total}   icon={<MdBusiness />}    color="#6366f1" size="sm" />
          <KpiCard title="Activas"        value={stats.active}  icon={<MdCheckCircle />} color="#22c55e" size="sm"
            subtitle={stats.total > 0 ? `${Math.round(stats.active / stats.total * 100)}% del total` : undefined} />
          <KpiCard title="En Trial"       value={stats.trialing} icon={<MdSchedule />}    color="#3b82f6" size="sm" />
          <KpiCard title="Vencidas"       value={stats.past_due} icon={<MdWarning />}     color="#f59e0b" size="sm"
            delta={stats.past_due > 0 ? { value: stats.past_due, positive: false } : undefined} />
        </StatGrid>

        {/* ── KPIs — Fila 2 (2 columnas) ───────────────────────────────────── */}
        <StatGrid columns={2}>
          <KpiCard title="Canceladas"     value={stats.canceled} icon={<MdCancel />}      color="#ef4444" size="sm" />
          <KpiCard title="Por Vencer (7d)" value={stats.expiring} icon={<MdWarning />}    color="#f97316" size="sm"
            delta={stats.expiring > 0 ? { value: stats.expiring, positive: false } : undefined} />
        </StatGrid>

        {/* ── Charts Row ────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem',
          marginTop: '1.25rem', marginBottom: '1.25rem',
        }}>
          {/* Crecimiento Mensual */}
          {growthData ? (
            <TrendChart
              title="📈 Crecimiento Mensual"
              data={growthData}
              dataKey="empresas"
              type="area"
              color="#6366f1"
              height={200}
            />
          ) : (
            <div className="cw-card" style={{
              padding: '1.25rem', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', minHeight: 200,
            }}>
              <div className="cw-card__header" style={{ alignSelf: 'stretch', marginBottom: '0.85rem', paddingBottom: '0.5rem' }}>
                <div className="cw-card__title">📈 Crecimiento Mensual</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '2.2rem', opacity: 0.25 }}>📊</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 240 }}>
                  Datos insuficientes — el gráfico se generará cuando haya empresas en al menos 2 meses distintos
                </div>
              </div>
            </div>
          )}

          {/* Distribución por Plan */}
          <div className="cw-card" style={{ padding: '1.25rem' }}>
            <div className="cw-card__header" style={{ marginBottom: '0.85rem', paddingBottom: '0.5rem' }}>
              <div className="cw-card__title">📊 Distribución por Plan</div>
            </div>
            <MiniBarChart data={planDistribution} height={160} showValues />
          </div>
        </div>

        {/* ── Barra de búsqueda y filtros ──────────────────────────────────── */}
        <div className="cw-card" style={{
          marginBottom: '1rem', padding: '0.85rem 1.15rem',
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <MdSearch style={{
              position: 'absolute', left: '0.75rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
            }} />
            <input
              id="search-tenants"
              type="text"
              className="cw-input"
              placeholder="Buscar empresa o NIT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { value: 'all',      label: 'Todas' },
              { value: 'active',   label: 'Activas' },
              { value: 'trialing', label: 'Trial' },
              { value: 'past_due', label: 'Vencidas' },
              { value: 'canceled', label: 'Canceladas' },
            ].map(f => (
              <button
                key={f.value}
                className="cw-btn cw-btn--sm"
                onClick={() => setFilterStatus(f.value)}
                style={{
                  fontSize: '0.72rem',
                  background: filterStatus === f.value ? 'rgba(99,102,241,0.15)' : 'var(--bg-glass)',
                  borderColor: filterStatus === f.value ? 'rgba(99,102,241,0.4)' : 'var(--border-medium)',
                  color: filterStatus === f.value ? '#a5b4fc' : 'var(--text-secondary)',
                  fontWeight: filterStatus === f.value ? 700 : 500,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            className="cw-btn cw-btn--secondary cw-btn--sm"
            onClick={loadTenants}
            title="Recargar"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto' }}
          >
            <MdRefresh /> Actualizar
          </button>
        </div>

        {/* ── Tabla de Empresas ────────────────────────────────────────────── */}
        {error && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {error}</div>}

        <div className="cw-table-wrapper" ref={tableRef} {...handlers} style={{ ...dragStyle, marginBottom: '1rem' }}>
          <table className="cw-table cw-table--striped" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>NIT</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Vence</th>
                <th style={{ textAlign: 'center', minWidth: 170 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <div className="cw-spinner" style={{ margin: '0 auto' }}></div>
                    <div style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Cargando empresas...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <MdBusiness style={{ fontSize: '2.5rem', opacity: 0.2, display: 'block', margin: '0 auto 0.75rem' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No se encontraron empresas</div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                        {search || filterStatus !== 'all' ? 'Intenta ajustar los filtros de búsqueda' : 'Aún no hay empresas registradas en la plataforma'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(t => {
                  const expiresAt = t.sub_expires_at ? new Date(t.sub_expires_at) : null;
                  const daysLeft = expiresAt ? Math.ceil((expiresAt - Date.now()) / 86400000) : null;
                  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                  const isExpired = daysLeft !== null && daysLeft < 0;

                  const rowClass = [
                    isExpiringSoon && 'cw-table__row--expiring',
                    isExpired && 'cw-table__row--expired',
                  ].filter(Boolean).join(' ');

                  return (
                    <tr key={t.tenant_id} className={rowClass || undefined} style={{ opacity: t.activo ? 1 : 0.55 }}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          {t.razon_social}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Creada: {t.created_at ? new Date(t.created_at).toLocaleDateString('es-CO') : '—'}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {t.nit}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600,
                          color: 'var(--cw-accent)',
                          background: 'rgba(59,130,246,0.1)',
                          padding: '0.15rem 0.55rem', borderRadius: 6,
                          border: '1px solid rgba(59,130,246,0.2)',
                        }}>
                          {PLAN_LABELS[t.sub_plan_type] || t.sub_plan_type || '—'}
                        </span>
                      </td>
                      <td><StatusBadge status={t.sub_status || 'canceled'} /></td>
                      <td>
                        {expiresAt ? (
                          <div>
                            <span style={{
                              color: isExpired ? '#fca5a5' : isExpiringSoon ? '#fcd34d' : 'var(--text-secondary)',
                              fontSize: '0.8rem', fontWeight: isExpiringSoon || isExpired ? 600 : 400,
                            }}>
                              {isExpiringSoon && '⚠️ '}{isExpired && '❗ '}
                              {expiresAt.toLocaleDateString('es-CO')}
                            </span>
                            {daysLeft !== null && (
                              <span style={{
                                fontSize: '0.68rem', display: 'block', marginTop: '0.12rem',
                                color: isExpired ? '#fca5a5' : isExpiringSoon ? '#f59e0b' : 'var(--text-muted)',
                              }}>
                                {daysLeft > 0 ? `En ${daysLeft} días` : daysLeft === 0 ? 'Vence hoy' : `Venció hace ${Math.abs(daysLeft)} días`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            id={`btn-users-tenant-${t.tenant_id}`}
                            className="cw-btn cw-btn--secondary cw-btn--sm"
                            onClick={() => setManagingTenant(t)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}
                            title="Gestionar usuarios"
                          >
                            <MdPeople /> Usuarios
                          </button>
                          <button
                            id={`btn-edit-tenant-${t.tenant_id}`}
                            className="cw-btn cw-btn--sm"
                            onClick={() => setEditingTenant(t)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem',
                              background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                              border: '1px solid rgba(99,102,241,0.25)',
                            }}
                            title="Editar suscripción"
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

        {/* ── Footer de tabla ──────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.5rem 0.25rem',
            fontSize: '0.75rem', color: 'var(--text-muted)',
          }}>
            <span>Mostrando <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{tenants.length}</strong> empresas</span>
            {filterStatus === 'all' && stats.expiring > 0 && (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                ⚠️ {stats.expiring} con vencimiento próximo
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Modales ────────────────────────────────────────────────────────── */}
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
