// ============================================================
// CONSTANTES GLOBALES DEL SISTEMA ChronosWork
// CST Colombia - Ley 2101 de 2021 + Ley 2466 de 2025
// ============================================================

// --- LÍMITES LEGALES DE JORNADA ---
export const MAX_HORAS_SEMANALES = 42;         // Ley 2101/2021
export const MAX_EXTRAS_DIARIAS = 2;
export const MAX_EXTRAS_SEMANALES = 12;

// --- DEFAULTS DE EMPLEADO ---
export const DEFAULT_HORAS_SEMANALES = 42;
export const MAX_HORAS_SEMANALES_POR_EMPLEADO = 168;
export const DEFAULT_HORAS_MENSUALES = 182;
export const DEFAULT_DIAS_DESCANSO = 1;
export const DEFAULT_NIVEL_ARL = 1;
export const MAX_NIVEL_ARL = 5;
// Los valores de SMLV (salario mínimo legal vigente) viven en laborCatalog.js:
//   SMLV_HISTORICO, getSMLV(year), SMLV_2025, SMLV_HORA_2025, AUX_TRANSPORTE_2025
// Usar getSMLV() en vez de valores duros para que no queden desactualizados.
export const SALARIO_MINIMO_DIARIO = 47366; // ~$1,421,000 / 30 (2025) — usar getSMLV(año) / 30 en su lugar
export const FACTOR_SALARIO_MENSUAL_A_HORA = 240; // divisor estándar: 30 días × 8 horas

// --- BANDAS HORARIAS ---
export const INICIO_DIURNA = 6;   // 06:00
export const FIN_DIURNA = 19;     // 19:00
export const INICIO_NOCTURNA = 19; // 19:00
export const FIN_NOCTURNA = 6;    // 06:00 del día siguiente

// --- FACTORES DE RECARGO (sobre valor hora base = 1.0) ---
// Período A: Enero - Junio
// Período B: Julio - Diciembre

export const RECARGOS = {
  // Ordinarios
  HON:    0.35,   // Hora Ordinaria Nocturna (+35%)
  HOD_A:  0.80,   // Hora Ordinaria Dominical Ene-Jun (+80%)
  HOD_B:  0.90,   // Hora Ordinaria Dominical Jul-Dic (+90%)
  HCDN_A: 1.15,   // Hora Compuesta Dom+Noct Ene-Jun (+115%)
  HCDN_B: 1.25,   // Hora Compuesta Dom+Noct Jul-Dic (+125%)

  // Horas Extras
  HED:    0.25,   // Hora Extra Diurna (+25%)
  HEN:    0.75,   // Hora Extra Nocturna (+75%)
  HEDD_A: 1.05,   // HE Diurna Dominical Ene-Jun (+105%)
  HEDD_B: 1.15,   // HE Diurna Dominical Jul-Dic (+115%)
  HEND_A: 1.55,   // HE Nocturna Dominical Ene-Jun (+155%)
  HEND_B: 1.65,   // HE Nocturna Dominical Jul-Dic (+165%)
};

// --- TIPOS DE NOVEDAD ---
export const TIPOS_NOVEDAD = [
  { value: 'vacaciones', label: 'Vacaciones', badge: 'cw-badge--green', color: '#10b981', icon: '🏖️' },
  { value: 'incapacidad_general', label: 'Incapacidad (Enf. General)', badge: 'cw-badge--red', color: '#ef4444', icon: '🏥' },
  { value: 'incapacidad_laboral', label: 'Incapacidad (ARL)', badge: 'cw-badge--red', color: '#b91c1c', icon: '🚑' },
  { value: 'licencia_maternidad', label: 'Licencia de Maternidad', badge: 'cw-badge--pink', color: '#ec4899', icon: '👶' },
  { value: 'licencia_paternidad', label: 'Licencia de Paternidad', badge: 'cw-badge--pink', color: '#f472b6', icon: '👨‍🍼' },
  { value: 'licencia_luto', label: 'Licencia por Luto', badge: 'cw-badge--dark', color: '#374151', icon: '🕊️' },
  { value: 'calamidad_domestica', label: 'Calamidad Doméstica', badge: 'cw-badge--yellow', color: '#f59e0b', icon: '🏠' },
  { value: 'licencia_sufragio', label: 'Licencia por Sufragio', badge: 'cw-badge--blue', color: '#3b82f6', icon: '🗳️' },
  { value: 'licencia_sindical', label: 'Licencia Sindical', badge: 'cw-badge--purple', color: '#8b5cf6', icon: '🤝' },
  { value: 'permiso_remunerado', label: 'Permiso Remunerado', badge: 'cw-badge--teal', color: '#14b8a6', icon: '✅' },
  { value: 'permiso_no_remunerado', label: 'Permiso No Remunerado', badge: 'cw-badge--orange', color: '#f97316', icon: '⏸️' },
  { value: 'suspension', label: 'Suspensión Disciplinaria', badge: 'cw-badge--gray', color: '#6b7280', icon: '⛔' },
  { value: 'otro', label: 'Otro (Especificar)', badge: 'cw-badge--gray', color: '#9ca3af', icon: '📝' },
];

export const ABSENCE_CFG = TIPOS_NOVEDAD.reduce((acc, curr) => {
  acc[curr.value] = curr;
  return acc;
}, {
  // Fallbacks para registros antiguos que ya están en la base de datos
  'incapacidad': { label: 'Incapacidad Médica', badge: 'cw-badge--red', color: '#ef4444', icon: '🏥' },
  'licencia': { label: 'Licencia Remunerada', badge: 'cw-badge--yellow', color: '#f59e0b', icon: '📄' }
});

// --- TIPOS DE TURNO ---
export const TIPOS_TURNO = [
  { value: 'morning', label: 'Turno Mañana', inicio: '06:00', fin: '14:00', color: '#f59e0b' },
  { value: 'afternoon', label: 'Turno Tarde', inicio: '14:00', fin: '22:00', color: '#3b82f6' },
  { value: 'night', label: 'Turno Noche', inicio: '22:00', fin: '06:00', color: '#8b5cf6' },
];

// --- PLANES DE SUSCRIPCIÓN ---
export const PLANES = {
  start: {
    nombre: 'Plan Start',
    descripcion: 'Hasta 25 empleados',
    max_empleados: 25,
    features: ['Rejilla de turnos básica', 'Control de novedades'],
  },
  scale: {
    nombre: 'Plan Scale',
    descripcion: 'Hasta 100 empleados',
    max_empleados: 100,
    features: ['Motor CST Colombia completo', 'Reportes de auditoría contable', 'Exportación CSV/JSON'],
  },
  enterprise: {
    nombre: 'Plan Enterprise',
    descripcion: 'Empleados ilimitados',
    max_empleados: Infinity,
    features: ['Acceso multi-empresa', 'APIs de exportación ERP', 'Soporte prioritario'],
  },
};

// --- ROLES DE USUARIO ---
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  COORDINATOR: 'coordinator',
};

// --- FESTIVOS: se obtienen dinámicamente de la BD ---
// La tabla `festivos` se llena con la función `calcular_festivos_colombia(año)`.
// Usar `fetchFestivos(año)` desde `../hooks/useFestivos.js` para obtenerlos.
// Este array se mantiene como fallback por si la BD no está disponible.
export const FESTIVOS_FALLBACK = [];
