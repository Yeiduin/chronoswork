// ============================================================
// Edge Function: auto-assign
// Endpoint: POST https://<project-ref>.supabase.co/functions/v1/auto-assign
//
// Ejecuta el algoritmo de asignación de turnos en el servidor,
// inserta los turnos en la BD y devuelve el resultado.
// Elimina la necesidad de correr el algoritmo en el navegador.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateAutomaticShifts } from "./algorithm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 0. Verificar autenticación del llamador ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado: token JWT requerido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verificar JWT con el cliente anónimo (sin service_role)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido o expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenant_id, params } = body;

    if (!tenant_id || !params) {
      return new Response(
        JSON.stringify({ error: "Se requieren tenant_id y params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar que el usuario pertenece al tenant solicitado
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("user_id", caller.id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: no perteneces a este tenant." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Cargar datos desde BD si no vienen en el request ─────────────────────
    let { employees, templates, absences, demandSlots, areaConfig } = params;

    // Si no se enviaron employees, cargarlos del área
    if (!employees && params.areaId) {
      const { data: areaEmps } = await supabase
        .from("area_employees")
        .select("employees(*)")
        .eq("area_id", params.areaId);
      employees = (areaEmps || []).map((ae: Record<string, unknown>) => ae.employees).filter(Boolean);
    }

    // Si no se enviaron templates, cargarlos del área
    if (!templates && params.areaId) {
      const { data: tpls } = await supabase
        .from("shift_templates")
        .select("*")
        .eq("area_id", params.areaId)
        .eq("activo", true);
      templates = tpls || [];
    }

    // Cargar absences si no se enviaron
    if (!absences && params.areaId) {
      const year = params.year || new Date().getFullYear();
      const month = params.month || new Date().getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
      const { data: absData } = await supabase
        .from("absences")
        .select("*")
        .eq("tenant_id", tenant_id)
        .lte("fecha_inicio", endDate)
        .gte("fecha_fin", startDate);
      absences = absData || [];
    }

    // Cargar demandSlots si no se enviaron
    if (!demandSlots && params.areaId) {
      const { data: ds } = await supabase
        .from("area_demand_slots")
        .select("*")
        .eq("area_id", params.areaId);
      demandSlots = ds || [];
    }

    // Cargar configuración del área
    if (!areaConfig && params.areaId) {
      const { data: area } = await supabase
        .from("areas")
        .select("*")
        .eq("id", params.areaId)
        .single();
      areaConfig = area || {};
    }

    // Cargar turnos existentes en el período
    const { data: existingShifts } = await supabase
      .from("shifts")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("periodo", `${params.year}-${String((params.month || 1)).padStart(2, "0")}`);

    // Mapear configuraciones de área y overrides para el algoritmo
    const {
      overrideMinEmpleadosDia,
      overrideMaxEmpleadosDia,
      overrideMinEmpleadosNoche,
    } = params;

    const config = {
      ...params,
      employees: employees || params.employees || [],
      templates: templates || params.templates || [],
      absences: absences || params.absences || [],
      existingShifts: existingShifts || [],
      demandSlots: demandSlots || params.demandSlots || [],
      
      estrategia: params.estrategia ?? areaConfig?.estrategia_asignacion ?? "COVERAGE_FIRST",
      minEmpleadosNoche: overrideMinEmpleadosNoche ?? areaConfig?.min_empleados_noche ?? 1,
      nocheSoloDedicados: areaConfig?.noche_solo_empleados_dedicados ?? true,
      permiteDiaCubrirNoche: areaConfig?.permite_dia_cubrir_noche ?? false,
      balancearCarga: areaConfig?.balancear_carga ?? true,
      rotarSlots: areaConfig?.rotar_slots_entre_asesores ?? false,
      slotsPorHora: areaConfig?.slots_por_hora ?? 4,
      snapMinutos: areaConfig?.snap_turnos_minutos ?? 15,
      minHorasTurnoOverride: areaConfig?.min_horas_turno_override ?? null,
      maxHorasTurnoOverride: areaConfig?.max_horas_turno_override ?? null,
      permiteExtras: areaConfig?.permitir_horas_extras ?? false,
      permitePartidos: areaConfig?.permitir_turno_partido ?? false,
      minEmpleadosDia: overrideMinEmpleadosDia ?? areaConfig?.min_empleados_dia ?? null,
      maxEmpleadosDia: overrideMaxEmpleadosDia ?? areaConfig?.max_empleados_dia ?? null,
      horaInicioDia: areaConfig?.hora_inicio_dia ?? "04:00",
      horaFinDia: areaConfig?.hora_fin_dia ?? null,
      breakPolicy: areaConfig?.break_policy ?? params.breakPolicy ?? null,
    };

    // ─── Ejecutar algoritmo ──────────────────────────────────────────────────
    const { shifts: generatedShifts, warnings } = generateAutomaticShifts(config);

    if (!Array.isArray(generatedShifts) || generatedShifts.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, skipped: 0, warnings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Insertar en BD ──────────────────────────────────────────────────────
    const ALLOWED_FIELDS = new Set([
      "tenant_id", "employee_id", "start_time", "end_time",
      "shift_type", "periodo", "break_minutes", "template_id",
      "shift_kind", "bloque", "disponibilidad", "recargo_porcentaje",
      "observaciones", "almuerzo_minutos", "breaks_15_count", "descansos",
    ]);

    const sanitized = generatedShifts.map(s => {
      const clean: Record<string, unknown> = { tenant_id };
      for (const key of Object.keys(s)) {
        if (ALLOWED_FIELDS.has(key)) clean[key] = (s as Record<string, unknown>)[key];
      }
      return clean;
    });

    const valid = sanitized.filter(s =>
      s.start_time && s.end_time && new Date(s.end_time as string) > new Date(s.start_time as string)
    );
    const invalidCount = sanitized.length - valid.length;

    let inserted = 0;
    const BATCH = 250;
    for (let i = 0; i < valid.length; i += BATCH) {
      const chunk = valid.slice(i, i + BATCH);
      const { error } = await supabase.from("shifts").insert(chunk);
      if (error) {
        return new Response(
          JSON.stringify({
            inserted,
            skipped: valid.length - i + invalidCount,
            warnings: [...warnings, `Error BD: ${error.message}`],
            error: error.message,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({ inserted, skipped: invalidCount, warnings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
