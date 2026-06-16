// ============================================================
// ChronosWork — Catálogo Laboral Colombia
// CST, Ley 2101/2021, Ley 2466/2025, prácticas del mercado
// Datos de salarios: promedio DANE + PILA 2024-2025
// ============================================================

// ── TIPOS DE CONTRATO (Código Sustantivo del Trabajo, Art. 37-50) ─────────
export const TIPOS_CONTRATO = [
  {
    value: 'INDEFINIDO',
    label: 'Término Indefinido',
    desc: 'El más común. Sin fecha de terminación. Estabilidad laboral reforzada.',
    prestacion: 'Todas (prima, cesantías, intereses, vacaciones)',
    icono: '♾️',
  },
  {
    value: 'TERMINO_FIJO',
    label: 'Término Fijo',
    desc: 'Mayor a 1 año. Requiere justificación. Ley 2466/2025 prohíbe fraccionar.',
    prestacion: 'Todas',
    icono: '📅',
  },
  {
    value: 'OBRA_LABOR',
    label: 'Obra o Labor Contratada',
    desc: 'Termina al finalizar la obra. Usado en construcción, proyectos, outsourcing.',
    prestacion: 'Todas',
    icono: '🔨',
  },
  {
    value: 'POR_HORAS',
    label: 'Por Horas (Art. 47 CST)',
    desc: 'Trabajador con jornada de hasta 30h/sem. Mínimo 4h consecutivas. Salario proporcional.',
    prestacion: 'Todas proporcionales',
    icono: '⏰',
  },
  {
    value: 'SALARIO_FIJO',
    label: 'Salario Fijo (mensual)',
    desc: 'Pago mensual fijo. Jornada ordinaria completa (42h/sem). Turno predeterminado.',
    prestacion: 'Todas',
    icono: '💵',
  },
  {
    value: 'PRESTACION_SERVICIOS',
    label: 'Prestación de Servicios',
    desc: 'Autónomo, no relación laboral. Cuidado: Sentencia C-201/24 prohíbe encadenar más de 3 meses con misma labor.',
    prestacion: 'NO tiene prestaciones (contratar aparte ARL)',
    icono: '🤝',
  },
  {
    value: 'APRENDIZAJE',
    label: 'Aprendizaje SENA',
    desc: 'Etapa lectiva: hasta 4h teóricas pagas. Etapa práctica: 50% SMLV sin prima. (Ley 1882/2018, Decreto 1072/2015)',
    prestacion: 'Limitadas (según etapa)',
    icono: '🎓',
  },
  {
    value: 'OCASIONAL',
    label: 'Trabajo Ocasional / Transitorio',
    desc: 'Hasta 30 días. Para actividades no habituales del giro ordinario de la empresa.',
    prestacion: 'NO prestaciones',
    icono: '⚡',
  },
  {
    value: 'TEMPORAL',
    label: 'Temporal (Ley 50/90 Art. 71)',
    desc: 'A través de empresa de servicios temporales (EST). Máximo 1 año, prorrogable a 3. Uso: reemplazos o picos de producción.',
    prestacion: 'A cargo de la EST usuaria',
    icono: '🔁',
  },
];

// ── TIPOS DE TURNO (mercado colombiano) ────────────────────────────────────
// shift_kind define el comportamiento en el algoritmo de auto-asignación
// kind: 'STANDARD'  = turno corrido simple (8h, 10h, etc)
//       'PARTIDO'  = turno con hora de almuerzo (mañana + tarde)
//       'ROTATIVO' = se asigna rotando mañana/tarde/noche
//       'DISPONIBILIDAD' = guardia on-call
//       'CUSTOM'   = definido por el usuario
export const TIPOS_TURNO = [
  {
    value: 'STANDARD',
    label: 'Turno Estándar',
    desc: 'Turno corrido (ej: 6am-2pm, 8am-5pm, 2pm-10pm).',
    icono: '⏰',
    color: '#3b82f6',
  },
  {
    value: 'PARTIDO',
    label: 'Turno Partido',
    desc: 'Con hora de almuerzo (ej: 7am-12pm y 2pm-6pm). Se paga el intermedio según jurisprudencia.',
    icono: '⏸️',
    color: '#8b5cf6',
  },
  {
    value: 'ROTATIVO',
    label: 'Turno Rotativo',
    desc: 'El sistema rota entre mañana/tarde/noche. Útil para 24/7.',
    icono: '🔄',
    color: '#f59e0b',
  },
  {
    value: 'NOCTURNO',
    label: 'Turno Nocturno Dedicado',
    desc: 'Jornada predominantemente nocturna (≥50% entre 19:00 y 06:00). Genera recargo HON automático.',
    icono: '🌙',
    color: '#6366f1',
  },
  {
    value: 'DISPONIBILIDAD',
    label: 'Disponibilidad / Guardia',
    desc: 'On-call. Se paga un recargo por disponibilidad aunque no se labore. Común: salud, vigilancia.',
    icono: '🛎️',
    color: '#ec4899',
  },
  {
    value: 'CUSTOM',
    label: 'Personalizado',
    desc: 'Define libremente la franja horaria.',
    icono: '🛠️',
    color: '#10b981',
  },
];

