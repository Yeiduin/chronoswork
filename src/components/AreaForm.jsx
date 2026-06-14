// ============================================================
// ChronosWork — Modal completo de creación/edición de Áreas
// Con todos los campos laborales colombianos y defaults
// inteligentes por sector.
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useAreas } from '../hooks/useAreas';
import {
  TIPOS_CONTRATO, TIPOS_TURNO, PATRONES_ROTATIVOS,
  SECTORES, AREAS_POR_SECTOR, FRANJAS_POR_SECTOR,
  TIPOS_JORNADA, getAreasBySector, getFranjasBySector, getSectorDefaults,
  SMLV_2025, AUX_TRANSPORTE_2025, SMLV_HORA_2025,
} from '../config/laborCatalog';
import {
  MdClose, MdDomain, MdAccessTime, MdWarning, MdInfo, MdSave,
} from 'react-icons/md';

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316',
];

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' }, { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 7, label: 'Dom' },
];

// Niveles de riesgo ARL (Decreto 1295/94)
const NIVELES_ARL = [
  { value: 1, label: 'Nivel I (0.522%)', desc: 'Oficinas, administrativos, educación' },
  { value: 2, label: 'Nivel II (1.044%)', desc: 'Comercio, hotelería, servicios' },
  { value: 3, label: 'Nivel III (2.436%)', desc: 'Manufactura liviana, transporte' },
  { value: 4, label: 'Nivel IV (4.350%)', desc: 'Construcción, industria pesada' },
  { value: 5, label: 'Nivel V (6.960%)', desc: 'Minería, petróleos, alto riesgo' },
];

// ── Defaults que se aplican al elegir sector ──────────────────────────────
function buildDefaultsForSector(sector) {
  const def = getSectorDefaults(sector);
  const franjas = getFranjasBySector(sector);
  return {
    modo_operacion: '24_7',
    tipo_contrato_predominante: def.contrato,
    tipo_contrato_default: def.contrato,
    valor_hora_default: def.salario,
    dias_trabajo: [1, 2, 3, 4, 5, 6, 7],
    patron_rotativo: null,
    jornada_tipo: 'DIURNA',
    duracion_jornada_horas: 8,
    dias_descanso: 1,
    dias_descanso_default: 1,
    nivel_riesgo_arl: 1,
    paga_auxilio_transporte: true,
    franjas_iniciales: franjas,
  };
}

