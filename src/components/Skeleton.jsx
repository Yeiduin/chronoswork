// ============================================================
// Skeleton — Componente de carga esquelético
// Mejora la percepción de velocidad vs un spinner genérico
// ============================================================

/**
 * Skeleton — placeholder animado para contenido en carga.
 *
 * Variantes:
 *   <Skeleton width={200} height={20} />           → barra simple
 *   <Skeleton variant="text" lines={3} />           → bloque de texto
 *   <Skeleton variant="card" />                     → simula una cw-card
 *   <Skeleton variant="stat" />                     → simula una cw-stat-card
 *   <Skeleton variant="table" rows={5} cols={4} /> → simula una tabla
 */
export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  variant,
  lines = 3,
  rows = 5,
  cols = 4,
  style,
  className = '',
}) {
  const baseStyle = {
    background: 'linear-gradient(90deg, var(--bg-glass) 25%, var(--bg-glass-hover) 50%, var(--bg-glass) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    borderRadius,
    ...style,
  };

  if (variant === 'text') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              width: i === lines - 1 ? '60%' : '100%',
              height: 14,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="cw-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...baseStyle, width: '40%', height: 18 }} />
          <div style={{ ...baseStyle, width: '100%', height: 14 }} />
          <div style={{ ...baseStyle, width: '80%', height: 14 }} />
        </div>
      </div>
    );
  }

  if (variant === 'stat') {
    return (
      <div className="cw-stat-card" style={{ pointerEvents: 'none' }}>
        <div style={{ ...baseStyle, width: 48, height: 48, borderRadius: 12 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...baseStyle, width: '60%', height: 24 }} />
          <div style={{ ...baseStyle, width: '40%', height: 14 }} />
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 8, padding: '0.875rem 1rem', background: '#f8fafc' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ ...baseStyle, flex: 1, height: 12 }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: 'flex', gap: 8, padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} style={{ ...baseStyle, flex: 1, height: 12 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Variante por defecto: barra simple
  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        width: width || '100%',
        height: height || 16,
      }}
    />
  );
}