// ── PATRONES DE TURNOS ROTATIVOS (comunes en Colombia) ────────────────────
export const PATRONES_ROTATIVOS = [
  {
    value: '2x1',
    label: '2x1 — Trabaja 2, Descansa 1',
    desc: '42h/sem promedio, respeta límite. Usado en vigilancia, hotelería.',
    diasPorSemana: 4.67, // 7/3 * 2
    diasTrabajo: 4, diasDescanso: 2,
  },
  {
    value: '3x2',
    label: '3x2 — Trabaja 3, Descansa 2',
    desc: 'Común en seguridad privada, salud. Equilibrio 60/40 trabajo/descanso.',
    diasPorSemana: 3.5,
    diasTrabajo: 3, diasDescanso: 2,
  },
  {
    value: '4x3',
    label: '4x3 — Trabaja 4, Descansa 3',
    desc: 'Favorito petroleras y minerías. Más descanso.',
    diasPorSemana: 4,
    diasTrabajo: 4, diasDescanso: 3,
  },
  {
    value: '5x2',
    label: '5x2 — Trabaja 5 (L-V), Descansa 2 (S-D)',
    desc: 'El clásico horario de oficina. 42h/sem si turnos de 8h24min.',
    diasPorSemana: 5,
    diasTrabajo: 5, diasDescanso: 2,
  },
  {
    value: '6x1',
    label: '6x1 — Trabaja 6, Descansa 1',
    desc: 'Máxima carga legal. Cuidado: los 2 domingos al mes obligatorios sí se pagan dominical.',
    diasPorSemana: 6,
    diasTrabajo: 6, diasDescanso: 1,
  },
  {
    value: '7x7',
    label: '7x7 — Trabaja 7, Descansa 7',
    desc: 'Minería, petroleras, plataformas. Jornada extendida de 14 días.',
    diasPorSemana: 7,
    diasTrabajo: 7, diasDescanso: 7,
  },
  {
    value: '10x5',
    label: '10x5 — Trabaja 10, Descansa 5',
    desc: 'Patrón 14x10 usado en plataformas offshore. Ciclos de 14 días.',
    diasPorSemana: 7,
    diasTrabajo: 10, diasDescanso: 5,
  },
  {
    value: '14x14',
    label: '14x14 — Trabaja 14, Descansa 14',
    desc: 'Hospitales, plataformas marítimas. Turnos de 12h.',
    diasPorSemana: 7,
    diasTrabajo: 14, diasDescanso: 14,
  },
  {
    value: 'PERSONALIZADO',
    label: 'Personalizado',
    desc: 'Define tu propio patrón (ej: trabaja L-Mié, descansa Jue-Vie, trabaja S-D).',
    diasPorSemana: 0,
    diasTrabajo: 0, diasDescanso: 0,
  },
];