export default function AreaFormModal({ area, onClose }) {
  const isEdit = !!area;
  const { createArea, updateArea } = useAreas();

  const [step, setStep] = useState(1);  // Wizard 3 pasos
  const [form, setForm] = useState(() => {
    if (area) {
      return {
        nombre: area.nombre || '',
        codigo_area: area.codigo_area || '',
        descripcion: area.descripcion || '',
        color: area.color || '#6366f1',
        sector: area.sector || '',
        sub_sector: area.sub_sector || '',
        centro_costo: area.centro_costo || '',
        // Jornada
        modo_operacion: area.modo_operacion || 'OFICINA',
        jornada_tipo: area.jornada_tipo || 'DIURNA',
        duracion_jornada_horas: area.duracion_jornada_horas || 8,
        dias_trabajo: area.dias_trabajo || [1, 2, 3, 4, 5],
        dias_descanso: area.dias_descanso || 1,
        dias_descanso_default: area.dias_descanso_default || 1,
        horas_extras_max_dia: area.horas_extras_max_dia ?? 2,
        horas_extras_max_semana: area.horas_extras_max_semana ?? 12,
        descanso_min_entre_jornadas: area.descanso_min_entre_jornadas ?? 9,
        patron_rotativo: area.patron_rotativo || null,
        jornada_partida: area.jornada_partida || false,
        // Contrato
        tipo_contrato_predominante: area.tipo_contrato_predominante || 'INDEFINIDO',
        tipo_contrato_default: area.tipo_contrato_default || 'INDEFINIDO',
        // Salario
        valor_hora_default: area.valor_hora_default || '',
        paga_auxilio_transporte: area.paga_auxilio_transporte ?? true,
        nivel_riesgo_arl: area.nivel_riesgo_arl || 1,
        // 24/7
        night_shift_enabled: area.night_shift_enabled || false,
        night_shift_start: area.night_shift_start || '22:00',
        night_shift_end: area.night_shift_end || '06:00',
        // Otros
        requiere_dotacion: area.requiere_dotacion || false,
        dotacion_periodicidad_meses: area.dotacion_periodicidad_meses || 4,
        requiere_epp: area.requiere_epp || false,
        descripcion_epp: area.descripcion_epp || '',
        break_minutos: area.break_minutos || 0,
        permite_turno_partido: area.permite_turno_partido ?? true,
        notas_operativas: area.notas_operativas || '',
        // Para crear franjas
        franjas_iniciales: [],
      };
    }
    // Modo creación: defaults por defecto
    return {
      nombre: '',
      codigo_area: '',
      descripcion: '',
      color: '#6366f1',
      sector: '',
      sub_sector: '',
      centro_costo: '',
      modo_operacion: 'OFICINA',
      jornada_tipo: 'DIURNA',
      duracion_jornada_horas: 8,
      dias_trabajo: [1, 2, 3, 4, 5],
      dias_descanso: 1,
      dias_descanso_default: 1,
      horas_extras_max_dia: 2,
      horas_extras_max_semana: 12,
      descanso_min_entre_jornadas: 9,
      patron_rotativo: null,
      jornada_partida: false,
      tipo_contrato_predominante: 'INDEFINIDO',
      tipo_contrato_default: 'INDEFINIDO',
      valor_hora_default: SMLV_HORA_2025,
      paga_auxilio_transporte: true,
      nivel_riesgo_arl: 1,
      night_shift_enabled: false,
      night_shift_start: '22:00',
      night_shift_end: '06:00',
      requiere_dotacion: false,
      dotacion_periodicidad_meses: 4,
      requiere_epp: false,
      descripcion_epp: '',
      break_minutos: 0,
      permite_turno_partido: true,
      notas_operativas: '',
      franjas_iniciales: [],
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Al elegir sector, aplicar defaults inteligentes
  const handleSectorChange = (newSector) => {
    setForm(prev => ({
      ...prev,
      sector: newSector,
      ...(newSector ? buildDefaultsForSector(newSector) : {}),
    }));
  };

  const toggleDia = (d) => {
    setForm(prev => ({
      ...prev,
      dias_trabajo: prev.dias_trabajo.includes(d)
        ? prev.dias_trabajo.filter(x => x !== d)
        : [...prev.dias_trabajo, d].sort(),
    }));
  };

  // Validación
  const validateStep = (s) => {
    if (s === 1) {
      if (!form.nombre.trim()) { setError('El nombre del área es obligatorio.'); return false; }
      if (!form.sector) { setError('Selecciona el sector económico.'); return false; }
      if (!form.dias_trabajo.length) { setError('Selecciona al menos un día de trabajo.'); return false; }
    }
    if (s === 2) {
      const v = parseFloat(form.valor_hora_default);
      if (!v || v <= 0) { setError('El valor hora debe ser mayor a 0.'); return false; }
    }
    setError('');
    return true;
  };

  const next = () => {
    if (validateStep(step)) setStep(s => Math.min(3, s + 1));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2)) return;
    setLoading(true);
    try {
      const valorNum = parseFloat(form.valor_hora_default);
      const payload = {
        ...form,
        valor_hora_default: valorNum,
      };
      if (isEdit) {
        await updateArea(area.id, payload);
      } else {
        await createArea(payload);
      }
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            <MdDomain style={{ marginRight: '0.5rem' }} />
            {isEdit ? `Editar Área: ${area.nombre}` : 'Nueva Área'}
          </h3>
          <button className="cw-modal__close" onClick={() => onClose(false)}><MdClose /></button>
        </div>

        {/* Stepper */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.25rem 1rem', gap: '0.5rem',
        }}>
          <Step n={1} active={step === 1} done={step > 1} title="Identidad" />
          <div style={{ flex: 1, height: 2, background: step > 1 ? 'var(--cw-accent)' : 'var(--border-subtle)' }} />
          <Step n={2} active={step === 2} done={step > 2} title="Jornada y Salario" />
          <div style={{ flex: 1, height: 2, background: step > 2 ? 'var(--cw-accent)' : 'var(--border-subtle)' }} />
          <Step n={3} active={step === 3} done={false} title="Extras y Operación" />
        </div>

        {error && <div className="cw-alert cw-alert--error" style={{ margin: '0 1.25rem 1rem' }}>🚫 {error}</div>}

        {/* ──────────── PASO 1: IDENTIDAD ──────────── */}
        {step === 1 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              ¿A qué área y sector pertenece?
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Elegir el sector te permite autollenar configuraciones típicas del mercado colombiano
              (salario, jornada, franjas horarias). Puedes ajustar todo en los siguientes pasos.
            </p>

            {/* Sector */}
            <div className="cw-form-group">
              <label className="cw-label">Sector económico <span className="required">*</span></label>
              <select className="cw-input"
                value={form.sector}
                onChange={e => handleSectorChange(e.target.value)}>
                <option value="">— Selecciona un sector —</option>
                {SECTORES.map(s => (
                  <option key={s.value} value={s.value}>{s.icono} {s.label}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Esto nos ayuda a sugerir salario, franjas horarias y turnos típicos.
              </div>
            </div>

            {/* Nombre */}
            <div className="cw-form-group">
              <label className="cw-label">Nombre del Área <span className="required">*</span></label>
              <input className="cw-input"
                placeholder={form.sector ? `Ej: ${getAreasBySector(form.sector)[0]?.nombre || 'Cajas'}` : 'Ej: Cajas, Recepción, Cocina...'}
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              {form.sector && getAreasBySector(form.sector).length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  Sugerencias: {getAreasBySector(form.sector).map(a => (
                    <button key={a.nombre} type="button" onClick={() => setForm(p => ({ ...p, nombre: a.nombre, color: a.color }))}
                      style={{
                        fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 100,
                        background: a.color + '20', color: a.color, border: `1px solid ${a.color}50`,
                        cursor: 'pointer',
                      }}>{a.nombre}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Código + Sub-sector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Código interno (opcional)</label>
                <input className="cw-input"
                  placeholder="CAJ-01"
                  value={form.codigo_area}
                  onChange={e => setForm(p => ({ ...p, codigo_area: e.target.value }))} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Sub-sector / Especialidad</label>
                <input className="cw-input"
                  placeholder="Cajas rápidas, Caja 24h..."
                  value={form.sub_sector}
                  onChange={e => setForm(p => ({ ...p, sub_sector: e.target.value }))} />
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Centro de costo (contable)</label>
              <input className="cw-input"
                placeholder="CC-1001"
                value={form.centro_costo}
                onChange={e => setForm(p => ({ ...p, centro_costo: e.target.value }))} />
            </div>

            {/* Color */}
            <div className="cw-form-group">
              <label className="cw-label">Color del área</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: form.color === c ? '3px solid white' : 'none',
                      boxShadow: form.color === c ? `0 0 0 5px ${c}60` : 'none',
                      transition: 'all 0.15s',
                    }} />
                ))}
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Descripción (opcional)</label>
              <input className="cw-input"
                placeholder="Descripción breve del área..."
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
          </div>
        )}

        {/* ──────────── PASO 2: JORNADA Y SALARIO ──────────── */}
        {step === 2 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Jornada, contrato y salario
            </h4>

            {/* Modo operación */}
            <div className="cw-form-group">
              <label className="cw-label">Tipo de operación <span className="required">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <OpcionCard
                  selected={form.modo_operacion === 'OFICINA'}
                  onClick={() => setForm(p => ({
                    ...p,
                    modo_operacion: 'OFICINA',
                    jornada_tipo: 'DIURNA',
                    dias_trabajo: [1, 2, 3, 4, 5],
                    patron_rotativo: null,
                    night_shift_enabled: false,
                  }))}
                  icono="🏢" titulo="Horario de Oficina"
                  desc="L-V, turnos fijos, máx 42h/sem (Ley 2101/2021)"
                  color="#6366f1" />
                <OpcionCard
                  selected={form.modo_operacion === '24_7'}
                  onClick={() => setForm(p => ({
                    ...p,
                    modo_operacion: '24_7',
                    dias_trabajo: [1, 2, 3, 4, 5, 6, 7],
                    patron_rotativo: '6x1',
                  }))}
                  icono="🔄" titulo="Operación 24/7"
                  desc="Todos los días incluyendo domingos y festivos, turnos rotativos"
                  color="#f59e0b" />
              </div>
            </div>

            {/* Tipo de jornada */}
            <div className="cw-form-group">
              <label className="cw-label">Tipo de jornada (CST art. 158-164)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {TIPOS_JORNADA.map(j => (
                  <button key={j.value} type="button"
                    onClick={() => setForm(p => ({ ...p, jornada_tipo: j.value }))}
                    style={{
                      padding: '0.5rem 0.4rem', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${form.jornada_tipo === j.value ? 'var(--cw-accent)' : 'var(--border-subtle)'}`,
                      background: form.jornada_tipo === j.value ? 'var(--cw-accent)18' : 'var(--bg-glass)',
                      textAlign: 'center', fontSize: '0.75rem', fontWeight: 600,
                    }}>{j.label.split(' ')[0]}</button>
                ))}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {TIPOS_JORNADA.find(j => j.value === form.jornada_tipo)?.desc}
              </div>
            </div>

            {/* Patrón rotativo (si aplica) */}
            <div className="cw-form-group">
              <label className="cw-label">Patrón de trabajo/descanso</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {PATRONES_ROTATIVOS.map(p => (
                  <button key={p.value} type="button"
                    onClick={() => {
                      const isPersonalizado = p.value === 'PERSONALIZADO';
                      setForm(prev => ({
                        ...prev,
                        patron_rotativo: isPersonalizado ? null : p.value,
                        dias_descanso: p.diasDescanso,
                        dias_descanso_default: p.diasDescanso,
                      }));
                    }}
                    style={{
                      padding: '0.5rem', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${form.patron_rotativo === p.value ? 'var(--cw-accent)' : 'var(--border-subtle)'}`,
                      background: form.patron_rotativo === p.value ? 'var(--cw-accent)18' : 'var(--bg-glass)',
                      textAlign: 'left', fontSize: '0.72rem',
                    }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{p.desc}</div>
                  </button>
                ))}
              </div>
              {!form.patron_rotativo && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="cw-label" style={{ fontSize: '0.78rem' }}>Días laborables manuales</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {DIAS_SEMANA.map(d => (
                      <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                        style={{
                          padding: '0.4rem 0.75rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                          border: `2px solid ${form.dias_trabajo.includes(d.value) ? form.color : 'var(--border-subtle)'}`,
                          background: form.dias_trabajo.includes(d.value) ? form.color + '20' : 'var(--bg-glass)',
                          color: form.dias_trabajo.includes(d.value) ? 'var(--text-primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}>{d.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Duración jornada */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Duración turno (h)</label>
                <input type="number" step="0.5" min="1" max="24" className="cw-input"
                  value={form.duracion_jornada_horas}
                  onChange={e => setForm(p => ({ ...p, duracion_jornada_horas: parseFloat(e.target.value) || 0 }))} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sin hora de almuerzo</div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">HE máx/día</label>
                <input type="number" min="0" max="4" className="cw-input"
                  value={form.horas_extras_max_dia}
                  onChange={e => setForm(p => ({ ...p, horas_extras_max_dia: parseInt(e.target.value) || 0 }))} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Límite CST: 2h</div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">HE máx/sem</label>
                <input type="number" min="0" max="48" className="cw-input"
                  value={form.horas_extras_max_semana}
                  onChange={e => setForm(p => ({ ...p, horas_extras_max_semana: parseInt(e.target.value) || 0 }))} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Límite CST: 12h</div>
              </div>
            </div>

            {/* Tipo contrato predominante */}
            <div className="cw-form-group">
              <label className="cw-label">Tipo de contrato predominante</label>
              <select className="cw-input"
                value={form.tipo_contrato_predominante}
                onChange={e => setForm(p => ({
                  ...p,
                  tipo_contrato_predominante: e.target.value,
                  tipo_contrato_default: e.target.value,
                }))}>
                {TIPOS_CONTRATO.map(t => (
                  <option key={t.value} value={t.value}>{t.icono} {t.label} — {t.desc}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato_predominante)?.prestacion}
              </div>
            </div>

            {/* Salario */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Valor hora base (COP) <span className="required">*</span></label>
                <input type="number" className="cw-input"
                  value={form.valor_hora_default}
                  onChange={e => setForm(p => ({ ...p, valor_hora_default: e.target.value }))} />
                {form.valor_hora_default && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--cw-success)', marginTop: '0.2rem' }}>
                    = {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
                      .format(parseFloat(form.valor_hora_default) || 0)} / hora
                    {' · '}
                    {(parseFloat(form.valor_hora_default) * 240).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} / mes (240h)
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  SMLV 2025: ${SMLV_2025.toLocaleString('es-CO')} / mes = ${SMLV_HORA_2025.toLocaleString('es-CO')} / hora
                </div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Nivel ARL</label>
                <select className="cw-input"
                  value={form.nivel_riesgo_arl}
                  onChange={e => setForm(p => ({ ...p, nivel_riesgo_arl: parseInt(e.target.value) }))}>
                  {NIVELES_ARL.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {NIVELES_ARL.find(n => n.value === form.nivel_riesgo_arl)?.desc}
                </div>
              </div>
            </div>

            {/* Auxilio transporte */}
            <div className="cw-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.paga_auxilio_transporte}
                  onChange={e => setForm(p => ({ ...p, paga_auxilio_transporte: e.target.checked }))} />
                <span>Aplica auxilio de transporte (sueldos ≤ 2 SMLV, monto 2025: ${AUX_TRANSPORTE_2025.toLocaleString('es-CO')})</span>
              </label>
            </div>
          </div>
        )}

        {/* ──────────── PASO 3: EXTRAS Y OPERACIÓN ──────────── */}
        {step === 3 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Operación, dotaciones y turno nocturno
            </h4>

            {/* 24/7 - Turno nocturno */}
            {form.modo_operacion === '24_7' && (
              <div style={{
                marginBottom: '1rem', padding: '0.875rem', background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                  <input type="checkbox" checked={form.night_shift_enabled}
                    onChange={e => setForm(p => ({ ...p, night_shift_enabled: e.target.checked }))} />
                  🌙 Habilitar jornada nocturna dedicada
                </label>
                {form.night_shift_enabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="cw-form-group" style={{ marginBottom: 0 }}>
                      <label className="cw-label">Inicio noche</label>
                      <input type="time" className="cw-input"
                        value={form.night_shift_start}
                        onChange={e => setForm(p => ({ ...p, night_shift_start: e.target.value }))} />
                    </div>
                    <div className="cw-form-group" style={{ marginBottom: 0 }}>
                      <label className="cw-label">Fin noche</label>
                      <input type="time" className="cw-input"
                        value={form.night_shift_end}
                        onChange={e => setForm(p => ({ ...p, night_shift_end: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dotación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.requiere_dotacion}
                    onChange={e => setForm(p => ({ ...p, requiere_dotacion: e.target.checked }))} />
                  <span>👕 Requiere dotación (Art. 230 CST)</span>
                </label>
                {form.requiere_dotacion && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <label className="cw-label" style={{ fontSize: '0.75rem' }}>Cada cuántos meses</label>
                    <input type="number" min="1" max="12" className="cw-input"
                      value={form.dotacion_periodicidad_meses}
                      onChange={e => setForm(p => ({ ...p, dotacion_periodicidad_meses: parseInt(e.target.value) || 4 }))} />
                  </div>
                )}
              </div>
              <div className="cw-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.requiere_epp}
                    onChange={e => setForm(p => ({ ...p, requiere_epp: e.target.checked }))} />
                  <span>⛑️ Requiere EPP</span>
                </label>
                {form.requiere_epp && (
                  <input className="cw-input" style={{ marginTop: '0.3rem' }} placeholder="Casco, botas, gafas..."
                    value={form.descripcion_epp}
                    onChange={e => setForm(p => ({ ...p, descripcion_epp: e.target.value }))} />
                )}
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Minutos de break / almuerzo (no se paga)</label>
              <input type="number" min="0" max="180" className="cw-input"
                value={form.break_minutos}
                onChange={e => setForm(p => ({ ...p, break_minutos: parseInt(e.target.value) || 0 }))} />
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Por jurisprudencia, si es &gt;30 min, se descuenta del tiempo laborado.</div>
            </div>

            <div className="cw-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.jornada_partida}
                  onChange={e => setForm(p => ({ ...p, jornada_partida: e.target.checked }))} />
                <span>Permitir turnos partidos (con hora de almuerzo)</span>
              </label>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Notas operativas</label>
              <textarea className="cw-input" rows={3}
                placeholder="Información adicional, restricciones, políticas internas..."
                value={form.notas_operativas}
                onChange={e => setForm(p => ({ ...p, notas_operativas: e.target.value }))} />
            </div>

            {/* Resumen */}
            <div style={{
              marginTop: '1rem', padding: '0.875rem', background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)', borderRadius: 8,
            }}>
              <h5 style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                📋 Resumen
              </h5>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong>{form.nombre || 'Nueva área'}</strong>
                {form.sector && ` · ${SECTORES.find(s => s.value === form.sector)?.label}`}
                <br />
                {form.modo_operacion === '24_7' ? '🔄 24/7' : '🏢 Oficina'} ·{' '}
                {form.patron_rotativo
                  ? PATRONES_ROTATIVOS.find(p => p.value === form.patron_rotativo)?.label
                  : `${form.dias_trabajo.length} días laborables`}
                {' · '}{form.duracion_jornada_horas}h turno
                <br />
                {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato_predominante)?.label}
                {' · '}
                {form.valor_hora_default ? `$${parseFloat(form.valor_hora_default).toLocaleString('es-CO')}/h` : '—'}
                {' · ARL Nivel '}{form.nivel_riesgo_arl}
                {form.requiere_epp && ' · Con EPP'}
                {form.requiere_dotacion && ' · Con dotación'}
              </div>
              {!isEdit && form.franjas_iniciales?.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--cw-success)', marginTop: '0.5rem' }}>
                  ✅ Se crearán {form.franjas_iniciales.length} franjas horarias típicas del sector automáticamente.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="cw-modal__footer">
          {step > 1 && <button type="button" className="cw-btn cw-btn--secondary" onClick={prev}>← Anterior</button>}
          {step < 3 && <button type="button" className="cw-btn cw-btn--primary" onClick={next}>Siguiente →</button>}
          {step === 3 && (
            <button type="button" className="cw-btn cw-btn--primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</>
                : <><MdSave /> {isEdit ? 'Actualizar Área' : 'Crear Área'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────
function Step({ n, active, done, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done ? 'var(--cw-success)' : active ? 'var(--cw-accent)' : 'var(--bg-glass)',
        color: done || active ? 'white' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.78rem',
        border: active ? '2px solid var(--cw-accent)' : '1px solid var(--border-subtle)',
      }}>{done ? '✓' : n}</div>
      <div style={{ fontSize: '0.78rem', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
        {title}
      </div>
    </div>
  );
}

function OpcionCard({ selected, onClick, icono, titulo, desc, color }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '0.75rem', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        border: `2px solid ${selected ? color : 'var(--border-subtle)'}`,
        background: selected ? color + '18' : 'var(--bg-glass)',
        transition: 'all 0.15s',
      }}>
      <div style={{ fontSize: '1.25rem' }}>{icono}</div>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{titulo}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}
