import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = useCallback(async (userId) => {
    if (!userId) return;
    try {
      // Usar service-level query para evitar que RLS bloquee la carga del tenant
      const { data, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, rol, tenants(id, razon_social, nit, direccion, telefono, plan, activo, created_at, suscripcion_activa, plan_vigente_hasta)')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('RLS/tenant fetch error:', error.message);
        // Intentar fetch directo sin join como fallback
        const { data: tuData } = await supabase
          .from('tenant_users')
          .select('tenant_id, rol')
          .eq('user_id', userId)
          .maybeSingle();
        if (tuData?.tenant_id) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tuData.tenant_id)
            .maybeSingle();
          if (tenantData) setTenant(tenantData);
        }
      } else if (data?.tenants) {
        setTenant(data.tenants);
      } else if (data?.tenant_id) {
        // join no devolvió tenants, buscar directamente
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', data.tenant_id)
          .maybeSingle();
        if (tenantData) setTenant(tenantData);
      }
    } catch (err) {
      console.error('Error crítico fetchTenant:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTenant(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTenant(session.user.id);
      } else {
        setTenant(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchTenant]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTenant(null);
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      tenant,
      loading,
      signIn,
      signOut,
      signUp,
      refreshTenant: () => fetchTenant(user?.id),
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
