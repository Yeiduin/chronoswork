import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { createCrudHook } from './createCrudHook';

// ─── Factory: hook base para area_demand_slots (solo fetch + estado) ──────────
const useCrudSlots = createCrudHook({
  tableName: 'area_demand_slots',
  guard: (_tenant, areaId) => !!areaId,       // si no hay areaId, data = []
  queryModifier: (query, _tenant, areaId) =>
    query.eq('area_id', areaId).order('day_of_week').order('start_hour'),
});

// ─── Hook público (preserva API original) ─────────────────────────────────────
export function useDemandSlots(areaId) {
  const { tenant } = useAuth();
  const { data: demandSlots, loading, error, setError, fetch: fetchDemandSlots } = useCrudSlots(areaId);

  // ── Operaciones de grupo (no estándar CRUD) ──────────────────────────────────

  const createDemandSlotGroup = async (days, start_hour, end_hour, required_staff) => {
    if (!tenant || !areaId || !days.length) return;
    try {
      const groupId = crypto.randomUUID();
      const inserts = days.map(d => ({
        tenant_id: tenant.id,
        area_id: areaId,
        group_id: groupId,
        day_of_week: d,
        start_hour,
        end_hour,
        required_staff
      }));
      const { data, error: err } = await supabase
        .from('area_demand_slots')
        .insert(inserts)
        .select();
      if (err) throw err;
      await fetchDemandSlots();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateDemandSlotGroup = async (groupId, days, start_hour, end_hour, required_staff) => {
    if (!tenant || !areaId) return;
    try {
      const { error: delErr } = await supabase
        .from('area_demand_slots')
        .delete()
        .eq('group_id', groupId)
        .eq('tenant_id', tenant.id);
      if (delErr) throw delErr;

      if (days.length === 0) {
        await fetchDemandSlots();
        return;
      }

      const inserts = days.map(d => ({
        tenant_id: tenant.id,
        area_id: areaId,
        group_id: groupId,
        day_of_week: d,
        start_hour,
        end_hour,
        required_staff
      }));

      const { data, error: insErr } = await supabase
        .from('area_demand_slots')
        .insert(inserts)
        .select();
      if (insErr) throw insErr;

      await fetchDemandSlots();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteDemandSlotGroup = async (groupId) => {
    if (!tenant) return;
    try {
      const { error: err } = await supabase
        .from('area_demand_slots')
        .delete()
        .eq('group_id', groupId)
        .eq('tenant_id', tenant.id);
      if (err) throw err;
      await fetchDemandSlots();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Reemplaza TODOS los slots de los días indicados en una sola operación atómica:
   * 1) Borra todos los slots de esos días (una sola query DELETE con IN)
   * 2) Inserta todos los segmentos en un solo INSERT batch
   * 3) Hace UN SOLO fetchDemandSlots al final
   *
   * Esto evita los N fetches intermedios que causaban N scrolls.
   *
   * @param {number[]} days      - Array de day_of_week (1-7)
   * @param {{ start_hour, end_hour, required_staff }[]} segments
   */
  const bulkReplaceDaySlots = async (days, segments) => {
    if (!tenant || !areaId || !days.length) return;
    try {
      // 1. Borrar todos los slots de esos días en una query
      const { error: delErr } = await supabase
        .from('area_demand_slots')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('area_id', areaId)
        .in('day_of_week', days);
      if (delErr) throw delErr;

      // 2. Insertar todos los segmentos × días en un solo batch
      if (segments.length > 0) {
        const inserts = segments.flatMap(seg => {
          const groupId = crypto.randomUUID(); // un group_id por segmento
          return days.map(d => ({
            tenant_id:      tenant.id,
            area_id:        areaId,
            group_id:       groupId,
            day_of_week:    d,
            start_hour:     seg.start_hour,
            end_hour:       seg.end_hour,
            required_staff: seg.required_staff,
          }));
        });
        const { error: insErr } = await supabase
          .from('area_demand_slots')
          .insert(inserts);
        if (insErr) throw insErr;
      }

      // 3. UN SOLO fetch — los datos ya son correctos, el draft no colapsa
      await fetchDemandSlots();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    demandSlots, loading, error, fetchDemandSlots,
    createDemandSlotGroup, updateDemandSlotGroup, deleteDemandSlotGroup,
    bulkReplaceDaySlots,
  };
}
