import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roleLoading: boolean;
  userRole: AppRole | null;
  isAdmin: boolean;
  isConsultor: boolean;
  isDirector: boolean;
  canAssignTasks: boolean;
  forcePasswordChange: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchUserRole = async (userId: string) => {
    setRoleLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, force_password_change')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('[AuthContext] fetchUserRole error', error);
      }
      setUserRole(data?.role ?? null);
      setForcePasswordChange((data as any)?.force_password_change ?? false);
    } catch (e) {
      console.error('[AuthContext] fetchUserRole exception', e);
      setUserRole(null);
      setForcePasswordChange(false);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const nextUser = session?.user ?? null;
        setSession(session);
        setUser(nextUser);
        setLoading(false);

        // Só reprocessa o papel quando o usuário realmente muda. Eventos de
        // revalidação (TOKEN_REFRESHED, USER_UPDATED, SIGNED_IN do mesmo
        // usuário ao voltar para a aba, INITIAL_SESSION) não devem remontar
        // a aplicação nem exibir o esqueleto de carregamento.
        if (nextUser?.id === currentUserIdRef.current) return;
        currentUserIdRef.current = nextUser?.id ?? null;

        if (nextUser) {
          setRoleLoading(true);
          setTimeout(() => fetchUserRole(nextUser.id), 0);
        } else {
          setUserRole(null);
          setForcePasswordChange(false);
          setRoleLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUser = session?.user ?? null;
      setSession(session);
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        if (currentUserIdRef.current !== nextUser.id) {
          currentUserIdRef.current = nextUser.id;
          fetchUserRole(nextUser.id);
        }
      } else {
        currentUserIdRef.current = null;
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const registrarAcesso = async (evento: 'login' | 'logout') => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      await supabase.from('acessos_log').insert({
        user_id: data.user.id,
        email: data.user.email,
        evento,
        user_agent: navigator.userAgent,
      });
    } catch {
      // logging de acesso nunca deve bloquear o fluxo
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) await registrarAcesso('login');
    return { error };
  };

  const signOut = async () => {
    await registrarAcesso('logout');
    setUserRole(null);
    setForcePasswordChange(false);
    await supabase.auth.signOut();
  };


  const isAdmin = userRole === 'admin';
  const isConsultor = userRole === 'consultor';
  const isDirector = userRole === 'director';
  const canAssignTasks = isAdmin || isDirector;

  return (
    <AuthContext.Provider value={{ user, session, loading, roleLoading, userRole, isAdmin, isConsultor, isDirector, canAssignTasks, forcePasswordChange, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
