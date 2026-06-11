import { useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { useEmployees } from '../hooks/useEmployees';
import { procesarTurnosEmpleado } from '../core/laborEngine';
import { formatCOP } from '../core/validators';
import { getPeriodoActual, getNombreMes } from '../core/dateUtils';
import { MdCalculate, MdDownload, MdChevronLeft, MdChevronRight } from 'react-icons/md';

const CONCEPTOS = [
  { key: 'horas_ordinarias', label: 'Horas Ordinarias Diurnas', factor: '×1.00' },
  { key: 'HON',   label: 'Hora Ordinaria Nocturna',            factor: '+35%' },
  { key: 'HOD_A', label: 'Hora Ord. Dominical (Ene–Jun)',      factor: '+80%' },
  { key: 'HOD_B', label: 'Hora Ord. Dominical (Jul–Dic)',      factor: '+90%' },
  { key: 'HCDN_A',label: 'H. Comp. Dom+Noct (Ene–Jun)',        factor: '+115%' },
  { key: 'HCDN_B',label: 'H. Comp. Dom+Noct (Jul–Dic)',        factor: '+125%' },
  { key: 'HED',   label: 'Hora Extra Diurna',                  factor: '+25%' },
  { key: 'HEN',   label: 'Hora Extra Nocturna',                factor: '+75%' },
  { key: 'HEDD_A',label: 'HE Diurna Dominical (Ene–Jun)',      factor: '+105%' },
  { key: 'HEDD_B',label: 'HE Diurna Dominical (Jul–Dic)',      factor: '+115%' },
  { key: 'HEND_A',label: 'HE Nocturna Dominical (Ene–Jun)',    factor: '+155%' },
  { key: 'HEND_B',label: 'HE Nocturna Dominical (Jul–Dic)',    factor: '+165%' },
];

export default function PrenominaPage() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [calculado, setCalculado] = useState(false);
  const [resultados, setResultados] = useState([]);

  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
  const { shifts } = useShifts(periodo);
  const { employees } = useEmployees();

  const handlePrevMonth = () => {
    setCalculado(false);
    if (mes === 1) { setMes(12); setAnio(anio - 1); }
    else setMes(mes - 1);
  };
  const handleNextMonth = () => {
    setCalculado(false);
    if (mes === 12) { setMes(1); setAnio(anio + 1); }
    else setMes(mes + 1);
  };

  const handleCalcular = () => {
    const res = employees.map(emp => {
      const turnosEmp = shifts.filter(s => s.employee_id === emp.id);
      const calculo = procesarTurnosEmpleado(turnosEmp, emp.valor_hora);
      return { ...emp, ...calculo, turnos: turnosEmp.length };
    });
    setResultados(res);
    setCalculado(true);
  };

  const handleExportCSV = () => {
    const headers = ['Empleado', 'Cédula', 'Cargo', 'Valor/Hora', ...CONCEPTOS.map(c => c.label), 'Total Bruto'];
    const rows = resultados.map(r => [
      r.nombre, r.cedula, r.cargo, r.valor_hora,
      ...CONCEPTOS.map(c => r.desglose?.[c.key]?.horas || 0),
      r.total_bruto,
    ]);
    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prenomina_${periodo}.csv`;
    a.click();
  };

  const totalGeneral = resultados.reduce((acc, r) => acc + (r.total_bruto || 0), 0);

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">💰 Liquidación de Prenómina</h1>
          <p className="page-subtitle">
            Cálculo automático CST Colombia 2026 · Ley 2101/2021 + Ley 2466/2025
          </p>
        </div>
        <div className="page-header__actions">
          <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={handlePrevMonth}><MdChevronLeft /></button>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center' }}>
            {getNombreMes(mes)} {anio}
          </span>
          <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={handleNextMonth}><MdChevronRight /></button>
          <button id="btn-calcular-prenomina" className="cw-btn cw-btn--primary" onClick={handleCalcular}>
            <MdCalculate /> Calcular Prenómina
          </button>
          {calculado && (
            <button id="btn-export-csv" className="cw-btn cw-btn--success" onClick={handleExportCSV}>
              <MdDownload /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      {calculado && (
        <div className="cw-grid cw-grid--3 mb-3">
          <div className="cw-stat-card" style={{ '--stat-color': '#10b981' }}>
            <div className="cw-stat-card__icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>💰</div>
            <div className="cw-stat-card__info">
              <div className="cw-stat-card__value" style={{ fontSize: '1.5rem' }}>{formatCOP(totalGeneral)}</div>
              <div className="cw-stat-card__label">Total Prenómina a Pagar</div>
            </div>
          </div>
          <div className="cw-stat-card" style={{ '--stat-color': '#3b82f6' }}>
            <div className="cw-stat-card__icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>👥</div>
            <div className="cw-stat-card__info">
              <div className="cw-stat-card__value">{resultados.filter(r => r.turnos > 0).length}</div>
              <div className="cw-stat-card__label">Empleados con turnos</div>
            </div>
          </div>
          <div className="cw-stat-card" style={{ '--stat-color': '#f59e0b' }}>
            <div className="cw-stat-card__icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⏱️</div>
            <div className="cw-stat-card__info">
              <div className="cw-stat-card__value">{shifts.length}</div>
              <div className="cw-stat-card__label">Turnos en el período</div>
            </div>
          </div>
        </div>
      )}

      {!calculado ? (
        <div className="cw-card">
          <div className="empty-state">
            <div className="empty-state__icon">💰</div>
            <div className="empty-state__title">Calcule la prenómina del período</div>
            <div className="empty-state__desc">
              Presione "Calcular Prenómina" para procesar los turnos de{' '}
              <strong>{getNombreMes(mes)} {anio}</strong> con el motor CST Colombia 2026.
            </div>
            <button className="cw-btn cw-btn--primary cw-btn--lg" onClick={handleCalcular}>
              <MdCalculate /> Calcular Prenómina
            </button>
          </div>
        </div>
      ) : (
        <div className="cw-card">
          <div className="cw-card__header">
            <h3 className="cw-card__title">📊 Reporte de Auditoría — {getNombreMes(mes)} {anio}</h3>
            <span className="cw-badge cw-badge--green">✓ Calculado automáticamente</span>
          </div>

          <div className="cw-table-wrapper">
            <table className="cw-table prenomina-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Turnos</th>
                  {CONCEPTOS.map(c => (
                    <th key={c.key} title={c.label} style={{ fontSize: '0.65rem' }}>
                      {c.key}
                      <div style={{ fontWeight: 400, opacity: 0.7, color: 'var(--cw-accent)' }}>{c.factor}</div>
                    </th>
                  ))}
                  <th style={{ background: 'rgba(59,130,246,0.05)' }}>TOTAL BRUTO</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.nombre}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.cargo}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="cw-badge cw-badge--blue">{r.turnos}</span>
                    </td>
                    {CONCEPTOS.map(c => {
                      const horas = r.desglose?.[c.key]?.horas || 0;
                      const valor = r.desglose?.[c.key]?.valor || 0;
                      return (
                        <td key={c.key} className={horas > 0 ? 'valor-positivo' : 'valor-cero'} style={{ textAlign: 'right' }}>
                          {horas > 0 ? (
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{horas}h</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--cw-success)', opacity: 0.8 }}>
                                {formatCOP(valor)}
                              </div>
                            </div>
                          ) : <span style={{ opacity: 0.3 }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#6ee7b7', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
                      {formatCOP(r.total_bruto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="prenomina-total-row">
                  <td colSpan={2} style={{ fontWeight: 700, color: 'var(--text-primary)', padding: '0.875rem 1rem' }}>
                    TOTAL GENERAL
                  </td>
                  {CONCEPTOS.map(c => <td key={c.key}></td>)}
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#6ee7b7', fontSize: '1rem' }}>
                    {formatCOP(totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
