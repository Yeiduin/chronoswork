import { useState, useRef } from 'react';
import { MdInfo } from 'react-icons/md';
import { getShiftBreakdown } from './getShiftBreakdown';

export default function ShiftCell({ employee, fecha, shift, blocked, blockedReason, template, onAdd, isDayOff }) {
  const [showInfo, setShowInfo] = useState(false);
  const cardRef = useRef(null);
  const [popPos, setPopPos] = useState(null);

  const openPopover = () => {
    const el = cardRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const POP_W = 215, POP_H = 340, M = 8;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = r.left + r.width / 2 - POP_W / 2;
      left = Math.min(Math.max(left, M), vw - POP_W - M);
      const cabeArriba = r.top >= POP_H + M;
      let top = cabeArriba ? r.top - POP_H - 6 : r.bottom + 6;
      top = Math.min(Math.max(top, M), vh - POP_H - M);
      setPopPos({ left, top, placement: cabeArriba ? 'up' : 'down' });
    }
    setShowInfo(true);
  };
  const closePopover = () => setShowInfo(false);

  if (isDayOff) {
    return (
      <td style={{ padding: '0.2rem' }}>
        <div style={{
          minHeight: 32, borderRadius: 6, opacity: 0.25,
          background: 'repeating-linear-gradient(-45deg, var(--border-subtle), var(--border-subtle) 2px, transparent 2px, transparent 8px)',
          border: '1px dashed var(--border-subtle)',
        }} title="Día de descanso" />
      </td>
    );
  }

  if (blocked) {
    return (
      <td style={{ padding: '0.2rem' }}>
        <div className="shift-cell shift-cell--blocked"
          onClick={() => setShowInfo(!showInfo)}
          title={blockedReason}
          style={{ position: 'relative', minHeight: 32, fontSize: '0.85rem' }}>
          🚫
          {showInfo && (
            <div style={{
              position: 'absolute', zIndex: 100, top: '110%', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
              borderRadius: 8, padding: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)',
              width: 190, boxShadow: 'var(--shadow-md)', whiteSpace: 'normal', textAlign: 'left',
            }}>
              <span style={{ color: '#fca5a5', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                <MdInfo style={{ verticalAlign: 'middle' }} /> Novedad
              </span>
              {blockedReason}
            </div>
          )}
        </div>
      </td>
    );
  }

  if (shift) {
    const color = template?.color || '#6366f1';
    const nombreCorto = template?.nombre || 'Turno';
    const abrev = nombreCorto.length > 8
      ? nombreCorto.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
      : nombreCorto;

    const getLocalHHMM = (str) => {
      if (!str) return '';
      if (!str.includes('T')) return str.slice(0, 5);
      return str.slice(11, 16);
    };

    const inicio = template?.hora_inicio?.slice(0, 5) || getLocalHHMM(shift.start_time);
    const fin = template?.hora_fin?.slice(0, 5) || getLocalHHMM(shift.end_time);

    const bd = getShiftBreakdown(shift);
    const esNocturno = shift.shift_kind === 'NOCTURNO';
    const esDisponibilidad = shift.disponibilidad || shift.shift_kind === 'DISPONIBILIDAD';
    const netoLabel = Number.isInteger(bd.netH) ? `${bd.netH}h` : `${bd.netH.toFixed(1)}h`;

    return (
      <td style={{ padding: '0.2rem' }}>
        <div onClick={onAdd}
          ref={cardRef}
          onMouseEnter={openPopover}
          onMouseLeave={closePopover}
          className="shift-cell-card"
          title={`${nombreCorto} · ${inicio}–${fin} · Netas ${bd.netH.toFixed(1)}h · Almuerzo ${bd.almuerzo}min · Breaks 15: ${bd.breaks15} · Descanso ${bd.descansoTotalMin}min`}
          style={{
            borderRadius: 6, padding: '0.25rem 0.2rem 0.3rem', fontSize: '0.65rem', fontWeight: 700,
            textAlign: 'center', cursor: 'pointer', minHeight: 32, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: color + '28', border: `1.5px solid ${color}70`, color: 'var(--text-primary)',
            transition: 'all 0.15s', position: 'relative', overflow: 'visible',
          }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '6px 6px 0 0' }} />
          <div style={{ marginTop: 2, fontWeight: 800, letterSpacing: '-0.3px', color, display: 'flex', alignItems: 'center', gap: 2 }}>
            {esNocturno && <span style={{ fontSize: '0.6rem' }}>🌙</span>}
            {esDisponibilidad && <span style={{ fontSize: '0.6rem' }} title="Disponibilidad">📟</span>}
            {abrev}
          </div>
          <div style={{ fontSize: '0.58rem', opacity: 0.78, fontWeight: 500 }}>{inicio} - {fin}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 1, fontSize: '0.55rem', fontWeight: 600, opacity: 0.9 }}>
            <span style={{ color: 'var(--text-primary)' }}>{netoLabel}</span>
            {bd.almuerzo > 0 && <span title={`Almuerzo ${bd.almuerzo} min`}>🍴</span>}
            {bd.breaks15 > 0 && <span title={`${bd.breaks15} break(s) de 15 min`}>☕{bd.breaks15}</span>}
          </div>

          {showInfo && popPos && (
            <div
              className={`shift-detail-popover shift-detail-popover--${popPos.placement}`}
              onClick={(e) => e.stopPropagation()}
              style={{ left: popPos.left, top: popPos.top }}>
              <div className="shift-detail-popover__title" style={{ color }}>
                {esNocturno && '🌙 '}{nombreCorto}
              </div>
              <div className="shift-detail-popover__row">
                <span>🕐 Horario</span><strong>{inicio} – {fin}</strong>
              </div>
              <div className="shift-detail-popover__row">
                <span>⏱ Duración bruta</span><strong>{bd.grossH.toFixed(1)} h</strong>
              </div>
              <div className="shift-detail-popover__row">
                <span>🍴 Almuerzo</span>
                <strong>{bd.almuerzo > 0 ? `${bd.almuerzo} min` : '—'}</strong>
              </div>
              <div className="shift-detail-popover__row">
                <span>☕ Breaks cortos</span>
                <strong>{bd.breaks15 > 0 ? `${bd.breaks15} (${bd.breaks15Min} min)` : '—'}</strong>
              </div>
              {bd.tieneDetalle && bd.descansos.some(d => d.inicio) && (
                <div className="shift-detail-popover__schedule">
                  <div className="shift-detail-popover__schedule-title">Horario de descansos</div>
                  {bd.descansos.map((d, i) => (
                    <div key={i} className="shift-detail-popover__schedule-item">
                      <span>{d.tipo === 'ALMUERZO' ? '🍴 Almuerzo' : '☕ Break'}</span>
                      <strong>{d.inicio ? d.inicio : '—'} · {d.minutos}m</strong>
                    </div>
                  ))}
                </div>
              )}
              <div className="shift-detail-popover__row">
                <span>😴 Descanso total</span>
                <strong>{bd.descansoTotalMin} min</strong>
              </div>
              <div className="shift-detail-popover__row shift-detail-popover__row--net">
                <span>✅ Horas netas</span>
                <strong>{bd.netH.toFixed(1)} h</strong>
              </div>
              {esDisponibilidad && (
                <div className="shift-detail-popover__row">
                  <span>📟 Disponibilidad</span>
                  <strong>{shift.recargo_porcentaje ? `+${shift.recargo_porcentaje}%` : 'Sí'}</strong>
                </div>
              )}
              {shift.observaciones && (
                <div className="shift-detail-popover__note">{shift.observaciones}</div>
              )}
              <div className="shift-detail-popover__hint">Click para editar / quitar</div>
            </div>
          )}
        </div>
      </td>
    );
  }

  return (
    <td style={{ padding: '0.2rem' }}>
      <div className="shift-cell shift-cell--empty" onClick={onAdd}
        title="Click para asignar turno"
        style={{ minHeight: 32, fontSize: '1rem', opacity: 0.4 }}>
        +
      </div>
    </td>
  );
}
