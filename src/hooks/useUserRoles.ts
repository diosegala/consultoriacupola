import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export function useUserRoles() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as UserRole[];
    },
  });
}

export function useCurrentUserRole() {
  return useQuery({
    queryKey: ['current-user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data.role as AppRole;
    },
  });
}

export function useAuthUsers(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ['auth-users'],
    queryFn: async () => {
      // Revalidate the session against the auth server first. If the local token
      // refers to a session that no longer exists (e.g. user logged out from
      // another tab/device), force a clean sign-out instead of bubbling a 401.
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        await supabase.auth.signOut().catch(() => {});
        if (typeof window !== 'undefined') window.location.href = '/auth';
        return [] as AuthUser[];
      }
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('list-auth-users', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.error) throw resp.error;
      return resp.data as AuthUser[];
    },
    retry: false,
    enabled,
  });
}

export function useAddUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });
}

export function useDeleteUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });
}
