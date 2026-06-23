// ============================================================
// ChronosWork — Edge Function: provision-employee
// Crea un usuario en Supabase Auth para un empleado existente
// usando la service_role key de forma segura (server-side).
//
// Despliegue: Supabase Dashboard → Edge Functions → New Function
// Nombre de la función: provision-employee
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ── Helpers ──────────────────────────────────────────────────

function generateSecurePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$%&*";
  const all = upper + lower + digits + special;

  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);

  let password = "";
  // Garantizar al menos un caracter de cada categoría
  password += upper[arr[0] % upper.length];
  password += lower[arr[1] % lower.length];
  password += digits[arr[2] % digits.length];
  password += special[arr[3] % special.length];

  for (let i = 4; i < length; i++) {
    password += all[arr[i] % all.length];
  }

  // Mezclar el password para no predecir el patrón
  return password.split("").sort(() => Math.random() - 0.5).join("");
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

    // ── 4. Obtener el NIT del tenant para generar el email institucional ───
    const { data: tenant } = await supabaseUserClient
      .from("tenants")
      .select("nit, razon_social")
      .eq("id", callerTenantId)
      .maybeSingle();

    const nitSlug = (tenant?.nit || "empresa").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const emailBase = email_override || `${cedula}@${nitSlug}.chronoswork.internal`;

    // ── 5. Generar contraseña temporal segura ─────────────────────────────
    const tempPassword = generateSecurePassword(14);

    // ── 6. Crear el usuario en Supabase Auth usando service_role ──────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailBase,
      password: tempPassword,
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
          error: `El correo ${emailBase} ya está registrado. Use un email personalizado con el campo email_override.`
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw createError;
    }

    const newUserId = newAuthUser.user.id;

    // ── 7. Vincular el auth_user_id al empleado en la DB ─────────────────
    // Usamos supabaseAdmin para saltar RLS en esta operación crítica
    const { error: linkError } = await supabaseAdmin
      .from("employees")
      .update({ auth_user_id: newUserId })
      .eq("id", employee_id);

    if (linkError) {
      // Rollback: eliminar el usuario Auth recién creado
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Error al vincular la cuenta: ${linkError.message}`);
    }

    // ── 8. Crear entrada en tenant_users para el nuevo empleado ───────────
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

    // ── 9. Respuesta exitosa (credenciales se muestran UNA SOLA VEZ) ───────
    return new Response(JSON.stringify({
      success: true,
      message: "Cuenta de empleado creada exitosamente.",
      credentials: {
        email: emailBase,
        password: tempPassword, // Solo se retorna aquí, NUNCA se almacena en DB
        employee_id: employee_id,
        auth_user_id: newUserId,
        nota: "⚠️ Entregue estas credenciales físicamente al colaborador. No se volverán a mostrar.",
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
