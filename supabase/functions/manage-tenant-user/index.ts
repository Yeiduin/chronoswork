// ============================================================
// ChronosWork — Edge Function: manage-tenant-user
// Gestión de usuarios de tenants desde el panel SaaS Admin.
//
// Acciones soportadas:
//   list_users      → Listar usuarios de un tenant con su rol
//   reset_password  → Resetear contraseña (genera temporal o usa la provista)
//   update_email    → Cambiar el correo de un usuario
//   create_admin    → Crear nuevo Super_Admin para un tenant
//
// Seguridad: Solo accesible por platform_admins (verificado por JWT + DB)
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateSecurePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$%&*";
  const all = upper + lower + digits + special;

  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);

  let password = "";
  password += upper[arr[0] % upper.length];
  password += lower[arr[1] % lower.length];
  password += digits[arr[2] % digits.length];
  password += special[arr[3] % special.length];

  for (let i = 4; i < length; i++) {
    password += all[arr[i] % all.length];
  }
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Verificar que el llamador es platform_admin ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Token inválido o expirado." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente con service_role (bypasa RLS, accede a auth.admin)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar que el llamador es platform_admin
    const { data: platformAdmin } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: "Acceso denegado: solo el administrador de la plataforma puede usar esta función." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Leer acción del body ─────────────────────────────────────────────
    const body = await req.json();
    const { action, tenant_id, user_id, new_email, new_password } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Se requiere el campo 'action'." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACCIÓN: list_users ──────────────────────────────────────────────────
    if (action === "list_users") {
      if (!tenant_id) {
        return new Response(JSON.stringify({ error: "Se requiere tenant_id." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tenantUsers, error: tuError } = await supabaseAdmin
        .from("tenant_users")
        .select("user_id, rol, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at");

      if (tuError) throw tuError;

      if (!tenantUsers || tenantUsers.length === 0) {
        return new Response(JSON.stringify({ users: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = tenantUsers.map(tu => tu.user_id);
      const usersWithAuth = await Promise.all(
        userIds.map(async (uid) => {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(uid);
          const tu = tenantUsers.find(t => t.user_id === uid);
          return {
            user_id: uid,
            email: authData?.user?.email || "—",
            rol: tu?.rol || "—",
            created_at: tu?.created_at,
            last_sign_in_at: authData?.user?.last_sign_in_at || null,
            email_confirmed: authData?.user?.email_confirmed_at != null,
          };
        })
      );

      return new Response(JSON.stringify({ users: usersWithAuth }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACCIÓN: reset_password ──────────────────────────────────────────────
    if (action === "reset_password") {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Se requiere user_id." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = new_password || generateSecurePassword(14);

      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: tempPassword }
      );

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        message: "Contraseña actualizada correctamente.",
        new_password: tempPassword,
        user_email: updatedUser.user?.email,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACCIÓN: update_email ────────────────────────────────────────────────
    if (action === "update_email") {
      if (!user_id || !new_email) {
        return new Response(JSON.stringify({ error: "Se requieren user_id y new_email." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        {
          email: new_email,
          email_confirm: true,
        }
      );

      if (updateError) {
        const msg = updateError.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("exists") || msg.includes("unique")) {
          return new Response(JSON.stringify({ error: `El correo ${new_email} ya está registrado por otro usuario.` }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw updateError;
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Correo actualizado correctamente.",
        new_email: updatedUser.user?.email,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACCIÓN: create_admin ────────────────────────────────────────────────
    if (action === "create_admin") {
      if (!tenant_id || !new_email) {
        return new Response(JSON.stringify({ error: "Se requieren tenant_id y new_email." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = new_password || generateSecurePassword(14);

      // Verificar que el tenant existe
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .select("id, razon_social, nit")
        .eq("id", tenant_id)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenant) {
        return new Response(JSON.stringify({ error: "Tenant no encontrado." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Intentar crear el usuario en Auth
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: new_email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role: "super_admin", tenant_id },
        user_metadata: { razon_social: tenant.razon_social },
      });

      if (createError) {
        // Si ya existe, retornar error claro (no intentar buscarlo)
        const msg = createError.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
          return new Response(JSON.stringify({
            error: `El correo ${new_email} ya está registrado. Usa "Cambiar correo" en el panel de usuarios si quieres actualizarlo.`
          }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw createError;
      }

      const newUserId = newAuthUser.user.id;

      // Vincular al tenant como super_admin
      const { error: tuError } = await supabaseAdmin
        .from("tenant_users")
        .upsert({
          user_id: newUserId,
          tenant_id: tenant_id,
          rol: "super_admin",
        }, { onConflict: "user_id,tenant_id" });

      if (tuError) {
        // Rollback: eliminar el usuario creado si falla el vínculo
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw tuError;
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Administrador creado y vinculado exitosamente.",
        credentials: {
          email: new_email,
          password: tempPassword,
          user_id: newUserId,
        },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Acción desconocida
    return new Response(JSON.stringify({ error: `Acción desconocida: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[manage-tenant-user] Error:", err);
    return new Response(JSON.stringify({
      error: "Error interno del servidor.",
      detail: err instanceof Error ? err.message : String(err),
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
