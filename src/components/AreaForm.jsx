// ============================================================
// ChronosWork — Modal de creación/edición de Áreas
// Wizard 3 pasos con explicaciones claras para cualquier empresa.
// Todos los campos inicializados siempre (creación y edición).
// ============================================================

import { useState } from 'react';
import { useAreas } from '../hooks/useAreas';
import {
  TIPOS_CONTRATO, PATRONES_ROTATIVOS,
  SECTORES, AREAS_POR_SECTOR,
  getAreasBySector, getFranjasBySector, getSectorDefaults,
  SMLV_2025, AUX_TRANSPORTE_2025, SMLV_HORA_2025,
} from '../config/laborCatalog';
import {
  MdClose, MdDomain, MdWarning, MdInfo, MdSave,
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

const NIVELES_ARL = [
  { value: 1, label: 'Nivel I (0.522%)', desc: 'Oficinas, administrativos, educación' },
  { value: 2, label: 'Nivel II (1.044%)', desc: 'Comercio, hotelería, servicios' },
  { value: 3, label: 'Nivel III (2.436%)', desc: 'Manufactura liviana, transporte' },
  { value: 4, label: 'Nivel IV (4.350%)', desc: 'Construcción, industria pesada' },
  { value: 5, label: 'Nivel V (6.960%)', desc: 'Minería, petróleos, alto riesgo' },
];

// ── Estado inicial unificado (creación Y edición) ──────────────────────────
// Garantiza que TODOS los campos existan siempre, sin importar si es creación
// o edición. Antes, la creación omitía ~15 campos que el paso 3 renderizaba,
// causando undefined en la UI y defaults inconsistentes al guardar.
function buildInitialForm(area) {
  const isEdit = !!area;

  // Defaults para creación
  const creationDefaults = {
    nombre: '',
    codigo_area: '',
    descripcion: '',
    color: '#6366f1',
    sector: '',
    sub_sector: '',
    centro_costo: '',
    modo_operacion: 'OFICINA',
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
    min_empleados_dia: '',
    max_empleados_dia: '',
    hora_inicio_dia: '08:00',
    hora_fin_dia: '18:00',
    estrategia_asignacion: 'BALANCED',
    min_empleados_noche: 1,
    noche_solo_empleados_dedicados: true,
    permite_dia_cubrir_noche: false,
    slots_por_hora: 4,
    snap_turnos_minutos: 15,
    balancear_carga: true,
    rotar_slots_entre_asesores: false,
    permitir_horas_extras: false,
    permitir_turno_partido: false,
    min_horas_turno_override: '',
    max_horas_turno_override: '',
    requiere_dotacion: false,
    dotacion_periodicidad_meses: 4,
    requiere_epp: false,
    descripcion_epp: '',
    notas_operativas: '',
    consecutividad_horario: true,
    equidad_fin_semana: true,
    peso_seniority: false,
    max_domingos_mes_area: 2,
    franjas_iniciales: [],
  };

  if (!isEdit) return creationDefaults;

  // Edición: sobreescribir con valores del área existente
  return {
    ...creationDefaults,
    nombre: area.nombre || '',
    codigo_area: area.codigo_area || '',
    descripcion: area.descripcion || '',
    color: area.color || '#6366f1',
    sector: area.sector || '',
    sub_sector: area.sub_sector || '',
    centro_costo: area.centro_costo || '',
    modo_operacion: area.modo_operacion || 'OFICINA',
    dias_trabajo: area.dias_trabajo || [1, 2, 3, 4, 5],
    dias_descanso: area.dias_descanso ?? 1,
    dias_descanso_default: area.dias_descanso_default ?? 1,
    horas_extras_max_dia: area.horas_extras_max_dia ?? 2,
    horas_extras_max_semana: area.horas_extras_max_semana ?? 12,
    descanso_min_entre_jornadas: area.descanso_min_entre_jornadas ?? 9,
    patron_rotativo: area.patron_rotativo || null,
    jornada_partida: area.jornada_partida || false,
    tipo_contrato_predominante: area.tipo_contrato_predominante || 'INDEFINIDO',
    tipo_contrato_default: area.tipo_contrato_default || 'INDEFINIDO',
    valor_hora_default: area.valor_hora_default || SMLV_HORA_2025,
    paga_auxilio_transporte: area.paga_auxilio_transporte ?? true,
    nivel_riesgo_arl: area.nivel_riesgo_arl || 1,
    night_shift_enabled: area.night_shift_enabled || false,
    night_shift_start: area.night_shift_start || '22:00',
    night_shift_end: area.night_shift_end || '06:00',
    min_empleados_dia: area.min_empleados_dia ?? '',
    max_empleados_dia: area.max_empleados_dia ?? '',
    hora_inicio_dia: area.hora_inicio_dia ? String(area.hora_inicio_dia).slice(0, 5) : '08:00',
    hora_fin_dia: area.hora_fin_dia ? String(area.hora_fin_dia).slice(0, 5) : '18:00',
    estrategia_asignacion: area.estrategia_asignacion || 'BALANCED',
    min_empleados_noche: area.min_empleados_noche || 1,
    noche_solo_empleados_dedicados: area.noche_solo_empleados_dedicados ?? true,
    permite_dia_cubrir_noche: area.permite_dia_cubrir_noche ?? false,
    slots_por_hora: area.slots_por_hora || 4,
    snap_turnos_minutos: area.snap_turnos_minutos || 15,
    balancear_carga: area.balancear_carga ?? true,
    rotar_slots_entre_asesores: area.rotar_slots_entre_asesores ?? false,
    permitir_horas_extras: area.permitir_horas_extras ?? false,
    permitir_turno_partido: area.permitir_turno_partido ?? false,
    min_horas_turno_override: area.min_horas_turno_override ?? '',
    max_horas_turno_override: area.max_horas_turno_override ?? '',
    requiere_dotacion: area.requiere_dotacion || false,
    dotacion_periodicidad_meses: area.dotacion_periodicidad_meses || 4,
    requiere_epp: area.requiere_epp || false,
    descripcion_epp: area.descripcion_epp || '',
    notas_operativas: area.notas_operativas || '',
    consecutividad_horario: area.consecutividad_horario ?? true,
    equidad_fin_semana: area.equidad_fin_semana ?? true,
    peso_seniority: area.peso_seniority ?? false,
    max_domingos_mes_area: area.max_domingos_mes_area ?? 2,
    franjas_iniciales: [],
  };
}

// ── Defaults inteligentes al elegir sector (solo en creación) ──────────────
function buildDefaultsForSector(sector) {
  const def = getSectorDefaults(sector);
  const franjas = getFranjasBySector(sector);
  const modo = def.modo || 'OFICINA';
  const es247 = modo === '24_7' || modo === '24_7_NIGHT_SPLIT';
  return {
    modo_operacion: modo,
    tipo_contrato_predominante: def.contrato,
    tipo_contrato_default: def.contrato,
    valor_hora_default: def.salario,
    dias_trabajo: es247 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5],
    patron_rotativo: es247 ? '6x1' : null,
    dias_descanso: 1,
    dias_descanso_default: 1,
    nivel_riesgo_arl: es247 ? 2 : 1,
    paga_auxilio_transporte: true,
    franjas_iniciales: franjas,
    night_shift_enabled: es247,
    estrategia_asignacion: es247 ? 'COVERAGE_FIRST' : 'BALANCED',
    min_empleados_noche: 1,
    hora_inicio_dia: es247 ? '04:00' : '08:00',
    hora_fin_dia: es247 ? '22:00' : '18:00',
  };
}

