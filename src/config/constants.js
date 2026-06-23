// ============================================================
// CONSTANTES GLOBALES DEL SISTEMA ChronosWork
// CST Colombia - Ley 2101 de 2021 + Ley 2466 de 2025
// ============================================================

// --- LÍMITES LEGALES DE JORNADA ---
export const MAX_HORAS_SEMANALES = 42;         // Ley 2101/2021
export const MAX_EXTRAS_DIARIAS = 2;
export const MAX_EXTRAS_SEMANALES = 12;

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
  { value: 'vacaciones', label: 'Vacaciones', color: '#10b981' },
  { value: 'incapacidad', label: 'Incapacidad Médica', color: '#ef4444' },
  { value: 'licencia', label: 'Licencia Remunerada', color: '#f59e0b' },
  { value: 'suspension', label: 'Suspensión', color: '#6b7280' },
];

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
