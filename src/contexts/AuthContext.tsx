import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
        // Ignore token refresh / window-focus revalidation events so we don't
        // toggle roleLoading and remount the whole app (which would wipe
        // in-page state like Agentes selection).
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          setRoleLoading(true);
          setTimeout(() => fetchUserRole(session.user.id), 0);
        } else {
          setUserRole(null);
          setForcePasswordChange(false);
          setRoleLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
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
