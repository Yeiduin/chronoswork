import { createCrudHook } from './createCrudHook';

// ─── Factory: hook CRUD base para shift_templates ─────────────────────────────
const useCrudTemplates = createCrudHook({
  tableName: 'shift_templates',
  softDelete: true,
  queryModifier: (query, _tenant, areaId) => {
    query = query.eq('activo', true).order('hora_inicio');
    if (areaId === 'global') {
      query = query.is('area_id', null);
    } else if (areaId) {
      query = query.eq('area_id', areaId);
    }
    return query;
  },
  // Silenciar error (hook original solo hacía console.error, no exponía error)
});

/**
 * Calcula las horas de un turno (considera cruce de medianoche).
 */
function calcHoras(template) {
  const [h1, m1] = template.hora_inicio.split(':').map(Number);
  const [h2, m2] = template.hora_fin.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

// ─── Hook público (preserva API original) ─────────────────────────────────────
export function useShiftTemplates(areaId = null) {
  const crud = useCrudTemplates(areaId);

  // El hook original no exponía error; solo console.error en catch.
  // Silenciamos errores para mantener compatibilidad.
  // (Si en el futuro se quiere exponer, basta con retornar crud.error.)

  return {
    templates: crud.data,
    loading: crud.loading,
    fetchTemplates: crud.fetch,
    createTemplate: crud.create,
    updateTemplate: crud.update,
    deleteTemplate: crud.remove,
    calcHoras,
  };
}
