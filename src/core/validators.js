// ============================================================
// VALIDADORES DE NEGOCIO — ChronosWork
// ============================================================

/**
 * Valida formato de cédula colombiana (numérico, 5-10 dígitos)
 */
export function validarCedula(cedula) {
  const cleaned = String(cedula).replace(/\D/g, '');
  if (cleaned.length < 5 || cleaned.length > 12) {
    return { valid: false, message: 'La cédula debe tener entre 5 y 12 dígitos numéricos.' };
  }
  return { valid: true };
}

/**
 * Valida NIT colombiano (formato XXXXXXXXX-D)
 */
export function validarNIT(nit) {
  const cleaned = String(nit).replace(/[^0-9-]/g, '');
  const regex = /^\d{8,9}-?\d$/;
  if (!regex.test(cleaned)) {
    return { valid: false, message: 'El NIT debe tener formato XXXXXXXXX-D (ej: 900123456-7).' };
  }
  return { valid: true };
}

/**
 * Valida que el valor de hora sea positivo y mayor a 0
 */
export function validarValorHora(valor) {
  const num = parseFloat(String(valor).replace(/,/g, ''));
  if (isNaN(num) || num <= 0) {
    return { valid: false, message: 'Ingrese un valor de hora válido mayor a 0.' };
  }
  if (num < 5000) {
    return { valid: false, message: 'El valor mínimo por hora en 2026 es $5.000 COP.' };
  }
  if (num > 2000000) {
    return { valid: false, message: 'El valor de hora no puede superar $2.000.000 COP.' };
  }
  return { valid: true };
}

/**
 * Valida formato de email
 */
export function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valid: false, message: 'El correo electrónico no tiene un formato válido.' };
  }
  return { valid: true };
}

/**
 * Valida contraseña (mínimo 8 caracteres, con letras y números)
 */
export function validarPassword(password) {
  if (password.length < 8) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos una letra.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos un número.' };
  }
  return { valid: true };
}

/**
 * Valida que una fecha de fin sea posterior a la de inicio
 */
export function validarRangoFechas(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (fin < inicio) {
    return { valid: false, message: 'La fecha fin debe ser igual o posterior a la fecha de inicio.' };
  }
  return { valid: true };
}

/**
 * Valida que un nombre no esté vacío y tenga al menos 2 palabras
 */
export function validarNombre(nombre) {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length < 2) {
    return { valid: false, message: 'Ingrese nombre y apellido completos.' };
  }
  return { valid: true };
}

/**
 * Formatea un número como moneda COP
 */
export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor);
}

/**
 * Detecta si el input de login es un número de cédula (solo dígitos, 5-15 chars).
 */
export function isCedulaInput(input) {
  const cleaned = String(input).trim();
  return /^\d{5,15}$/.test(cleaned);
}

/**
 * Valida un identificador de login: acepta email válido O número de cédula.
 * Retorna { valid, isCedula, message? }
 */
export function validarLoginIdentifier(input) {
  const trimmed = String(input).trim();
  if (!trimmed) {
    return { valid: false, isCedula: false, message: 'Ingrese su correo o número de cédula.' };
  }

  // Si parece cédula (solo dígitos)
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length < 5 || trimmed.length > 15) {
      return { valid: false, isCedula: true, message: 'El número de cédula debe tener entre 5 y 15 dígitos.' };
    }
    return { valid: true, isCedula: true };
  }

  // Si contiene @, validar como email
  if (trimmed.includes('@')) {
    const emailResult = validarEmail(trimmed);
    return { ...emailResult, isCedula: false };
  }

  // No es ni email ni cédula
  return { valid: false, isCedula: false, message: 'Ingrese un correo electrónico válido o su número de cédula.' };
}

