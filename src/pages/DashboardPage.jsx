import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../hooks/useEmployees';
import { useShifts } from '../hooks/useShifts';
import { useAbsences } from '../hooks/useAbsences';
import { useAreas } from '../hooks/useAreas';
import { useFestivos } from '../hooks/useFestivos';
import { getPeriodoActual, formatFecha, getNombreMes, toISODay } from '../core/dateUtils';
import { procesarTurnosEmpleado } from '../core/laborEngine';
import { formatCOP } from '../core/validators';
import KpiCard from '../components/KpiCard';
import TrendChart from '../components/TrendChart';
import MiniBarChart from '../components/MiniBarChart';
import StatGrid from '../components/StatGrid';
import {
  MdPeople, MdCalendarMonth, MdEventBusy, MdSchedule,
  MdWarning, MdCheckCircle, MdPersonAdd, MdEventNote,
  MdWarningAmber, MdAttachMoney, MdAccessTime, MdNightlight,
  MdInfo, MdTrendingUp, MdEventAvailable,
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

// Verifica si una hora cae en franja nocturna legal (19:00-06:00)
const isNightHour = (h) => h >= 19 || h < 6;
const shiftNightHours = (s) => {
  let total = 0;
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  let cursor = new Date(start);
  while (cursor < end) {
    if (isNightHour(cursor.getHours())) total += 1 / 60;
    cursor = new Date(cursor.getTime() + 60000);
  }
  return total;
};

// Semana ISO (lunes a domingo)
const weekBounds = (dateObj) => {
  const d = new Date(dateObj);
  const dow = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(monday.getDate() - dow + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
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
  const { festivos } = useFestivos();

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
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // ═══ Cálculo de nómina estimada ══════════════════════════════════════════════
  // Procesar todos los turnos del mes para obtener costo total, horas extras, etc.
  const nominaData = useMemo(() => {
    if (!employees.length || !shifts.length) {
      return { costoTotal: 0, horasExtras: 0, costoExtras: 0, horasOrdinarias: 0, costoOrdinarias: 0 };
    }

    const areaByEmp = {};
    areas.forEach(a => {
      (a.area_employees || []).forEach(ae => {
        if (ae.employee_id) areaByEmp[ae.employee_id] = a;
      });
    });

    let costoTotal = 0;
    let horasExtras = 0;
    let costoExtras = 0;
    let horasOrdinarias = 0;
    let costoOrdinarias = 0;

    for (const emp of employees) {
      const turnosEmp = shifts.filter(s => s.employee_id === emp.id);
      if (turnosEmp.length === 0) continue;

      const calculo = procesarTurnosEmpleado(turnosEmp, emp.valor_hora, festivos);
      costoTotal += calculo.total_bruto || 0;
      horasExtras += calculo.total_horas_extras || 0;
      horasOrdinarias += calculo.total_horas_ordinarias || 0;

      // Costo de extras
      const d = calculo.desglose;
      costoExtras += (d.HED?.valor || 0) + (d.HEN?.valor || 0) + (d.HEDD_A?.valor || 0) +
                     (d.HEDD_B?.valor || 0) + (d.HEND_A?.valor || 0) + (d.HEND_B?.valor || 0);
      costoOrdinarias += (d.horas_ordinarias?.valor || 0) + (d.HON?.valor || 0) +
                          (d.HOD_A?.valor || 0) + (d.HOD_B?.valor || 0) +
                          (d.HCDN_A?.valor || 0) + (d.HCDN_B?.valor || 0);
    }

    return {
      costoTotal: Math.round(costoTotal),
      horasExtras: Math.round(horasExtras * 10) / 10,
      costoExtras: Math.round(costoExtras),
      horasOrdinarias: Math.round(horasOrdinarias * 10) / 10,
      costoOrdinarias: Math.round(costoOrdinarias),
    };
  }, [employees, shifts, festivos, areas]);

  // Nómina del período anterior para delta
  const prevNomina = useMemo(() => {
    if (!employees.length || !prevShifts.length) return 0;
    let total = 0;
    for (const emp of employees) {
      const turnosEmp = prevShifts.filter(s => s.employee_id === emp.id);
      if (turnosEmp.length === 0) continue;
      const calculo = procesarTurnosEmpleado(turnosEmp, emp.valor_hora, festivos);
      total += calculo.total_bruto || 0;
    }
    return Math.round(total);
  }, [employees, prevShifts, festivos]);

  // ═══ Métricas básicas ════════════════════════════════════════════════════════
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
  const dCosto = nominaData.costoTotal - prevNomina;

  // ═══ Empleados sin turno ═════════════════════════════════════════════════════
  const empsSinTurno = useMemo(() => {
    if (!employees.length) return [];
    const empIdsConTurno = new Set(shifts.map(s => s.employee_id));
    return employees.filter(e => !empIdsConTurno.has(e.id) && e.activo !== false);
  }, [employees, shifts]);

  // ═══ Cumplimiento legal (42h semanales) ══════════════════════════════════════
  const cumplimiento = useMemo(() => {
    if (!employees.length || !shifts.length) {
      return { total: 0, cumplen: 0, exceden: 0, pct: 100, excedidos: [] };
    }

    const { monday, sunday } = weekBounds(hoy);
    let cumplen = 0;
    let exceden = 0;
    const excedidos = [];

    for (const emp of employees) {
      const turnosSemana = shifts.filter(s => {
        if (s.employee_id !== emp.id) return false;
        const d = new Date(s.start_time);
        return d >= monday && d <= sunday;
      });
      const horasSemana = sumHrs(turnosSemana);
      if (horasSemana > 42) {
        exceden++;
        excedidos.push({ nombre: emp.nombre, horas: Math.round(horasSemana) });
      } else {
        cumplen++;
      }
    }

    const total = cumplen + exceden;
    const pct = total > 0 ? Math.round((cumplen / total) * 100) : 100;
    return { total, cumplen, exceden, pct, excedidos };
  }, [employees, shifts, hoy]);

  // ═══ Resumen de HOY ══════════════════════════════════════════════════════════
  const resumenHoy = useMemo(() => {
    const turnosHoy = shifts.filter(s => localDate(new Date(s.start_time)) === hoyStr);
    const personasHoy = new Set(turnosHoy.map(s => s.employee_id)).size;
    const nocturnoHoy = turnosHoy.filter(s => shiftNightHours(s) > 0).length;
    const horasHoy = sumHrs(turnosHoy);

    // Novedades de hoy
    const novedadesHoy = absences.filter(a =>
      hoyStr >= a.fecha_inicio && hoyStr <= a.fecha_fin
    );

    // Turnos sin cubrir hoy
    let sinCubrirHoy = 0;
    if (areas.length && templates.length) {
      const dow = toISODay(hoy);
      areas.forEach(area => {
        const dias = area.dias_trabajo || [];
        if (!dias.includes(dow)) return;
        const tpls = templates.filter(t => t.area_id === area.id);
        tpls.forEach(t => {
          if (!turnosHoy.some(s => s.template_id === t.id)) sinCubrirHoy++;
        });
      });
    }

    return { personasHoy, nocturnoHoy, horasHoy: Math.round(horasHoy), novedadesHoy: novedadesHoy.length, sinCubrirHoy };
  }, [shifts, absences, areas, templates, hoyStr, hoy]);

  // ═══ Trend: costo proyectado por semana (ordinarias vs extras) ═══════════════
  const trendData = useMemo(() => {
    const w = { ord: {}, ext: {} };
    for (const s of shifts) {
      const k = weekOfMonth(s.start_time.slice(0, 10));
      const emp = employees.find(e => e.id === s.employee_id);
      if (!emp) continue;
      const turnosEmp = shifts.filter(sh =>
        sh.employee_id === emp.id &&
        weekOfMonth(sh.start_time.slice(0, 10)) === k
      );
      const calc = procesarTurnosEmpleado(turnosEmp, emp.valor_hora, festivos);
      w.ord[k] = (w.ord[k] || 0) + (calc.total_bruto - (calc.desglose.HED?.valor || 0) - (calc.desglose.HEN?.valor || 0) - (calc.desglose.HEDD_A?.valor || 0) - (calc.desglose.HEDD_B?.valor || 0) - (calc.desglose.HEND_A?.valor || 0) - (calc.desglose.HEND_B?.valor || 0));
      w.ext[k] = (w.ext[k] || 0) + (calc.desglose.HED?.valor || 0) + (calc.desglose.HEN?.valor || 0) + (calc.desglose.HEDD_A?.valor || 0) + (calc.desglose.HEDD_B?.valor || 0) + (calc.desglose.HEND_A?.valor || 0) + (calc.desglose.HEND_B?.valor || 0);
    }
    return [1, 2, 3, 4, 5].map(n => ({
      name: `Sem ${n}`,
      ordinarias: Math.round(w.ord[n] || 0),
      extras: Math.round(w.ext[n] || 0),
    }));
  }, [shifts, employees, festivos]);

  // ═══ Distribución por área (horas + costo) ═══════════════════════════════════
  const areaDist = useMemo(() => {
    const m = {};
    areas.forEach(a => {
      const empIds = (a.area_employees || []).map(ae => ae.employee_id).filter(Boolean);
      if (!empIds.length) return;
      const turnosArea = shifts.filter(s => empIds.includes(s.employee_id));
      const horasArea = Math.round(sumHrs(turnosArea));
      m[a.nombre] = { horas: horasArea, personas: empIds.length };
    });
    return Object.entries(m)
      .map(([l, v]) => ({ label: l, value: v.horas, subtitle: `${v.personas} personas` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [areas, shifts]);

  // ═══ Alertas de cobertura ════════════════════════════════════════════════════
  const alertas = useMemo(() => {
    if (!areas.length || !templates.length) return [];
    const dim = new Date(anio, mes, 0).getDate();
    const days = [];
    for (let i = 1; i <= dim; i++) {
      const d = new Date(anio, mes - 1, i);
      if (d >= hoy) days.push({ d, ds: localDate(d), dow: toISODay(d) });
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
    return out.sort((a, b) => b.date - a.date).slice(0, 15);
  }, [areas, templates, shifts, anio, mes, hoy]);

  // ═══ Próximas novedades (futuras, no activas) ════════════════════════════════
  const proximasNovedades = useMemo(() => {
    if (!absences.length) return [];
    return absences
      .filter(a => a.fecha_inicio > hoyStr)
      .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
      .slice(0, 5)
      .map(a => {
        const emp = employees.find(e => e.id === a.employee_id);
        return {
          ...a,
          nombre: emp?.nombre || 'Empleado',
          cargo: emp?.cargo || '',
        };
      });
  }, [absences, employees, hoyStr]);

  // ── Saludo ──
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos dias' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  const name = user?.email?.split('@')[0] || 'Administrador';

  // ── Acciones rápidas (compactas) ──
  const actions = [
    { l: 'Nuevo Empleado', i: <MdPersonAdd size={18} />, to: '/empleados', c: '#3b82f6' },
    { l: 'Programar Turnos', i: <MdEventNote size={18} />, to: '/programacion', c: '#10b981' },
    { l: 'Registrar Novedad', i: <MdWarningAmber size={18} />, to: '/novedades', c: '#f59e0b' },
    { l: 'Liquidar Prenomina', i: <MdAttachMoney size={18} />, to: '/prenomina', c: '#8b5cf6' },
  ];

  // ═════════════════════════════════════════════════════════════════ RENDER

  return (
    <div className="page-wrapper animate-fade-in">
      {/* ═══ Welcome + Acciones compactas ═══ */}
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>
            {saludo},{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--cw-accent), var(--cw-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {name}
            </span>{' '}
          </h1>
          <p className="dashboard-welcome__sub">
            {tenant?.razon_social || 'ChronosWork'} · <strong>{nombreMes} {anio}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {actions.map(item => (
            <button
              key={item.to}
              className="cw-btn cw-btn--secondary"
              onClick={() => navigate(item.to)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderColor: item.c + '40' }}
            >
              <span style={{ color: item.c }}>{item.i}</span>
              {item.l}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Fila 1: KPIs principales (4) ═══ */}
      <StatGrid columns={4}>
        <KpiCard
          icon={<MdAttachMoney />}
          title="Costo Nomina (estimado)"
          value={nominaData.costoTotal > 0 ? formatCOP(nominaData.costoTotal) : '—'}
          color="#10b981"
          subtitle={`${nominaData.horasOrdinarias}h ordinarias`}
          delta={hayHist && prevNomina > 0 ? { value: Math.abs(dCosto), positive: dCosto >= 0 } : undefined}
          onClick={() => navigate('/prenomina')}
        />
        <KpiCard
          icon={<MdPeople />}
          title="Empleados Activos"
          value={activos}
          color="#3b82f6"
          subtitle={empsSinTurno.length > 0 ? `${empsSinTurno.length} sin turno` : 'Todos con turno'}
          onClick={() => navigate('/empleados')}
        />
        <KpiCard
          icon={<MdSchedule />}
          title="Horas Programadas"
          value={Math.round(horas)}
          color="#8b5cf6"
          subtitle={`En ${nombreMes}`}
          delta={hayHist ? { value: Math.abs(dHoras), positive: dHoras >= 0 } : undefined}
          onClick={() => navigate('/programacion')}
        />
        <KpiCard
          icon={<MdEventBusy />}
          title="Novedades Activas"
          value={novedades}
          color={novedades > 0 ? '#ef4444' : '#10b981'}
          subtitle={novedades > 0 ? 'Personal no disponible' : 'Todo disponible'}
          onClick={() => navigate('/novedades')}
        />
      </StatGrid>

      {/* ═══ Fila 2: KPIs secundarios (4) ═══ */}
      <StatGrid columns={4}>
        <KpiCard
          icon={<MdCalendarMonth />}
          title="Turnos del Mes"
          value={turnos}
          color="#6366f1"
          subtitle={`En ${nombreMes}`}
          delta={hayHist ? { value: Math.abs(dTurnos), positive: dTurnos >= 0 } : undefined}
          onClick={() => navigate('/programacion')}
          size="sm"
        />
        <KpiCard
          icon={<MdAccessTime />}
          title="Horas Extras"
          value={nominaData.horasExtras > 0 ? `${nominaData.horasExtras}h` : '0h'}
          color={nominaData.horasExtras > 0 ? '#f59e0b' : '#10b981'}
          subtitle={nominaData.costoExtras > 0 ? formatCOP(nominaData.costoExtras) : 'Sin extras'}
          onClick={() => navigate('/prenomina')}
          size="sm"
        />
        <KpiCard
          icon={<MdWarning />}
          title="Sin Turno Asignado"
          value={empsSinTurno.length}
          color={empsSinTurno.length > 0 ? '#ef4444' : '#10b981'}
          subtitle={empsSinTurno.length > 0 ? 'Empleados sin programar' : 'Todos programados'}
          onClick={() => navigate('/empleados')}
          size="sm"
        />
        <KpiCard
          icon={<MdCheckCircle />}
          title="Cumplimiento Legal"
          value={`${cumplimiento.pct}%`}
          color={cumplimiento.pct >= 95 ? '#10b981' : cumplimiento.pct >= 80 ? '#f59e0b' : '#ef4444'}
          subtitle={cumplimiento.exceden > 0 ? `${cumplimiento.exceden} sobre 42h/sem` : 'Dentro de limite'}
          onClick={() => navigate('/programacion')}
          size="sm"
        />
      </StatGrid>

      {/* ═══ Resumen de HOY ═══ */}
      <div style={{
        marginBottom: '1.25rem', padding: '1rem 1.25rem', borderRadius: 12,
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
        display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          📅 HOY
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <ResumenItem icon={<MdPeople size={16} />} label="Trabajando ahora" value={`${resumenHoy.personasHoy} personas`} color="#3b82f6" />
          <ResumenItem icon={<MdNightlight size={16} />} label="Turno nocturno" value={`${resumenHoy.nocturnoHoy} turnos`} color="#6366f1" />
          <ResumenItem icon={<MdSchedule size={16} />} label="Horas hoy" value={`${resumenHoy.horasHoy}h`} color="#8b5cf6" />
          {resumenHoy.sinCubrirHoy > 0 && (
            <ResumenItem icon={<MdWarning size={16} />} label="Sin cubrir" value={`${resumenHoy.sinCubrirHoy} turnos`} color="#ef4444" />
          )}
          {resumenHoy.novedadesHoy > 0 && (
            <ResumenItem icon={<MdEventBusy size={16} />} label="Novedades" value={`${resumenHoy.novedadesHoy} activas`} color="#f59e0b" />
          )}
        </div>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="dashboard-charts">
        <TrendChart
          title="Costo Nomina por Semana"
          data={trendData}
          dataKey="ordinarias"
          xKey="name"
          type="bar"
          color="#10b981"
          height={220}
          secondDataKey="extras"
          secondColor="#f59e0b"
        />
        <div className="cw-card" style={{ padding: '1.25rem' }}>
          <div className="cw-card__header">
            <h3 className="cw-card__title">Horas por Area</h3>
          </div>
          <MiniBarChart data={areaDist} height={180} showValues />
        </div>
      </div>

      {/* ═══ Alertas de Cobertura + Cumplimiento ═══ */}
      {(alertas.length > 0 || cumplimiento.exceden > 0) && (
        <div className="cw-card dashboard-alerts" style={{ marginBottom: '1.25rem' }}>
          <div className="cw-card__header">
            <h3 className="cw-card__title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdWarning size={20} /> Alertas
            </h3>
          </div>

          {/* Cumplimiento legal */}
          {cumplimiento.exceden > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.4rem' }}>
                Cumplimiento Legal ({cumplimiento.exceden} empleados sobre 42h/sem)
              </div>
              <div className="dashboard-alerts__list">
                {cumplimiento.excedidos.slice(0, 5).map((e, i) => (
                  <div key={i} className="cw-alert cw-alert--warning">
                    <strong>{e.nombre}</strong>
                    <span className="cw-alert__time">{e.horas}h esta semana</span>
                    <span style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 700 }}>Excede 42h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cobertura de turnos */}
          {alertas.length > 0 && (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.4rem' }}>
                Cobertura ({alertas.length} turnos sin asignar)
              </div>
              <p className="dashboard-alerts__desc">Turnos del mes actual sin personal asignado.</p>
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
          )}
        </div>
      )}

      {alertas.length === 0 && cumplimiento.exceden === 0 && (
        <div className="cw-glass-panel dashboard-coverage-ok">
          <MdCheckCircle size={20} /> Todas las areas con cobertura completa · Cumplimiento legal al dia
        </div>
      )}

      {/* ═══ Empleados sin turno ═══ */}
      {empsSinTurno.length > 0 && (
        <div className="cw-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
          <div className="cw-card__header" style={{ marginBottom: '0.5rem' }}>
            <h3 className="cw-card__title" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdWarningAmber size={20} /> Empleados sin turno ({empsSinTurno.length})
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {empsSinTurno.slice(0, 12).map(e => (
              <span key={e.id} style={{
                fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 6,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                color: 'var(--text-secondary)',
              }}>
                {e.nombre}
              </span>
            ))}
            {empsSinTurno.length > 12 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
                ...y {empsSinTurno.length - 12} mas
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══ Proximas novedades ═══ */}
      {proximasNovedades.length > 0 && (
        <div className="cw-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
          <div className="cw-card__header" style={{ marginBottom: '0.5rem' }}>
            <h3 className="cw-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdEventAvailable size={20} color="#6366f1" /> Proximas Novedades
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {proximasNovedades.map((n, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.4rem 0.6rem', borderRadius: 8,
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {n.nombre}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.cargo}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                  {n.tipo || 'Novedad'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {formatFecha(n.fecha_inicio)}
                  {n.fecha_fin !== n.fecha_inicio && ` - ${formatFecha(n.fecha_fin)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: ResumenItem (barra de HOY) ──────────────────────────────
function ResumenItem({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginLeft: '0.3rem' }}>
          {value}
        </span>
      </div>
    </div>
  );
}
