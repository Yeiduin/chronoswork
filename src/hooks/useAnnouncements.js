import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const TZ = 'America/Bogota';

function colTodayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function useAnnouncements() {
  const { tenant, user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const uploadImage = useCallback(async (file, tenantId) => {
    const filePath = `${tenantId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('anuncios')
      .upload(filePath, file);
    if (uploadError) throw new Error('Error al subir imagen: ' + uploadError.message);
    const { data: publicUrlData } = supabase.storage
      .from('anuncios')
      .getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const today = colTodayStr();
      const { data, error: fetchError } = await supabase
        .from('anuncios')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .lte('fecha_inicio', today)
        .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      if (mountedRef.current) setAnnouncements(data || []);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const createAnnouncement = async (data) => {
    const { imageFile, ...payload } = data;
    if (imageFile && tenant?.id) {
      payload.media_url = await uploadImage(imageFile, tenant.id);
    }
    payload.tenant_id = tenant.id;
    payload.created_by = user?.id;
    const { data: result, error: insError } = await supabase
      .from('anuncios')
      .insert([payload])
      .select()
      .single();
    if (insError) throw insError;
    await fetchAnnouncements();
    return result;
  };

  const updateAnnouncement = async (id, data) => {
    const { imageFile, ...payload } = data;
    if (imageFile && tenant?.id) {
      payload.media_url = await uploadImage(imageFile, tenant.id);
    }
    const { data: result, error: updError } = await supabase
      .from('anuncios')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();
    if (updError) throw updError;
    await fetchAnnouncements();
    return result;
  };

  const deleteAnnouncement = async (id) => {
    const { error: delError } = await supabase
      .from('anuncios')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (delError) throw delError;
    await fetchAnnouncements();
  };

  return {
    announcements, loading, error, fetchAnnouncements,
    createAnnouncement, updateAnnouncement, deleteAnnouncement,
  };
}
