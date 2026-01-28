import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type FerramentasCliente = Tables<'ferramentas_cliente'>;
export type FerramentasClienteInsert = TablesInsert<'ferramentas_cliente'>;
export type FerramentasClienteUpdate = TablesUpdate<'ferramentas_cliente'>;

export interface FerramentasComCRM extends FerramentasCliente {
  crm?: Tables<'crms'> | null;
}

export function useFerramentas(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['ferramentas', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('ferramentas_cliente')
        .select(`
          *,
          crm:crms(*)
        `)
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error) throw error;
      return data as FerramentasComCRM | null;
    },
    enabled: !!clienteId
  });
}

export function useCreateFerramentas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ferramentas: FerramentasClienteInsert) => {
      const { data, error } = await supabase
        .from('ferramentas_cliente')
        .insert(ferramentas)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ferramentas', variables.cliente_id] });
    }
  });
}

export function useUpdateFerramentas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cliente_id, ...updates }: FerramentasClienteUpdate & { id: string; cliente_id: string }) => {
      const { data, error } = await supabase
        .from('ferramentas_cliente')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, cliente_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ferramentas', data.cliente_id] });
    }
  });
}