// ── SECTORES ECONÓMICOS (catálogo DIAN, simplificado) ──────────────────────
export const SECTORES = [
  { value: 'RETAIL', label: 'Comercio al por menor (Retail)', icono: '🛒',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 12500 } },
  { value: 'HOTELERIA', label: 'Hotelería y Turismo', icono: '🏨',
    defaults: { modo: '24_7', contrato: 'INDEFINIDO', salario: 13000 } },
  { value: 'RESTAURANTE', label: 'Restaurantes y Bares', icono: '🍽️',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 12500 } },
  { value: 'SALUD', label: 'Salud y Hospitalario', icono: '🏥',
    defaults: { modo: '24_7', contrato: 'INDEFINIDO', salario: 15000 } },
  { value: 'SEGURIDAD', label: 'Vigilancia y Seguridad Privada', icono: '🛡️',
    defaults: { modo: '24_7', contrato: 'INDEFINIDO', salario: 12000 } },
  { value: 'INDUSTRIA', label: 'Industria / Manufactura / Fábrica', icono: '🏭',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 13000 } },
  { value: 'CONSTRUCCION', label: 'Construcción y Obras', icono: '🏗️',
    defaults: { modo: 'OFICINA', contrato: 'OBRA_LABOR', salario: 13000 } },
  { value: 'LOGISTICA', label: 'Logística, Transporte y Bodega', icono: '📦',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 12500 } },
  { value: 'OFICINA', label: 'Oficina / Servicios administrativos', icono: '💼',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 15000 } },
  { value: 'EDUCACION', label: 'Educación', icono: '🎓',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 13500 } },
  { value: 'AGRO', label: 'Agropecuario', icono: '🌾',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 12500 } },
  { value: 'TECNOLOGIA', label: 'Tecnología / Software', icono: '💻',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 20000 } },
  { value: 'CALL_CENTER', label: 'Call Center / BPO', icono: '📞',
    defaults: { modo: '24_7_NIGHT_SPLIT', contrato: 'INDEFINIDO', salario: 13000 } },
  { value: 'OTRO', label: 'Otro', icono: '🔹',
    defaults: { modo: 'OFICINA', contrato: 'INDEFINIDO', salario: 12500 } },
];

// ── TIPOS DE ÁREA POR SECTOR (catálogo preconfigurado) ─────────────────────
// Al elegir un sector, se sugieren estas áreas y franjas típicas
export const AREAS_POR_SECTOR = {
  RETAIL: [
    { nombre: 'Cajas', color: '#10b981' },
    { nombre: 'Atención al Cliente', color: '#3b82f6' },
    { nombre: 'Bodega / Inventario', color: '#f59e0b' },
    { nombre: 'Surtido', color: '#8b5cf6' },
    { nombre: 'Administración', color: '#6366f1' },
  ],
  HOTELERIA: [
    { nombre: 'Recepción', color: '#6366f1' },
    { nombre: 'Housekeeping / Pisos', color: '#10b981' },
    { nombre: 'Cocina', color: '#f59e0b' },
    { nombre: 'Meseros / Alimentos y Bebidas', color: '#ec4899' },
    { nombre: 'Mantenimiento', color: '#ef4444' },
    { nombre: 'Administración', color: '#8b5cf6' },
  ],
  RESTAURANTE: [
    { nombre: 'Meseros / Salón', color: '#ec4899' },
    { nombre: 'Cocina', color: '#f59e0b' },
    { nombre: 'Caja', color: '#10b981' },
    { nombre: 'Barra', color: '#8b5cf6' },
    { nombre: 'Limpieza', color: '#3b82f6' },
  ],
  SALUD: [
    { nombre: 'Enfermería', color: '#ec4899' },
    { nombre: 'Medicina General', color: '#3b82f6' },
    { nombre: 'Urgencias', color: '#ef4444' },
    { nombre: 'Cirugía', color: '#8b5cf6' },
    { nombre: 'Administrativo', color: '#6366f1' },
    { nombre: 'Mantenimiento', color: '#f59e0b' },
  ],
  SEGURIDAD: [
    { nombre: 'Vigilancia 24/7', color: '#1e40af' },
    { nombre: 'Escolta', color: '#dc2626' },
    { nombre: 'Monitoreo / CCTV', color: '#6366f1' },
    { nombre: 'Supervisores', color: '#f59e0b' },
  ],
  INDUSTRIA: [
    { nombre: 'Producción / Planta', color: '#f59e0b' },
    { nombre: 'Calidad', color: '#10b981' },
    { nombre: 'Mantenimiento', color: '#ef4444' },
    { nombre: 'Logística Interna', color: '#3b82f6' },
    { nombre: 'Administración', color: '#6366f1' },
  ],
  CONSTRUCCION: [
    { nombre: 'Obra Civil', color: '#f59e0b' },
    { nombre: 'Electricistas', color: '#fbbf24' },
    { nombre: 'Soldadores', color: '#dc2626' },
    { nombre: 'Albañilería', color: '#a3a3a3' },
    { nombre: 'Maestros / Jefes de Obra', color: '#6366f1' },
    { nombre: 'Administración de Obra', color: '#8b5cf6' },
  ],
  LOGISTICA: [
    { nombre: 'Recepción de Mercancía', color: '#3b82f6' },
    { nombre: 'Almacenamiento / Picking', color: '#f59e0b' },
    { nombre: 'Despachos', color: '#10b981' },
    { nombre: 'Conductores', color: '#ef4444' },
    { nombre: 'Administración', color: '#6366f1' },
  ],
  OFICINA: [
    { nombre: 'Administración', color: '#6366f1' },
    { nombre: 'Contabilidad / Finanzas', color: '#10b981' },
    { nombre: 'Recursos Humanos', color: '#ec4899' },
    { nombre: 'Ventas', color: '#f59e0b' },
    { nombre: 'Atención al Cliente', color: '#3b82f6' },
  ],
  EDUCACION: [
    { nombre: 'Docentes', color: '#6366f1' },
    { nombre: 'Coordinación Académica', color: '#8b5cf6' },
    { nombre: 'Servicios Generales', color: '#10b981' },
    { nombre: 'Administración', color: '#f59e0b' },
  ],
  AGRO: [
    { nombre: 'Campo / Cosecha', color: '#10b981' },
    { nombre: 'Maquinaria Agrícola', color: '#f59e0b' },
    { nombre: 'Veterinaria / Cuidado Animal', color: '#ec4899' },
    { nombre: 'Administración', color: '#6366f1' },
  ],
  TECNOLOGIA: [
    { nombre: 'Desarrollo', color: '#3b82f6' },
    { nombre: 'Diseño / Producto', color: '#ec4899' },
    { nombre: 'Soporte Técnico', color: '#f59e0b' },
    { nombre: 'Administración', color: '#6366f1' },
  ],
  CALL_CENTER: [
    { nombre: 'Agentes Call Center', color: '#3b82f6' },
    { nombre: 'Backoffice', color: '#10b981' },
    { nombre: 'Supervisores', color: '#f59e0b' },
    { nombre: 'Calidad', color: '#ec4899' },
  ],
  OTRO: [
    { nombre: 'Operativa', color: '#6366f1' },
    { nombre: 'Administrativa', color: '#8b5cf6' },
  ],
};

