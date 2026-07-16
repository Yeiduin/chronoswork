import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

/**
 * TrendChart — Gráfico de tendencia (línea / área / barras) con Recharts.
 *
 * Props:
 *   title   (string)               — título del gráfico
 *   data    (array)                — array de objetos de datos
 *   dataKey (string)               — key del valor numérico a graficar
 *   xKey    (string)               — key del eje X (default: 'name')
 *   color   (string)               — color del trazo / relleno (default: var(--cw-accent))
 *   type    ('area'|'line'|'bar')  — tipo de gráfico (default: 'area')
 *   height  (number)               — alto del contenedor del gráfico (default: 200)
 *   loading (boolean)              — mostrar estado de carga
 *   className (string, opcional)   — clases adicionales
 */
export default function TrendChart({
  title,
  data = [],
  dataKey,
  xKey = 'name',
  color = 'var(--cw-accent)',
  type = 'area',
  height = 200,
  loading = false,
  className = '',
  secondDataKey,
  secondColor,
}) {
  const accentColor = color.startsWith('var(') ? '#3b82f6' : color;
  const accentColor2 = secondColor
    ? (secondColor.startsWith('var(') ? '#f59e0b' : secondColor)
    : '#f59e0b';
  const fillId = `fill-${dataKey || 'trend'}`;
  const fillId2 = `fill-${secondDataKey || 'trend2'}`;
  const hasData = Array.isArray(data) && data.length > 0;

  const RenderTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '0.65rem 0.85rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          fontSize: '0.78rem',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
          {label}
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color || accentColor,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>{entry.name}: </span>
            <span style={{ fontWeight: 700, color: entry.color || 'var(--cw-accent)' }}>
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const commonAxisProps = {
    tick: { fontSize: 11, fill: '#64748b' },
    axisLine: { stroke: 'rgba(255,255,255,0.06)' },
    tickLine: false,
  };

  const gridStyle = {
    stroke: 'rgba(255,255,255,0.04)',
    strokeDasharray: '3 3',
    vertical: false,
  };

  const renderChart = () => {
    if (!hasData) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height, color: 'var(--text-muted)', fontSize: '0.85rem',
        }}>
          Sin datos disponibles
        </div>
      );
    }

    const ChartComponent = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} width={40} />
          <Tooltip content={<RenderTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />

          {type === 'bar' && (
            <Bar
              dataKey={dataKey}
              fill={accentColor}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          )}
          {type === 'bar' && secondDataKey && (
            <Bar
              dataKey={secondDataKey}
              fill={accentColor2}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          )}
          {type === 'line' && (
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={accentColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: accentColor }}
            />
          )}
          {type === 'area' && (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={accentColor}
              strokeWidth={2.5}
              fill={`url(#${fillId})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: accentColor }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <div className={`cw-card ${className}`} style={{ padding: '1.25rem' }}>
      {title && (
        <div className="cw-card__header" style={{ marginBottom: '0.85rem', paddingBottom: '0.5rem' }}>
          <div className="cw-card__title">{title}</div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay" style={{ minHeight: height }}>
          <div className="cw-spinner" />
          <span>Cargando datos...</span>
        </div>
      ) : (
        renderChart()
      )}
    </div>
  );
}