export default function AreaFormModal({ area, onClose }) {
  const isEdit = !!area;
  const { createArea, updateArea } = useAreas();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => buildInitialForm(area));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSalaryWarning, setShowSalaryWarning] = useState(false);

  const es247 = form.modo_operacion === '24_7' || form.modo_operacion === '24_7_NIGHT_SPLIT';

  // Al elegir sector: solo aplicar defaults automáticos en CREACIÓN.
  // En edición, cambiar el sector solo actualiza el sector (no sobrescribe
  // la configuración que el usuario ya personalizó).
  const handleSectorChange = (newSector) => {
    setForm(prev => ({
      ...prev,
      sector: newSector,
      ...(newSector && !isEdit ? buildDefaultsForSector(newSector) : {}),
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

  const setModoOperacion = (modo) => {
    const es247Nuevo = modo === '24_7' || modo === '24_7_NIGHT_SPLIT';
    setForm(prev => ({
      ...prev,
      modo_operacion: modo,
      dias_trabajo: es247Nuevo ? [1, 2, 3, 4, 5, 6, 7] : (prev.dias_trabajo.length ? prev.dias_trabajo : [1, 2, 3, 4, 5]),
      night_shift_enabled: es247Nuevo,
      estrategia_asignacion: es247Nuevo ? 'COVERAGE_FIRST' : 'BALANCED',
      patron_rotativo: modo === '24_7' ? (prev.patron_rotativo || '6x1') : null,
    }));
  };

  // ── Validaciones por paso ────────────────────────────────────────────────
  const validateStep = (s) => {
    setError('');
    if (s === 1) {
      if (!form.nombre.trim()) { setError('El nombre del área es obligatorio.'); return false; }
      if (!form.sector) { setError('Selecciona el sector económico de tu empresa.'); return false; }
      if (!form.dias_trabajo.length) { setError('Selecciona al menos un día de trabajo.'); return false; }
    }
    if (s === 2) {
      const v = parseFloat(form.valor_hora_default);
      if (!v || v <= 0) { setError('El valor por hora debe ser mayor a 0.'); return false; }
      if (v < 5000) { setError(`El valor por hora ($${v}) es muy bajo. El SMLV/hora 2025 es $${SMLV_HORA_2025}.`); return false; }
      if (form.hora_inicio_dia && form.hora_fin_dia) {
        if (form.hora_inicio_dia >= form.hora_fin_dia) {
          setError('La hora de inicio del día debe ser anterior a la hora de cierre.'); return false;
        }
      }
      if (form.min_empleados_dia && form.max_empleados_dia) {
        if (parseInt(form.min_empleados_dia) > parseInt(form.max_empleados_dia)) {
          setError('El mínimo de personas por día no puede ser mayor al máximo.'); return false;
        }
      }
    }
    if (s === 3) {
      if (es247 && form.night_shift_enabled) {
        if (!form.night_shift_start || !form.night_shift_end) {
          setError('Configura las horas de inicio y fin del turno nocturno.'); return false;
        }
        if (form.min_empleados_noche < 1) {
          setError('Debe haber al menos 1 persona en el turno nocturno.'); return false;
        }
      }
    }
    return true;
  };

  const next = () => { if (validateStep(step)) setStep(s => Math.min(3, s + 1)); };
  const prev = () => { setError(''); setStep(s => Math.max(1, s - 1)); };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    // Si en edición se cambió el valor_hora, pedir confirmación
    // (la propagación recalcula la nómina de todos los empleados del área)
    if (isEdit && showSalaryWarning) {
      // El warning ya se mostró; el usuario ya vio el mensaje.
      // Procedemos: el hook updateArea se encarga de la propagación.
    }

    setLoading(true);
    try {
      // Limpiar el payload: quitar break_minutos (reemplazado por break_policy)
      // y franjas_iniciales (solo relevantes en creación)
      const { break_minutos, franjas_iniciales, ...restForm } = form;
      const valorNum = parseFloat(form.valor_hora_default);
      const payload = { ...restForm, valor_hora_default: valorNum };

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

  // Detectar cambio de valor_hora para mostrar warning
  const onValorHoraChange = (val) => {
    setForm(p => ({ ...p, valor_hora_default: val }));
    if (isEdit && parseFloat(val) !== parseFloat(area.valor_hora_default)) {
      setShowSalaryWarning(true);
    } else {
      setShowSalaryWarning(false);
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
          <Step n={3} active={step === 3} done={false} title="Asignación y Operación" />
        </div>

        {error && <div className="cw-alert cw-alert--error" style={{ margin: '0 1.25rem 1rem' }}>{''} {error}</div>}

        {/* ──────────── PASO 1: IDENTIDAD ──────────── */}
        {step === 1 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <InfoCard color="#6366f1">
              Elige el sector de tu empresa y el sistema autocompletará salario, jornada y franjas
              horarias típicas. Podrás ajustar todo en los siguientes pasos.
            </InfoCard>

            <div className="cw-form-group">
              <label className="cw-label">Sector económico <span className="required">*</span></label>
              <select className="cw-input"
                value={form.sector}
                onChange={e => handleSectorChange(e.target.value)}>
                <option value="">— Selecciona tu sector —</option>
                {SECTORES.map(s => (
                  <option key={s.value} value={s.value}>{s.icono} {s.label}</option>
                ))}
              </select>
              <div className="field-hint">
                Determina el salario, franjas y turnos sugeridos. Puedes cambiar todo después.
              </div>
            </div>

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Código interno (opcional)</label>
                <input className="cw-input"
                  placeholder="CAJ-01"
                  value={form.codigo_area}
                  onChange={e => setForm(p => ({ ...p, codigo_area: e.target.value }))} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Centro de costo (opcional)</label>
                <input className="cw-input"
                  placeholder="CC-1001"
                  value={form.centro_costo}
                  onChange={e => setForm(p => ({ ...p, centro_costo: e.target.value }))} />
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Color identificador</label>
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
              <div className="field-hint">Sirve para identificar el área en la grilla de turnos.</div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Descripción (opcional)</label>
              <input className="cw-input"
                placeholder="Breve descripción del área..."
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
          </div>
        )}

        {/* ──────────── PASO 2: JORNADA Y SALARIO ──────────── */}
        {step === 2 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <InfoCard color="#6366f1">
              Define <strong>cómo opera tu área</strong>: el horario, los días laborables, el tipo de
              contrato y el salario. Esto es lo que el algoritmo usa para generar los turnos
              automáticamente y calcular la nómina según la ley colombiana.
            </InfoCard>

            {/* Modo operación */}
            <div className="cw-form-group">
              <label className="cw-label">Tipo de operación <span className="required">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <OpcionCard
                  selected={form.modo_operacion === 'OFICINA'}
                  onClick={() => setModoOperacion('OFICINA')}
                  icono="🏢" titulo="Horario definido"
                  desc="Turnos fijos por día. Para oficinas, retail, restaurantes, fábricas — cualquier horario que no sea 24h."
                  color="#6366f1" />
                <OpcionCard
                  selected={form.modo_operacion === '24_7'}
                  onClick={() => setModoOperacion('24_7')}
                  icono="🔄" titulo="Operación continua 24/7"
                  desc="Cobertura ininterrumpida, todos los días. El algoritmo garantiza turno nocturno automáticamente."
                  color="#f59e0b" />
                <OpcionCard
                  selected={form.modo_operacion === '24_7_NIGHT_SPLIT'}
                  onClick={() => setModoOperacion('24_7_NIGHT_SPLIT')}
                  icono="📞" titulo="24/7 con nocturno dedicado"
                  desc="Para call centers, hospitales. Personas exclusivas de noche + turnos flexibles de día."
                  color="#10b981" />
              </div>
              <div className="field-hint">
                {form.modo_operacion === 'OFICINA' && 'Funciona para cualquier horario que no opere 24h: oficinas L-V, retail L-D, restaurantes con turnos partidos, fábricas con 3 turnos. Configura los días y franjas en los pasos siguientes.'}
                {form.modo_operacion === '24_7' && 'Recomendado para seguridad, salud, hotelería. Cobertura todos los días, turnos rotativos. El algoritmo coloca bloques nocturnos automáticamente.'}
                {form.modo_operacion === '24_7_NIGHT_SPLIT' && 'Recomendado para call centers. Personas exclusivas de noche + turnos flexibles de día según demanda.'}
              </div>
            </div>

            {/* Patrón rotativo */}
            <div className="cw-form-group">
              <label className="cw-label">Patrón de trabajo/descanso</label>
              <div className="field-hint" style={{ marginBottom: '0.5rem' }}>
                Define cuántos días seguidos trabaja una persona y cuántos descansa.
                {!es247 && ' Para oficina, usa "Personalizado" y marca los días abajo.'}
                {es247 && ' Para 24/7, elige un patrón rotativo (ej: 6x1 = trabaja 6, descansa 1).'}
              </div>
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
            </div>

            {/* Días laborables manuales (si no hay patrón rotativo) */}
            {!form.patron_rotativo && (
              <div className="cw-form-group">
                <label className="cw-label" style={{ fontSize: '0.78rem' }}>Días laborables</label>
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

            {/* Límites de horas extras */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">HE máx/día</label>
                <input type="number" min="0" max="4" className="cw-input"
                  value={form.horas_extras_max_dia}
                  onChange={e => setForm(p => ({ ...p, horas_extras_max_dia: parseInt(e.target.value) || 0 }))} />
                <div className="field-hint">Límite legal CST: 2h</div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">HE máx/sem</label>
                <input type="number" min="0" max="48" className="cw-input"
                  value={form.horas_extras_max_semana}
                  onChange={e => setForm(p => ({ ...p, horas_extras_max_semana: parseInt(e.target.value) || 0 }))} />
                <div className="field-hint">Límite legal CST: 12h</div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Descanso entre turnos (h)</label>
                <input type="number" min="6" max="24" className="cw-input"
                  value={form.descanso_min_entre_jornadas}
                  onChange={e => setForm(p => ({ ...p, descanso_min_entre_jornadas: parseInt(e.target.value) || 9 }))} />
                <div className="field-hint">Mínimo legal: 9h</div>
              </div>
            </div>

            {/* Tipo contrato */}
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
              <div className="field-hint">
                {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato_predominante)?.prestacion}
              </div>
            </div>

            {/* Salario */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Valor hora base (COP) <span className="required">*</span></label>
                <input type="number" className="cw-input"
                  value={form.valor_hora_default}
                  onChange={e => onValorHoraChange(e.target.value)} />
                {form.valor_hora_default && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--cw-success)', marginTop: '0.2rem' }}>
                    = {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
                      .format(parseFloat(form.valor_hora_default) || 0)} / hora
                    {' · '}
                    {(parseFloat(form.valor_hora_default) * 240).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} / mes (240h)
                  </div>
                )}
                <div className="field-hint">
                  SMLV 2025: ${SMLV_2025.toLocaleString('es-CO')} / mes = ${SMLV_HORA_2025.toLocaleString('es-CO')} / hora
                </div>
                {showSalaryWarning && (
                  <div style={{
                    marginTop: '0.4rem', padding: '0.5rem 0.75rem',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 6, fontSize: '0.72rem', color: '#d97706', display: 'flex', gap: '0.4rem',
                  }}>
                    <MdWarning style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>Al cambiar el valor hora, se actualizará el salario de todos los colaboradores
                    del área (excepto los marcados como "salario especial"). Esto recalcula la nómina
                    del mes en curso.</span>
                  </div>
                )}
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Nivel de riesgo ARL</label>
                <select className="cw-input"
                  value={form.nivel_riesgo_arl}
                  onChange={e => setForm(p => ({ ...p, nivel_riesgo_arl: parseInt(e.target.value) }))}>
                  {NIVELES_ARL.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
                <div className="field-hint">
                  {NIVELES_ARL.find(n => n.value === form.nivel_riesgo_arl)?.desc}
                </div>
              </div>
            </div>

            {/* Auxilio transporte */}
            <div className="cw-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.paga_auxilio_transporte}
                  onChange={e => setForm(p => ({ ...p, paga_auxilio_transporte: e.target.checked }))} />
                <span>Aplica auxilio de transporte</span>
              </label>
              <div className="field-hint">
                Para empleados que ganan hasta 2 SMLV (${(SMLV_2025 * 2).toLocaleString('es-CO')}).
                Monto 2025: ${AUX_TRANSPORTE_2025.toLocaleString('es-CO')}/mes.
                <strong> Informativo:</strong> la liquidación final de nómina lo calcula Gestión Humana.
              </div>
            </div>

            {/* Horario del día */}
            <div style={{
              marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10,
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.4rem' }}>
                 🕑 Horario de operación del día
              </div>
              <div className="field-hint" style={{ marginBottom: '0.5rem' }}>
                Entre qué horas puede el algoritmo colocar turnos de día.
                {!es247 && ' Ej: 08:00 a 18:00 para una oficina.'}
                {es247 && ' La noche se gestiona aparte en el paso 3.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Primer turno puede iniciar a las</label>
                  <input type="time" className="cw-input"
                    value={form.hora_inicio_dia}
                    onChange={e => setForm(p => ({ ...p, hora_inicio_dia: e.target.value }))} />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Último turno debe terminar a las</label>
                  <input type="time" className="cw-input"
                    value={form.hora_fin_dia}
                    onChange={e => setForm(p => ({ ...p, hora_fin_dia: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Headcount */}
            <div style={{
              marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10,
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', marginBottom: '0.4rem' }}>
                 👥 Personas por día (opcional)
              </div>
              <div className="field-hint" style={{ marginBottom: '0.5rem' }}>
                Cuántas personas distintas quieres programar por día. El algoritmo reparte ese total
                según la curva de demanda (más gente en horas pico, menos en valle).
                <strong> Deja en blanco</strong> si no tienes un número objetivo — el algoritmo
                cubre según la demanda.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Mín. personas/día (piso)</label>
                  <input type="number" min="0" className="cw-input" placeholder="opcional"
                    value={form.min_empleados_dia}
                    onChange={e => setForm(p => ({ ...p, min_empleados_dia: e.target.value }))} />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Máx. personas/día (objetivo)</label>
                  <input type="number" min="0" className="cw-input" placeholder="opcional"
                    value={form.max_empleados_dia}
                    onChange={e => setForm(p => ({ ...p, max_empleados_dia: e.target.value }))} />
                </div>
              </div>
              <div className="field-hint" style={{ marginTop: '0.4rem' }}>
                El <strong>máximo</strong> es el objetivo: intenta llegar a ese número, nunca lo supera.
                El <strong>mínimo</strong> es el piso: si no se alcanza, el día se deja sin cubrir
                para priorizar los demás.
              </div>
            </div>
          </div>
        )}

        {/* ──────────── PASO 3: ASIGNACIÓN Y OPERACIÓN ──────────── */}
        {step === 3 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <InfoCard color="#10b981">
              Estos ajustes controlan <strong>cómo el algoritmo asigna los turnos</strong>.
              Si no estás seguro, déjalo en los valores recomendados — funcionan para la mayoría
              de empresas. Puedes ajustarlo después si los turnos no salen como esperas.
            </InfoCard>

            {/* Turno nocturno (solo 24/7) */}
            {es247 && (
              <div style={{
                marginBottom: '1rem', padding: '0.875rem', background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                  <input type="checkbox" checked={form.night_shift_enabled}
                    onChange={e => setForm(p => ({ ...p, night_shift_enabled: e.target.checked }))} />
                   🌙 Habilitar turno nocturno dedicado
                </label>
                <div className="field-hint" style={{ marginBottom: '0.6rem' }}>
                  Personas que trabajan exclusivamente de noche. <strong>Para generar turnos:</strong> el algoritmo
                  usa estas horas. <strong>Para nómina:</strong> la ley colombiana aplica recargo nocturno
                  (+35%) a toda hora entre 19:00 y 06:00, sin importar cómo configures la franja aquí.
                </div>
                {form.night_shift_enabled && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
                      <div className="cw-form-group" style={{ marginBottom: 0 }}>
                        <label className="cw-label">Mín. personas en la noche</label>
                        <input type="number" min="1" className="cw-input"
                          value={form.min_empleados_noche}
                          onChange={e => setForm(p => ({ ...p, min_empleados_noche: parseInt(e.target.value) || 1 }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                        <input type="checkbox" checked={form.noche_solo_empleados_dedicados}
                          onChange={e => setForm(p => ({ ...p, noche_solo_empleados_dedicados: e.target.checked }))} />
                        <span>Solo personas dedicadas a la noche</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                        <input type="checkbox" checked={form.permite_dia_cubrir_noche}
                          onChange={e => setForm(p => ({ ...p, permite_dia_cubrir_noche: e.target.checked }))} />
                        <span>Permitir diurnos en noche (emergencia)</span>
                      </label>
                    </div>
                    <div className="field-hint">
                      Marca cada colaborador como 🌙 Nocturno, 🌓 Mixto o ☀️ Diurno desde la
                      página de áreas (botones junto a cada persona).
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Estrategia de asignación */}
            <div style={{
              marginBottom: '1rem', padding: '0.875rem', background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10,
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', marginBottom: '0.5rem' }}>
                🤖 Cómo repartir los turnos
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Estrategia de asignación</label>
                <select className="cw-input" value={form.estrategia_asignacion}
                  onChange={e => setForm(p => ({ ...p, estrategia_asignacion: e.target.value }))}>
                  <option value="COVERAGE_FIRST">📊 Cobertura primero — Llenar la demanda (recomendado 24/7)</option>
                  <option value="BALANCED">⚖️ Balanceado — Repartir horas parejas (recomendado oficina)</option>
                  <option value="EMPLOYEE_PREF">👤 Preferencias del empleado — Respeta su jornada preferida</option>
                </select>
                <div className="field-hint">
                  {form.estrategia_asignacion === 'COVERAGE_FIRST' && 'El algoritmo prioriza que siempre haya gente cubriendo. Puede dejar a algunas personas con más horas que otras.'}
                  {form.estrategia_asignacion === 'BALANCED' && 'El algoritmo intenta repartir las horas parejo entre todos. Ideal cuando todos hacen lo mismo.'}
                  {form.estrategia_asignacion === 'EMPLOYEE_PREF' && 'El algoritmo respeta si una persona marcó que solo quiere día o solo noche, aunque queden huecos.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Min horas/turno</label>
                  <input type="number" step="0.5" min="1" className="cw-input" placeholder="4 (legal)"
                    value={form.min_horas_turno_override}
                    onChange={e => setForm(p => ({ ...p, min_horas_turno_override: e.target.value }))} />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Max horas/turno</label>
                  <input type="number" step="0.5" min="1" className="cw-input" placeholder="9 (defecto)"
                    value={form.max_horas_turno_override}
                    onChange={e => setForm(p => ({ ...p, max_horas_turno_override: e.target.value }))} />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.72rem' }}>Ajuste de turnos</label>
                  <select className="cw-input" value={form.snap_turnos_minutos}
                    onChange={e => setForm(p => ({ ...p, snap_turnos_minutos: parseInt(e.target.value) }))}>
                    <option value="5">5 min (preciso)</option>
                    <option value="10">10 min</option>
                    <option value="15">15 min (recomendado)</option>
                    <option value="30">30 min</option>
                    <option value="60">60 min (sencillo)</option>
                  </select>
                </div>
              </div>
              <div className="field-hint" style={{ marginTop: '0.3rem' }}>
                Min/Max horas: duración de cada turno. Si lo dejas en blanco, usa los defaults legales (4h mín, 9h máx).
                Ajuste: cada cuánto puede variar la hora de inicio (15 min = turnos a :00, :15, :30, :45).
              </div>

              {/* Toggles de asignación */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.balancear_carga}
                    onChange={e => setForm(p => ({ ...p, balancear_carga: e.target.checked }))} />
                  <span>⚖️ Balancear carga semanal</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.permitir_horas_extras}
                    onChange={e => setForm(p => ({ ...p, permitir_horas_extras: e.target.checked }))} />
                  <span>⏱️ Permitir horas extra (máx 2/día)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.permitir_turno_partido}
                    onChange={e => setForm(p => ({ ...p, permitir_turno_partido: e.target.checked }))} />
                  <span>⏱️ Permitir turnos partidos (con almuerzo)</span>
                </label>
              </div>
            </div>

            {/* Optimización avanzada */}
            <div style={{
              marginBottom: '1rem', padding: '0.75rem', borderRadius: 10,
              background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                OPTIMIZACIÓN AVANZADA (opcional)
              </div>
              <div className="field-hint" style={{ marginBottom: '0.5rem' }}>
                Activa estas opciones para mejorar la calidad de vida de tus colaboradores.
                Funcionan para 24/7 y oficina.
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.consecutividad_horario}
                    onChange={e => setForm(p => ({ ...p, consecutividad_horario: e.target.checked }))} />
                  <span>🔗 Mismo horario días seguidos</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.equidad_fin_semana}
                    onChange={e => setForm(p => ({ ...p, equidad_fin_semana: e.target.checked }))} />
                  <span>🏖️ Repartir fines de semana parejo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={form.peso_seniority}
                    onChange={e => setForm(p => ({ ...p, peso_seniority: e.target.checked }))} />
                  <span>🏅 Priorizar por antigüedad</span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Máx. domingos/mes:</label>
                <input type="number" min="0" max="5" step="1" className="cw-input" style={{ width: 70 }}
                  value={form.max_domingos_mes_area}
                  onChange={e => setForm(p => ({ ...p, max_domingos_mes_area: parseInt(e.target.value) || 2 }))} />
                <span className="field-hint">CST Colombia: mínimo 2 de descanso</span>
              </div>
            </div>

            {/* Dotación y EPP */}
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
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.6rem 0.75rem',
                background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8,
              }}>
                ☕ Los descansos (almuerzo y breaks) se configuran en <strong>Política de Descansos</strong>
                al seleccionar el área, donde defines su duración, espaciado y reglas por horas de turno.
              </div>
            </div>

            <div className="cw-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.jornada_partida}
                  onChange={e => setForm(p => ({ ...p, jornada_partida: e.target.checked }))} />
                <span>Permitir turnos partidos (con hora de almuerzo)</span>
              </label>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Notas operativas (opcional)</label>
              <textarea className="cw-input" rows={2}
                placeholder="Información adicional, restricciones, políticas internas..."
                value={form.notas_operativas}
                onChange={e => setForm(p => ({ ...p, notas_operativas: e.target.value }))} />
            </div>

            {/* Resumen */}
            <div style={{
              marginTop: '0.5rem', padding: '0.875rem', background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)', borderRadius: 8,
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📋 Resumen
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong>{form.nombre || 'Nueva área'}</strong>
                {form.sector && ` · ${SECTORES.find(s => s.value === form.sector)?.label}`}
                <br />
                {es247 ? (form.modo_operacion === '24_7_NIGHT_SPLIT' ? '📞 24/7 con nocturno dedicado' : '🔄 Operación continua 24/7') : '🏢 Horario definido'}
                {' · '}
                {form.patron_rotativo
                  ? PATRONES_ROTATIVOS.find(p => p.value === form.patron_rotativo)?.label
                  : `${form.dias_trabajo.length} días laborables`}
                {' · '}
                {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato_predominante)?.label}
                {' · '}
                {form.valor_hora_default ? `$${parseFloat(form.valor_hora_default).toLocaleString('es-CO')}/h` : '—'}
                {' · ARL Nivel '}{form.nivel_riesgo_arl}
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
          {step > 1 && <button type="button" className="cw-btn cw-btn--secondary" onClick={prev}>{'←'} Anterior</button>}
          {step < 3 && <button type="button" className="cw-btn cw-btn--primary" onClick={next}>Siguiente {'→'}</button>}
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

function InfoCard({ children, color = '#6366f1' }) {
  return (
    <div style={{
      marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8,
      background: color + '0A', border: `1px solid ${color}25`,
      fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
      display: 'flex', gap: '0.5rem',
    }}>
      <MdInfo style={{ flexShrink: 0, marginTop: 2, color }} />
      <span>{children}</span>
    </div>
  );
}
