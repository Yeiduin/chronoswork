// ============================================================
// ChronosWork — Edge Function: provision-employee
// Crea un usuario en Supabase Auth para un empleado existente
// usando la service_role key de forma segura (server-side).
//
// v2 — Email institucional basado en nombre del empleado:
//   carlosandresrape@empresa.chronoswork.app
//   Contraseña inicial = número de cédula
//   Login dual: email o cédula
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Normaliza un texto: quita tildes/acentos, convierte a minúscula,
 * elimina todo lo que no sea letra ASCII.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")                        // descompone acentos
    .replace(/[\u0300-\u036f]/g, "")         // elimina diacríticos
    .replace(/ñ/gi, "n")                     // ñ → n (después de NFD queda "ñ" intacta en algunos casos)
    .toLowerCase()
    .replace(/[^a-z]/g, "");                 // solo letras ASCII
}

/**
 * Genera la parte local del email institucional a partir del nombre completo.
 *
 * Reglas colombianas:
 *   - 1 palabra  → se usa completa
 *   - 2 palabras → nombre completo + 2 primeras letras del apellido
 *   - 3 palabras → nombre completo + 2 primeras letras del apellido
 *   - 4+ palabras → nombres completos + 2 primeras letras de cada apellido (últimos 2)
 *
 * Ejemplo: "Carlos Andrés Ramírez Pérez" → "carlosandresrape"
 */
function buildEmailLocalPart(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).map(normalizeText).filter(Boolean);

  if (parts.length === 0) return "empleado";
  if (parts.length === 1) return parts[0];

  if (parts.length === 2) {
    // nombre + apellido
    return parts[0] + parts[1].slice(0, 2);
  }

  if (parts.length === 3) {
    // nombre1 + nombre2 o apellido1 — asumimos: nombre apellido1 apellido2
    // Pero también puede ser: nombre1 nombre2 apellido
    // Heurística colombiana: últimas 1 palabra es apellido si solo hay 3
    const nombres = parts.slice(0, 2).join("");
    const apellido = parts[2].slice(0, 2);
    return nombres + apellido;
  }

  // 4+ palabras: últimas 2 son apellidos, el resto son nombres
  const apellidos = parts.slice(-2);
  const nombres = parts.slice(0, -2);
  const nombresStr = nombres.join("");
  const apellidosStr = apellidos.map(a => a.slice(0, 2)).join("");
  return nombresStr + apellidosStr;
}

/**
 * Genera un slug limpio a partir de la razón social del tenant.
 * "Mi Empresa S.A.S." → "miempresasas"
 */
function buildDomainSlug(razonSocial: string): string {
  const slug = normalizeText(razonSocial);
  return slug || "empresa";
}

/**
 * Busca un email disponible. Si el base ya existe, agrega sufijo numérico (2, 3, 4...).
 * Máximo 99 intentos para evitar loops infinitos.
 *
 * Busca en employees.email_institucional (DB local) que es mucho más eficiente
 * que iterar sobre auth.users.
 */
