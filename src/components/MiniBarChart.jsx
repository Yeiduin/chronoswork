import { useRef, useEffect, useState } from 'react';

/**
 * MiniBarChart — Barras horizontales CSS puras, sin dependencia de Recharts.
 *
 * Props:
 *   data       (array de { label: string, value: number, color?: string })
 *   height     (number, default: 120)
 *   showValues (boolean, default: false) — mostrar valor numérico junto a la barra
 */
export default function MiniBarChart({
  data = [],
  height = 120,
  showValues = false,
}) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) { setAnimated(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setAnimated(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasData = Array.isArray(data) && data.length > 0;

  if (!hasData) {
    return (
      <div
        ref={ref}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height, color: 'var(--text-muted)', fontSize: '0.85rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--border-radius)',
        }}
      >
        Sin datos
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);

  const semanticColors = {
    teal:    'var(--cw-success)',
    green:   'var(--cw-success)',
    blue:    'var(--cw-accent)',
    purple:  'var(--cw-purple)',
    amber:   'var(--cw-warning)',
    red:     'var(--cw-danger)',
  };

  const getColor = (item, idx) => {
    if (item.color && semanticColors[item.color]) return semanticColors[item.color];
    if (item.color) return item.color;

    const palette = [
      'var(--cw-accent)',
      'var(--cw-purple)',
      'var(--cw-success)',
      'var(--cw-warning)',
      'var(--cw-danger)',
      '#60a5fa',
    ];
    return palette[idx % palette.length];
  };

  const barHeight = Math.max(6, Math.min(24, (height - (data.length - 1) * 4) / data.length));

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        justifyContent: 'center',
        height,
      }}
    >
      {data.map((item, idx) => {
        const color = getColor(item, idx);
        const widthPct = (item.value / maxVal) * 100;
        const delay = idx * 0.08;

        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: barHeight,
            }}
          >
            {/* Label */}
            <div
              style={{
                width: '90px',
                flexShrink: 0,
                fontSize: '0.72rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: `${barHeight}px`,
              }}
              title={item.label}
            >
              {item.label}
            </div>

            {/* Bar */}
            <div style={{ flex: 1, position: 'relative', height: barHeight }}>
              {/* Track */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.04)',
                }}
              />
              {/* Fill */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: animated ? `${widthPct}%` : '0%',
                  maxWidth: '100%',
                  borderRadius: '4px',
                  background: `linear-gradient(90deg, ${color}CC, ${color})`,
                  boxShadow: `0 0 8px ${color}40`,
                  transition: `width 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}s`,
                }}
              />
            </div>

            {/* Value */}
            {showValues && (
              <div
                style={{
                  width: '48px',
                  flexShrink: 0,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  lineHeight: `${barHeight}px`,
                }}
              >
                {item.value.toLocaleString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