// ── PLANTILLAS DE FRANJAS HORARIAS TÍPICAS POR SECTOR ─────────────────────
// Para que un área recién creada ya tenga turnos listos para auto-asignar
export const FRANJAS_POR_SECTOR = {
  RETAIL: [
    { nombre: 'Apertura',  hora_inicio: '07:00', hora_fin: '15:00', color: '#f59e0b' },
    { nombre: 'Cierre',    hora_inicio: '13:00', hora_fin: '21:00', color: '#3b82f6' },
    { nombre: 'Cierre 2',  hora_inicio: '15:00', hora_fin: '22:00', color: '#8b5cf6' },
  ],
  HOTELERIA: [
    { nombre: 'Mañana',   hora_inicio: '06:00', hora_fin: '14:00', color: '#f59e0b' },
    { nombre: 'Tarde',    hora_inicio: '14:00', hora_fin: '22:00', color: '#3b82f6' },
    { nombre: 'Noche',    hora_inicio: '22:00', hora_fin: '06:00', cruza_medianoche: true, color: '#6366f1' },
  ],
  RESTAURANTE: [
    { nombre: 'Apertura Cocina',  hora_inicio: '10:00', hora_fin: '16:00', color: '#f59e0b' },
    { nombre: 'Turno Cena',       hora_inicio: '16:00', hora_fin: '23:00', color: '#3b82f6' },
    { nombre: 'Salón Mañana',     hora_inicio: '11:00', hora_fin: '16:00', color: '#ec4899' },
    { nombre: 'Salón Noche',      hora_inicio: '17:00', hora_fin: '23:00', color: '#8b5cf6' },
  ],
  SALUD: [
    { nombre: 'Mañana (7-19h)',  hora_inicio: '07:00', hora_fin: '19:00', color: '#f59e0b' },
    { nombre: 'Noche (19-7h)',   hora_inicio: '19:00', hora_fin: '07:00', cruza_medianoche: true, color: '#6366f1' },
    { nombre: 'Administración',  hora_inicio: '07:00', hora_fin: '17:00', color: '#3b82f6' },
  ],
  SEGURIDAD: [
    { nombre: 'Diurno 6-18',  hora_inicio: '06:00', hora_fin: '18:00', color: '#f59e0b' },
    { nombre: 'Nocturno 18-6', hora_inicio: '18:00', hora_fin: '06:00', cruza_medianoche: true, color: '#6366f1' },
    { nombre: 'Diurno 7-19',  hora_inicio: '07:00', hora_fin: '19:00', color: '#fbbf24' },
    { nombre: 'Nocturno 19-7', hora_inicio: '19:00', hora_fin: '07:00', cruza_medianoche: true, color: '#1e40af' },
  ],
  INDUSTRIA: [
    { nombre: 'Turno Día',  hora_inicio: '06:00', hora_fin: '14:00', color: '#f59e0b' },
    { nombre: 'Turno Tarde', hora_inicio: '14:00', hora_fin: '22:00', color: '#3b82f6' },
    { nombre: 'Turno Noche', hora_inicio: '22:00', hora_fin: '06:00', cruza_medianoche: true, color: '#6366f1' },
    { nombre: 'Administrativo', hora_inicio: '07:00', hora_fin: '17:00', color: '#10b981' },
  ],
  CONSTRUCCION: [
    { nombre: 'Obra Mañana',  hora_inicio: '07:00', hora_fin: '12:00', color: '#f59e0b' },
    { nombre: 'Obra Tarde',   hora_inicio: '13:00', hora_fin: '17:00', color: '#3b82f6' },
    { nombre: 'Jornada Completa', hora_inicio: '07:00', hora_fin: '17:00', color: '#fbbf24' },
    { nombre: 'Administrativo', hora_inicio: '07:00', hora_fin: '17:00', color: '#10b981' },
  ],
  LOGISTICA: [
    { nombre: 'Turno Día',   hora_inicio: '06:00', hora_fin: '14:00', color: '#f59e0b' },
    { nombre: 'Turno Tarde', hora_inicio: '14:00', hora_fin: '22:00', color: '#3b82f6' },
    { nombre: 'Turno Noche', hora_inicio: '22:00', hora_fin: '06:00', cruza_medianoche: true, color: '#6366f1' },
  ],
  OFICINA: [
    { nombre: 'Jornada Completa', hora_inicio: '08:00', hora_fin: '18:00', color: '#6366f1' },
    { nombre: 'Media Jornada AM', hora_inicio: '08:00', hora_fin: '13:00', color: '#10b981' },
    { nombre: 'Media Jornada PM', hora_inicio: '13:00', hora_fin: '18:00', color: '#f59e0b' },
  ],
  EDUCACION: [
    { nombre: 'Jornada Mañana', hora_inicio: '07:00', hora_fin: '12:00', color: '#f59e0b' },
    { nombre: 'Jornada Tarde',  hora_inicio: '13:00', hora_fin: '18:00', color: '#3b82f6' },
    { nombre: 'Jornada Única',  hora_inicio: '07:00', hora_fin: '17:00', color: '#10b981' },
  ],
  AGRO: [
    { nombre: 'Jornada Día',  hora_inicio: '06:00', hora_fin: '14:00', color: '#f59e0b' },
    { nombre: 'Jornada Tarde', hora_inicio: '14:00', hora_fin: '22:00', color: '#3b82f6' },
    { nombre: 'Administrativo', hora_inicio: '07:00', hora_fin: '17:00', color: '#10b981' },
  ],
  TECNOLOGIA: [
    { nombre: 'Jornada Completa', hora_inicio: '08:00', hora_fin: '18:00', color: '#6366f1' },
    { nombre: 'Flexible Mañana', hora_inicio: '07:00', hora_fin: '15:00', color: '#10b981' },
    { nombre: 'Flexible Tarde',  hora_inicio: '11:00', hora_fin: '19:00', color: '#3b82f6' },
  ],
  CALL_CENTER: [
    { nombre: 'Mañana (7-15)',  hora_inicio: '07:00', hora_fin: '15:00', color: '#f59e0b' },
    { nombre: 'Tarde (13-21)',  hora_inicio: '13:00', hora_fin: '21:00', color: '#3b82f6' },
    { nombre: 'Cierre (15-23)',  hora_inicio: '15:00', hora_fin: '23:00', color: '#8b5cf6' },
    { nombre: 'Noche (22-6)',   hora_inicio: '22:00', hora_fin: '06:00', cruza_medianoche: true, color: '#6366f1' },
  ],
  OTRO: [
    { nombre: 'Jornada Estándar', hora_inicio: '08:00', hora_fin: '17:00', color: '#6366f1' },
  ],
};

