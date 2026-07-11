import { createCrudHook } from './createCrudHook';

// ─── Factory: hook CRUD base para absences ────────────────────────────────────
const useCrudAbsences = createCrudHook({
  tableName: 'absences',
  selectQuery: `
    *,
    employees(
      nombre,
      cedula,
      cargo,
      area_employees(areas(nombre))
    )
  `,
  queryModifier: (query) => query.order('fecha_inicio', { ascending: false }),
});

// ─── Hook público (preserva API original) ─────────────────────────────────────
export function useAbsences() {
  const { data: absences, loading, error, fetch: fetchAbsences, create: createAbsence, update: updateAbsence, remove: deleteAbsence } = useCrudAbsences();

  /**
   * Verifica si un empleado tiene novedad activa en un rango de fechas.
   */
  const tieneNovedad = (employeeId, fecha) =>
    absences.some(a =>
      a.employee_id === employeeId &&
      (a.estado === 'aprobada' || a.aprobada === true) && // Fallback compatibilidad temporal
      fecha >= a.fecha_inicio &&
      fecha <= a.fecha_fin
    );

  /**
   * Obtiene la novedad activa para un empleado en una fecha dada.
   */
  const getNovedad = (employeeId, fecha) =>
    absences.find(a =>
      a.employee_id === employeeId &&
      (a.estado === 'aprobada' || a.aprobada === true) &&
      fecha >= a.fecha_inicio &&
      fecha <= a.fecha_fin
    );

  /**
   * Actualiza el estado de una novedad (Aprobar/Rechazar)
   */
  const updateAbsenceStatus = async (id, nuevoEstado) => {
    return updateAbsence(id, { estado: nuevoEstado, aprobada: nuevoEstado === 'aprobada' });
  };

  return { absences, loading, error, fetchAbsences, createAbsence, updateAbsenceStatus, deleteAbsence, tieneNovedad, getNovedad };
}
