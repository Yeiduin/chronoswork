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
export async function withRetry(fn, { maxRetries = 2, baseDelay = 1000, maxDelay = 5000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Solo reintentar en errores de red/conección, no en errores de aplicación
      const isNetworkError = !err.code || err.code === 'NETWORK_ERROR' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('ERR_CONNECTION') ||
        err.message?.includes('timeout') ||
        err.message?.includes('Timeout') ||
        err.status === 0 ||
        err.status == null;
      if (!isNetworkError || attempt >= maxRetries) throw err;
      // Espera exponencial con jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
