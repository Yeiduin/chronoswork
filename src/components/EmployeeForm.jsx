// ============================================================
// ChronosWork — Modal completo de creación/edición de Empleados
// Con todos los tipos de contrato colombianos, seguridad social,
// datos personales, datos bancarios y académicos.
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  TIPOS_CONTRATO, TIPOS_JORNADA, PATRONES_ROTATIVOS,
  SMLV_2025, AUX_TRANSPORTE_2025, SMLV_HORA_2025,
  TIPOS_NOVEDAD,
} from '../config/laborCatalog';
import {
  MdClose, MdPerson, MdWork, MdAccountBalance, MdSchool, MdContactPhone, MdInfo,
} from 'react-icons/md';

const NIVELES_ARL = [
  { value: 1, label: 'Nivel I — Riesgo Mínimo (0.522%)' },
  { value: 2, label: 'Nivel II — Riesgo Bajo (1.044%)' },
  { value: 3, label: 'Nivel III — Riesgo Medio (2.436%)' },
  { value: 4, label: 'Nivel IV — Riesgo Alto (4.350%)' },
  { value: 5, label: 'Nivel V — Riesgo Máximo (6.960%)' },
];

// Catálogo común de EPS, AFP, ARL, Cajas (datos del usuario, no hardcoded oficial)
const EPS_COMUNES = [
  'Nueva EPS', 'Sanitas', 'Sura EPS', 'Compensar EPS', 'Famisanar',
  'Salud Total', 'Coomeva', 'Medimás', 'Aliansalud', 'Cajacopi EPS',
];
const AFP_COMUNES = [
  'Porvenir', 'Protección', 'Colfondos', 'Skandia (Old Mutual)',
  'Cafam', 'Colpensiones (público)',
];
const ARL_COMUNES = [
  'Sura ARL', 'Positiva ARL', 'Bolívar ARL', 'Colmena Seguros ARL',
  'Liberty Seguros ARL', 'Mapfre ARL', 'La Equidad Seguros',
];
const CAJAS_COMUNES = [
  'Compensar', 'Comfama', 'Comfenalco Antioquia', 'Comfandi', 'Cajacopi',
  'Comfamiliar Atlántico', 'Comfacasanare', 'Comfenalco Quindío',
];

