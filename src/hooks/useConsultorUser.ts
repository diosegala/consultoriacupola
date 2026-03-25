import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ConsultorUser {
  id: string;
  user_id: string;
  consultor_id: string;
  created_at: string;
}

export function useConsultorUsers() {
  return useQuery({
    queryKey: ['consultor-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultor_user')
        .select('*, consultores(nome)')
        .order('created_at');
      if (error) throw error;
      return data as (ConsultorUser & { consultores: { nome: string } })[];
    },
  });
}

export function useMyConsultorId() {
  return useQuery({
    queryKey: ['my-consultor-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('consultor_user')
        .select('consultor_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.consultor_id ?? null;
    },
  });
}

export function useCreateConsultorUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, consultorId }: { userId: string; consultorId: string }) => {
      // Insert consultor_user link
      const { error } = await supabase
        .from('consultor_user')
        .insert({ user_id: userId, consultor_id: consultorId });
      if (error) throw error;

      // Also add 'consultor' role if user doesn't have one yet
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'consultor' });
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultor-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });
}

export function useDeleteConsultorUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consultor_user')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultor-users'] });
    },
  });
}
