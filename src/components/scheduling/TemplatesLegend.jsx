export default function TemplatesLegend({ templates }) {
  if (!templates.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TURNOS:</span>
      {templates.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          background: t.color + '18', border: `1px solid ${t.color}50`,
          borderRadius: 100, padding: '0.2rem 0.6rem', fontSize: '0.72rem',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.nombre}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}</span>
        </div>
      ))}
    </div>
  );
}
