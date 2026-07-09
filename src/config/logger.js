// ============================================================
// LOGGER CENTRALIZADO — ChronosWork
// En producción (VITE_ENV=production o build), los logs se silencian.
// En desarrollo, se mantienen para debugging.
// ============================================================

const isProduction = import.meta.env.PROD || import.meta.env.VITE_ENV === 'production';

/**
 * Logger centralizado. Reemplaza console.error/warn en todo el proyecto.
 * En producción, los mensajes se suprimen. En desarrollo, se muestran normalmente.
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
