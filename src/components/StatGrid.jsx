import { Children, cloneElement, isValidElement, useRef, useEffect, useState } from 'react';

/**
 * StatGrid — Grid responsive de KPIs con animación stagger en cascada.
 *
 * Props:
 *   children (ReactNode)  — hijos (típicamente KpiCard)
 *   columns  (number)     — número de columnas (default: 4, valores válidos: 2, 3, 4)
 *   className (string, opcional) — clases extra
 */
export default function StatGrid({
  children,
  columns = 4,
  className = '',
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const validCols = [2, 3, 4].includes(columns) ? columns : 4;

  useEffect(() => {
    const el = ref.current;
    if (!el) { setVisible(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const childArray = Children.toArray(children);

  return (
    <div
      ref={ref}
      className={`cw-grid cw-grid--${validCols} ${className}`}
    >
      {childArray.map((child, idx) => {
        if (!isValidElement(child)) return child;

        const delay = idx * 0.07;

        return (
          <div
            key={idx}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
