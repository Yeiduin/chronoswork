import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  TIPOS_CONTRATO, TIPOS_JORNADA,
  SMLV_2025, AUX_TRANSPORTE_2025, SMLV_HORA_2025,
} from '../config/laborCatalog';
import {
  BANCOS_COLOMBIA,
  EPS_COLOMBIA,
  AFP_COLOMBIA,
  FONDOS_CESANTIAS_COLOMBIA,
  ARL_COLOMBIA,
  CAJAS_COMPENSACION_COLOMBIA,
  PARENTESCOS_EMERGENCIA,
  DEPARTAMENTOS_Y_CIUDADES,
  onlyDigits,
  onlyLettersAndSpaces,
  onlyTextPunctuation,
} from '../config/colombiaCatalogs';
import {
  MdClose, MdPerson, MdWork, MdAccountBalance, MdSchool, MdContactPhone,
  MdCheck, MdArrowForward, MdArrowBack, MdSave, MdCheckCircle,
} from 'react-icons/md';

const NIVELES_ARL = [
  { value: 1, label: 'Nivel I — Riesgo Mínimo (0.522%)' },
  { value: 2, label: 'Nivel II — Riesgo Bajo (1.044%)' },
  { value: 3, label: 'Nivel III — Riesgo Medio (2.436%)' },
  { value: 4, label: 'Nivel IV — Riesgo Alto (4.350%)' },
  { value: 5, label: 'Nivel V — Riesgo Máximo (6.960%)' },
];

const DIAS_SEMANA = [
  { num: 1, label: 'Lun', nombre: 'Lunes' },
  { num: 2, label: 'Mar', nombre: 'Martes' },
  { num: 3, label: 'Mié', nombre: 'Miércoles' },
  { num: 4, label: 'Jue', nombre: 'Jueves' },
  { num: 5, label: 'Vie', nombre: 'Viernes' },
  { num: 6, label: 'Sáb', nombre: 'Sábado' },
  { num: 7, label: 'Dom', nombre: 'Domingo' },
];

