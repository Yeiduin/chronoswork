import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useDemandSlots(areaId) {
  const { tenant } = useAuth();
  const [demandSlots, setDemandSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDemandSlots = useCallback(async () => {
    if (!tenant || !areaId) {
      setDemandSlots([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('area_demand_slots')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('area_id', areaId)
        .order('day_of_week')
        .order('start_hour');
      if (err) throw err;
      setDemandSlots(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant, areaId]);

  useEffect(() => {
    fetchDemandSlots();
  }, [fetchDemandSlots]);

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
      // Reemplazo completo: borrar viejo grupo, insertar nuevo con el mismo groupId
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
        group_id: groupId, // Mantenemos el ID
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

  return {
    demandSlots, loading, error, fetchDemandSlots,
    createDemandSlotGroup, updateDemandSlotGroup, deleteDemandSlotGroup
  };
}
