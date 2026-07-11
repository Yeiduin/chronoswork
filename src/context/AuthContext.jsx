import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { logger } from '../config/logger';
import { isCedulaInput } from '../core/validators';

const AuthContext = createContext(null);

// ── Helpers de rol ────────────────────────────────────────────────────────────
// Los roles operativos vienen de tenant_users.rol
// El SaaS_Admin se detecta por la tabla platform_admins (via query adicional)

const ROLE_SAAS_ADMIN     = 'saas_admin';    // Dueño de la plataforma
const ROLE_SUPER_ADMIN    = 'super_admin';   // Dueño de la empresa
const ROLE_COORDINATOR    = 'coordinator';   // Programador de turnos (también 'admin')
const ROLE_EMPLEADO       = 'empleado';      // Colaborador

export { ROLE_SAAS_ADMIN, ROLE_SUPER_ADMIN, ROLE_COORDINATOR, ROLE_EMPLEADO };

// Destino de redirección según rol
export function getRoleRedirect(role) {
  switch (role) {
    case ROLE_SAAS_ADMIN:  return '/saas-dashboard';
    case ROLE_EMPLEADO:    return '/mi-perfil';
    default:               return '/dashboard';  // super_admin, coordinator, admin
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [tenant, setTenant]   = useState(null);
  const [userRole, setUserRole] = useState(null);   // string del rol actual
  const [loading, setLoading] = useState(true);

  // ── Función principal: cargar datos del usuario autenticado ──────────────
  const fetchUserData = useCallback(async (userId) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // 1. ¿Es Platform Admin (SaaS_Admin)?
      const { data: platformAdmin } = await supabase
        .from('platform_admins')
        .select('id, nombre')
        .eq('user_id', userId)
        .maybeSingle();

      if (platformAdmin) {
        setUserRole(ROLE_SAAS_ADMIN);
        setTenant(null);  // El SaaS_Admin no tiene tenant propio
        return;
      }

      // 2. Buscar en tenant_users para roles operativos
      const { data: tenantUserData, error: tuError } = await supabase
        .from('tenant_users')
        .select(`
          tenant_id,
          rol,
          tenants (
            id, razon_social, nit, direccion, telefono,
            plan, activo, created_at, suscripcion_activa, plan_vigente_hasta
          )
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (tuError) {
        logger.error('AuthContext', 'fetchUserData error:', tuError.message);
        // Fallback sin join
        const { data: tuBasic } = await supabase
          .from('tenant_users')
          .select('tenant_id, rol')
          .eq('user_id', userId)
          .maybeSingle();

        if (tuBasic) {
          setUserRole(tuBasic.rol === 'admin' ? ROLE_COORDINATOR : tuBasic.rol);
          const { data: tenantData } = await supabase
            .from('tenants').select('*').eq('id', tuBasic.tenant_id).maybeSingle();
          if (tenantData) setTenant(tenantData);
        }
        return;
      }

      if (tenantUserData) {
        // Normalizar 'admin' como alias de coordinator
        const rawRol = tenantUserData.rol;
        const normalizedRol = rawRol === 'admin' ? ROLE_COORDINATOR : rawRol;
        setUserRole(normalizedRol);

        if (tenantUserData.tenants) {
          setTenant(tenantUserData.tenants);
        } else if (tenantUserData.tenant_id) {
          // Join no devolvió datos, buscar directamente
          const { data: tenantData } = await supabase
            .from('tenants').select('*').eq('id', tenantUserData.tenant_id).maybeSingle();
          if (tenantData) setTenant(tenantData);
        }
      }
    } catch (err) {
      logger.error('AuthContext', 'Error crítico fetchUserData:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Suscripción a cambios de sesión ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchUserData(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setTenant(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  // ── Helpers computados de rol ─────────────────────────────────────────────
  const roleHelpers = useMemo(() => ({
    isPlatformAdmin: userRole === ROLE_SAAS_ADMIN,
    isSuperAdmin:    userRole === ROLE_SUPER_ADMIN,
    isCoordinator:   userRole === ROLE_COORDINATOR,
    isEmpleado:      userRole === ROLE_EMPLEADO,
    isOperationalAdmin: [ROLE_SUPER_ADMIN, ROLE_COORDINATOR].includes(userRole),
    tenantId: tenant?.id ?? null,
  }), [userRole, tenant]);

  // ── Resolver de login: cédula → email ─────────────────────────────────────
  const resolveLoginIdentifier = async (identifier) => {
    const trimmed = String(identifier).trim();

    // Si ya es un email (contiene @), devolverlo tal cual
    if (trimmed.includes('@')) return trimmed;

    // Si es un número de cédula, buscar el email institucional en employees
    if (isCedulaInput(trimmed)) {
      const { data: emp, error } = await supabase
        .from('employees')
        .select('email_institucional')
        .eq('cedula', trimmed)
        .not('auth_user_id', 'is', null)
        .maybeSingle();

      if (error || !emp?.email_institucional) {
        throw new Error('No se encontró una cuenta vinculada a ese número de cédula.');
      }

      return emp.email_institucional;
    }

    // Si no es ni email ni cédula válida, devolver tal cual y dejar que falle el login
    return trimmed;
  };

  // ── Auth Actions ──────────────────────────────────────────────────────────
  const signIn = async (identifier, password) => {
    // Resolver cédula → email si es necesario
    const email = await resolveLoginIdentifier(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTenant(null);
    setUserRole(null);
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  // Enviar email de recuperación de contraseña
  const resetPassword = async (email) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };

  // Establecer nueva contraseña (luego de hacer clic en el link del email)
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      tenant,
      userRole,
      loading,
      // Helpers de rol
      ...roleHelpers,
      // Auth actions
      signIn,
      signOut,
      signUp,
      resetPassword,
      updatePassword,
      refreshUserData: () => fetchUserData(user?.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