// ─────────────────────────────────────────────────────────────
// Componente selector configurable con opción "Otro (especificar)"
// ─────────────────────────────────────────────────────────────
function SelectWithOther({
  id,
  label,
  required,
  value,
  onChange,
  options, // Array de strings o array de objetos { nombre, codigo? }
  placeholder = '— Seleccionar —',
  otherPlaceholder = 'Escribe el nombre si no está en la lista...',
  onSelectOption,
  error,
  allowDigitsInOther = false,
  badgeText,
  secondaryAction,
}) {
  const optionsList = useMemo(() => {
    return options.map(opt => (typeof opt === 'string' ? opt : opt.nombre));
  }, [options]);

  const isKnown = Boolean(value && optionsList.includes(value));
  const [forceOther, setForceOther] = useState(() => Boolean(value && !optionsList.includes(value)));

  useEffect(() => {
    if (value && !optionsList.includes(value)) {
      setForceOther(true);
    } else if (value && optionsList.includes(value)) {
      setForceOther(false);
    }
  }, [value, optionsList]);

  const selectVal = forceOther ? '__OTRO__' : (isKnown ? value : '');

  const handleSelectChange = (e) => {
    const chosen = e.target.value;
    if (chosen === '__OTRO__') {
      setForceOther(true);
      if (isKnown) onChange('');
    } else {
      setForceOther(false);
      onChange(chosen);
      if (onSelectOption) {
        const fullItem = options.find(opt => (typeof opt === 'string' ? opt : opt.nombre) === chosen);
        if (fullItem) onSelectOption(fullItem);
      }
    }
  };

  const handleTextChange = (e) => {
    const raw = e.target.value;
    const clean = allowDigitsInOther ? onlyTextPunctuation(raw) : onlyLettersAndSpaces(raw);
    onChange(clean);
  };

  return (
    <div className="cw-form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <label className="cw-label" htmlFor={id} style={{ marginBottom: 0 }}>
          {label} {required && <span className="required">*</span>}
        </label>
        {badgeText && (
          <span style={{ fontSize: '0.68rem', color: 'var(--cw-accent)', fontWeight: 600 }}>{badgeText}</span>
        )}
        {secondaryAction}
      </div>

      <select
        id={id}
        className={`cw-input cw-select ${error ? 'error' : ''}`}
        value={selectVal}
        onChange={handleSelectChange}
      >
        <option value="">{placeholder}</option>
        {options.map((opt, idx) => {
          const name = typeof opt === 'string' ? opt : opt.nombre;
          const code = typeof opt === 'object' && opt.codigo ? ` (${opt.codigo})` : '';
          return (
            <option key={idx} value={name}>
              {name}{code}
            </option>
          );
        })}
        <option value="__OTRO__">➕ Otra / No aparece en la lista (escribir)...</option>
      </select>

      {forceOther && (
        <div style={{ marginTop: '0.4rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <input
              type="text"
              className={`cw-input ${error ? 'error' : ''}`}
              value={isKnown ? '' : (value || '')}
              onChange={handleTextChange}
              placeholder={otherPlaceholder}
              autoFocus
            />
            <button
              type="button"
              className="cw-btn cw-btn--secondary"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
              onClick={() => {
                setForceOther(false);
                onChange('');
              }}
              title="Volver a seleccionar de la lista desplegable"
            >
              Ver lista
            </button>
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            ✏️ Ingresa el nombre personalizado (solo texto)
          </span>
        </div>
      )}

      {error && <span className="cw-input-error">⚠ {error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal principal de registro y edición de empleado
// ─────────────────────────────────────────────────────────────
export default function EmployeeFormModal({ employee, areas, onClose, onSave }) {
  const { tenant } = useAuth();
  const isEdit = !!employee;
  const initialAreaId = !isEdit
    ? ''
    : (
        employee?.area_employees?.[0]?.area_id ||
        employee?.area_employees?.[0]?.areas?.id ||
        areas.find(a => a.area_employees?.some(ae => ae.employee_id === employee.id))?.id ||
        ''
      );

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    tipo_documento: employee?.tipo_documento || 'CC',
    cedula: employee?.cedula ? onlyDigits(employee.cedula) : '',
    lugar_expedicion: employee?.lugar_expedicion || '',
    nombre: employee?.nombre || '',
    fecha_nacimiento: employee?.fecha_nacimiento || '',
    genero: employee?.genero || '',
    estado_civil: employee?.estado_civil || '',
    numero_hijos: employee?.numero_hijos ?? 0,
    tiene_discapacidad: employee?.tiene_discapacidad || false,
    descripcion_discapacidad: employee?.descripcion_discapacidad || '',

    direccion: employee?.direccion || '',
    ciudad: employee?.ciudad || '',
    departamento: employee?.departamento || '',
    telefono_contacto: employee?.telefono_contacto ? onlyDigits(employee.telefono_contacto) : '',
    email_personal: employee?.email_personal || '',
    email_institucional: employee?.email_institucional || '',
    contacto_emergencia_nombre: employee?.contacto_emergencia_nombre || '',
    contacto_emergencia_telefono: employee?.contacto_emergencia_telefono ? onlyDigits(employee.contacto_emergencia_telefono) : '',
    contacto_emergencia_parentesco: employee?.contacto_emergencia_parentesco || '',
    embarazada: employee?.embarazada || false,

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
    dias_descanso_semana: employee?.dias_descanso_semana ?? 1,
    turno_predeterminado_id: employee?.turno_predeterminado_id || '',
    jornada_partida: employee?.jornada_partida || false,

    jornada_preferida: employee?.jornada_preferida || 'CUALQUIERA',
    solo_diurno: employee?.solo_diurno || false,
    solo_nocturno: employee?.solo_nocturno || false,
    horas_max_diarias: employee?.horas_max_diarias ?? '',
    horas_nocturnas_max_semana: employee?.horas_nocturnas_max_semana ?? '',
    horas_max_semana: employee?.horas_max_semana ?? '',
    permite_partido: employee?.permite_partido || false,
    max_domingos_mes: employee?.max_domingos_mes ?? '',
    dias_descanso_fijos: Array.isArray(employee?.dias_descanso_fijos)
      ? employee.dias_descanso_fijos.join(',')
      : (employee?.dias_descanso_fijos ? String(employee.dias_descanso_fijos) : ''),

    valor_hora: employee?.valor_hora ?? SMLV_HORA_2025,
    salario_mensual: employee?.salario_mensual ?? SMLV_2025,
    bono_rodamiento: employee?.bono_rodamiento ?? 0,
    bonificacion_fija: employee?.bonificacion_fija ?? 0,
    recibe_auxilio_transporte: employee?.recibe_auxilio_transporte ?? true,
    aplica_pago_dominical: employee?.aplica_pago_dominical ?? true,
    aplica_horas_extras: employee?.aplica_horas_extras ?? true,
    es_especial: employee?.es_especial || false,

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

    banco_nombre: employee?.banco_nombre || '',
    tipo_cuenta: employee?.tipo_cuenta || 'AHORROS',
    numero_cuenta: employee?.numero_cuenta ? onlyDigits(employee.numero_cuenta) : '',
    titular_cuenta: employee?.titular_cuenta || '',

    nivel_educacion: employee?.nivel_educacion || '',
    titulo_obtenido: employee?.titulo_obtenido || '',
    sena_aprendiz: employee?.sena_aprendiz || false,
    etapa_productiva: employee?.etapa_productiva || false,
    fecha_etapa_lectiva_inicio: employee?.fecha_etapa_lectiva_inicio || '',
    fecha_etapa_lectiva_fin: employee?.fecha_etapa_lectiva_fin || '',

    responsable_iva: employee?.responsable_iva || false,
    declarante_renta: employee?.declarante_renta || false,
    aplica_retencion_fuente: employee?.aplica_retencion_fuente ?? true,
    numero_dependientes: employee?.numero_dependientes ?? 0,
    persona_mayor_dependiente: employee?.persona_mayor_dependiente || false,

    tiene_licencia_conduccion: employee?.tiene_licencia_conduccion || false,
    categoria_licencia: employee?.categoria_licencia || '',
    vencimiento_licencia: employee?.vencimiento_licencia || '',
    tiene_certificaciones: employee?.tiene_certificaciones || '',
  }));

  const [selectedAreaId, setSelectedAreaId] = useState(
    !isEdit && areas.length === 1 ? areas[0].id : initialAreaId
  );
  const prevSelectedAreaRef = useRef(selectedAreaId);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);

  // Cargos ya usados en la organización
  const cargosExistentes = useMemo(
    () => Array.from(new Set(
      areas.flatMap(a => (a.area_employees || [])
        .map(ae => ae.employees?.cargo)
        .filter(Boolean))
    )).sort((a, b) => a.localeCompare(b, 'es')),
    [areas]
  );

  // Ciudades dinámicas según el departamento seleccionado
  const deptActual = useMemo(() => {
    return DEPARTAMENTOS_Y_CIUDADES.find(d => d.departamento === form.departamento);
  }, [form.departamento]);

  const ciudadesDelDepartamento = useMemo(() => {
    return deptActual?.ciudades || [];
  }, [deptActual]);

  useEffect(() => {
    if (!selectedAreaId) { setTemplates([]); return; }
    let cancelled = false;
    let query = supabase.from('shift_templates')
      .select('*')
      .eq('area_id', selectedAreaId)
      .eq('activo', true)
      .order('hora_inicio');
    if (tenant?.id) {
      query = query.eq('tenant_id', tenant.id);
    }
    query.then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setTemplates([]); return; }
      setTemplates(data || []);
    });
    return () => { cancelled = true; };
  }, [selectedAreaId, tenant?.id]);

  useEffect(() => {
    if (!selectedAreaId) return;
    const areaChanged = prevSelectedAreaRef.current !== selectedAreaId;
    prevSelectedAreaRef.current = selectedAreaId;

    if (!areaChanged) return;

    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;
    if (form.es_especial) return;

    setForm(prev => {
      const updates = {};
      const horasMes = parseInt(prev.horas_mensuales_contrato, 10) || Math.round((parseInt(prev.horas_semanales_contrato, 10) || 42) * 4.333) || 182;
      if (area.valor_hora_default) {
        updates.valor_hora = area.valor_hora_default;
        updates.salario_mensual = Math.round(area.valor_hora_default * horasMes);
      }
      if (area.tipo_contrato_predominante) updates.tipo_contrato = area.tipo_contrato_predominante;
      if (area.dias_descanso_default) updates.dias_descanso_semana = area.dias_descanso_default;
      if (area.jornada_tipo) updates.jornada_tipo = area.jornada_tipo;
      if (area.nivel_riesgo_arl) updates.nivel_riesgo_arl = area.nivel_riesgo_arl;
      if (area.paga_auxilio_transporte !== undefined) {
        updates.recibe_auxilio_transporte = area.paga_auxilio_transporte;
      }
      return { ...prev, ...updates };
    });
  }, [selectedAreaId, form.es_especial, areas, isEdit, initialAreaId]);

  useEffect(() => {
    if (isEdit) return;
    if (form.sena_aprendiz && form.etapa_productiva && !form.es_especial) {
      setForm(prev => ({ ...prev, salario_mensual: Math.round(SMLV_2025 * 0.5) }));
    }
  }, [form.sena_aprendiz, form.etapa_productiva, form.es_especial, isEdit]);

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const horasMesDe = (f) => parseInt(f.horas_mensuales_contrato, 10)
    || Math.round((parseInt(f.horas_semanales_contrato, 10) || 42) * 4.333)
    || 182;

  const setValorHora = (val) => {
    const cleanDigits = onlyDigits(val);
    setForm(prev => {
      const vh = parseFloat(cleanDigits);
      return {
        ...prev,
        valor_hora: cleanDigits,
        salario_mensual: Number.isNaN(vh) ? prev.salario_mensual : Math.round(vh * horasMesDe(prev)),
      };
    });
    setErrors(prev => ({ ...prev, valor_hora: '' }));
  };

  const setHorasContrato = (key, val) => {
    const cleanDigits = onlyDigits(val);
    setForm(prev => {
      const next = { ...prev, [key]: cleanDigits };
      const vh = parseFloat(prev.valor_hora);
      if (!Number.isNaN(vh) && vh > 0) next.salario_mensual = Math.round(vh * horasMesDe(next));
      return next;
    });
  };

  const setPreferenciaJornada = (campo, checked) => {
    setForm(prev => {
      const solo_diurno = campo === 'solo_diurno' ? checked : (campo === 'solo_nocturno' && checked ? false : prev.solo_diurno);
      const solo_nocturno = campo === 'solo_nocturno' ? checked : (campo === 'solo_diurno' && checked ? false : prev.solo_nocturno);
      const jornada_preferida = solo_diurno ? 'DIURNA' : solo_nocturno ? 'NOCTURNA' : 'CUALQUIERA';
      return { ...prev, solo_diurno, solo_nocturno, jornada_preferida };
    });
  };

  // Días de descanso fijos parseados
  const diasDescansoSeleccionados = useMemo(() => {
    if (!form.dias_descanso_fijos) return [];
    return String(form.dias_descanso_fijos)
      .split(',')
      .map(p => parseInt(p.trim(), 10))
      .filter(n => !Number.isNaN(n) && n >= 1 && n <= 7);
  }, [form.dias_descanso_fijos]);

  const toggleDiaDescanso = (num) => {
    let next;
    if (diasDescansoSeleccionados.includes(num)) {
      next = diasDescansoSeleccionados.filter(d => d !== num);
    } else {
      next = [...diasDescansoSeleccionados, num].sort((a, b) => a - b);
    }
    set('dias_descanso_fijos', next.join(','));
  };

  const setDiasPreset = (arr) => {
    set('dias_descanso_fijos', arr.join(','));
  };

  const buildStepErrors = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.cedula?.trim()) {
        e.cedula = 'El número de identificación es obligatorio.';
      } else if (form.cedula.length < 5) {
        e.cedula = 'Debe tener al menos 5 dígitos.';
      }
      if (!form.nombre?.trim()) {
        e.nombre = 'El nombre completo es obligatorio.';
      } else if (form.nombre.trim().split(/\s+/).length < 2) {
        e.nombre = 'Ingresa nombre y apellido.';
      }
      if (!form.fecha_nacimiento) {
        e.fecha_nacimiento = 'Fecha de nacimiento obligatoria.';
      } else if (new Date(form.fecha_nacimiento) > new Date()) {
        e.fecha_nacimiento = 'La fecha de nacimiento no puede ser en el futuro.';
      }
    }
    if (s === 2) {
      if (!form.cargo?.trim()) e.cargo = 'El cargo es obligatorio.';
      if (!selectedAreaId) e.area = 'Selecciona un área.';
      if (!form.fecha_ingreso) {
        e.fecha_ingreso = 'La fecha de ingreso es obligatoria.';
      }
      if (form.fecha_ingreso && form.fecha_fin_contrato) {
        if (form.fecha_fin_contrato < form.fecha_ingreso) {
          e.fecha_fin_contrato = 'La fecha de terminación debe ser posterior o igual a la de ingreso.';
        }
      }
      if (form.fecha_ingreso && form.periodo_prueba_hasta) {
        if (form.periodo_prueba_hasta < form.fecha_ingreso) {
          e.periodo_prueba_hasta = 'El período de prueba debe ser posterior o igual al ingreso.';
        }
      }
      if ((form.tipo_contrato === 'TERMINO_FIJO' || form.tipo_contrato === 'OBRA_LABOR') && !form.fecha_fin_contrato) {
        e.fecha_fin_contrato = 'Este tipo de contrato requiere fecha de terminación.';
      }
    }
    if (s === 3) {
      const vh = parseFloat(form.valor_hora);
      if (!vh || vh <= 0) {
        e.valor_hora = 'El valor por hora es obligatorio.';
      } else if (vh < SMLV_HORA_2025) {
        e.valor_hora = `El valor mínimo por hora es $${SMLV_HORA_2025.toLocaleString('es-CO')} (SMLV 2025).`;
      }
    }
    if (s === 4) {
      if (form.sena_aprendiz && form.fecha_etapa_lectiva_inicio && form.fecha_etapa_lectiva_fin) {
        if (form.fecha_etapa_lectiva_fin < form.fecha_etapa_lectiva_inicio) {
          e.fecha_etapa_lectiva_fin = 'El fin de etapa lectiva debe ser posterior o igual al inicio.';
        }
      }
    }
    return e;
  };

  const validateStep = (s) => {
    const e = buildStepErrors(s);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep(s => Math.min(4, s + 1)); };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    for (let s = 1; s <= 4; s++) {
      const e = buildStepErrors(s);
      if (Object.keys(e).length > 0) {
        setStep(s);
        setErrors(e);
        return;
      }
    }
    setLoading(true);
    try {
      const optNum = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = parseFloat(v);
        return Number.isNaN(n) ? null : n;
      };

      await onSave({
        ...form,
        nombre: form.nombre.trim(),
        cedula: String(form.cedula).trim(),
        cargo: form.cargo.trim(),
        valor_hora: parseFloat(form.valor_hora) || 0,
        salario_mensual: parseFloat(form.salario_mensual) || 0,
        bono_rodamiento: parseFloat(form.bono_rodamiento) || 0,
        bonificacion_fija: parseFloat(form.bonificacion_fija) || 0,
        numero_hijos: parseInt(form.numero_hijos, 10) || 0,
        numero_dependientes: parseInt(form.numero_dependientes, 10) || 0,
        horas_semanales_contrato: parseInt(form.horas_semanales_contrato, 10) || 42,
        horas_mensuales_contrato: parseInt(form.horas_mensuales_contrato, 10) || 182,
        dias_descanso_semana: parseInt(form.dias_descanso_semana, 10) || 1,
        nivel_riesgo_arl: parseInt(form.nivel_riesgo_arl, 10) || 1,
        horas_max_diarias: optNum(form.horas_max_diarias),
        horas_max_semana: optNum(form.horas_max_semana),
        horas_nocturnas_max_semana: optNum(form.horas_nocturnas_max_semana),
        max_domingos_mes: form.max_domingos_mes !== ''
          ? (Number.isNaN(parseInt(form.max_domingos_mes, 10)) ? null : parseInt(form.max_domingos_mes, 10))
          : null,
        dias_descanso_fijos: form.dias_descanso_fijos
          ? String(form.dias_descanso_fijos).split(',').map(d => parseInt(d.trim(), 10)).filter(d => !Number.isNaN(d) && d >= 1 && d <= 7)
          : null,
      }, selectedAreaId);
    } catch (err) {
      setErrors({ api: err.message });
      setLoading(false);
    }
  };

  const salarioCalculado = Math.round((parseFloat(form.valor_hora) || 0) * horasMesDe(form));

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 760, maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Cabecera del modal */}
        <div className="cw-modal__header" style={{ paddingBottom: '0.75rem' }}>
          <div>
            <h3 className="cw-modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isEdit ? `Editar colaborador: ${employee.nombre}` : '👤 Registrar nuevo colaborador'}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Diligenciamiento optimizado para Colombia (CST, Ley 2101/21 y PILA)
            </span>
          </div>
          <button className="cw-modal__close" onClick={onClose} aria-label="Cerrar modal"><MdClose /></button>
        </div>

        {/* Barra de progreso de pasos */}
        <div style={{
          padding: '0.5rem 1.25rem 0.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
          marginBottom: '0.5rem',
        }}>
          {[
            { n: 1, title: 'Datos Personales', icon: <MdPerson /> },
            { n: 2, title: 'Contrato y Turno', icon: <MdWork /> },
            { n: 3, title: 'Salario y Afiliaciones', icon: <MdAccountBalance /> },
            { n: 4, title: 'Educación y Fiscal', icon: <MdSchool /> },
          ].map(s => {
            const isDone = step > s.n;
            const isCurrent = step === s.n;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.6rem',
                  borderRadius: 8,
                  border: isCurrent ? '1px solid var(--cw-accent)' : '1px solid transparent',
                  background: isCurrent ? 'rgba(79, 70, 229, 0.12)' : (isDone ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-glass, rgba(0,0,0,0.02))'),
                  color: isCurrent ? 'var(--cw-accent)' : (isDone ? '#059669' : 'var(--text-muted)'),
                  fontWeight: isCurrent ? 700 : 500,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--cw-accent)' : (isDone ? '#10b981' : 'rgba(150,150,150,0.2)'),
                  color: (isCurrent || isDone) ? '#fff' : 'inherit',
                  fontSize: '0.65rem',
                  flexShrink: 0,
                }}>
                  {isDone ? <MdCheck /> : s.n}
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {errors.api && (
          <div className="cw-alert cw-alert--error" style={{ margin: '0.5rem 1.25rem 0.75rem' }}>
            🚫 {errors.api}
          </div>
        )}

        {/* ──────────── PASO 1: DATOS PERSONALES ──────────── */}
        {step === 1 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <MdPerson style={{ color: 'var(--cw-accent)', fontSize: '1.2rem' }} />
              <h4 style={{ fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>Identidad y contacto</h4>
            </div>

            {/* Documento y número */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Tipo doc <span className="required">*</span></label>
                <select className="cw-input cw-select" value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)}>
                  <option value="CC">CC — Cédula</option>
                  <option value="CE">CE — Cédula Ext.</option>
                  <option value="TI">TI — Tarjeta Id.</option>
                  <option value="PPT">PPT — Permiso Prot.</option>
                  <option value="PA">Pasaporte</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Número de documento <span className="required">*</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}> (solo números)</span>
                </label>
                <input
                  className={`cw-input ${errors.cedula ? 'error' : ''}`}
                  inputMode="numeric"
                  placeholder="Ej: 1020304050"
                  autoFocus
                  value={form.cedula}
                  onChange={e => set('cedula', onlyDigits(e.target.value))}
                  disabled={isEdit}
                />
                {errors.cedula && <span className="cw-input-error">⚠ {errors.cedula}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Lugar de expedición
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}> (solo texto)</span>
                </label>
                <input
                  list="ciudades-expedicion"
                  className="cw-input"
                  placeholder="Ej: Bogotá D.C., Medellín..."
                  value={form.lugar_expedicion}
                  onChange={e => set('lugar_expedicion', onlyLettersAndSpaces(e.target.value))}
                />
                <datalist id="ciudades-expedicion">
                  <option value="Bogotá D.C." />
                  <option value="Medellín" />
                  <option value="Cali" />
                  <option value="Barranquilla" />
                  <option value="Bucaramanga" />
                  <option value="Cartagena" />
                  <option value="Pereira" />
                  <option value="Manizales" />
                  <option value="Ibagué" />
                  <option value="Cúcuta" />
                  <option value="Santa Marta" />
                </datalist>
              </div>
            </div>

            {/* Nombre completo */}
            <div className="cw-form-group">
              <label className="cw-label">
                Nombre completo <span className="required">*</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}> (solo letras y espacios)</span>
              </label>
              <input
                className={`cw-input ${errors.nombre ? 'error' : ''}`}
                placeholder="Nombres y apellidos completos..."
                value={form.nombre}
                onChange={e => set('nombre', onlyLettersAndSpaces(e.target.value))}
              />
              {errors.nombre && <span className="cw-input-error">⚠ {errors.nombre}</span>}
            </div>

            {/* Fecha nacimiento, Género, Estado civil */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">F. nacimiento <span className="required">*</span></label>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  className={`cw-input ${errors.fecha_nacimiento ? 'error' : ''}`}
                  value={form.fecha_nacimiento}
                  onChange={e => set('fecha_nacimiento', e.target.value)}
                />
                {errors.fecha_nacimiento && <span className="cw-input-error">⚠ {errors.fecha_nacimiento}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label">Género</label>
                <select className="cw-input cw-select" value={form.genero} onChange={e => set('genero', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="OTRO">Otro</option>
                  <option value="PREFIERO_NO_DECIR">Prefiero no decir</option>
                </select>
              </div>

              <div className="cw-form-group">
                <label className="cw-label">Estado civil</label>
                <select className="cw-input cw-select" value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  <option value="SOLTERO">Soltero(a)</option>
                  <option value="CASADO">Casado(a)</option>
                  <option value="UNION_LIBRE">Unión libre</option>
                  <option value="DIVORCIADO">Divorciado(a)</option>
                  <option value="VIUDO">Viudo(a)</option>
                  <option value="SEPARADO">Separado(a)</option>
                </select>
              </div>
            </div>

            {/* Hijos y discapacidad */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">N° hijos</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.numero_hijos}
                  onChange={e => set('numero_hijos', onlyDigits(e.target.value))}
                />
              </div>

              <div className="cw-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '1.4rem' }}>
                  <input
                    type="checkbox"
                    checked={form.tiene_discapacidad}
                    onChange={e => set('tiene_discapacidad', e.target.checked)}
                  />
                  <span>♿ Tiene discapacidad (Ley 1618/13 — estabilidad reforzada)</span>
                </label>
                {form.tiene_discapacidad && (
                  <input
                    className="cw-input"
                    placeholder="Detalle de la discapacidad..."
                    style={{ marginTop: '0.35rem' }}
                    value={form.descripcion_discapacidad}
                    onChange={e => set('descripcion_discapacidad', onlyLettersAndSpaces(e.target.value))}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '1rem 0 0.5rem' }}>
              <MdContactPhone style={{ color: 'var(--cw-accent)', fontSize: '1.1rem' }} />
              <h4 style={{ fontSize: '0.88rem', margin: 0, fontWeight: 700 }}>Ubicación y comunicación</h4>
            </div>

            {/* Dirección */}
            <div className="cw-form-group">
              <label className="cw-label">Dirección residencial</label>
              <input
                className="cw-input"
                value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
                placeholder="Calle 100 #15-20, Apto 301"
              />
            </div>

            {/* Departamento y Ciudad (Selects optimizados) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <SelectWithOther
                id="select-departamento"
                label="Departamento"
                value={form.departamento}
                options={DEPARTAMENTOS_Y_CIUDADES.map(d => d.departamento)}
                placeholder="— Seleccionar Departamento —"
                onChange={val => {
                  set('departamento', val);
                  // Si cambia departamento y la ciudad actual no pertenece, sugerir capital
                  const found = DEPARTAMENTOS_Y_CIUDADES.find(d => d.departamento === val);
                  if (found && found.ciudades.length > 0) {
                    set('ciudad', found.ciudades[0]);
                  }
                }}
              />

              {ciudadesDelDepartamento.length > 0 ? (
                <SelectWithOther
                  id="select-ciudad"
                  label="Ciudad / Municipio"
                  value={form.ciudad}
                  options={ciudadesDelDepartamento}
                  placeholder="— Seleccionar Ciudad —"
                  onChange={val => set('ciudad', val)}
                />
              ) : (
                <div className="cw-form-group">
                  <label className="cw-label">
                    Ciudad / Municipio
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}> (solo texto)</span>
                  </label>
                  <input
                    className="cw-input"
                    value={form.ciudad}
                    onChange={e => set('ciudad', onlyLettersAndSpaces(e.target.value))}
                    placeholder="Escribe la ciudad..."
                  />
                </div>
              )}
            </div>

            {/* Teléfono y Email personal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">
                  Teléfono de contacto <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>(solo números)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="cw-input"
                  maxLength={10}
                  value={form.telefono_contacto}
                  onChange={e => set('telefono_contacto', onlyDigits(e.target.value))}
                  placeholder="3001234567"
                />
              </div>

              <div className="cw-form-group">
                <label className="cw-label">Email personal</label>
                <input
                  type="email"
                  className="cw-input"
                  value={form.email_personal}
                  onChange={e => set('email_personal', e.target.value.trim())}
                  placeholder="nombre@ejemplo.com"
                />
              </div>
            </div>

            {form.email_institucional && (
              <div className="cw-form-group">
                <label className="cw-label">Email institucional</label>
                <input
                  className="cw-input"
                  value={form.email_institucional}
                  disabled
                  readOnly
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Asignado automáticamente por el sistema</div>
              </div>
            )}

            {/* Contacto de emergencia */}
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: 8,
              background: 'var(--bg-glass, rgba(0,0,0,0.02))',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
            }}>
              <h5 style={{ fontSize: '0.8rem', margin: '0 0 0.5rem', color: 'var(--text-secondary)' }}>
                🚨 Contacto en caso de emergencia
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.2fr', gap: '0.5rem' }}>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.74rem' }}>
                    Nombre <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(solo texto)</span>
                  </label>
                  <input
                    className="cw-input"
                    value={form.contacto_emergencia_nombre}
                    onChange={e => set('contacto_emergencia_nombre', onlyLettersAndSpaces(e.target.value))}
                    placeholder="Nombre del familiar..."
                  />
                </div>

                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.74rem' }}>
                    Teléfono <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(solo números)</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    className="cw-input"
                    maxLength={10}
                    value={form.contacto_emergencia_telefono}
                    onChange={e => set('contacto_emergencia_telefono', onlyDigits(e.target.value))}
                    placeholder="3101234567"
                  />
                </div>

                <div style={{ marginBottom: 0 }}>
                  <SelectWithOther
                    id="select-parentesco"
                    label="Parentesco"
                    value={form.contacto_emergencia_parentesco}
                    options={PARENTESCOS_EMERGENCIA}
                    placeholder="— Parentesco —"
                    onChange={val => set('contacto_emergencia_parentesco', val)}
                  />
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.85rem' }}>
              <input
                type="checkbox"
                checked={form.embarazada}
                onChange={e => set('embarazada', e.target.checked)}
              />
              <span>🤰 Está en período de embarazo / lactancia (CST: no nocturno, máx 8h/día)</span>
            </label>
          </div>
        )}

        {/* ──────────── PASO 2: CONTRATO Y JORNADA ──────────── */}
        {step === 2 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <MdWork style={{ color: 'var(--cw-accent)', fontSize: '1.2rem' }} />
              <h4 style={{ fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>Contrato, cargo y asignación</h4>
            </div>

            {/* Área */}
            <div className="cw-form-group">
              <label className="cw-label">Área operativa / Departamento <span className="required">*</span></label>
              {areas.length === 0 ? (
                <div className="cw-alert cw-alert--warning" style={{ fontSize: '0.8rem' }}>
                  ⚠️ Primero crea al menos un área. <a href="/areas" style={{ color: 'var(--cw-accent)' }}>Ir a Áreas</a>
                </div>
              ) : (
                <>
                  <select
                    className={`cw-input cw-select ${errors.area ? 'error' : ''}`}
                    value={selectedAreaId}
                    onChange={e => setSelectedAreaId(e.target.value)}
                  >
                    <option value="">— Seleccionar área de trabajo —</option>
                    {isEdit && initialAreaId && !areas.some(a => a.id === initialAreaId) && (
                      <option value={initialAreaId}>⚠️ Área actual archivada</option>
                    )}
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        ● {a.nombre} {a.sector && `· [${a.sector}]`}
                      </option>
                    ))}
                  </select>
                  {errors.area && <span className="cw-input-error">⚠ {errors.area}</span>}
                </>
              )}
            </div>

            {/* Cargo y Nivel */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">
                  Cargo / Rol <span className="required">*</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo texto)</span>
                </label>
                <input
                  list="cargos-list"
                  className={`cw-input ${errors.cargo ? 'error' : ''}`}
                  value={form.cargo}
                  onChange={e => set('cargo', onlyLettersAndSpaces(e.target.value))}
                  placeholder="Escribe o elige un cargo..."
                />
                <datalist id="cargos-list">
                  {cargosExistentes.map(c => <option key={c} value={c} />)}
                </datalist>
                {errors.cargo && <span className="cw-input-error">⚠ {errors.cargo}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label">Nivel jerárquico</label>
                <select className="cw-input cw-select" value={form.nivel_cargo} onChange={e => set('nivel_cargo', e.target.value)}>
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

            {/* Tipo de contrato */}
            <div className="cw-form-group">
              <label className="cw-label">Tipo de contrato laboral <span className="required">*</span></label>
              <select className="cw-input cw-select" value={form.tipo_contrato} onChange={e => set('tipo_contrato', e.target.value)}>
                {TIPOS_CONTRATO.map(t => (
                  <option key={t.value} value={t.value}>{t.icono} {t.label}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato)?.desc}
              </div>
            </div>

            {/* Fechas de contrato */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Fecha de ingreso <span className="required">*</span></label>
                <input
                  type="date"
                  className={`cw-input ${errors.fecha_ingreso ? 'error' : ''}`}
                  value={form.fecha_ingreso}
                  onChange={e => set('fecha_ingreso', e.target.value)}
                />
                {errors.fecha_ingreso && <span className="cw-input-error">⚠ {errors.fecha_ingreso}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Fecha fin de contrato
                  {(form.tipo_contrato === 'TERMINO_FIJO' || form.tipo_contrato === 'OBRA_LABOR') && (
                    <span className="required"> *</span>
                  )}
                </label>
                <input
                  type="date"
                  className={`cw-input ${errors.fecha_fin_contrato ? 'error' : ''}`}
                  value={form.fecha_fin_contrato}
                  onChange={e => set('fecha_fin_contrato', e.target.value)}
                />
                {errors.fecha_fin_contrato && <span className="cw-input-error">⚠ {errors.fecha_fin_contrato}</span>}
              </div>

              <div className="cw-form-group">
                <label className="cw-label">Período de prueba hasta</label>
                <input
                  type="date"
                  className={`cw-input ${errors.periodo_prueba_hasta ? 'error' : ''}`}
                  value={form.periodo_prueba_hasta}
                  onChange={e => set('periodo_prueba_hasta', e.target.value)}
                />
                {errors.periodo_prueba_hasta && <span className="cw-input-error">⚠ {errors.periodo_prueba_hasta}</span>}
              </div>
            </div>

            {/* Jornada y Horas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Tipo jornada</label>
                <select className="cw-input cw-select" value={form.jornada_tipo} onChange={e => set('jornada_tipo', e.target.value)}>
                  {TIPOS_JORNADA.map(j => <option key={j.value} value={j.value}>{j.label.split(' ')[0]}</option>)}
                </select>
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Horas/sem <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.horas_semanales_contrato}
                  onChange={e => setHorasContrato('horas_semanales_contrato', e.target.value)}
                />
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Horas/mes <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.horas_mensuales_contrato}
                  onChange={e => setHorasContrato('horas_mensuales_contrato', e.target.value)}
                />
              </div>

              <div className="cw-form-group">
                <label className="cw-label">Días descanso</label>
                <select
                  className="cw-input cw-select"
                  value={form.dias_descanso_semana}
                  onChange={e => set('dias_descanso_semana', parseInt(e.target.value, 10))}
                >
                  <option value={1}>1 día / sem</option>
                  <option value={2}>2 días / sem</option>
                </select>
              </div>
            </div>

            {form.tipo_contrato === 'SALARIO_FIJO' && templates.length > 0 && (
              <div className="cw-form-group">
                <label className="cw-label">Turno predeterminado fijo</label>
                <select className="cw-input cw-select" value={form.turno_predeterminado_id} onChange={e => set('turno_predeterminado_id', e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre} ({t.hora_inicio.slice(0,5)} - {t.hora_fin.slice(0,5)})</option>
                  ))}
                </select>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={form.es_jefe} onChange={e => set('es_jefe', e.target.checked)} />
              <span>👑 Es líder / jefe de equipo (tiene personal a cargo)</span>
            </label>

            {/* Preferencias de Turnos y Días Fijos */}
            <div style={{
              marginTop: '1rem',
              padding: '0.85rem',
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 10,
            }}>
              <h5 style={{ fontSize: '0.82rem', color: '#4f46e5', margin: '0 0 0.5rem', fontWeight: 700 }}>
                🌙 Parámetros de programación automática y turnos rotativos
              </h5>

              <div className="cw-form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="cw-label">Jornada preferida para asignación</label>
                <select
                  className="cw-input cw-select"
                  value={form.jornada_preferida}
                  onChange={e => {
                    const val = e.target.value;
                    set('jornada_preferida', val);
                    if (val === 'DIURNA')   { set('solo_diurno', true);   set('solo_nocturno', false); }
                    if (val === 'NOCTURNA') { set('solo_nocturno', true); set('solo_diurno', false); }
                    if (val === 'MIXTA' || val === 'CUALQUIERA') {
                      set('solo_diurno', false); set('solo_nocturno', false);
                    }
                  }}
                >
                  <option value="CUALQUIERA">🔄 Flexible / Cualquier jornada</option>
                  <option value="DIURNA">☀️ Diurna exclusiva (04:00 - 22:00)</option>
                  <option value="NOCTURNA">🌙 Nocturna dedicada (22:00 - 06:00)</option>
                  <option value="MIXTA">🌓 Mixta</option>
                </select>
              </div>

              {/* Botones de selección rápida de días fijos de descanso */}
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="cw-label" style={{ fontSize: '0.74rem', marginBottom: 0 }}>
                    Días de descanso fijos semanales:
                  </label>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      type="button"
                      className="cw-btn cw-btn--secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                      onClick={() => setDiasPreset([6, 7])}
                    >
                      Sáb + Dom
                    </button>
                    <button
                      type="button"
                      className="cw-btn cw-btn--secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                      onClick={() => setDiasPreset([7])}
                    >
                      Solo Dom
                    </button>
                    <button
                      type="button"
                      className="cw-btn cw-btn--secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                      onClick={() => setDiasPreset([])}
                    >
                      Rotativo
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {DIAS_SEMANA.map(d => {
                    const isSelected = diasDescansoSeleccionados.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => toggleDiaDescanso(d.num)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid var(--cw-accent)' : '1px solid var(--border-medium)',
                          background: isSelected ? 'var(--cw-accent)' : 'var(--bg-input)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <MdCheck style={{ verticalAlign: 'middle', marginRight: 2 }} />}
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  {diasDescansoSeleccionados.length > 0
                    ? `Descansa fijos: ${diasDescansoSeleccionados.map(n => DIAS_SEMANA.find(d => d.num === n)?.nombre).join(', ')}`
                    : 'Sin días fijos (descansos variables según cuadrante)'}
                </div>
              </div>

              {/* Restricciones numéricas adicionales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.7rem' }}>Máx h/día</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="cw-input"
                    placeholder="8 o 10"
                    value={form.horas_max_diarias}
                    onChange={e => set('horas_max_diarias', onlyDigits(e.target.value))}
                  />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.7rem' }}>Máx h/sem</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="cw-input"
                    placeholder="42 (Legal)"
                    value={form.horas_max_semana}
                    onChange={e => set('horas_max_semana', onlyDigits(e.target.value))}
                  />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.7rem' }}>Máx h noche/sem</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="cw-input"
                    placeholder="Sin tope"
                    value={form.horas_nocturnas_max_semana}
                    onChange={e => set('horas_nocturnas_max_semana', onlyDigits(e.target.value))}
                  />
                </div>
                <div className="cw-form-group" style={{ marginBottom: 0 }}>
                  <label className="cw-label" style={{ fontSize: '0.7rem' }}>Máx domingos/mes</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="cw-input"
                    placeholder="2 (CST)"
                    value={form.max_domingos_mes}
                    onChange={e => set('max_domingos_mes', onlyDigits(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────── PASO 3: SALARIO Y SEGURIDAD SOCIAL ──────────── */}
        {step === 3 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <MdAccountBalance style={{ color: 'var(--cw-accent)', fontSize: '1.2rem' }} />
              <h4 style={{ fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>Salario, beneficios y seguridad social</h4>
            </div>

            {/* Check salario personalizado */}
            <div style={{
              padding: '0.65rem 0.85rem',
              background: form.es_especial ? 'rgba(245,158,11,0.08)' : 'var(--bg-glass, rgba(0,0,0,0.02))',
              border: `1px solid ${form.es_especial ? 'rgba(245,158,11,0.35)' : 'var(--border-subtle, rgba(0,0,0,0.08))'}`,
              borderRadius: 8,
              marginBottom: '0.85rem',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.es_especial} onChange={e => set('es_especial', e.target.checked)} />
                <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>⭐ Salario personalizado (no se sobrescribe al editar el área)</span>
              </label>
            </div>

            {/* Valor hora y Salario mensual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">
                  Valor hora ordinaria (COP) <span className="required">*</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`cw-input ${errors.valor_hora ? 'error' : ''}`}
                  value={form.valor_hora}
                  onChange={e => setValorHora(e.target.value)}
                />
                {errors.valor_hora && <span className="cw-input-error">⚠ {errors.valor_hora}</span>}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Mínimo legal 2025: ${SMLV_HORA_2025.toLocaleString('es-CO')} COP/hora
                </div>
                {parseFloat(form.valor_hora) > 0 && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--cw-accent)', fontWeight: 600, marginTop: '0.2rem' }}>
                    ≈ ${salarioCalculado.toLocaleString('es-CO')} COP / mes ({horasMesDe(form)}h)
                  </div>
                )}
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Salario mensual pactado (COP)
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.salario_mensual}
                  onChange={e => set('salario_mensual', onlyDigits(e.target.value))}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  SMLV 2025: ${SMLV_2025.toLocaleString('es-CO')} COP
                </div>
              </div>
            </div>

            {/* Bonos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">
                  Bono de rodamiento (COP)
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.bono_rodamiento}
                  onChange={e => set('bono_rodamiento', onlyDigits(e.target.value))}
                  placeholder="0"
                />
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Bonificación fija (COP)
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.bonificacion_fija}
                  onChange={e => set('bonificacion_fija', onlyDigits(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Checkboxes de beneficios */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', margin: '0.5rem 0 1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.recibe_auxilio_transporte}
                  onChange={e => set('recibe_auxilio_transporte', e.target.checked)}
                />
                <span>🚌 Auxilio de transporte (${AUX_TRANSPORTE_2025.toLocaleString('es-CO')})</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.aplica_pago_dominical}
                  onChange={e => set('aplica_pago_dominical', e.target.checked)}
                />
                <span>⛪ Recargo dominical / festivo (Art. 179 CST)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.aplica_horas_extras}
                  onChange={e => set('aplica_horas_extras', e.target.checked)}
                />
                <span>⏰ Liquidación de horas extras</span>
              </label>
            </div>

            {/* Afiliaciones PILA (EPS, AFP, ARL, Caja, Cesantías) con SELECT COMPLETO + OTRO */}
            <h5 style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: '1rem 0 0.5rem', fontWeight: 700 }}>
              🛡️ Seguridad Social Integral (Afiliaciones PILA Colombia)
            </h5>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.5rem' }}>
              {/* EPS */}
              <SelectWithOther
                id="select-eps"
                label="EPS (Entidad Promotora de Salud)"
                value={form.eps_nombre}
                options={EPS_COLOMBIA}
                placeholder="— Seleccionar EPS —"
                otherPlaceholder="Escribe el nombre de la EPS..."
                onChange={val => set('eps_nombre', val)}
                onSelectOption={item => {
                  if (item?.codigo) set('eps_codigo', item.codigo);
                }}
              />

              <div className="cw-form-group">
                <label className="cw-label">Código EPS PILA</label>
                <input
                  className="cw-input"
                  value={form.eps_codigo}
                  onChange={e => set('eps_codigo', e.target.value.toUpperCase().trim())}
                  placeholder="Ej: EPS037"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.5rem' }}>
              {/* AFP */}
              <SelectWithOther
                id="select-afp"
                label="AFP (Fondo de Pensiones)"
                value={form.afp_nombre}
                options={AFP_COLOMBIA}
                placeholder="— Seleccionar Fondo de Pensiones —"
                otherPlaceholder="Escribe el fondo de pensiones..."
                onChange={val => set('afp_nombre', val)}
                onSelectOption={item => {
                  if (item?.codigo) set('afp_codigo', item.codigo);
                }}
              />

              <div className="cw-form-group">
                <label className="cw-label">Régimen pensión</label>
                <select className="cw-input cw-select" value={form.afp_tipo} onChange={e => set('afp_tipo', e.target.value)}>
                  <option value="RAZON">RAIS — Cuenta individual</option>
                  <option value="PRIMAPROMEDIO">RPM — Colpensiones</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.5rem' }}>
              {/* ARL */}
              <SelectWithOther
                id="select-arl"
                label="ARL (Riesgos Laborales)"
                value={form.arl_nombre}
                options={ARL_COLOMBIA}
                placeholder="— Seleccionar ARL —"
                otherPlaceholder="Escribe el nombre de la ARL..."
                onChange={val => set('arl_nombre', val)}
                onSelectOption={item => {
                  if (item?.codigo) set('arl_codigo', item.codigo);
                }}
              />

              <div className="cw-form-group">
                <label className="cw-label">Nivel riesgo ARL</label>
                <select className="cw-input cw-select" value={form.nivel_riesgo_arl} onChange={e => set('nivel_riesgo_arl', parseInt(e.target.value, 10))}>
                  {NIVELES_ARL.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {/* Caja de Compensación */}
              <SelectWithOther
                id="select-caja"
                label="Caja de Compensación Familiar"
                value={form.caja_compensacion}
                options={CAJAS_COMPENSACION_COLOMBIA}
                placeholder="— Seleccionar Caja —"
                otherPlaceholder="Escribe el nombre de la caja..."
                onChange={val => set('caja_compensacion', val)}
              />

              {/* Fondo de Cesantías */}
              <SelectWithOther
                id="select-cesantias"
                label="Fondo de Cesantías"
                value={form.fondo_cesantias}
                options={FONDOS_CESANTIAS_COLOMBIA}
                placeholder="— Seleccionar Fondo Cesantías —"
                otherPlaceholder="Escribe el fondo de cesantías..."
                onChange={val => set('fondo_cesantias', val)}
                secondaryAction={
                  form.afp_nombre && (
                    <button
                      type="button"
                      className="cw-btn cw-btn--secondary"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem' }}
                      onClick={() => set('fondo_cesantias', form.afp_nombre)}
                      title="Copiar el mismo fondo de pensiones"
                    >
                      Mismo que AFP
                    </button>
                  )
                }
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={form.cesantias_afc} onChange={e => set('cesantias_afc', e.target.checked)} />
              <span>💰 Tiene cuenta de ahorro programado AFC (beneficio tributario de vivienda)</span>
            </label>

            {/* DATOS BANCARIOS (TODOS LOS BANCOS DE COLOMBIA) */}
            <h5 style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: '1.15rem 0 0.5rem', fontWeight: 700 }}>
              🏦 Información bancaria para dispersión de nómina
            </h5>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 1.2fr', gap: '0.5rem' }}>
              {/* Selector de Banco de Colombia */}
              <SelectWithOther
                id="select-banco"
                label="Entidad Bancaria"
                value={form.banco_nombre}
                options={BANCOS_COLOMBIA}
                placeholder="— Seleccionar Banco —"
                otherPlaceholder="Escribe el nombre del banco o billetera..."
                onChange={val => set('banco_nombre', val)}
              />

              <div className="cw-form-group">
                <label className="cw-label">Tipo cuenta</label>
                <select className="cw-input cw-select" value={form.tipo_cuenta} onChange={e => set('tipo_cuenta', e.target.value)}>
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </select>
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  N° de cuenta <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(solo números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.numero_cuenta}
                  onChange={e => set('numero_cuenta', onlyDigits(e.target.value))}
                  placeholder="Número de cuenta bancaria..."
                />
              </div>
            </div>

            <div className="cw-form-group">
              <label className="cw-label">
                Titular de la cuenta
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo texto — dejar en blanco si es el mismo empleado)</span>
              </label>
              <input
                className="cw-input"
                value={form.titular_cuenta}
                onChange={e => set('titular_cuenta', onlyLettersAndSpaces(e.target.value))}
                placeholder={form.nombre || 'Nombre del titular si es cuenta de terceros...'}
              />
            </div>
          </div>
        )}

        {/* ──────────── PASO 4: FORMACIÓN Y DATOS FISCALES ──────────── */}
        {step === 4 && (
          <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <MdSchool style={{ color: 'var(--cw-accent)', fontSize: '1.2rem' }} />
              <h4 style={{ fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>Perfil profesional, formación y datos tributarios</h4>
            </div>

            {/* Nivel educativo y título */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
              <div className="cw-form-group">
                <label className="cw-label">Nivel de educación</label>
                <select className="cw-input cw-select" value={form.nivel_educacion} onChange={e => set('nivel_educacion', e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  <option value="PRIMARIA">Primaria</option>
                  <option value="BACHILLERATO">Bachillerato</option>
                  <option value="TECNICO">Técnico</option>
                  <option value="TECNOLOGO">Tecnólogo</option>
                  <option value="PREGRADO">Pregrado / Profesional</option>
                  <option value="ESPECIALIZACION">Especialización</option>
                  <option value="MAESTRIA">Maestría</option>
                  <option value="DOCTORADO">Doctorado</option>
                </select>
              </div>

              <div className="cw-form-group">
                <label className="cw-label">
                  Título obtenido <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>(solo texto)</span>
                </label>
                <input
                  className="cw-input"
                  value={form.titulo_obtenido}
                  onChange={e => set('titulo_obtenido', onlyTextPunctuation(e.target.value))}
                  placeholder="Ej: Ingeniero de Sistemas, Administrador, Bachiller..."
                />
              </div>
            </div>

            {/* Aprendiz SENA */}
            <div style={{
              padding: '0.75rem',
              background: form.sena_aprendiz ? 'rgba(59,130,246,0.08)' : 'var(--bg-glass, rgba(0,0,0,0.02))',
              border: `1px solid ${form.sena_aprendiz ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle, rgba(0,0,0,0.08))'}`,
              borderRadius: 8,
              marginBottom: '0.75rem',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.sena_aprendiz} onChange={e => set('sena_aprendiz', e.target.checked)} />
                <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>🎓 Aprendiz SENA (Ley 789/02 y Ley 1882/18)</span>
              </label>

              {form.sena_aprendiz && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                    <input type="checkbox" checked={form.etapa_productiva} onChange={e => set('etapa_productiva', e.target.checked)} />
                    <span>En etapa productiva (Apoyo del 50% SMLV, sin prestaciones sociales)</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <div className="cw-form-group" style={{ marginBottom: 0 }}>
                      <label className="cw-label" style={{ fontSize: '0.72rem' }}>Inicio etapa lectiva</label>
                      <input type="date" className="cw-input" value={form.fecha_etapa_lectiva_inicio} onChange={e => set('fecha_etapa_lectiva_inicio', e.target.value)} />
                    </div>
                    <div className="cw-form-group" style={{ marginBottom: 0 }}>
                      <label className="cw-label" style={{ fontSize: '0.72rem' }}>Fin etapa lectiva</label>
                      <input
                        type="date"
                        className={`cw-input ${errors.fecha_etapa_lectiva_fin ? 'error' : ''}`}
                        value={form.fecha_etapa_lectiva_fin}
                        onChange={e => set('fecha_etapa_lectiva_fin', e.target.value)}
                      />
                      {errors.fecha_etapa_lectiva_fin && <span className="cw-input-error">⚠ {errors.fecha_etapa_lectiva_fin}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Licencia de conducción */}
            <div className="cw-form-group">
              <label className="cw-label">Licencia de conducción</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.tiene_licencia_conduccion} onChange={e => set('tiene_licencia_conduccion', e.target.checked)} />
                  <span>Tiene licencia vigente</span>
                </label>
                {form.tiene_licencia_conduccion && (
                  <>
                    <select
                      className="cw-input cw-select"
                      style={{ width: 140 }}
                      value={form.categoria_licencia}
                      onChange={e => set('categoria_licencia', e.target.value)}
                    >
                      <option value="">Categoría</option>
                      <option value="A1">A1 (Moto ≤125cc)</option>
                      <option value="A2">A2 (Moto &gt;125cc)</option>
                      <option value="B1">B1 (Automóvil part.)</option>
                      <option value="B2">B2 (Camión part.)</option>
                      <option value="B3">B3 (Articulado part.)</option>
                      <option value="C1">C1 (Automóvil públ.)</option>
                      <option value="C2">C2 (Camión públ.)</option>
                      <option value="C3">C3 (Articulado públ.)</option>
                    </select>
                    <input
                      type="date"
                      className="cw-input"
                      style={{ flex: 1, minWidth: 140 }}
                      value={form.vencimiento_licencia}
                      onChange={e => set('vencimiento_licencia', e.target.value)}
                      title="Fecha de vencimiento de la licencia"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Otras certificaciones */}
            <div className="cw-form-group">
              <label className="cw-label">
                Certificaciones laborales o cursos habilitantes
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}> (solo texto)</span>
              </label>
              <textarea
                className="cw-input"
                rows={2}
                value={form.tiene_certificaciones}
                onChange={e => set('tiene_certificaciones', onlyTextPunctuation(e.target.value))}
                placeholder="Trabajo seguro en alturas, manipulación de alimentos, primeros auxilios..."
              />
            </div>

            {/* Datos tributarios DIAN */}
            <h5 style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: '1rem 0 0.5rem', fontWeight: 700 }}>
              📊 Parámetros tributarios (DIAN / Retención en la fuente)
            </h5>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.responsable_iva} onChange={e => set('responsable_iva', e.target.checked)} />
                <span>Responsable de IVA (Art. 437 E.T.)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.declarante_renta} onChange={e => set('declarante_renta', e.target.checked)} />
                <span>Declarante del impuesto sobre la renta</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.aplica_retencion_fuente} onChange={e => set('aplica_retencion_fuente', e.target.checked)} />
                <span>Aplica retención en la fuente laboral (Art. 383 E.T.)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.persona_mayor_dependiente} onChange={e => set('persona_mayor_dependiente', e.target.checked)} />
                <span>Tiene persona mayor de 60 años dependiente</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
              <div className="cw-form-group" style={{ marginBottom: 0 }}>
                <label className="cw-label">
                  N° dependientes <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(números)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="cw-input"
                  value={form.numero_dependientes}
                  onChange={e => set('numero_dependientes', onlyDigits(e.target.value))}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                💡 Hijos dependientes o cónyuge a cargo reducen la base gravable de retención en la fuente.
              </div>
            </div>

            {/* Resumen rápido de comprobación */}
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'var(--bg-glass, rgba(0,0,0,0.03))',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
              borderRadius: 8,
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem', color: 'var(--cw-accent)' }}>
                📋 Resumen de la ficha del colaborador:
              </div>
              <div><strong>Colaborador:</strong> {form.nombre || '—'} · {form.tipo_documento} {form.cedula || '—'}</div>
              <div><strong>Cargo y Contrato:</strong> {form.cargo || '—'} · {TIPOS_CONTRATO.find(t => t.value === form.tipo_contrato)?.label}</div>
              <div><strong>Salario pactado:</strong> ${(parseFloat(form.salario_mensual) || 0).toLocaleString('es-CO')} COP/mes · ${(parseFloat(form.valor_hora) || 0).toLocaleString('es-CO')} COP/hora</div>
              <div><strong>Seguridad Social:</strong> EPS {form.eps_nombre || '—'} · AFP {form.afp_nombre || '—'} · ARL {form.arl_nombre || '—'}</div>
              <div><strong>Dispersión:</strong> {form.banco_nombre || '—'} ({form.tipo_cuenta}) N° {form.numero_cuenta || '—'}</div>
            </div>
          </div>
        )}

        {/* Pie del modal con navegación */}
        <div className="cw-modal__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {step > 1 && (
              <button type="button" className="cw-btn cw-btn--secondary" onClick={prev}>
                <MdArrowBack /> Anterior
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="cw-btn cw-btn--secondary" onClick={onClose}>
              Cancelar
            </button>

            {step < 4 ? (
              <button type="button" className="cw-btn cw-btn--primary" onClick={next}>
                Siguiente paso <MdArrowForward />
              </button>
            ) : (
              <button type="button" className="cw-btn cw-btn--primary" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <span className="cw-spinner cw-spinner--sm"></span> Guardando datos...
                  </>
                ) : (
                  <>
                    <MdSave /> {isEdit ? 'Actualizar Colaborador' : 'Guardar y Registrar Colaborador'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