// ── SALARIO MÍNIMO LEGAL VIGENTE (Colombia 2025-2026) ──────────────────────
export const SMLV_2025 = 1423500; // COP / mes
export const SMLV_HORA_2025 = 5180; // COP / hora (1423500 / 240 hrs mensuales)

// Auxilio de transporte 2025 (para sueldos ≤ 2 SMLV)
export const AUX_TRANSPORTE_2025 = 200000;

// ── TIPOS DE JORNADA (CST) ─────────────────────────────────────────────────
export const TIPOS_JORNADA = [
  {
    value: 'DIURNA',
    label: 'Jornada Diurna (06:00 – 19:00)',
    desc: 'La más común. Máximo 42h semanales desde Ley 2101/2021.',
  },
  {
    value: 'NOCTURNA',
    label: 'Jornada Nocturna (19:00 – 06:00)',
    desc: 'Recargo HON +35% sobre cada hora. Máximo 42h/sem.',
  },
  {
    value: 'MIXTA',
    label: 'Jornada Mixta',
    desc: 'Combina diurna y nocturna. Las horas nocturnas (>19:00) pagan HON.',
  },
  {
    value: 'POR_TURNOS',
    label: 'Jornada por Turnos (Art. 164 CST)',
    desc: 'Trabaja en equipo cumpliendo rol. Turnos rotativos 8h, 12h, 24h.',
  },
];

