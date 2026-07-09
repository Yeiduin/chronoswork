import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import { esDominicalOFestivo } from '../core/dateUtils';

/**
 * Hook para obtener los festivos colombianos desde la BD.
 * Reemplaza el array hardcodeado FESTIVOS_2026.
 * 
 * @param {number} anio - Año para consultar festivos (default: año actual)
 * @returns {{ festivos: string[], loading: boolean, error: string|null }}
 */
export function useFestivos(anio = null) {
  const [festivos, setFestivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const year = anio || new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('festivos')
      .select('fecha')
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)
      .order('fecha')
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          logger.warn('useFestivos', 'Error cargando festivos:', err.message);
          setError(err.message);
          setFestivos([]);
        } else {
          setFestivos((data || []).map(f => f.fecha));
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year]);

  return { festivos, loading, error };
}

// Re-exportamos esDominicalOFestivo desde dateUtils.js (fuente única de verdad)
export { esDominicalOFestivo };
