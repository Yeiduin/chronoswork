import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../hooks/useEmployees';
import { useShifts } from '../hooks/useShifts';
import { useAbsences } from '../hooks/useAbsences';
import { useAreas } from '../hooks/useAreas';
import { getPeriodoActual, formatFecha, getNombreMes } from '../core/dateUtils';
import { formatCOP } from '../core/validators';
import {
  MdPeople, MdCalendarMonth, MdEventBusy, MdTrendingUp,
  MdSchedule, MdCheckCircle, MdWarning, MdInfo,
} from 'react-icons/md';

function StatCard({ icon, label, value, color, sublabel, onClick }) {
  return (
    <div 
      className="cw-stat-card" 
      style={{ '--stat-color': color, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className="cw-stat-card__icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="cw-stat-card__info">
        <div className="cw-stat-card__value">{value}</div>
        <div className="cw-stat-card__label">{label}</div>
        {sublabel && (
          <div className="cw-stat-card__delta" style={{ color }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { areas } = useAreas();
  const periodoActual = getPeriodoActual();
  const { shifts } = useShifts(periodoActual);
  const { absences } = useAbsences();

  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    if (!tenant) return;
    const fetchTpls = async () => {
      const { data } = await supabase.from('shift_templates').select('*').eq('tenant_id', tenant.id).eq('activo', true);
      setTemplates(data || []);
    };
    fetchTpls();
  }, [tenant]);

  const [anio, mes] = periodoActual.split('-').map(Number);
  const nombreMes = getNombreMes(mes);

  // Métricas
  const empleadosActivos = employees.length;
  const turnosEsteMes = shifts.length;
  const hoyStr = new Date().toISOString().slice(0, 10);
  const novedadesActivas = absences.filter(a => {
    return hoyStr >= a.fecha_inicio && hoyStr <= a.fecha_fin;
  }).length;
  const horasAsignadas = shifts.reduce((acc, s) => {
    const diff = (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
    return acc + diff;
  }, 0);

  // Alertas de cobertura (desde hoy hasta fin de mes)
  const alertasCobertura = useMemo(() => {
    if (!areas.length || !templates.length) return [];
    
    const getLocalYYYYMMDD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Inicio del día local
    
    const daysInMonth = new Date(anio, mes, 0).getDate();
    const daysToCheck = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(anio, mes - 1, i);
      if (d >= today) {
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        daysToCheck.push({ date: d, dateStr: getLocalYYYYMMDD(d), dow });
      }
    }

    areas.forEach(area => {
      const areaDias = area.dias_trabajo || [];
      const areaTpls = templates.filter(t => t.area_id === area.id);
      if (!areaTpls.length) return;

      daysToCheck.forEach(day => {
        if (!areaDias.includes(day.dow)) return;
        
        areaTpls.forEach(t => {
          const isCovered = shifts.some(s => s.template_id === t.id && getLocalYYYYMMDD(new Date(s.start_time)) === day.dateStr);
          if (!isCovered) {
            alerts.push({
              date: day.date,
              dateStr: day.dateStr,
              areaName: area.nombre,
              templateName: t.nombre,
              horario: `${t.hora_inicio.slice(0,5)} a ${t.hora_fin.slice(0,5)}`
            });
          }
        });
      });
    });

    // Ordenar por fecha
    return alerts.sort((a, b) => a.date - b.date);
  }, [areas, templates, shifts, anio, mes]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
  const adminName = user?.email?.split('@')[0] || 'Administrador';

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Welcome */}
      <div className="dashboard-welcome">
        <h1>
          {saludo},{' '}
          <span style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {adminName}
          </span>
          👋
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
          {tenant?.razon_social || 'ChronosWork'} · Período activo:{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>{nombreMes} {anio}</strong>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="cw-grid cw-grid--4 dashboard-stats">
        <StatCard
          icon={<MdPeople />}
          label="Empleados Activos"
          value={empleadosActivos}
          color="#3b82f6"
          sublabel={`Personal en nómina`}
          onClick={() => navigate('/empleados')}
        />
        <StatCard
          icon={<MdCalendarMonth />}
          label="Turnos Asignados"
          value={turnosEsteMes}
          color="#10b981"
          sublabel={`En ${nombreMes}`}
          onClick={() => navigate('/programacion')}
        />
        <StatCard
          icon={<MdSchedule />}
          label="Horas Programadas"
          value={Math.round(horasAsignadas)}
          color="#8b5cf6"
          sublabel="Horas totales del mes"
          onClick={() => navigate('/programacion')}
        />
        <StatCard
          icon={<MdEventBusy />}
          label="Novedades Activas"
          value={novedadesActivas}
          color={novedadesActivas > 0 ? '#f59e0b' : '#10b981'}
          sublabel={novedadesActivas > 0 ? 'Personal no disponible' : 'Todo el personal disponible'}
          onClick={() => navigate('/novedades')}
        />
      </div>

      {/* Alertas de Cobertura */}
      {alertasCobertura.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="cw-card" style={{ border: '1px solid #fca5a5', background: 'rgba(239, 68, 68, 0.03)' }}>
            <div className="cw-card__header" style={{ paddingBottom: '0.5rem' }}>
              <h3 className="cw-card__title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MdWarning size={20} /> ¡Atención! Turnos sin personal asignado
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0 1.25rem 1rem' }}>
              Los siguientes turnos para el mes actual no tienen personal asignado. Contrata personal o asigna horas extra para cubrirlos.
            </p>
            <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alertasCobertura.map((alerta, i) => (
                <div key={i} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--bg-glass)', border: '1px solid #fca5a560', 
                  padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', width: '90px' }}>
                      {formatFecha(alerta.dateStr)}
                    </div>
                    <div>
                      <span className="cw-badge cw-badge--red" style={{ marginRight: '0.5rem' }}>{alerta.areaName}</span>
                      <strong style={{ color: 'var(--text-secondary)' }}>{alerta.templateName}</strong>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ef4444' }}>
                    {alerta.horario}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="dashboard-body">
        {/* Quick Access */}
        <div className="cw-card">
          <div className="cw-card__header">
            <h3 className="cw-card__title">⚡ Accesos Rápidos</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Registrar nuevo empleado', icon: '👤', href: '/empleados', color: '#3b82f6' },
              { label: 'Programar turnos del mes', icon: '📅', href: '/programacion', color: '#10b981' },
              { label: 'Registrar novedad', icon: '📋', href: '/novedades', color: '#f59e0b' },
              { label: 'Liquidar prenómina', icon: '💰', href: '/prenomina', color: '#8b5cf6' },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem', borderRadius: '10px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', textDecoration: 'none',
                  transition: 'var(--transition)', fontWeight: 500, fontSize: '0.875rem',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = item.color + '60';
                  e.currentTarget.style.background = item.color + '10';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-glass)';
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: item.color + '18', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                }}>
                  {item.icon}
                </span>
                {item.label}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* Legal Info */}
        <div className="cw-card">
          <div className="cw-card__header">
            <h3 className="cw-card__title">⚖️ Marco Legal Activo (2026)</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Jornada Ordinaria Máxima', value: '42 hrs/semana', icon: <MdCheckCircle />, color: '#10b981' },
              { label: 'Límite Horas Extra Diarias', value: '2 horas', icon: <MdWarning />, color: '#f59e0b' },
              { label: 'Límite Horas Extra Semanales', value: '12 horas', icon: <MdWarning />, color: '#f59e0b' },
              { label: 'Recargo Nocturno (19:00-06:00)', value: '+35%', icon: <MdInfo />, color: '#3b82f6' },
              { label: 'Recargo Dominical (Ene-Jun 2026)', value: '+80%', icon: <MdInfo />, color: '#8b5cf6' },
              { label: 'Recargo Dominical (Jul-Dic 2026)', value: '+90%', icon: <MdInfo />, color: '#8b5cf6' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.625rem 0.75rem', background: 'var(--bg-glass)',
                borderRadius: 8, fontSize: '0.82rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: item.color, fontSize: '1rem' }}>{item.icon}</span>
                  {item.label}
                </div>
                <span style={{ fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '1rem', padding: '0.6rem 0.75rem',
            background: 'rgba(59,130,246,0.08)', borderRadius: 8,
            fontSize: '0.75rem', color: 'var(--text-muted)',
            border: '1px solid rgba(59,130,246,0.15)',
          }}>
            📜 Ley 2101 de 2021 + Reforma Laboral Ley 2466 de 2025
          </div>
        </div>
      </div>
    </div>
  );
}
