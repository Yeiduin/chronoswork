import { useRef, useEffect, useState } from 'react';

/**
 * KpiCard — Tarjeta KPI reutilizable.
 *
 * Props:
 *   title    (string)          — label del KPI
 *   value    (string|number)   — valor principal
 *   subtitle (string, opcional) — texto secundario
 *   icon     (ReactNode, opc)  — ícono
 *   color    (string, opc)     — color de acento (default: var(--cw-accent))
 *   delta    ({ value: number, positive: boolean }, opc) — cambio vs período anterior
 *   onClick  (function, opc)   — callback al click
 *   size     ('sm'|'md'|'lg')  — tamaño (default: 'md')
 */
export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = 'var(--cw-accent)',
  delta,
  onClick,
  size = 'md',
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) { setVisible(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sizeStyles = {
    sm: { padding: '0.9rem 1rem', gap: '0.65rem' },
    md: { padding: '1.5rem', gap: '1rem' },
    lg: { padding: '2rem', gap: '1.25rem' },
  };

  const valueStyles = {
    sm: { fontSize: '1.5rem' },
    md: { fontSize: '2rem' },
    lg: { fontSize: '2.375rem' },
  };

  const iconSizes = {
    sm: { width: 40, height: 40, fontSize: '1.1rem', borderRadius: '10px' },
    md: { width: 48, height: 48, fontSize: '1.375rem', borderRadius: '12px' },
    lg: { width: 56, height: 56, fontSize: '1.5rem', borderRadius: '14px' },
  };

  const s = sizeStyles[size] || sizeStyles.md;
  const vs = valueStyles[size] || valueStyles.md;
  const is = iconSizes[size] || iconSizes.md;

  return (
    <div
      ref={ref}
      className="cw-stat-card"
      style={{
        '--stat-color': color,
        cursor: onClick ? 'pointer' : 'default',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        padding: s.padding,
        gap: s.gap,
        alignItems: 'flex-start',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {icon && (
        <div
          className="cw-stat-card__icon"
          style={{
            background: `${color}18`,
            color,
            width: is.width,
            height: is.height,
            fontSize: is.fontSize,
            borderRadius: is.borderRadius,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}

      <div className="cw-stat-card__info" style={{ flex: 1, minWidth: 0 }}>
        <div
          className="cw-stat-card__value"
          style={{ ...vs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={String(value)}
        >
          {value}
        </div>
        <div className="cw-stat-card__label">{title}</div>

        {subtitle && (
          <div className="cw-stat-card__delta" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </div>
        )}

        {delta && (
          <div
            className="cw-stat-card__delta"
            style={{ color: delta.positive ? 'var(--cw-success)' : 'var(--cw-danger)' }}
          >
            {delta.positive ? '▲' : '▼'} {Math.abs(delta.value)}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.15rem' }}>
              vs. periodo anterior
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
