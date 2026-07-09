import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../hooks/useEmployees';
import { useShifts } from '../hooks/useShifts';
import { useAbsences } from '../hooks/useAbsences';
import { useAreas } from '../hooks/useAreas';
import { getPeriodoActual, formatFecha, getNombreMes, toISODay } from '../core/dateUtils';
import KpiCard from '../components/KpiCard';
import TrendChart from '../components/TrendChart';
import MiniBarChart from '../components/MiniBarChart';
import StatGrid from '../components/StatGrid';
import {
  MdPeople, MdCalendarMonth, MdEventBusy, MdSchedule,
  MdWarning, MdCheckCircle, MdPersonAdd, MdEventNote,
  MdWarningAmber, MdAttachMoney,
} from 'react-icons/md';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const prevPeriod = (p) => {
  const [y, m] = p.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
const weekOfMonth = (ds) => Math.ceil(new Date(ds + 'T12:00:00').getDate() / 7);
const hrsDiff = (s) => (new Date(s.end_time) - new Date(s.start_time)) / 3600000;
const sumHrs = (arr) => arr.reduce((acc, s) => acc + hrsDiff(s), 0);
const localDate = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { areas } = useAreas();
  const periodo = getPeriodoActual();
  const { shifts } = useShifts(periodo);
  const { shifts: prevShifts } = useShifts(prevPeriod(periodo));
  const { absences } = useAbsences();

  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    if (!tenant) return;
    supabase.from('shift_templates').select('*')
      .eq('tenant_id', tenant.id).eq('activo', true)
      .then(({ data }) => setTemplates(data || []));
  }, [tenant]);

  const [anio, mes] = periodo.split('-').map(Number);
  const nombreMes = getNombreMes(mes);
  const hoyStr = new Date().toISOString().slice(0, 10);

  // ── Métricas ──
  const activos = employees.length;
  const turnos = shifts.length;
  const horas = useMemo(() => sumHrs(shifts), [shifts]);
  const horasPrev = useMemo(() => sumHrs(prevShifts), [prevShifts]);
  const novedades = useMemo(
    () => absences.filter(a => hoyStr >= a.fecha_inicio && hoyStr <= a.fecha_fin).length,
    [absences, hoyStr],
  );
  const hayHist = prevShifts.length > 0;
  const dTurnos = turnos - prevShifts.length;
  const dHoras = Math.round(horas) - Math.round(horasPrev);

  // ── Trend: horas por semana del mes ──
  const trendData = useMemo(() => {
    const w = {};
    shifts.forEach(s => { const k = weekOfMonth(s.start_time.slice(0, 10)); w[k] = (w[k] || 0) + hrsDiff(s); });
    return [1, 2, 3, 4, 5].map(n => ({ name: `Sem ${n}`, horas: Math.round(w[n] || 0) }));
  }, [shifts]);

  // ── Distribución por área (top 5) ──
  const areaDist = useMemo(() => {
    const m = {};
    areas.forEach(a => { const c = a.area_employees?.length || 0; if (c) m[a.nombre] = c; });
    return Object.entries(m).map(([l, v]) => ({ label: l, value: v })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [areas]);

  // ── Alertas de cobertura ──
  const alertas = useMemo(() => {
    if (!areas.length || !templates.length) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dim = new Date(anio, mes, 0).getDate();
    const days = [];
    for (let i = 1; i <= dim; i++) {
      const d = new Date(anio, mes - 1, i);
      if (d >= today) days.push({ d, ds: localDate(d), dow: toISODay(d) });
    }
    const out = [];
    areas.forEach(area => {
      const dias = area.dias_trabajo || [];
      const tpls = templates.filter(t => t.area_id === area.id);
      if (!tpls.length) return;
      days.forEach(day => {
        if (!dias.includes(day.dow)) return;
        tpls.forEach(t => {
          if (shifts.some(s => s.template_id === t.id && localDate(new Date(s.start_time)) === day.ds)) return;
          out.push({ date: day.d, ds: day.ds, area: area.nombre, tpl: t.nombre, hr: `${t.hora_inicio.slice(0, 5)} a ${t.hora_fin.slice(0, 5)}` });
        });
      });
    });
    return out.sort((a, b) => b.date - a.date);
  }, [areas, templates, shifts, anio, mes]);

  // ── Saludo ──
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  const name = user?.email?.split('@')[0] || 'Administrador';

  // ── Acciones rápidas ──
  const actions = [
    { l: 'Nuevo Empleado', d: 'Registrar personal', i: <MdPersonAdd size={48} />, to: '/empleados', c: '#3b82f6' },
    { l: 'Programar Turnos', d: 'Asignar horarios del mes', i: <MdEventNote size={48} />, to: '/programacion', c: '#10b981' },
    { l: 'Registrar Novedad', d: 'Incapacidad, permiso, etc.', i: <MdWarningAmber size={48} />, to: '/novedades', c: '#f59e0b' },
    { l: 'Liquidar Prenómina', d: 'Calcular pago del período', i: <MdAttachMoney size={48} />, to: '/prenomina', c: '#8b5cf6' },
  ];

  // ── Marco legal ──
  const legal = [
    { l: 'Jornada máx.', v: '42h/sem', c: '#10b981' }, { l: 'Extra diaria', v: '2h/día', c: '#f59e0b' },
    { l: 'Extra semanal', v: '12h/sem', c: '#f59e0b' }, { l: 'Rec. nocturno', v: '+35%', c: '#3b82f6' },
    { l: 'Dom. Ene-Jun', v: '+80%', c: '#8b5cf6' }, { l: 'Dom. Jul-Dic', v: '+90%', c: '#8b5cf6' },
  ];

  // ═══════════════════════════════════════════════════════════════════ RENDER

  return (
    <div className="page-wrapper animate-fade-in">
      {/* ═══ Welcome ═══ */}
      <div className="dashboard-welcome">
        <h1>
          {saludo},{' '}
          <span style={{ background: 'linear-gradient(135deg, var(--cw-accent), var(--cw-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {name}
          </span>{' '}👋
        </h1>
        <p className="dashboard-welcome__sub">
          {tenant?.razon_social || 'ChronosWork'} · <strong>{nombreMes} {anio}</strong>
        </p>
      </div>

      {/* ═══ KPIs ═══ */}
      <StatGrid columns={4}>
        <KpiCard icon={<MdPeople />} title="Empleados Activos" value={activos} color="#3b82f6" subtitle="Personal en nómina" onClick={() => navigate('/empleados')} />
        <KpiCard icon={<MdCalendarMonth />} title="Turnos del Mes" value={turnos} color="#10b981" subtitle={`En ${nombreMes}`} delta={hayHist ? { value: Math.abs(dTurnos), positive: dTurnos >= 0 } : undefined} onClick={() => navigate('/programacion')} />
        <KpiCard icon={<MdSchedule />} title="Horas Programadas" value={Math.round(horas)} color="#8b5cf6" subtitle="Total del mes" delta={hayHist ? { value: Math.abs(dHoras), positive: dHoras >= 0 } : undefined} onClick={() => navigate('/programacion')} />
        <KpiCard icon={<MdEventBusy />} title="Novedades Activas" value={novedades} color={novedades > 0 ? '#ef4444' : '#10b981'} subtitle={novedades > 0 ? 'Personal no disponible' : 'Todo disponible'} onClick={() => navigate('/novedades')} />
      </StatGrid>

      {/* ═══ Charts Row ═══ */}
      <div className="dashboard-charts">
        <TrendChart title="📊 Horas por Semana" data={trendData} dataKey="horas" xKey="name" type="area" color="#3b82f6" height={220} />
        <div className="cw-card" style={{ padding: '1.25rem' }}>
          <div className="cw-card__header"><h3 className="cw-card__title">👥 Distribución por Área</h3></div>
          <MiniBarChart data={areaDist} height={180} showValues />
        </div>
      </div>

      {/* ═══ Coverage Alerts ═══ */}
      {alertas.length > 0 ? (
        <div className="cw-card dashboard-alerts">
          <div className="cw-card__header">
            <h3 className="cw-card__title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdWarning size={20} /> Alertas de Cobertura ({alertas.length})
            </h3>
          </div>
          <p className="dashboard-alerts__desc">Los siguientes turnos del mes actual no tienen personal asignado.</p>
          <div className="dashboard-alerts__list">
            {alertas.map((a, i) => (
              <div key={i} className="cw-alert cw-alert--warning">
                <span className="cw-alert__date">{formatFecha(a.ds)}</span>
                <span className="cw-badge cw-badge--red">{a.area}</span>
                <strong className="cw-alert__template">{a.tpl}</strong>
                <span className="cw-alert__time">{a.hr}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="cw-glass-panel dashboard-coverage-ok">
          <MdCheckCircle size={20} /> Todas las áreas con cobertura completa
        </div>
      )}

      {/* ═══ Quick Actions ═══ */}
      <div className="dashboard-section">
        <h3 className="dashboard-section__title">⚡ Acciones Rápidas</h3>
        <div className="dashboard-quick-actions">
          {actions.map(item => (
            <div key={item.to} className="cw-card cw-quick-action" onClick={() => navigate(item.to)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.to); } }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = item.c + '60'; e.currentTarget.style.boxShadow = `0 0 24px ${item.c}18`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = ''; }}>
              <div className="cw-quick-action__icon" style={{ color: item.c }}>{item.i}</div>
              <div className="cw-quick-action__label">{item.l}</div>
              <div className="cw-quick-action__desc">{item.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Legal Framework ═══ */}
      <div className="cw-glass-panel dashboard-legal">
        <span className="dashboard-legal__title">⚖️ Marco Legal 2026</span>
        {legal.map(item => (
          <div key={item.l} className="dashboard-legal__item">
            <span className="dashboard-legal__label">{item.l}</span>
            <span className="dashboard-legal__value" style={{ color: item.c }}>{item.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
