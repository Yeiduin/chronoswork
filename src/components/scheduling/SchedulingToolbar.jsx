import {
  MdChevronLeft, MdChevronRight, MdBolt, MdDeleteSweep, MdDownload, MdAccessTime,
} from 'react-icons/md';
import { getNombreMes } from '../../core/dateUtils';

export default function SchedulingToolbar({
  mes, anio, viewMode, viewType,
  selectedAreaId, searchTerm, sortBy,
  naturalWeeks, areas, shifts, employees,
  autoAssignLoading,
  onSetMes, onSetAnio, onSetViewMode, onSetViewType,
  onSetSelectedAreaId, onSetSearchTerm, onSetSortBy,
  onPrev, onNext, onToday,
  onAutoAssign, onExport, onClear,
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      background: 'var(--bg-glass)', padding: '0.8rem 1rem', borderRadius: 10,
      border: '1px solid var(--border-subtle)'
    }}>
      {/* Mes / Año / Hoy */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <select value={mes} onChange={e => onSetMes(Number(e.target.value))}
          className="cw-input" style={{ width: 'auto', padding: '0.45rem 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {Array.from({length: 12}, (_, i) => (
            <option key={i+1} value={i+1}>{getNombreMes(i+1)}</option>
          ))}
        </select>
        <select value={anio} onChange={e => onSetAnio(Number(e.target.value))}
          className="cw-input" style={{ width: 'auto', padding: '0.45rem 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {[anio-2, anio-1, anio, anio+1, anio+2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button className="cw-btn cw-btn--secondary" onClick={onToday} style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}>Hoy</button>
      </div>

      <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

      {/* Vista Semana/Quincena/Mes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'var(--bg-primary)', borderRadius: '8px', padding: '0.2rem', border: '1px solid var(--border-medium)' }}>
        <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={onPrev} title="Anterior" style={{ border: 'none', background: 'transparent' }}><MdChevronLeft size={20} /></button>
        <select className="cw-input"
          style={{ fontSize: '0.82rem', padding: '0.4rem 0.5rem', width: 'auto', minWidth: 150, border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--cw-accent)' }}
          value={viewMode} onChange={e => onSetViewMode(e.target.value)}>
          <option value="monthly">📅 Mes completo</option>
          <option value="biweekly_1">📅 Quincena 1 (1-15)</option>
          <option value="biweekly_2">📅 Quincena 2 (16-fin)</option>
          {naturalWeeks.map((w, i) => (
            <option key={i} value={`weekly_${i + 1}`}>
              📅 Sem {i + 1} ({w[0].getDate()} al {w[w.length - 1].getDate()})
            </option>
          ))}
        </select>
        <button className="cw-btn cw-btn--secondary cw-btn--icon" onClick={onNext} title="Siguiente" style={{ border: 'none', background: 'transparent' }}><MdChevronRight size={20} /></button>
      </div>

      <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

      {/* Filtro área */}
      <select className="cw-input"
        style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', width: 'auto', minWidth: 160 }}
        value={selectedAreaId} onChange={e => onSetSelectedAreaId(e.target.value)}>
        <option value="all">🏢 Todas las áreas</option>
        {areas.map(a => (
          <option key={a.id} value={a.id}>● {a.nombre}</option>
        ))}
      </select>

      {/* Búsqueda */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '0.2rem 0.5rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>🔍</span>
        <input type="text" placeholder="Buscar colaborador..." value={searchTerm}
          onChange={e => onSetSearchTerm(e.target.value)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: 140 }} />
      </div>

      {/* Ordenar */}
      <select className="cw-input"
        style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', width: 'auto', minWidth: 140 }}
        value={sortBy} onChange={e => onSetSortBy(e.target.value)}>
        <option value="alfabetico">🔤 Orden Alfabético</option>
        <option value="area">🏢 Agrupar por Área</option>
        <option value="salario_desc">💰 Mayor Salario</option>
      </select>

      {/* Toggle vista */}
      <button className={`cw-btn ${viewType === 'coverage' ? 'cw-btn--primary' : 'cw-btn--secondary'}`}
        onClick={onSetViewType}
        style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}
        title={viewType === 'grid' ? 'Ver cobertura por hora' : 'Ver rejilla de turnos'}>
        <MdAccessTime /> {viewType === 'grid' ? 'Cobertura por Hora' : 'Rejilla'}
      </button>

      <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

      {/* Botones de acción */}
      <button className="cw-btn cw-btn--primary" onClick={onAutoAssign}
        disabled={autoAssignLoading}
        title="Asignar turnos automáticamente">
        {autoAssignLoading ? <span className="cw-spinner cw-spinner--sm"></span> : <MdBolt />}
        Auto-asignar...
      </button>

      <button className="cw-btn cw-btn--secondary" onClick={onExport}
        title="Exportar turnos y resumen a Excel"
        disabled={shifts.length === 0 && employees.length === 0}>
        <MdDownload /> Exportar Excel
      </button>

      <button className="cw-btn cw-btn--danger" onClick={onClear}
        title="Eliminar turnos del período"
        disabled={shifts.length === 0}>
        <MdDeleteSweep /> Limpiar
      </button>
    </div>
  );
}