// ── TIPOS DE NOVEDAD (CST, Ley 2466/2025) ──────────────────────────────────
export const TIPOS_NOVEDAD = [
  { value: 'vacaciones', label: 'Vacaciones', color: '#10b981', icono: '🏖️',
    desc: '15 días hábiles por año trabajado. 18 días desde 2027 (Ley 2466/2025). Remuneradas.' },
  { value: 'incapacidad', label: 'Incapacidad Médica', color: '#ef4444', icono: '🏥',
    desc: 'Días 1-2: empleador 100%. Días 3-180: EPS 66.7%. >180: fondo/ARL.' },
  { value: 'licencia_luto', label: 'Licencia de Luto (5 días)', color: '#6b7280', icono: '⚫',
    desc: '5 días hábiles remunerados por fallecimiento familiar (Ley 1280/09, ampliada Ley 2466/25).' },
  { value: 'licencia_paternidad', label: 'Licencia de Paternidad (2 semanas)', color: '#3b82f6', icono: '👶',
    desc: '2 semanas intransferibles desde Ley 2114/2021. Paga la EPS al 100%.' },
  { value: 'licencia_menstrual', label: 'Licencia Menstrual (2 días)', color: '#ec4899', icono: '🌸',
    desc: 'Hasta 2 días remunerados por periodo menstrual. Ley 2307/2023.' },
  { value: 'dia_familia', label: 'Día de la Familia (1 día/mes)', color: '#8b5cf6', icono: '👨‍👩‍👧',
    desc: '1 día remunerado cada 6 meses para empleados con hijos menores de 14 años. Ley 2466/2025.' },
  { value: 'licencia', label: 'Licencia Remunerada', color: '#f59e0b', icono: '📋',
    desc: 'Licencia acordada con el empleador. Se paga el salario.' },
  { value: 'suspension', label: 'Suspensión', color: '#6b7280', icono: '⛔',
    desc: 'Sanción disciplinaria o acordada. No remunerada.' },
  { value: 'permiso_sindical', label: 'Permiso Sindical', color: '#06b6d4', icono: '✊',
    desc: 'Permisos remunerados para dirigentes sindicales (Ley 584/00).' },
  { value: 'calamidad', label: 'Calamidad Doméstica', color: '#dc2626', icono: '🆘',
    desc: 'Días por calamidad familiar. Convención o pacto.' },
];

// ── SMLV POR AÑO (histórico + vigente, para que no se rompa en el futuro) ─
export const SMLV_HISTORICO = {
  2024: 1300000,
  2025: 1423500,
  2026: 1423500, // Se actualiza cada enero. Pendiente del decreto 2026
};

// ── FUNCIONES HELPER ────────────────────────────────────────────────────────
export function getContratoLabel(value) {
  return TIPOS_CONTRATO.find(c => c.value === value)?.label || value;
}
export function getSectorDefaults(sector) {
  return SECTORES.find(s => s.value === sector)?.defaults || SECTORES[0].defaults;
}
export function getAreasBySector(sector) {
  return AREAS_POR_SECTOR[sector] || AREAS_POR_SECTOR.OTRO;
}
export function getFranjasBySector(sector) {
  return FRANJAS_POR_SECTOR[sector] || FRANJAS_POR_SECTOR.OTRO;
}
export function getSMLV(year = 2025) {
  return SMLV_HISTORICO[year] || SMLV_2025;
}