async function findAvailableEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  localPart: string,
  domain: string,
): Promise<string> {
  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0
      ? `${localPart}@${domain}`
      : `${localPart}${suffix + 1}@${domain}`;

    // Buscar si ya existe un empleado con ese email institucional
    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("email_institucional", candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  // Fallback extremo: usar timestamp
  return `${localPart}${Date.now()}@${domain}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Handler principal ─────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Verificar que el llamador es un admin autenticado ──────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado: falta el token de autenticación." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente con el JWT del usuario que llama (para verificar su rol)
    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar sesión del llamador pasando explícitamente el token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseUserClient.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Token inválido o expirado.", detail: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el llamador es admin operativo (super_admin o coordinator)
    const { data: tenantUser, error: tuError } = await supabaseUserClient
      .from("tenant_users")
      .select("rol, tenant_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (tuError || !tenantUser) {
      return new Response(JSON.stringify({ error: "No se encontró el rol del usuario en el sistema." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["super_admin", "admin", "coordinator"].includes(tenantUser.rol)) {
      return new Response(JSON.stringify({ error: "Acceso denegado: solo los administradores pueden provisionar cuentas de empleados." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerTenantId = tenantUser.tenant_id;

    // ── 2. Leer y validar el body de la solicitud ─────────────────────────
    const body = await req.json();
    const { employee_id, cedula, nombre, email_override } = body;

    if (!employee_id || !cedula || !nombre) {
      return new Response(JSON.stringify({ error: "Parámetros requeridos: employee_id, cedula, nombre." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Verificar que el empleado pertenece al tenant del admin ─────────
    const { data: employee, error: empError } = await supabaseUserClient
      .from("employees")
      .select("id, cedula, nombre, auth_user_id, tenant_id")
      .eq("id", employee_id)
      .eq("tenant_id", callerTenantId)
      .maybeSingle();

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: "Empleado no encontrado o no pertenece a su organización." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (employee.auth_user_id) {
      return new Response(JSON.stringify({ error: "Este empleado ya tiene una cuenta de acceso activa." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Obtener el tenant para generar el dominio del email ─────────────
    const { data: tenant } = await supabaseUserClient
      .from("tenants")
      .select("nit, razon_social")
      .eq("id", callerTenantId)
      .maybeSingle();

    // ── 5. Generar email institucional basado en el nombre ─────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let emailFinal: string;

    if (email_override) {
      // Si se proporciona un email personalizado, usarlo directamente
      emailFinal = email_override;
    } else {
      const localPart = buildEmailLocalPart(nombre);
      const domainSlug = buildDomainSlug(tenant?.razon_social || "empresa");
      const domain = `${domainSlug}.chronoswork.app`;
      emailFinal = await findAvailableEmail(supabaseAdmin, localPart, domain);
    }

    // ── 6. Contraseña inicial = número de cédula ──────────────────────────
    const initialPassword = cedula.toString().trim();

    // Validar que la cédula cumple el mínimo de Supabase (6 chars)
    if (initialPassword.length < 6) {
      return new Response(JSON.stringify({
        error: "La cédula del empleado es demasiado corta para usarla como contraseña inicial (mínimo 6 caracteres)."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 7. Crear el usuario en Supabase Auth usando service_role ──────────
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailFinal,
      password: initialPassword,
      email_confirm: true, // Confirmar email automáticamente (no necesita verificación)
      app_metadata: {
        role: "empleado",
        tenant_id: callerTenantId,
        employee_id: employee_id,
      },
      user_metadata: {
        nombre_completo: nombre,
        cedula: cedula,
        provisioned_by: caller.id,
        provisioned_at: new Date().toISOString(),
      },
    });

    if (createError) {
      // Si el email ya existe, devolver error descriptivo
      if (createError.message?.includes("already")) {
        return new Response(JSON.stringify({
          error: `El correo ${emailFinal} ya está registrado. Use un email personalizado con el campo email_override.`
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw createError;
    }

    const newUserId = newAuthUser.user.id;

    // ── 8. Vincular el auth_user_id y email_institucional al empleado ───────
    // Usamos supabaseAdmin para saltar RLS en esta operación crítica
    const { error: linkError } = await supabaseAdmin
      .from("employees")
      .update({ auth_user_id: newUserId, email_institucional: emailFinal })
      .eq("id", employee_id);

    if (linkError) {
      // Rollback: eliminar el usuario Auth recién creado
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Error al vincular la cuenta: ${linkError.message}`);
    }

    // ── 9. Crear entrada en tenant_users para el nuevo empleado ───────────
    const { error: tuInsertError } = await supabaseAdmin
      .from("tenant_users")
      .upsert({
        user_id: newUserId,
        tenant_id: callerTenantId,
        rol: "empleado",
      }, { onConflict: "user_id,tenant_id" });

    if (tuInsertError) {
      // Rollback completo
      await supabaseAdmin.from("employees").update({ auth_user_id: null }).eq("id", employee_id);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Error al registrar el rol del empleado: ${tuInsertError.message}`);
    }

    // ── 10. Respuesta exitosa ─────────────────────────────────────────────
    return new Response(JSON.stringify({
      success: true,
      message: "Cuenta de empleado creada exitosamente.",
      credentials: {
        email: emailFinal,
        password: initialPassword,
        employee_id: employee_id,
        auth_user_id: newUserId,
        nota: "⚠️ La contraseña inicial es el número de cédula del colaborador. Puede ingresar con su correo o con su número de cédula.",
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[provision-employee] Error:", err);
    return new Response(JSON.stringify({
      error: "Error interno del servidor.",
      detail: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
