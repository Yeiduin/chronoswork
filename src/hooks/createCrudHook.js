import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * Hook factory genérico para operaciones CRUD sobre tablas de Supabase.
 *
 * Elimina el boilerplate repetido de: estado (data/loading/error),
 * fetch con filtro tenant_id, create/update/delete con invalidación.
 *
 * @param {object|string} tableOrOptions - Nombre de tabla (string) u objeto de opciones.
 * @param {string}  options.tableName        - Nombre de la tabla en Supabase.
 * @param {string}  [options.selectQuery='*']- Columnas a seleccionar (incluyendo joins).
 * @param {number}  [options.cacheTTL=0]     - TTL de caché en ms (0 = sin caché).
 * @param {boolean} [options.softDelete=false]- Si true, usa UPDATE activo=false en vez de DELETE.
 * @param {Function} [options.queryModifier]  - (query, tenant, ...hookParams) => query modificada.
 * @param {Function} [options.transformResponse]- (data, tenant) => data transformada tras fetch.
 * @param {Function} [options.beforeCreate]   - (payload, tenant) => payload sanitizado.
 * @param {Function} [options.beforeUpdate]   - (payload, tenant) => payload sanitizado.
 * @param {Function} [options.afterCreate]    - (data, tenant) => void|Promise.
 * @param {Function} [options.afterUpdate]    - (data, tenant) => void|Promise.
 * @param {Function} [options.afterDelete]    - (id, tenant) => void|Promise.
 * @param {Function} [options.guard]          - (tenant, ...hookParams) => boolean. Si retorna false, no se fetchea y data=[]
 * @param {Array}   [options.extraDeps=[]]    - Dependencias extra para el useCallback del fetch.
 * @returns {Function} Hook de React ya configurado.
 *
 * El hook retornado recibe (...hookParams) y devuelve:
 *   { data, loading, error, fetch, create, update, remove, invalidate }
 */
export function createCrudHook(tableOrOptions) {
  const {
    tableName,
    selectQuery = '*',
    cacheTTL = 0,
    softDelete = false,
    queryModifier = null,
    transformResponse = null,
    beforeCreate = null,
    beforeUpdate = null,
    afterCreate = null,
    afterUpdate = null,
    afterDelete = null,
    guard = null,
    extraDeps = [],
  } = typeof tableOrOptions === 'string'
    ? { tableName: tableOrOptions }
    : tableOrOptions;

  if (!tableName) {
    throw new Error('[createCrudHook] tableName es requerido.');
  }

  return function useCrudEntity(...hookParams) {
    const { tenant } = useAuth();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    // ── Caché opcional ──────────────────────────────────────────
    const cacheRef = useRef({ data: null, ts: 0, key: null });

    useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
    }, []);

    const buildBaseQuery = useCallback(() => {
      return supabase.from(tableName).select(selectQuery).eq('tenant_id', tenant?.id);
    }, [tenant?.id]);

    const fetch = useCallback(async (force = false) => {
      if (!tenant) return;

      // Guard: si la condición no se cumple, limpiar y salir
      if (guard && !guard(tenant, ...hookParams)) {
        if (mountedRef.current) setData([]);
        return;
      }

      // Caché (incluye tenant.id en la key para evitar leaks entre tenants)
      const cacheKey = tenant.id + (hookParams.length ? '::' + JSON.stringify(hookParams) : '');
      if (
        !force &&
        cacheTTL > 0 &&
        cacheRef.current.key === cacheKey &&
        cacheRef.current.data &&
        Date.now() - cacheRef.current.ts < cacheTTL
      ) {
        if (mountedRef.current) setData(cacheRef.current.data);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        let query = buildBaseQuery();
        if (queryModifier) {
          query = queryModifier(query, tenant, ...hookParams);
        }
        const { data: result, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        const transformed = transformResponse
          ? transformResponse(result || [], tenant)
          : (result || []);
        if (cacheTTL > 0) {
          cacheRef.current = { data: transformed, ts: Date.now(), key: cacheKey };
        }
        if (mountedRef.current) setData(transformed);
      } catch (err) {
        if (mountedRef.current) setError(err.message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }, [tenant, buildBaseQuery, ...hookParams, ...extraDeps]);

    useEffect(() => {
      fetch();
    }, [fetch]);

    const invalidate = useCallback(() => {
      cacheRef.current.ts = 0;
      return fetch(true);
    }, [fetch]);

    // ── CRUD ────────────────────────────────────────────────────
    const create = useCallback(async (payload) => {
      const processed = beforeCreate ? beforeCreate(payload, tenant) : payload;
      const { data: result, error: insErr } = await supabase
        .from(tableName)
        .insert([{ ...processed, tenant_id: tenant.id }])
        .select()
        .single();
      if (insErr) throw insErr;
      if (afterCreate) await afterCreate(result, tenant);
      await invalidate();
      return result;
    }, [tenant, invalidate]);

    const update = useCallback(async (id, updates) => {
      const processed = beforeUpdate ? beforeUpdate(updates, tenant) : updates;
      const { data: result, error: updErr } = await supabase
        .from(tableName)
        .update(processed)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .single();
      if (updErr) throw updErr;
      if (afterUpdate) await afterUpdate(result, tenant);
      await invalidate();
      return result;
    }, [tenant, invalidate]);

    const remove = useCallback(async (id) => {
      let opErr;
      if (softDelete) {
        const { error: err } = await supabase
          .from(tableName)
          .update({ activo: false })
          .eq('id', id)
          .eq('tenant_id', tenant.id);
        opErr = err;
      } else {
        const { error: err } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenant.id);
        opErr = err;
      }
      if (opErr) throw opErr;
      if (afterDelete) await afterDelete(id, tenant);
      await invalidate();
    }, [tenant, invalidate]);

    return { data, loading, error, setError, setLoading, fetch, create, update, remove, invalidate };
  };
}
