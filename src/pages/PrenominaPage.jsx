import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDragScroll } from '../hooks/useDragScroll';
import { useShifts } from '../hooks/useShifts';
import { useEmployees } from '../hooks/useEmployees';
import { useAreas } from '../hooks/useAreas';
import { useFestivos } from '../hooks/useFestivos';
import { procesarTurnosEmpleado } from '../core/laborEngine';
import { formatCOP } from '../core/validators';
import { getNombreMes } from '../core/dateUtils';
import {
  MdCalculate, MdDownload, MdChevronLeft, MdChevronRight,
  MdPerson, MdOutlineTableChart, MdBarChart,
  MdOutlineGridView, MdSearch, MdFilterList,
  MdWarning, MdCheckCircle, MdAccessTime,
  MdArrowUpward, MdArrowDownward,
} from 'react-icons/md';

// ── Constantes ──────────────────────────────────────────────────────────────
const CONCEPTOS = [
  { key: 'horas_ordinarias', label: 'H. Ordinarias Diurnas', short: 'HOD',   factor: '×1.00', color: '#10b981', group: 'ordinarias' },
  { key: 'HON',              label: 'H. Ordinaria Nocturna', short: 'HON',   factor: '+35%',  color: '#6366f1', group: 'ordinarias' },
  { key: 'HOD_A',            label: 'H. Ord. Dominical A',   short: 'HOD-A', factor: '+80%',  color: '#f59e0b', group: 'dominicales' },
  { key: 'HOD_B',            label: 'H. Ord. Dominical B',   short: 'HOD-B', factor: '+90%',  color: '#f59e0b', group: 'dominicales' },
  { key: 'HCDN_A',           label: 'H. Dom+Noct A',         short: 'HDN-A', factor: '+115%', color: '#ec4899', group: 'dominicales' },
  { key: 'HCDN_B',           label: 'H. Dom+Noct B',         short: 'HDN-B', factor: '+125%', color: '#ec4899', group: 'dominicales' },
  { key: 'HED',              label: 'H. Extra Diurna',        short: 'HED',   factor: '+25%',  color: '#3b82f6', group: 'extras' },
  { key: 'HEN',              label: 'H. Extra Nocturna',      short: 'HEN',   factor: '+75%',  color: '#8b5cf6', group: 'extras' },
  { key: 'HEDD_A',           label: 'HE Diurna Dom A',        short: 'HED-A', factor: '+105%', color: '#f97316', group: 'extras' },
  { key: 'HEDD_B',           label: 'HE Diurna Dom B',        short: 'HED-B', factor: '+115%', color: '#f97316', group: 'extras' },
  { key: 'HEND_A',           label: 'HE Noct Dom A',          short: 'HEN-A', factor: '+155%', color: '#ef4444', group: 'extras' },
  { key: 'HEND_B',           label: 'HE Noct Dom B',          short: 'HEN-B', factor: '+165%', color: '#ef4444', group: 'extras' },
];

const GRUPOS = {
  ordinarias:  { label: 'Ordinarias',   color: '#10b981' },
  dominicales: { label: 'Dominicales',  color: '#f59e0b' },
  extras:      { label: 'Extras',       color: '#3b82f6' },
};

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function pct(val, total) {
  if (!total) return 0;
  return Math.min(100, (val / total) * 100);
}

