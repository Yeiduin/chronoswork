import { useState } from 'react';

/**
 * CollapsibleSection
 * Sección plegable reutilizable. Muestra una barra-encabezado clickeable
 * (título + resumen opcional a la derecha + caret) y oculta el contenido
 * cuando está colapsada.
 *
 * Props:
 *   title          — nodo del título (texto o JSX)
 *   right          — nodo opcional alineado a la derecha (badges, contador…)
 *   defaultOpen    — abierta por defecto (false = colapsada)
 *   children       — contenido a mostrar al expandir
 *   accent         — color de acento opcional para el borde superior al abrir
 */
export function CollapsibleSection({ title, right, defaultOpen = false, accent, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      marginTop: '1rem',
      border: '1px solid var(--border-subtle)',
      borderRadius: 10,
      background: 'var(--bg-glass)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.75rem', padding: '0.6rem 0.85rem', cursor: 'pointer',
          background: open ? 'var(--bg-glass-hover)' : 'transparent',
          border: 'none', borderLeft: `3px solid ${open ? (accent || 'var(--cw-accent)') : 'transparent'}`,
          color: 'var(--text-primary)', textAlign: 'left', transition: 'background 0.15s',
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.02em' }}>
          <span style={{
            display: 'inline-block', transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)', fontSize: '0.7rem',
          }}>▶</span>
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>{right}</span>
      </button>
      {open && (
        <div style={{ padding: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