export default function EmployeeFormModal({ employee, areas, onClose, onSave }) {
  const isEdit = !!employee;
  const initialAreaId = !isEdit
    ? ''
    : areas.find(a => a.area_employees?.some(ae => ae.employee_id === employee.id))?.id || '';

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    // Paso 1: Identidad
    tipo_documento: employee?.tipo_documento || 'CC',
    cedula: employee?.cedula || '',
    lugar_expedicion: employee?.lugar_expedicion || '',
    nombre: employee?.nombre || '',
    fecha_nacimiento: employee?.fecha_nacimiento || '',
    genero: employee?.genero || '',
    estado_civil: employee?.estado_civil || '',
    numero_hijos: employee?.numero_hijos ?? 0,
    tiene_discapacidad: employee?.tiene_discapacidad || false,
    descripcion_discapacidad: employee?.descripcion_discapacidad || '',

    // Paso 2: Contacto
    direccion: employee?.direccion || '',
    ciudad: employee?.ciudad || '',
    departamento: employee?.departamento || '',
    telefono_contacto: employee?.telefono_contacto || '',
    email_personal: employee?.email_personal || '',
    contacto_emergencia_nombre: employee?.contacto_emergencia_nombre || '',
    contacto_emergencia_telefono: employee?.contacto_emergencia_telefono || '',
    contacto_emergencia_parentesco: employee?.contacto_emergencia_parentesco || '',

    // Paso 3: Contrato
    fecha_ingreso: employee?.fecha_ingreso || new Date().toISOString().slice(0, 10),
    fecha_fin_contrato: employee?.fecha_fin_contrato || '',
    periodo_prueba_hasta: employee?.periodo_prueba_hasta || '',
    tipo_contrato: employee?.tipo_contrato || 'INDEFINIDO',
    cargo: employee?.cargo || '',
    cargo_codigo: employee?.cargo_codigo || '',
    nivel_cargo: employee?.nivel_cargo || 'JUNIOR',
    es_jefe: employee?.es_jefe || false,
    jornada_tipo: employee?.jornada_tipo || 'DIURNA',
    horas_semanales_contrato: employee?.horas_semanales_contrato ?? 42,
    horas_mensuales_contrato: employee?.horas_mensuales_contrato ?? 182,
    duracion_jornada_horas: employee?.duracion_jornada_horas ?? 8,
    dias_descanso_semana: employee?.dias_descanso_semana ?? 1,
    turno_predeterminado_id: employee?.turno_predeterminado_id || '',
    jornada_partida: employee?.jornada_partida || false,

    // Paso 4: Salario
    valor_hora: employee?.valor_hora ?? SMLV_HORA_2025,
    salario_mensual: employee?.salario_mensual ?? SMLV_2025,
    bono_rodamiento: employee?.bono_rodamiento ?? 0,
    bonificacion_fija: employee?.bonificacion_fija ?? 0,
    recibe_auxilio_transporte: employee?.recibe_auxilio_transporte ?? true,
    aplica_pago_dominical: employee?.aplica_pago_dominical ?? true,
    aplica_horas_extras: employee?.aplica_horas_extras ?? true,
    es_especial: employee?.es_especial || false,  // salario personalizado

    // Paso 5: Seguridad social
    eps_nombre: employee?.eps_nombre || '',
    eps_codigo: employee?.eps_codigo || '',
    afp_nombre: employee?.afp_nombre || '',
    afp_codigo: employee?.afp_codigo || '',
    afp_tipo: employee?.afp_tipo || 'RAZON',
    arl_nombre: employee?.arl_nombre || '',
    arl_codigo: employee?.arl_codigo || '',
    nivel_riesgo_arl: employee?.nivel_riesgo_arl ?? 1,
    caja_compensacion: employee?.caja_compensacion || '',
    caja_codigo: employee?.caja_codigo || '',
    fondo_cesantias: employee?.fondo_cesantias || '',
    cesantias_afc: employee?.cesantias_afc || false,

    // Paso 6: Bancarios
    banco_nombre: employee?.banco_nombre || '',
    tipo_cuenta: employee?.tipo_cuenta || 'AHORROS',
    numero_cuenta: employee?.numero_cuenta || '',
    titular_cuenta: employee?.titular_cuenta || '',

    // Paso 7: Académico
    nivel_educacion: employee?.nivel_educacion || '',
    titulo_obtenido: employee?.titulo_obtenido || '',
    sena_aprendiz: employee?.sena_aprendiz || false,
    etapa_productiva: employee?.etapa_productiva || false,
    fecha_etapa_lectiva_inicio: employee?.fecha_etapa_lectiva_inicio || '',
    fecha_etapa_lectiva_fin: employee?.fecha_etapa_lectiva_fin || '',

    // Paso 8: Datos fiscales
    responsable_iva: employee?.responsable_iva || false,
    declarante_renta: employee?.declarante_renta || false,
    aplica_retencion_fuente: employee?.aplica_retencion_fuente ?? true,
    numero_dependientes: employee?.numero_dependientes ?? 0,
    persona_mayor_dependiente: employee?.persona_mayor_dependiente || false,

    // Permisos
    tiene_licencia_conduccion: employee?.tiene_licencia_conduccion || false,
    categoria_licencia: employee?.categoria_licencia || '',
    vencimiento_licencia: employee?.vencimiento_licencia || '',
    tiene_certificaciones: employee?.tiene_certificaciones || '',
  }));

  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);

  // Cargar templates del área seleccionada
  useEffect(() => {
    if (!selectedAreaId) { setTemplates([]); return; }
    supabase.from('shift_templates')
      .select('*').eq('area_id', selectedAreaId).eq('activo', true).order('hora_inicio')
      .then(({ data }) => setTemplates(data || []));
  }, [selectedAreaId]);

  // Al elegir área, aplicar defaults si NO es especial ni edición inicial
  useEffect(() => {
    if (!selectedAreaId) return;
    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;
    if (form.es_especial) return;
    if (isEdit && selectedAreaId === initialAreaId) return;
    setForm(prev => {
      const updates = {};
      if (area.valor_hora_default) {
        updates.valor_hora = area.valor_hora_default;
        updates.salario_mensual = area.valor_hora_default * 240;
      }
      if (area.tipo_contrato_predominante) updates.tipo_contrato = area.tipo_contrato_predominante;
      if (area.duracion_jornada_horas) updates.duracion_jornada_horas = area.duracion_jornada_horas;
      if (area.dias_descanso_default) updates.dias_descanso_semana = area.dias_descanso_default;
      if (area.jornada_tipo) updates.jornada_tipo = area.jornada_tipo;
      if (area.nivel_riesgo_arl) updates.nivel_riesgo_arl = area.nivel_riesgo_arl;
      if (area.paga_auxilio_transporte !== undefined) {
        updates.recibe_auxilio_transporte = area.paga_auxilio_transporte;
      }
      return { ...prev, ...updates };
    });
  }, [selectedAreaId, form.es_especial, areas, isEdit, initialAreaId]);

  // Auto-completar SMLV si el empleado es aprendiz (productiva)
  useEffect(() => {
    if (form.sena_aprendiz && form.etapa_productiva && !form.es_especial) {
      setForm(prev => ({ ...prev, salario_mensual: Math.round(SMLV_2025 * 0.5) }));
    }
  }, [form.sena_aprendiz, form.etapa_productiva, form.es_especial]);

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.cedula?.trim()) e.cedula = 'La cédula es obligatoria.';
      if (!form.nombre?.trim()) e.nombre = 'El nombre es obligatorio.';
      if (!form.fecha_nacimiento) e.fecha_nacimiento = 'Fecha de nacimiento obligatoria.';
    }
    if (s === 3) {
      if (!form.cargo?.trim()) e.cargo = 'El cargo es obligatorio.';
      if (!selectedAreaId) e.area = 'Selecciona un área.';
      if (!form.fecha_ingreso) e.fecha_ingreso = 'La fecha de ingreso es obligatoria.';
      if (form.tipo_contrato === 'TERMINO_FIJO' && !form.fecha_fin_contrato) {
        e.fecha_fin_contrato = 'Contrato a término fijo requiere fecha de terminación.';
      }
    }
    if (s === 4) {
      if (!form.valor_hora || parseFloat(form.valor_hora) <= 0) e.valor_hora = 'Valor hora debe ser > 0.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep(s => Math.min(8, s + 1)); };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    // Validar todos los pasos requeridos
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setLoading(true);
    try {
      await onSave({
        ...form,
        valor_hora: parseFloat(form.valor_hora) || 0,
        salario_mensual: parseFloat(form.salario_mensual) || 0,
        bono_rodamiento: parseFloat(form.bono_rodamiento) || 0,
        bonificacion_fija: parseFloat(form.bonificacion_fija) || 0,
        numero_hijos: parseInt(form.numero_hijos) || 0,
        numero_dependientes: parseInt(form.numero_dependientes) || 0,
        horas_semanales_contrato: parseInt(form.horas_semanales_contrato) || 42,
        horas_mensuales_contrato: parseInt(form.horas_mensuales_contrato) || 182,
        duracion_jornada_horas: parseFloat(form.duracion_jornada_horas) || 8,
        dias_descanso_semana: parseInt(form.dias_descanso_semana) || 1,
        nivel_riesgo_arl: parseInt(form.nivel_riesgo_arl) || 1,
      }, selectedAreaId);
    } catch (err) {
      setErrors({ api: err.message });
      setLoading(false);
    }
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            {isEdit ? `Editar: ${employee.nombre}` : '👤 Nuevo Colaborador'}
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {/* Stepper compacto */}
        <div style={{ padding: '0 1.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['Identidad', 'Contacto', 'Contrato', 'Salario', 'Seg. Social', 'Banco', 'Estudio', 'Fiscal'].map((title, i) => (
            <div key={i}
              onClick={() => validateStep(step) && setStep(i + 1)}
              style={{
                padding: '0.3rem 0.6rem', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.7rem', fontWeight: 600,
                background: step === i + 1 ? 'var(--cw-accent)' : (step > i + 1 ? 'var(--cw-success)' : 'var(--bg-glass)'),
                color: (step === i + 1 || step > i + 1) ? 'white' : 'var(--text-muted)',
              }}>{step > i + 1 ? '✓' : i + 1} {title}</div>
          ))}
        </div>

        {errors.api && <div className="cw-alert cw-alert--error" style={{ margin: '0 1.25rem 1rem' }}>🚫 {errors.api}</div>}

        {/* ──────────── PASO 1: IDENTIDAD ──────────── */}
        {step === 1 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><MdPerson style={{ verticalAlign: 'middle' }} /> Identidad</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Tipo doc</label>
                <select className="cw-input" value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)}>
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="TI">TI</option>
                  <option value="PA">Pasaporte</option>
                  <option value="PPT">PPT</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Número <span className="required">*</span></label>
                <input className={`cw-input ${errors.cedula ? 'error' : ''}`}
                  value={form.cedula} onChange={e => set('cedula', e.target.value)} disabled={isEdit} />
                {errors.cedula && <span className="cw-input-error">⚠ {errors.cedula}</span>}
              </div>
            </div>
            <div className="cw-form-group">
              <label className="cw-label">Lugar de expedición</label>
              <input className="cw-input" value={form.lugar_expedicion} onChange={e => set('lugar_expedicion', e.target.value)} placeholder="Bogotá D.C." />
            </div>
            <div className="cw-form-group">
              <label className="cw-label">Nombre completo <span className="required">*</span></label>
              <input className={`cw-input ${errors.nombre ? 'error' : ''}`}
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errors.nombre && <span className="cw-input-error">⚠ {errors.nombre}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">F. nacimiento <span className="required">*</span></label>
                <input type="date" className={`cw-input ${errors.fecha_nacimiento ? 'error' : ''}`}
                  value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
                {errors.fecha_nacimiento && <span className="cw-input-error">⚠ {errors.fecha_nacimiento}</span>}
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Género</label>
                <select className="cw-input" value={form.genero} onChange={e => set('genero', e.target.value)}>
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="OTRO">Otro</option>
                  <option value="PREFIERO_NO_DECIR">Prefiero no decir</option>
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Estado civil</label>
                <select className="cw-input" value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}>
                  <option value="">—</option>
                  <option value="SOLTERO">Soltero(a)</option>
                  <option value="CASADO">Casado(a)</option>
                  <option value="UNION_LIBRE">Unión libre</option>
                  <option value="DIVORCIADO">Divorciado(a)</option>
                  <option value="VIUDO">Viudo(a)</option>
                  <option value="SEPARADO">Separado(a)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">N° hijos</label>
                <input type="number" min="0" className="cw-input"
                  value={form.numero_hijos} onChange={e => set('numero_hijos', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '1.4rem' }}>
                  <input type="checkbox" checked={form.tiene_discapacidad}
                    onChange={e => set('tiene_discapacidad', e.target.checked)} />
                  <span>♿ Tiene discapacidad (Ley 1618/13 — estabilidad reforzada)</span>
                </label>
                {form.tiene_discapacidad && (
                  <input className="cw-input" placeholder="Detalle de la discapacidad"
                    value={form.descripcion_discapacidad} onChange={e => set('descripcion_discapacidad', e.target.value)} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────────── PASO 2: CONTACTO ──────────── */}
        {step === 2 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><MdContactPhone style={{ verticalAlign: 'middle' }} /> Contacto y emergencia</h4>
            <div className="cw-form-group">
              <label className="cw-label">Dirección</label>
              <input className="cw-input" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle 100 #15-20" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Ciudad</label>
                <input className="cw-input" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Departamento</label>
                <input className="cw-input" value={form.departamento} onChange={e => set('departamento', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Teléfono</label>
                <input className="cw-input" value={form.telefono_contacto} onChange={e => set('telefono_contacto', e.target.value)} placeholder="+57 300 1234567" />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Email personal</label>
                <input type="email" className="cw-input" value={form.email_personal} onChange={e => set('email_personal', e.target.value)} />
              </div>
            </div>
            <h5 style={{ fontSize: '0.8rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>Contacto de emergencia</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Nombre</label>
                <input className="cw-input" value={form.contacto_emergencia_nombre} onChange={e => set('contacto_emergencia_nombre', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Teléfono</label>
                <input className="cw-input" value={form.contacto_emergencia_telefono} onChange={e => set('contacto_emergencia_telefono', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Parentesco</label>
                <input className="cw-input" value={form.contacto_emergencia_parentesco} onChange={e => set('contacto_emergencia_parentesco', e.target.value)} placeholder="Madre, Esposo(a)..." />
              </div>
            </div>
          </div>
        )}

        {/* ──────────── PASO 3: CONTRATO ──────────── */}
        {step === 3 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><MdWork style={{ verticalAlign: 'middle' }} /> Contrato y jornada</h4>

            {/* Área */}
            <div className="cw-form-group">
              <label className="cw-label">Área de trabajo <span className="required">*</span></label>
              {areas.length === 0 ? (
                <div className="cw-alert cw-alert--warning" style={{ fontSize: '0.8rem' }}>
                  ⚠️ Primero crea al menos un área. <a href="/areas" style={{ color: 'var(--cw-accent)' }}>Ir a Áreas</a>
                </div>
              ) : (
                <>
                  <select className={`cw-input ${errors.area ? 'error' : ''}`}
                    value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        ● {a.nombre} {a.sector && `· ${a.sector}`}
                      </option>
                    ))}
                  </select>
                  {errors.area && <span className="cw-input-error">⚠ {errors.area}</span>}
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Cargo <span className="required">*</span></label>
                <input className={`cw-input ${errors.cargo ? 'error' : ''}`}
                  value={form.cargo} onChange={e => set('cargo', e.target.value)} />
                {errors.cargo && <span className="cw-input-error">⚠ {errors.cargo}</span>}
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Nivel</label>
                <select className="cw-input" value={form.nivel_cargo} onChange={e => set('nivel_cargo', e.target.value)}>
                  <option value="JUNIOR">Junior</option>
                  <option value="SENIOR">Senior</option>
                  <option value="COORDINADOR">Coordinador</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="JEFE">Jefe</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="DIRECTOR">Director</option>
                </select>
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Tipo de contrato <span className="required">*</span></label>
              <select className="cw-input" value={form.tipo_contrato} onChange={e => set('tipo_contrato', e.target.value)}>
                {TIPOS_CONTRATO.map(t => (
                  <option key={t.value} value={t.value}>{t.icono} {t.label}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato)?.desc}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Fecha de ingreso <span className="required">*</span></label>
                <input type="date" className={`cw-input ${errors.fecha_ingreso ? 'error' : ''}`}
                  value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
                {errors.fecha_ingreso && <span className="cw-input-error">⚠ {errors.fecha_ingreso}</span>}
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Fin contrato</label>
                <input type="date" className={`cw-input ${errors.fecha_fin_contrato ? 'error' : ''}`}
                  value={form.fecha_fin_contrato} onChange={e => set('fecha_fin_contrato', e.target.value)} />
                {errors.fecha_fin_contrato && <span className="cw-input-error">⚠ {errors.fecha_fin_contrato}</span>}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Si aplica</div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Período de prueba hasta</label>
                <input type="date" className="cw-input" value={form.periodo_prueba_hasta} onChange={e => set('periodo_prueba_hasta', e.target.value)} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>2 meses máx. CST</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Tipo jornada</label>
                <select className="cw-input" value={form.jornada_tipo} onChange={e => set('jornada_tipo', e.target.value)}>
                  {TIPOS_JORNADA.map(j => <option key={j.value} value={j.value}>{j.label.split(' ')[0]}</option>)}
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Horas/sem</label>
                <input type="number" className="cw-input" value={form.horas_semanales_contrato}
                  onChange={e => set('horas_semanales_contrato', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Horas/mes</label>
                <input type="number" className="cw-input" value={form.horas_mensuales_contrato}
                  onChange={e => set('horas_mensuales_contrato', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Días desc.</label>
                <select className="cw-input" value={form.dias_descanso_semana}
                  onChange={e => set('dias_descanso_semana', parseInt(e.target.value))}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
            </div>

            {/* Turno predeterminado (solo si SALARIO_FIJO) */}
            {form.tipo_contrato === 'SALARIO_FIJO' && templates.length > 0 && (
              <div className="cw-form-group">
                <label className="cw-label">Turno predeterminado (fijo)</label>
                <select className="cw-input" value={form.turno_predeterminado_id} onChange={e => set('turno_predeterminado_id', e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre} ({t.hora_inicio.slice(0,5)}-{t.hora_fin.slice(0,5)})</option>
                  ))}
                </select>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
              <input type="checkbox" checked={form.es_jefe} onChange={e => set('es_jefe', e.target.checked)} />
              <span>👑 Es jefe / tiene subordinados</span>
            </label>
          </div>
        )}

        {/* ──────────── PASO 4: SALARIO ──────────── */}
        {step === 4 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>💰 Salario y beneficios</h4>

            <div style={{
              padding: '0.75rem', background: form.es_especial ? 'rgba(245,158,11,0.08)' : 'var(--bg-glass)',
              border: `1px solid ${form.es_especial ? 'rgba(245,158,11,0.35)' : 'var(--border-subtle)'}`,
              borderRadius: 8, marginBottom: '1rem',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.es_especial} onChange={e => set('es_especial', e.target.checked)} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>⭐ Empleado especial — Salario personalizado (no toma el del área)</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Valor hora (COP) <span className="required">*</span></label>
                <input type="number" className={`cw-input ${errors.valor_hora ? 'error' : ''}`}
                  value={form.valor_hora} onChange={e => set('valor_hora', e.target.value)} />
                {errors.valor_hora && <span className="cw-input-error">⚠ {errors.valor_hora}</span>}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  SMLV/hora 2025: ${SMLV_HORA_2025.toLocaleString('es-CO')}
                </div>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Salario mensual (COP)</label>
                <input type="number" className="cw-input" value={form.salario_mensual}
                  onChange={e => set('salario_mensual', e.target.value)} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  SMLV 2025: ${SMLV_2025.toLocaleString('es-CO')}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Bono rodamiento</label>
                <input type="number" className="cw-input" value={form.bono_rodamiento}
                  onChange={e => set('bono_rodamiento', e.target.value)} placeholder="Minera/petrolera" />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Bonificación fija</label>
                <input type="number" className="cw-input" value={form.bonificacion_fija}
                  onChange={e => set('bonificacion_fija', e.target.value)} placeholder="Alimentación, etc." />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.recibe_auxilio_transporte}
                  onChange={e => set('recibe_auxilio_transporte', e.target.checked)} />
                <span>🚌 Recibe auxilio de transporte (${AUX_TRANSPORTE_2025.toLocaleString('es-CO')})</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.aplica_pago_dominical}
                  onChange={e => set('aplica_pago_dominical', e.target.checked)} />
                <span>⛪ Aplica pago dominical (Art. 179 CST)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.aplica_horas_extras}
                  onChange={e => set('aplica_horas_extras', e.target.checked)} />
                <span>⏰ Aplica pago de horas extras</span>
              </label>
            </div>
          </div>
        )}

        {/* ──────────── PASO 5: SEGURIDAD SOCIAL ──────────── */}
        {step === 5 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><MdAccountBalance style={{ verticalAlign: 'middle' }} /> Seguridad social (PILA)</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">EPS</label>
                <input list="eps-list" className="cw-input" value={form.eps_nombre}
                  onChange={e => set('eps_nombre', e.target.value)} placeholder="Sanitas, Sura, Nueva EPS..." />
                <datalist id="eps-list">{EPS_COMUNES.map(e => <option key={e} value={e} />)}</datalist>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Código EPS</label>
                <input className="cw-input" value={form.eps_codigo} onChange={e => set('eps_codigo', e.target.value)} />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">AFP</label>
                <input list="afp-list" className="cw-input" value={form.afp_nombre}
                  onChange={e => set('afp_nombre', e.target.value)} placeholder="Porvenir, Protección..." />
                <datalist id="afp-list">{AFP_COMUNES.map(e => <option key={e} value={e} />)}</datalist>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Tipo AFP</label>
                <select className="cw-input" value={form.afp_tipo} onChange={e => set('afp_tipo', e.target.value)}>
                  <option value="RAZON">Razón (último salario)</option>
                  <option value="PRIMAPROMEDIO">Prima Promedio (10 años)</option>
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">ARL</label>
                <input list="arl-list" className="cw-input" value={form.arl_nombre}
                  onChange={e => set('arl_nombre', e.target.value)} placeholder="Sura, Positiva, Bolívar..." />
                <datalist id="arl-list">{ARL_COMUNES.map(e => <option key={e} value={e} />)}</datalist>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Nivel riesgo ARL</label>
                <select className="cw-input" value={form.nivel_riesgo_arl} onChange={e => set('nivel_riesgo_arl', parseInt(e.target.value))}>
                  {NIVELES_ARL.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Caja de compensación</label>
                <input list="caja-list" className="cw-input" value={form.caja_compensacion}
                  onChange={e => set('caja_compensacion', e.target.value)} placeholder="Compensar, Comfama..." />
                <datalist id="caja-list">{CAJAS_COMUNES.map(e => <option key={e} value={e} />)}</datalist>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Fondo de cesantías</label>
                <input className="cw-input" value={form.fondo_cesantias} onChange={e => set('fondo_cesantias', e.target.value)} placeholder="Porvenir, Protección..." />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={form.cesantias_afc} onChange={e => set('cesantias_afc', e.target.checked)} />
              <span>💰 Tiene cuenta AFC (Auxilio de ahorro para cesantías — beneficio tributario)</span>
            </label>
          </div>
        )}

        {/* ──────────── PASO 6: BANCARIOS ──────────── */}
        {step === 6 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>🏦 Datos bancarios (para pago de nómina)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Banco</label>
                <input className="cw-input" value={form.banco_nombre} onChange={e => set('banco_nombre', e.target.value)} placeholder="Bancolombia, Davivienda..." />
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Tipo de cuenta</label>
                <select className="cw-input" value={form.tipo_cuenta} onChange={e => set('tipo_cuenta', e.target.value)}>
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">N° de cuenta</label>
                <input className="cw-input" value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)} />
              </div>
            </div>
            <div className="cw-form-group">
              <label className="cw-label">Titular de la cuenta</label>
              <input className="cw-input" value={form.titular_cuenta} onChange={e => set('titular_cuenta', e.target.value)} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Si es diferente al empleado</div>
            </div>
          </div>
        )}

        {/* ──────────── PASO 7: ACADÉMICO ──────────── */}
        {step === 7 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><MdSchool style={{ verticalAlign: 'middle' }} /> Formación y certificaciones</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Nivel educativo</label>
                <select className="cw-input" value={form.nivel_educacion} onChange={e => set('nivel_educacion', e.target.value)}>
                  <option value="">—</option>
                  <option value="PRIMARIA">Primaria</option>
                  <option value="BACHILLERATO">Bachillerato</option>
                  <option value="TECNICO">Técnico</option>
                  <option value="TECNOLOGO">Tecnólogo</option>
                  <option value="PREGRADO">Pregrado</option>
                  <option value="ESPECIALIZACION">Especialización</option>
                  <option value="MAESTRIA">Maestría</option>
                  <option value="DOCTORADO">Doctorado</option>
                </select>
              </div>
              <div className="cw-form-group">
                <label className="cw-label">Título obtenido</label>
                <input className="cw-input" value={form.titulo_obtenido} onChange={e => set('titulo_obtenido', e.target.value)} placeholder="Ingeniero Industrial, Bachiller..." />
              </div>
            </div>

            <div style={{
              padding: '0.75rem', background: form.sena_aprendiz ? 'rgba(59,130,246,0.08)' : 'var(--bg-glass)',
              border: `1px solid ${form.sena_aprendiz ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 8, marginBottom: '0.75rem',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.sena_aprendiz} onChange={e => set('sena_aprendiz', e.target.checked)} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>🎓 Aprendiz SENA (Ley 1882/2018)</span>
              </label>
              {form.sena_aprendiz && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                    <input type="checkbox" checked={form.etapa_productiva} onChange={e => set('etapa_productiva', e.target.checked)} />
                    <span>En etapa productiva (50% SMLV, sin prestaciones)</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <div className="cw-form-group" style={{ marginBottom: 0 }}>
                      <label className="cw-label" style={{ fontSize: '0.72rem' }}>Inicio etapa lectiva</label>
                      <input type="date" className="cw-input" value={form.fecha_etapa_lectiva_inicio} onChange={e => set('fecha_etapa_lectiva_inicio', e.target.value)} />
                    </div>
                    <div className="cw-form-group" style={{ marginBottom: 0 }}>
                      <label className="cw-label" style={{ fontSize: '0.72rem' }}>Fin etapa lectiva</label>
                      <input type="date" className="cw-input" value={form.fecha_etapa_lectiva_fin} onChange={e => set('fecha_etapa_lectiva_fin', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Licencia de conducción</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={form.tiene_licencia_conduccion} onChange={e => set('tiene_licencia_conduccion', e.target.checked)} />
                  <span>Tiene</span>
                </label>
                {form.tiene_licencia_conduccion && (
                  <>
                    <select className="cw-input" style={{ width: 100 }} value={form.categoria_licencia} onChange={e => set('categoria_licencia', e.target.value)}>
                      <option value="">Cat.</option>
                      <option value="A1">A1</option><option value="A2">A2</option>
                      <option value="B1">B1</option><option value="B2">B2</option>
                      <option value="C1">C1</option><option value="C2">C2</option>
                      <option value="C3">C3</option>
                    </select>
                    <input type="date" className="cw-input" style={{ flex: 1 }} value={form.vencimiento_licencia} onChange={e => set('vencimiento_licencia', e.target.value)} />
                  </>
                )}
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">Otras certificaciones / cursos</label>
              <textarea className="cw-input" rows={2} value={form.tiene_certificaciones} onChange={e => set('tiene_certificaciones', e.target.value)} placeholder="Trabajo en alturas, manipulación de alimentos, etc." />
            </div>
          </div>
        )}

        {/* ──────────── PASO 8: DATOS FISCALES ──────────── */}
        {step === 8 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>📊 Datos fiscales (DIAN)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.responsable_iva} onChange={e => set('responsable_iva', e.target.checked)} />
                <span>Responsable de IVA</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.declarante_renta} onChange={e => set('declarante_renta', e.target.checked)} />
                <span>Declarante de renta</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.aplica_retencion_fuente} onChange={e => set('aplica_retencion_fuente', e.target.checked)} />
                <span>Aplica retención en la fuente</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.persona_mayor_dependiente} onChange={e => set('persona_mayor_dependiente', e.target.checked)} />
                <span>Tiene persona mayor dependiente</span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">N° dependientes</label>
                <input type="number" min="0" className="cw-input"
                  value={form.numero_dependientes} onChange={e => set('numero_dependientes', e.target.value)} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Reduce retención en la fuente</div>
              </div>
            </div>

            <div style={{
              marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-glass)',
              borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-secondary)',
            }}>
              <strong>📋 Resumen:</strong> {form.nombre || 'Empleado'} · CC {form.cedula} · {form.cargo || '—'}<br/>
              <strong>Contrato:</strong> {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato)?.label}<br/>
              <strong>Salario:</strong> ${(parseFloat(form.salario_mensual) || 0).toLocaleString('es-CO')} / mes
              · ${(parseFloat(form.valor_hora) || 0).toLocaleString('es-CO')} / hora
            </div>
          </div>
        )}

        <div className="cw-modal__footer">
          {step > 1 && <button type="button" className="cw-btn cw-btn--secondary" onClick={prev}>← Anterior</button>}
          {step < 8 && <button type="button" className="cw-btn cw-btn--primary" onClick={next}>Siguiente →</button>}
          {step === 8 && (
            <button type="button" className="cw-btn cw-btn--primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</>
                : <>{isEdit ? '💾 Actualizar' : '➕ Registrar'} Colaborador</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