function HorasBar({ horas, max, color = '#3b82f6' }) {
  const w = pct(horas, max);
  return (
    <div style={{ background: 'var(--border-subtle)', borderRadius: 3, height: 5, overflow: 'hidden', marginTop: 2 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  );
}

function Badge({ children, color = '#3b82f6' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: color + '20', color, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '0.1rem 0.45rem',
      fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.4,
    }}>
      {children}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA 1 — TABLA DE AUDITORÍA (desglose completo por concepto)
// ════════════════════════════════════════════════════════════════════════════
function VistaTabla({ resultados, searchTerm, sortCol, sortDir, onSort }) {
  const { ref: tableRef, handlers, style: dragStyle } = useDragScroll();
  const filtered = useMemo(() => {
    let r = resultados;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      r = r.filter(e => e.nombre?.toLowerCase().includes(t) || e.cargo?.toLowerCase().includes(t));
    }
    return [...r].sort((a, b) => {
      let va, vb;
      if (sortCol === 'nombre') { va = a.nombre; vb = b.nombre; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
      if (sortCol === 'turnos') { va = a.turnos; vb = b.turnos; }
      else if (sortCol === 'total') { va = a.total_bruto; vb = b.total_bruto; }
      else if (sortCol === 'horas') { va = a.total_horas_ordinarias; vb = b.total_horas_ordinarias; }
      else { va = a.desglose?.[sortCol]?.horas || 0; vb = b.desglose?.[sortCol]?.horas || 0; }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [resultados, searchTerm, sortCol, sortDir]);

  const SortTh = ({ col, children, style }) => {
    const active = sortCol === col;
    return (
      <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', ...style }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: style?.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
          {children}
          {active ? (sortDir === 'asc' ? <MdArrowUpward style={{ fontSize: '0.7rem', color: 'var(--cw-accent)' }} /> : <MdArrowDownward style={{ fontSize: '0.7rem', color: 'var(--cw-accent)' }} />) : null}
        </span>
      </th>
    );
  };

  return (
    <div className="cw-table-wrapper pn-table-wrapper" ref={tableRef} {...handlers} style={dragStyle}>
      <table className="cw-table pn-audit-table">
        <thead>
          <tr>
            <SortTh col="nombre" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 5, minWidth: 200 }}>Colaborador</SortTh>
            <SortTh col="turnos" style={{ textAlign: 'center', minWidth: 60 }}>T.</SortTh>
            <SortTh col="horas" style={{ textAlign: 'right', minWidth: 70 }}>H.Tot</SortTh>
            {CONCEPTOS.map(c => (
              <th key={c.key} title={`${c.label} (${c.factor})`}
                style={{ textAlign: 'right', minWidth: 68, fontSize: '0.62rem', whiteSpace: 'nowrap' }}>
                <span style={{ color: c.color, fontWeight: 800 }}>{c.short}</span>
                <div style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.55rem' }}>{c.factor}</div>
              </th>
            ))}
            <SortTh col="total" style={{ textAlign: 'right', minWidth: 120, background: 'rgba(59,130,246,0.04)' }}>
              <span style={{ color: 'var(--cw-accent)' }}>TOTAL</span>
            </SortTh>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => {
            const totalH = (r.total_horas_ordinarias || 0) + (r.total_horas_extras || 0);
            const tieneExtras = (r.total_horas_extras || 0) > 0;
            const tieneAdv = r.clasificacion?.advertencias?.length > 0;
            return (
              <tr key={r.id} className={r.turnos === 0 ? 'pn-row--sin-turnos' : ''}>
                {/* Empleado */}
                <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 3, borderRight: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <div className="pn-avatar">
                      {(r.nombre || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: r.turnos === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {r.nombre}
                        {tieneAdv && <MdWarning style={{ color: '#f59e0b', marginLeft: 4, verticalAlign: 'middle', fontSize: '0.85rem' }} title={r.clasificacion.advertencias.join('\n')} />}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{r.cargo}</div>
                    </div>
                  </div>
                </td>
                {/* Turnos */}
                <td style={{ textAlign: 'center' }}>
                  <Badge color={r.turnos > 0 ? '#3b82f6' : 'var(--text-muted)'}>{r.turnos}</Badge>
                </td>
                {/* Total horas */}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  {totalH > 0 ? (
                    <span style={{ color: tieneExtras ? '#f59e0b' : 'var(--text-primary)' }}>
                      {totalH.toFixed(1)}h
                    </span>
                  ) : <span style={{ opacity: 0.45 }}>—</span>}
                </td>
                {/* Conceptos */}
                {CONCEPTOS.map(c => {
                  const horas = r.desglose?.[c.key]?.horas || 0;
                  const valor = r.desglose?.[c.key]?.valor || 0;
                  return (
                    <td key={c.key} style={{ textAlign: 'right' }} className={horas > 0 ? 'pn-cell--active' : 'pn-cell--zero'}>
                      {horas > 0 ? (
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: c.color }}>{horas.toFixed(2)}h</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 1 }}>{formatCOP(valor)}</div>
                        </div>
                      ) : <span style={{ opacity: 0.18, fontSize: '0.7rem' }}>—</span>}
                    </td>
                  );
                })}
                {/* Total */}
                <td style={{ textAlign: 'right', background: 'rgba(59,130,246,0.03)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 800, color: r.total_bruto > 0 ? '#6ee7b7' : 'var(--text-muted)' }}>
                    {r.total_bruto > 0 ? formatCOP(r.total_bruto) : '—'}
                  </div>
                  {r.valor_hora > 0 && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 1 }}>{formatCOP(r.valor_hora)}/h</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="pn-total-row">
            <td colSpan={3} style={{ fontWeight: 800, fontSize: '0.82rem' }}>TOTAL GENERAL</td>
            {CONCEPTOS.map(c => {
              const totalHoras = resultados.reduce((a, r) => a + (r.desglose?.[c.key]?.horas || 0), 0);
              const totalValor = resultados.reduce((a, r) => a + (r.desglose?.[c.key]?.valor || 0), 0);
              return (
                <td key={c.key} style={{ textAlign: 'right' }}>
                  {totalHoras > 0 ? (
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: c.color }}>{totalHoras.toFixed(2)}h</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{formatCOP(totalValor)}</div>
                    </div>
                  ) : null}
                </td>
              );
            })}
            <td style={{ textAlign: 'right', background: 'rgba(59,130,246,0.06)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 800, color: '#6ee7b7' }}>
                {formatCOP(resultados.reduce((a, r) => a + (r.total_bruto || 0), 0))}
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA 2 — TARJETAS por empleado (resumen visual)
// ════════════════════════════════════════════════════════════════════════════
function VistaTarjetas({ resultados, searchTerm, areaFilter }) {
  const maxBruto = useMemo(() => Math.max(...resultados.map(r => r.total_bruto || 0), 1), [resultados]);

  const filtered = useMemo(() => {
    let r = resultados.filter(e => e.turnos > 0);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      r = r.filter(e => e.nombre?.toLowerCase().includes(t) || e.cargo?.toLowerCase().includes(t));
    }
    if (areaFilter !== 'all') r = r.filter(e => e._areaId === areaFilter);
    return r.sort((a, b) => b.total_bruto - a.total_bruto);
  }, [resultados, searchTerm, areaFilter]);

  if (filtered.length === 0) return (
    <div className="pn-empty-state">
      <MdPerson style={{ fontSize: '2.5rem', opacity: 0.2 }} />
      <p>Sin resultados para el filtro seleccionado</p>
    </div>
  );

  return (
    <div className="pn-cards-grid">
      {filtered.map((r, i) => {
        const tieneExtras = (r.total_horas_extras || 0) > 0;
        const tieneAdv = r.clasificacion?.advertencias?.length > 0;
        const totalH = (r.total_horas_ordinarias || 0) + (r.total_horas_extras || 0);
        const pctBruto = pct(r.total_bruto, maxBruto);
        const initials = (r.nombre || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

        const conceptosActivos = CONCEPTOS.filter(c => (r.desglose?.[c.key]?.horas || 0) > 0);

        return (
          <div key={r.id} className="pn-card animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
            {/* Cabecera */}
            <div className="pn-card__header">
              <div className="pn-card__avatar">{initials}</div>
              <div className="pn-card__info">
                <div className="pn-card__name">
                  {r.nombre}
                  {tieneAdv && <MdWarning title={r.clasificacion.advertencias[0]} style={{ color: '#f59e0b', fontSize: '0.85rem', marginLeft: 4, verticalAlign: 'middle' }} />}
                </div>
                <div className="pn-card__cargo">{r.cargo}</div>
              </div>
              <div className="pn-card__rank">#{i + 1}</div>
            </div>

            {/* Total */}
            <div className="pn-card__total">
              {formatCOP(r.total_bruto)}
            </div>
            <div className="pn-card__totalbar">
              <div style={{ width: `${pctBruto}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #6ee7b7)', borderRadius: 4, transition: 'width 0.5s' }} />
            </div>

            {/* Stats secundarias */}
            <div className="pn-card__stats">
              <div className="pn-card__stat">
                <span>⏱</span>
                <strong>{totalH.toFixed(1)}h</strong>
                <span>totales</span>
              </div>
              <div className="pn-card__stat">
                <span>📋</span>
                <strong>{r.turnos}</strong>
                <span>turnos</span>
              </div>
              <div className="pn-card__stat">
                <span>💵</span>
                <strong>{formatCOP(r.valor_hora || 0)}</strong>
                <span>/h</span>
              </div>
              {tieneExtras && (
                <div className="pn-card__stat pn-card__stat--warn">
                  <span>🔶</span>
                  <strong>{(r.total_horas_extras || 0).toFixed(1)}h</strong>
                  <span>extras</span>
                </div>
              )}
            </div>

            {/* Conceptos activos */}
            {conceptosActivos.length > 0 && (
              <div className="pn-card__concepts">
                {conceptosActivos.map(c => (
                  <span key={c.key} className="pn-concept-pill" style={{ color: c.color, borderColor: c.color + '40', background: c.color + '12' }}>
                    {c.short} · {(r.desglose[c.key].horas || 0).toFixed(1)}h
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA 3 — DESGLOSE POR CONCEPTOS (barras agrupadas)
// ════════════════════════════════════════════════════════════════════════════
function VistaConceptos({ resultados }) {
  // Totales por concepto
  const totales = useMemo(() => {
    const t = {};
    CONCEPTOS.forEach(c => {
      t[c.key] = {
        horas: resultados.reduce((a, r) => a + (r.desglose?.[c.key]?.horas || 0), 0),
        valor: resultados.reduce((a, r) => a + (r.desglose?.[c.key]?.valor || 0), 0),
        empleados: resultados.filter(r => (r.desglose?.[c.key]?.horas || 0) > 0).length,
      };
    });
    return t;
  }, [resultados]);

  const maxHoras = Math.max(...Object.values(totales).map(t => t.horas), 1);
  const maxValor = Math.max(...Object.values(totales).map(t => t.valor), 1);

  // Top empleados por concepto
  const topPorConcepto = useMemo(() => {
    const m = {};
    CONCEPTOS.forEach(c => {
      m[c.key] = [...resultados]
        .filter(r => (r.desglose?.[c.key]?.horas || 0) > 0)
        .sort((a, b) => (b.desglose[c.key].horas || 0) - (a.desglose[c.key].horas || 0))
        .slice(0, 3);
    });
    return m;
  }, [resultados]);

  return (
    <div>
      {Object.entries(GRUPOS).map(([groupKey, groupMeta]) => {
        const groupConceptos = CONCEPTOS.filter(c => c.group === groupKey && totales[c.key].horas > 0);
        if (groupConceptos.length === 0) return null;
        return (
          <div key={groupKey} className="pn-group-section">
            <div className="pn-group-title">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: groupMeta.color, display: 'inline-block' }} />
              {groupMeta.label}
              <Badge color={groupMeta.color}>{groupConceptos.length} conceptos</Badge>
            </div>
            <div className="pn-conceptos-grid">
              {groupConceptos.map(c => {
                const t = totales[c.key];
                return (
                  <div key={c.key} className="pn-concepto-card">
                    <div className="pn-concepto-card__header">
                      <div>
                        <div className="pn-concepto-card__label" style={{ color: c.color }}>{c.short}</div>
                        <div className="pn-concepto-card__full">{c.label}</div>
                      </div>
                      <Badge color={c.color}>{c.factor}</Badge>
                    </div>

                    <div className="pn-concepto-card__metric">
                      <span className="pn-concepto-card__horas">{t.horas.toFixed(2)}<small>h</small></span>
                      <span className="pn-concepto-card__valor">{formatCOP(t.valor)}</span>
                    </div>

                    {/* Barra horas */}
                    <div style={{ marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                        <span>{t.empleados} colaborador(es)</span>
                        <span>{pct(t.horas, maxHoras).toFixed(0)}% del máx.</span>
                      </div>
                      <HorasBar horas={t.horas} max={maxHoras} color={c.color} />
                    </div>

                    {/* Top empleados */}
                    <div className="pn-concepto-top">
                      {topPorConcepto[c.key].map(r => (
                        <div key={r.id} className="pn-concepto-top__item">
                          <span className="pn-concepto-top__name" title={r.nombre}>{r.nombre?.split(' ')[0]}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: c.color }}>
                            {(r.desglose[c.key].horas || 0).toFixed(1)}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Resumen global */}
      <div className="pn-global-summary">
        <div className="pn-global-summary__title">Resumen Global del Período</div>
        <div className="pn-global-summary__grid">
          {Object.entries(GRUPOS).map(([gk, gm]) => {
            const gConceptos = CONCEPTOS.filter(c => c.group === gk);
            const gHoras = gConceptos.reduce((a, c) => a + (totales[c.key]?.horas || 0), 0);
            const gValor = gConceptos.reduce((a, c) => a + (totales[c.key]?.valor || 0), 0);
            return (
              <div key={gk} className="pn-global-summary__item" style={{ borderColor: gm.color + '40' }}>
                <div style={{ color: gm.color, fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.5rem' }}>{gm.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{gHoras.toFixed(1)}<small style={{ fontSize: '0.65rem' }}>h</small></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{formatCOP(gValor)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function PrenominaPage() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes]   = useState(new Date().getMonth() + 1);
  const [calculado, setCalculado] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [calculando, setCalculando] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const autoCalcRef = useRef(false);

  // UI State
  const [activeView, setActiveView] = useState('tabla');   // tabla | tarjetas | conceptos
  const [searchTerm, setSearchTerm]  = useState('');
  const [areaFilter, setAreaFilter]  = useState('all');
  const [sortCol, setSortCol] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [showSoloConTurnos, setShowSoloConTurnos] = useState(true);

  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
  const { shifts } = useShifts(periodo);
  const { employees } = useEmployees();
  const { areas } = useAreas();
  const { festivos } = useFestivos(anio);

  // Periodos para cargar
  const periodos = useMemo(() => [periodo], [periodo]);

  const handlePrev = () => { setCalculado(false); setCalculando(true); if (mes === 1) { setMes(12); setAnio(anio - 1); } else setMes(mes - 1); };
  const handleNext = () => { setCalculado(false); setCalculando(true); if (mes === 12) { setMes(1); setAnio(anio + 1); } else setMes(mes + 1); };

  const handleSort = useCallback((col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }, [sortCol]);

  const handleCalcular = useCallback(() => {
    setCalculando(true);
    // Construir mapa area por empleado
    const areaByEmp = {};
    areas.forEach(a => {
      (a.area_employees || []).forEach(ae => {
        if (ae.employee_id) areaByEmp[ae.employee_id] = a;
      });
    });

    const res = employees.map(emp => {
      const turnosEmp = shifts.filter(s => s.employee_id === emp.id);
      const calculo = procesarTurnosEmpleado(turnosEmp, emp.valor_hora, festivos);
      const empArea = areaByEmp[emp.id];
      return {
        ...emp,
        ...calculo,
        turnos: turnosEmp.length,
        _areaId: empArea?.id || null,
        _areaNombre: empArea?.nombre || 'Sin área',
        _areaColor: empArea?.color || '#6366f1',
      };
    });
    setResultados(res);
    setCalculado(true);
    setCalculando(false);
  }, [employees, shifts, festivos, areas]);

  // Auto-calcular al montar y al cambiar de mes/año
  useEffect(() => {
    if (employees.length > 0 && shifts.length > 0) {
      handleCalcular();
      autoCalcRef.current = true;
    } else if (employees.length > 0 && !autoCalcRef.current && !calculando) {
      // Sin turnos pero con empleados: mostrar resultados vacíos
      setResultados(employees.map(emp => ({
        ...emp,
        turnos: 0,
        total_bruto: 0,
        total_horas_ordinarias: 0,
        total_horas_extras: 0,
        desglose: {},
        advertencias: [],
      })));
      setCalculado(true);
    }
    setIsInitialLoad(false);
  }, [mes, anio, employees, shifts.length, handleCalcular, calculando]);

  const handleExportCSV = () => {
    const headers = ['Empleado','Cédula','Cargo','Área','Valor/Hora','Turnos',
      ...CONCEPTOS.map(c => `${c.short} (h)`),
      ...CONCEPTOS.map(c => `${c.short} ($)`),
      'Total Bruto'];
    const rows = resultados.map(r => [
      r.nombre, r.cedula, r.cargo, r._areaNombre, r.valor_hora, r.turnos,
      ...CONCEPTOS.map(c => r.desglose?.[c.key]?.horas || 0),
      ...CONCEPTOS.map(c => r.desglose?.[c.key]?.valor || 0),
      r.total_bruto,
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `prenomina_${periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Métricas globales
  const totalGeneral      = useMemo(() => resultados.reduce((a, r) => a + (r.total_bruto || 0), 0), [resultados]);
  const empConTurnos      = useMemo(() => resultados.filter(r => r.turnos > 0), [resultados]);
  const totalHorasNetas   = useMemo(() => empConTurnos.reduce((a, r) => a + (r.total_horas_ordinarias || 0) + (r.total_horas_extras || 0), 0), [empConTurnos]);
  const totalHorasExtras  = useMemo(() => empConTurnos.reduce((a, r) => a + (r.total_horas_extras || 0), 0), [empConTurnos]);
  const empConExtras       = useMemo(() => empConTurnos.filter(r => (r.total_horas_extras || 0) > 0).length, [empConTurnos]);
  const promedioEmp        = useMemo(() => empConTurnos.length ? totalGeneral / empConTurnos.length : 0, [totalGeneral, empConTurnos]);

  const resultadosVista = useMemo(() => {
    let r = resultados;
    if (showSoloConTurnos) r = r.filter(e => e.turnos > 0);
    if (areaFilter !== 'all') r = r.filter(e => e._areaId === areaFilter);
    return r;
  }, [resultados, showSoloConTurnos, areaFilter]);

  return (
    <div className="page-wrapper animate-fade-in pn-shell">
      {/* ════ HERO HEADER ════ */}
      <div className="pn-hero">
        <div className="pn-hero__bg" />
        <div className="pn-hero__content">
          <div className="pn-hero__left">
            <div className="pn-hero__icon">💰</div>
            <div>
              <h1 className="pn-hero__title">Liquidación de Pre-nómina</h1>
              <p className="pn-hero__subtitle">Motor CST Colombia · Ley 2101/2021 + Ley 2466/2025</p>
            </div>
          </div>

          {/* Selector de período */}
          <div className="pn-hero__period">
            <button className="pn-period-btn" onClick={handlePrev}><MdChevronLeft /></button>
            <div className="pn-period-display">
              <select
                className="pn-month-select"
                value={mes}
                onChange={e => { setMes(Number(e.target.value)); setCalculado(false); }}
              >
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <select
                className="pn-year-select"
                value={anio}
                onChange={e => { setAnio(Number(e.target.value)); setCalculado(false); }}
              >
                {[anio - 1, anio, anio + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="pn-period-btn" onClick={handleNext}><MdChevronRight /></button>
          </div>

          {/* Acciones */}
          <div className="pn-hero__actions">
            <button
              id="btn-calcular-prenomina"
              className={`pn-calc-btn ${calculando ? 'pn-calc-btn--loading' : ''}`}
              onClick={handleCalcular}
              disabled={calculando}
            >
              {calculando ? <span className="cw-spinner-sm" /> : <MdCalculate />}
              {calculando ? 'Calculando...' : <><MdCalculate /> Recalcular</>}
            </button>
            {calculado && (
              <button id="btn-export-csv" className="pn-export-btn" onClick={handleExportCSV}>
                <MdDownload /> Exportar CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ════ KPI CARDS ════ */}
      {calculado && (
        <div className="pn-kpi-row animate-fade-in">
          <div className="pn-kpi pn-kpi--green">
            <div className="pn-kpi__label">Total a Pagar</div>
            <div className="pn-kpi__value">{formatCOP(totalGeneral)}</div>
            <div className="pn-kpi__sub">{getNombreMes(mes)} {anio}</div>
          </div>
          <div className="pn-kpi pn-kpi--blue">
            <div className="pn-kpi__label">Colaboradores con Turnos</div>
            <div className="pn-kpi__value">{empConTurnos.length}</div>
            <div className="pn-kpi__sub">de {employees.length} registrados</div>
          </div>
          <div className="pn-kpi pn-kpi--purple">
            <div className="pn-kpi__label">Total Horas del Período</div>
            <div className="pn-kpi__value">{totalHorasNetas.toFixed(1)}<small>h</small></div>
            <div className="pn-kpi__sub">promedio {empConTurnos.length ? (totalHorasNetas / empConTurnos.length).toFixed(1) : 0}h/persona</div>
          </div>
          <div className="pn-kpi pn-kpi--amber">
            <div className="pn-kpi__label">Horas Extras</div>
            <div className="pn-kpi__value">{totalHorasExtras.toFixed(1)}<small>h</small></div>
            <div className="pn-kpi__sub">{empConExtras} empleado(s) con extras</div>
          </div>
          <div className="pn-kpi pn-kpi--indigo">
            <div className="pn-kpi__label">Promedio por Empleado</div>
            <div className="pn-kpi__value">{formatCOP(Math.round(promedioEmp))}</div>
            <div className="pn-kpi__sub">{shifts.length} turnos procesados</div>
          </div>
        </div>
      )}

      {/* ════ CARGA INICIAL ════ */}
      {calculando && (
        <div className="pn-welcome" style={{ minHeight: 200 }}>
          <div className="pn-welcome__inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="cw-spinner" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Calculando pre-nómina de <strong>{getNombreMes(mes)} {anio}</strong>...
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Procesando {shifts.length} turnos de {employees.length} colaboradores
            </p>
          </div>
        </div>
      )}

      {/* ════ TOOLBAR + VISTAS ════ */}
      {calculado && (
        <>
          {/* Toolbar */}
          <div className="pn-toolbar">
            {/* Vistas */}
            <div className="pn-view-tabs">
              {[
                { id: 'tabla',     icon: <MdOutlineTableChart />, label: 'Auditoría' },
                { id: 'tarjetas',  icon: <MdOutlineGridView />,   label: 'Tarjetas' },
                { id: 'conceptos', icon: <MdBarChart />,          label: 'Conceptos' },
              ].map(v => (
                <button
                  key={v.id}
                  className={`pn-view-tab ${activeView === v.id ? 'pn-view-tab--active' : ''}`}
                  onClick={() => setActiveView(v.id)}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>

            {/* Filtros */}
            <div className="pn-filters">
              {/* Búsqueda */}
              <div className="pn-search">
                <MdSearch className="pn-search__icon" />
                <input
                  className="pn-search__input"
                  placeholder="Buscar colaborador..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtro por área */}
              <select
                className="pn-filter-select"
                value={areaFilter}
                onChange={e => setAreaFilter(e.target.value)}
              >
                <option value="all">Todas las áreas</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>

              {/* Toggle sin turnos */}
              <label className="pn-toggle" title="Mostrar solo empleados con turnos asignados">
                <input
                  type="checkbox"
                  checked={showSoloConTurnos}
                  onChange={e => setShowSoloConTurnos(e.target.checked)}
                />
                <span className="pn-toggle__track" />
                <span className="pn-toggle__label">Solo con turnos</span>
              </label>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="pn-results-bar">
            <div className="pn-results-bar__count">
              <MdCheckCircle style={{ color: '#10b981' }} />
              Mostrando <strong>{resultadosVista.length}</strong> colaborador(es)
              {areaFilter !== 'all' && <span> · área filtrada</span>}
              {searchTerm && <span> · búsqueda activa</span>}
            </div>
            {totalHorasExtras > 0 && (
              <div className="pn-results-bar__warn">
                <MdWarning style={{ color: '#f59e0b' }} />
                {empConExtras} empleado(s) con horas extras detectadas
              </div>
            )}
          </div>

          {/* Contenido de la vista activa */}
          <div className="pn-view-content">
            {activeView === 'tabla' && (
              <div className="cw-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="pn-card-header-bar">
                  <div>
                    <span style={{ fontWeight: 700 }}>Reporte de Auditoría</span>
                    <span className="cw-badge cw-badge--green" style={{ marginLeft: '0.5rem' }}>
                      {getNombreMes(mes)} {anio}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Haz clic en los encabezados para ordenar
                  </span>
                </div>
                <VistaTabla
                  resultados={resultadosVista}
                  searchTerm={searchTerm}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </div>
            )}

            {activeView === 'tarjetas' && (
              <VistaTarjetas
                resultados={resultadosVista}
                searchTerm={searchTerm}
                areaFilter={areaFilter}
              />
            )}

            {activeView === 'conceptos' && (
              <VistaConceptos resultados={resultadosVista} />
            )}
          </div>

          {/* Nota legal */}
          <div className="pn-legal-note">
            <MdAccessTime style={{ flexShrink: 0, color: 'var(--cw-accent)', fontSize: '1rem' }} />
            <span>
              Este cálculo es un <strong>estimado de pre-nómina</strong> basado en los turnos del sistema. Clasifica automáticamente horas ordinarias diurnas, nocturnas, dominicales, festivas y extras según la normativa CST Colombia (Ley 2101/2021 · Ley 2466/2025). El valor final lo calcula y aprueba <strong>Gestión Humana</strong>.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
