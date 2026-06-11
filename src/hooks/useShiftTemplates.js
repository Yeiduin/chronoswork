import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useShiftTemplates(areaId = null) {
  const { tenant } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      let query = supabase
        .from('shift_templates')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .order('hora_inicio');

      if (areaId === 'global') {
        query = query.is('area_id', null);
      } else if (areaId) {
        query = query.eq('area_id', areaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, areaId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const createTemplate = async (templateData) => {
    const { data, error } = await supabase
      .from('shift_templates')
      .insert([{ ...templateData, tenant_id: tenant.id }])
      .select()
      .single();
    if (error) throw error;
    await fetchTemplates();
    return data;
  };

  const updateTemplate = async (id, updates) => {
    const { data, error } = await supabase
      .from('shift_templates')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (error) throw error;
    await fetchTemplates();
    return data;
  };

  const deleteTemplate = async (id) => {
    const { error } = await supabase
      .from('shift_templates')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (error) throw error;
    await fetchTemplates();
  };

  /**
   * Calcula las horas de un turno (considera cruce de medianoche)
   */
  const calcHoras = (template) => {
    const [h1, m1] = template.hora_inicio.split(':').map(Number);
    const [h2, m2] = template.hora_fin.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0) mins += 24 * 60; // cruza medianoche
    return mins / 60;
  };

  return {
    templates, loading, fetchTemplates,
    createTemplate, updateTemplate, deleteTemplate,
    calcHoras,
  };
}
