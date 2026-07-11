// ============================================================
// LOGGER CENTRALIZADO — ChronosWork
// - error / warn / debug: solo desarrollo (condicional isProduction)
// - info: siempre visible (métricas/diagnóstico en producción)
// En build prod, el plugin @rollup/plugin-strip solo elimina
// console.log/debug/dir/table/trace. console.error/warn/info se
// conservan para que el logger funcione según su diseño.
// ============================================================

const isProduction = import.meta.env.PROD || import.meta.env.VITE_ENV === 'production';

/**
 * Logger centralizado.
 * - error / warn / debug: solo desarrollo.
 * - info: siempre visible (métricas/diagnóstico en producción también).
 */
export const logger = {
  /**
   * Error — solo se muestra en desarrollo o si force=true
   */
  error(context, ...args) {
    if (!isProduction) {
      console.error(`[${context}]`, ...args);
    }
  },

  /**
   * Warning — solo se muestra en desarrollo o si force=true
   */
  warn(context, ...args) {
    if (!isProduction) {
      console.warn(`[${context}]`, ...args);
    }
  },

  /**
   * Info — siempre visible (para métricas/diagnóstico en producción también)
   */
  info(context, ...args) {
    console.info(`[${context}]`, ...args);
  },

  /**
   * Debug — solo desarrollo
   */
  debug(context, ...args) {
    if (!isProduction) {
      console.debug(`[${context}]`, ...args);
    }
  },
};

export default logger;
