import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import {
  MdPerson, MdCalendarMonth, MdEventBusy, MdCalculate,
  MdLogout, MdSchedule, MdCheckCircle, MdAccessTime,
} from 'react-icons/md';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatTime(dtStr) {
  if (!dtStr) return '—';
  return new Date(dtStr).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Bogota',
  });
}

function formatCurrency(val) {
  if (val == null) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(val);
}

const ABSENCE_LABELS = {
  vacaciones: { label: 'Vacaciones',  color: '#22c55e', icon: '🏖️' },
  incapacidad: { label: 'Incapacidad', color: '#f59e0b', icon: '🏥' },
  licencia:   { label: 'Licencia',    color: '#3b82f6', icon: '📋' },
  suspension: { label: 'Suspensión',  color: '#ef4444', icon: '⚠️' },
};

// ── Tarjeta de Turno ─────────────────────────────────────────────────────────
function ShiftCard({ shift }) {
  const startDate = new Date(shift.start_time);
  const endDate   = new Date(shift.end_time);
  const now       = new Date();
  const isToday   = startDate.toDateString() === now.toDateString();
  const isActive  = now >= startDate && now <= endDate;
  const isPast    = endDate < now;

  const netHours = ((endDate - startDate) / 3600000) - ((shift.break_minutes || 0) / 60);

  return (
    <div style={{
      padding: '1rem 1.25rem',
      borderRadius: 12,
      border: `1px solid ${isActive ? 'rgba(34,197,94,0.4)' : 'var(--border-subtle)'}`,
      background: isActive
        ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))'
        : isToday
          ? 'linear-gradient(135deg, rgba(99,102,241,0.08), var(--surface-1))'
          : 'var(--surface-1)',
      position: 'relative', overflow: 'hidden',
      opacity: isPast ? 0.65 : 1,
    }}>
      {isActive && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: '0.68rem', fontWeight: 700, color: '#22c55e',
          background: 'rgba(34,197,94,0.15)', padding: '0.15rem 0.5rem',
          borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          EN CURSO
        </div>
      )}
      {isToday && !isActive && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: '0.68rem', fontWeight: 700, color: '#6366f1',
          background: 'rgba(99,102,241,0.12)', padding: '0.15rem 0.5rem', borderRadius: 999,
        }}>
          HOY
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: isActive ? 'rgba(34,197,94,0.15)' : 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActive ? '#22c55e' : 'var(--text-muted)', fontSize: '1.3rem',
        }}>
          <MdSchedule />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            {startDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <MdAccessTime style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {formatTime(shift.start_time)} → {formatTime(shift.end_time)}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ⏱ {netHours.toFixed(1)}h netas
            </span>
            {shift.break_minutes > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ☕ {shift.break_minutes}min descanso
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal del Empleado ─────────────────────────────────────────────
export default function EmployeeProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState('turnos');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_my_employee_profile');
      if (rpcError) throw rpcError;
      setProfile(data);
    } catch (err) {
      setError('No se pudo cargar tu perfil. Contacta a tu administrador.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const employee = profile?.employee;
  const shifts   = profile?.shifts || [];
  const absences = profile?.absences || [];

  // ── Calcular pre-nómina resumida ──────────────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7);
  const shiftsThisMonth = shifts.filter(s => s.periodo === currentMonth);
  const totalHorasNetas = shiftsThisMonth.reduce((acc, s) => {
    const horas = ((new Date(s.end_time) - new Date(s.start_time)) / 3600000) - ((s.break_minutes || 0) / 60);
    return acc + Math.max(0, horas);
  }, 0);
  const valorHora = employee?.valor_hora || 0;
  const totalEstimado = totalHorasNetas * valorHora;

  // Turnos próximos (desde hoy)
  const upcomingShifts = shifts
    .filter(s => new Date(s.end_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 10);

  const pastShifts = shifts
    .filter(s => new Date(s.end_time) < new Date())
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    .slice(0, 10);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div className="cw-spinner"></div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando tu información...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cw-card" style={{ maxWidth: 400, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>😕</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="cw-btn cw-btn--primary" onClick={loadProfile}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* ── Header personal ───────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%)',
        padding: '1.5rem 1.5rem 4rem',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decoración de fondo */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: '30%', width: 150, height: 150,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '1.2rem' }}>⏱️</div>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              ChronosWork
            </span>
          </div>
          <button
            id="btn-employee-logout"
            onClick={handleSignOut}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', cursor: 'pointer', padding: '0.4rem 0.9rem',
              borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              backdropFilter: 'blur(8px)',
            }}
          >
            <MdLogout /> Salir
          </button>
        </div>

        <div style={{ marginTop: '1.25rem', position: 'relative' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', marginBottom: '0.75rem',
            border: '2px solid rgba(255,255,255,0.3)',
          }}>
            <MdPerson style={{ color: 'white' }} />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white', marginBottom: '0.2rem' }}>
            {employee?.nombre || user?.email}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.1rem' }}>
            {employee?.cargo || 'Colaborador'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            C.C. {employee?.cedula}
          </div>
        </div>
      </div>

      {/* ── Cards de resumen ──────────────────────────────────────────────── */}
      <div style={{
        padding: '0 1.25rem',
        marginTop: -32, marginBottom: '1.5rem',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
        position: 'relative', zIndex: 2,
        maxWidth: 900, marginLeft: 'auto', marginRight: 'auto',
      }}>
        {[
          {
            label: 'Turnos este mes', value: shiftsThisMonth.length,
            icon: <MdCalendarMonth />, color: '#3b82f6',
          },
          {
            label: 'Horas netas', value: totalHorasNetas.toFixed(1) + 'h',
            icon: <MdAccessTime />, color: '#6366f1',
          },
          {
            label: 'Estimado nómina', value: formatCurrency(totalEstimado),
            icon: <MdCalculate />, color: '#22c55e', small: true,
          },
        ].map(card => (
          <div key={card.label} className="cw-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${card.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', color: card.color, margin: '0 auto 0.5rem',
            }}>
              {card.icon}
            </div>
            <div style={{
              fontSize: card.small ? '0.85rem' : '1.2rem',
              fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1,
              marginBottom: '0.25rem',
            }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs de contenido ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.25rem 2rem' }}>
        {/* Tab selector */}
        <div style={{
          display: 'flex', gap: '0.25rem', marginBottom: '1.25rem',
          background: 'var(--surface-1)', borderRadius: 10, padding: '0.25rem',
          border: '1px solid var(--border-subtle)',
        }}>
          {[
            { id: 'turnos',   label: 'Mis Turnos',   icon: <MdCalendarMonth /> },
            { id: 'novedades', label: 'Novedades',   icon: <MdEventBusy /> },
            { id: 'prenomina', label: 'Pre-nómina',  icon: <MdCalculate /> },
          ].map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '0.6rem 0.5rem',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s',
                background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Turnos ───────────────────────────────────────────────────── */}
        {activeTab === 'turnos' && (
          <div className="animate-fade-in">
            {upcomingShifts.length > 0 && (
              <>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Próximos turnos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {upcomingShifts.map(s => <ShiftCard key={s.id} shift={s} />)}
                </div>
              </>
            )}

            {pastShifts.length > 0 && (
              <>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Turnos recientes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {pastShifts.map(s => <ShiftCard key={s.id} shift={s} />)}
                </div>
              </>
            )}

            {shifts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <MdCalendarMonth style={{ fontSize: '2.5rem', opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                <p>Aún no tienes turnos asignados</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Novedades ────────────────────────────────────────────────── */}
        {activeTab === 'novedades' && (
          <div className="animate-fade-in">
            {absences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <MdCheckCircle style={{ fontSize: '2.5rem', color: '#22c55e', display: 'block', margin: '0 auto 0.75rem' }} />
                <p>No tienes novedades registradas</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {absences.map(a => {
                  const cfg = ABSENCE_LABELS[a.tipo] || { label: a.tipo, color: '#6366f1', icon: '📌' };
                  return (
                    <div key={a.id} className="cw-card" style={{
                      padding: '1rem 1.25rem',
                      borderLeft: `3px solid ${cfg.color}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.3rem' }}>{cfg.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {cfg.label}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {formatDate(a.fecha_inicio)} → {formatDate(a.fecha_fin)}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600,
                          color: a.aprobada ? '#22c55e' : '#f59e0b',
                          background: a.aprobada ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                          padding: '0.2rem 0.6rem', borderRadius: 999,
                        }}>
                          {a.aprobada ? '✓ Aprobada' : '⏳ Pendiente'}
                        </span>
                      </div>
                      {a.observaciones && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginLeft: '2rem' }}>
                          {a.observaciones}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Pre-nómina ───────────────────────────────────────────────── */}
        {activeTab === 'prenomina' && (
          <div className="animate-fade-in">
            <div className="cw-card" style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), var(--surface-1))',
              borderColor: 'rgba(99,102,241,0.2)',
              marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estimado pre-nómina — {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                {formatCurrency(totalEstimado)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span>⏱ {totalHorasNetas.toFixed(2)} horas netas</span>
                <span>💵 {formatCurrency(valorHora)}/hora</span>
                <span>📋 {shiftsThisMonth.length} turnos este mes</span>
              </div>
            </div>

            <div className="cw-alert" style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              color: 'var(--text-secondary)',
              borderRadius: 10, padding: '0.75rem 1rem',
              fontSize: '0.78rem',
            }}>
              ℹ️ Este valor es un <strong>estimado de pre-nómina</strong> basado en tus horas netas del mes actual.
              No incluye recargos nocturnos, dominicales, ni deducciones. El valor final lo calcula el área de Gestión Humana.
            </div>

            {shiftsThisMonth.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                <MdCalculate style={{ fontSize: '2rem', opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
                <p>No hay turnos registrados en el mes actual</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
