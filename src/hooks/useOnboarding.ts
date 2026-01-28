import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Onboarding = Tables<'onboarding'>;
export type OnboardingInsert = TablesInsert<'onboarding'>;
export type OnboardingUpdate = TablesUpdate<'onboarding'>;

export function useOnboarding(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['onboarding', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('onboarding')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId
  });
}

export function useCreateOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboarding: OnboardingInsert) => {
      const { data, error } = await supabase
        .from('onboarding')
        .insert(onboarding)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', variables.cliente_id] });
    }
  });
}

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cliente_id, ...updates }: OnboardingUpdate & { id: string; cliente_id: string }) => {
      const { data, error } = await supabase
        .from('onboarding')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, cliente_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', data.cliente_id] });
    }
  });
}

export function useOnboardingsPendentes() {
  return useQuery({
    queryKey: ['onboardings', 'pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding')
        .select(`
          *,
          cliente:clientes!onboarding_cliente_id_fkey(id, nome, status)
        `)
        .neq('etapa_atual', 'concluido');

      if (error) throw error;
      
      // Filtrar apenas clientes ativos
      return (data as any[]).filter(o => o.cliente?.status === 'ativo');
    }
  });
}
