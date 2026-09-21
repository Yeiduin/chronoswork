import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Ejecuta una función asíncrona con reintentos automáticos ante fallos de red.
 * Útil para operaciones Supabase en conexiones inestables.
 *
 * @template T
 * @param {() => Promise<T>} fn - Función a ejecutar (ej: una query Supabase)
 * @param {object} [options]
 * @param {number} [options.maxRetries=2] - Máximo de reintentos
 * @param {number} [options.baseDelay=1000] - Espera base entre reintentos (ms)
 * @param {number} [options.maxDelay=5000] - Espera máxima entre reintentos
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxRetries = 3, baseDelay = 800, maxDelay = 4000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      if (res && res.error) {
        const err = res.error;
        const isNetworkError = !err.code || err.code === 'NETWORK_ERROR' ||
          String(err.message || '').includes('Failed to fetch') ||
          String(err.message || '').includes('NetworkError') ||
          String(err.message || '').includes('ERR_CONNECTION') ||
          String(err.message || '').includes('timeout') ||
          String(err.message || '').includes('Timeout') ||
          err.status === 0 ||
          err.status == null;
        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 300, maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err;
      const isNetworkError = !err.code || err.code === 'NETWORK_ERROR' ||
        String(err.message || '').includes('Failed to fetch') ||
        String(err.message || '').includes('NetworkError') ||
        String(err.message || '').includes('ERR_CONNECTION') ||
        String(err.message || '').includes('timeout') ||
        String(err.message || '').includes('Timeout') ||
        err.status === 0 ||
        err.status == null;
      if (!isNetworkError || attempt >= maxRetries) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 300, maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
