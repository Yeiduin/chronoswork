import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import { useAuth } from '../context/AuthContext';
import { createCrudHook } from './createCrudHook';
import { DEFAULT_HORAS_MENSUALES } from '../config/constants';

// ─── Factory: hook base para areas (solo fetch + estado + soft delete) ────────
const useCrudAreas = createCrudHook({
  tableName: 'areas',
  selectQuery: `
    *,
    area_demand_slots(*),
    area_employees(
      id,
      employee_id,
      employees(
        id, nombre, cedula, cargo, valor_hora, tipo_contrato, es_especial,
        activo, horas_semanales_contrato, dias_descanso_semana,
        jornada_preferida, solo_diurno, solo_nocturno, permite_partido,
        horas_max_diarias, horas_nocturnas_max_semana, horas_max_semana,
        dias_descanso_fijos, turno_predeterminado_id
      )
    )
  `,
  softDelete: true,
  queryModifier: (query) => query.eq('activo', true).order('nombre'),
});

// ─── Helper: sanitizar campos numéricos vacíos → null ─────────────────────────
function sanitizeNumeric(raw) {
  const NUMERIC_FIELDS = [
    'min_empleados_noche', 'min_empleados_dia', 'max_empleados_dia',
    'min_horas_turno_override', 'max_horas_turno_override',
    'slots_por_hora', 'snap_turnos_minutos', 'valor_hora_default',
    'duracion_jornada_horas', 'dias_descanso', 'dias_descanso_default',
    'horas_extras_max_dia', 'horas_extras_max_semana',
    'descanso_min_entre_jornadas', 'dotacion_periodicidad_meses',
    'break_minutos', 'nivel_riesgo_arl',
  ];
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (NUMERIC_FIELDS.includes(k)) {
      const empty = v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
      out[k] = empty ? null : (isNaN(Number(v)) ? null : Number(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Hook público (preserva API original) ─────────────────────────────────────
export function useAreas() {
  const { tenant } = useAuth();
  const {
    data: areas,
    loading,
    error,
    fetch: fetchAreas,
    remove: deleteArea,
  } = useCrudAreas();

  // ═══ createArea: lógica específica (franjas_iniciales) ═════════════════════
  const createArea = async (areaData) => {
    const { franjas_iniciales, ...raw } = areaData;
    const dataToInsert = sanitizeNumeric(raw);
    // 1. Insertar el área
    const { data, error: insErr } = await supabase
      .from('areas')
      .insert([{ ...dataToInsert, tenant_id: tenant.id }])
      .select()
      .single();
    if (insErr) throw insErr;

    // 2. Si se pidió franjas típicas del sector, las creamos automáticamente
    if (franjas_iniciales?.length) {
      const templatesToInsert = franjas_iniciales.map(t => ({
        tenant_id: tenant.id,
        area_id: data.id,
        nombre: t.nombre,
        hora_inicio: t.hora_inicio,
        hora_fin: t.hora_fin,
        cruza_medianoche: t.cruza_medianoche || false,
        color: t.color || '#3b82f6',
        shift_kind: t.shift_kind || 'STANDARD',
        activo: true,
      }));
      const { error: tplErr } = await supabase.from('shift_templates').insert(templatesToInsert);
      if (tplErr) logger.warn('useAreas', 'Error al crear franjas iniciales:', tplErr.message);
    } else {
      // Si no, copiamos las globales como respaldo
      const { data: globalTemplates, error: globErr } = await supabase
        .from('shift_templates')
        .select('nombre, hora_inicio, hora_fin, cruza_medianoche, color, shift_kind, activo')
        .eq('tenant_id', tenant.id)
        .is('area_id', null)
        .eq('activo', true);

      if (globErr) {
        logger.warn('useAreas', 'Error al leer plantillas globales:', globErr.message);
      } else if (globalTemplates && globalTemplates.length > 0) {
        const templatesToInsert = globalTemplates.map(t => ({
          ...t,
          area_id: data.id,
          tenant_id: tenant.id
        }));
        const { error: tplErr } = await supabase.from('shift_templates').insert(templatesToInsert);
        if (tplErr) logger.warn('useAreas', 'Error al crear plantillas de respaldo:', tplErr.message);
      }
    }

    await fetchAreas();
    return data;
  };

  // ═══ updateArea: lógica específica ════════════════════════════════════════
  // La propagación de valor_hora_default a empleados se hace solo si el
  // caller lo solicita explícitamente (propagarSalario: true), para evitar
  // recálculos retroactivos de nómina sin consentimiento del usuario.
  const updateArea = async (id, updates) => {
    const { franjas_iniciales, propagarSalario, ...raw } = updates;
    const dataToUpdate = sanitizeNumeric(raw);
    const { data, error: updErr } = await supabase
      .from('areas')
      .update(dataToUpdate)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (updErr) throw updErr;

    // Propagar valor_hora_default y salario_mensual a empleados no especiales SOLO si se solicitó
    if (propagarSalario && updates.valor_hora_default !== undefined) {
      const { data: areaEmps, error: empErr } = await supabase
        .from('area_employees')
        .select('employee_id')
        .eq('area_id', id)
        .eq('tenant_id', tenant.id);
      if (empErr) logger.warn('useAreas', 'Error al leer empleados del área:', empErr.message);

      if (areaEmps && areaEmps.length > 0) {
        const empIds = areaEmps.map(ae => ae.employee_id);
        const { data: empsToUpdate, error: empReadErr } = await supabase
          .from('employees')
          .select('id, horas_mensuales_contrato, horas_semanales_contrato')
          .in('id', empIds)
          .eq('es_especial', false)
          .eq('tenant_id', tenant.id);

        if (empReadErr) {
          logger.warn('useAreas', 'Error al leer datos de empleados para propagar salario:', empReadErr.message);
        } else if (empsToUpdate && empsToUpdate.length > 0) {
          const newValorHora = parseFloat(updates.valor_hora_default);
          const updatePromises = empsToUpdate.map(emp => {
            const horasMensuales = emp.horas_mensuales_contrato || (emp.horas_semanales_contrato ? Math.round(emp.horas_semanales_contrato * 4.333) : DEFAULT_HORAS_MENSUALES);
            const newSalarioMensual = Math.round(newValorHora * horasMensuales);
            return supabase
              .from('employees')
              .update({
                valor_hora: newValorHora,
                salario_mensual: newSalarioMensual,
              })
              .eq('id', emp.id)
              .eq('tenant_id', tenant.id);
          });
          const results = await Promise.all(updatePromises);
          const hasError = results.some(r => r.error);
          if (hasError) logger.warn('useAreas', 'Error al propagar salario en algunos empleados');
        }
      }
    }

    await fetchAreas();
    return data;
  };

  // ═══ Operaciones adicionales (no cubiertas por la factory) ═════════════════

  const deleteAllAreas = async () => {
    const { error: delErr } = await supabase
      .from('areas')
      .update({ activo: false })
      .eq('tenant_id', tenant.id)
      .eq('activo', true);
    if (delErr) throw delErr;
    await fetchAreas();
  };

  /** Asigna un empleado a un área (remueve de la anterior si tenía) */
  const assignEmployee = async (areaId, employeeId) => {
    // Validar que areaId pertenece al tenant actual (anti cross-tenant).
    const areaPertenece = areas.some(a => a.id === areaId);
    if (!areaPertenece) {
      throw new Error(`El área ${areaId} no pertenece al tenant actual.`);
    }

    const { error: delErr } = await supabase
      .from('area_employees')
      .delete()
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenant.id);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase
      .from('area_employees')
      .insert([{ area_id: areaId, employee_id: employeeId, tenant_id: tenant.id }]);
    if (insErr) throw insErr;
    await fetchAreas();
  };

  /** Remueve un empleado de su área */
  const removeEmployee = async (employeeId) => {
    const { error: delErr } = await supabase
      .from('area_employees')
      .delete()
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenant.id);
    if (delErr) throw delErr;
    await fetchAreas();
  };

  const getAreaEmployees = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    return area?.area_employees?.map(ae => ae.employees).filter(Boolean) || [];
  };

  const getEmployeeArea = (employeeId) => {
    return areas.find(a =>
      a.area_employees?.some(ae => ae.employee_id === employeeId)
    ) || null;
  };

  return {
    areas, loading, error, fetchAreas,
    createArea, updateArea, deleteArea, deleteAllAreas,
    assignEmployee, removeEmployee,
    getAreaEmployees, getEmployeeArea,
  };
}
