import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Viagem {
  id: string;
  contrato_id: string;
  cliente_id: string;
  data_viagem: string;
  descricao: string | null;
  valor: number;
  created_at: string;
  updated_at: string;
}

export interface ViagemInsert {
  contrato_id: string;
  cliente_id: string;
  data_viagem: string;
  descricao?: string | null;
  valor: number;
}

export interface ViagemUpdate {
  id: string;
  contrato_id: string;
  data_viagem?: string;
  descricao?: string | null;
  valor?: number;
}

export function useViagensContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['viagens', contratoId],
    queryFn: async () => {
      if (!contratoId) return [];

      const { data, error } = await supabase
        .from('viagens_contrato')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('data_viagem', { ascending: false });

      if (error) throw error;
      return data as Viagem[];
    },
    enabled: !!contratoId
  });
}

export function useTotalDespesasContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['viagens', 'total', contratoId],
    queryFn: async () => {
      if (!contratoId) return 0;

      const { data, error } = await supabase
        .from('viagens_contrato')
        .select('valor')
        .eq('contrato_id', contratoId);

      if (error) throw error;
      return (data || []).reduce((sum, v) => sum + Number(v.valor), 0);
    },
    enabled: !!contratoId
  });
}

export function useCreateViagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (viagem: ViagemInsert) => {
      const { data, error } = await supabase
        .from('viagens_contrato')
        .insert(viagem)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viagens', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['viagens', 'total', data.contrato_id] });
    }
  });
}

export function useUpdateViagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contrato_id, ...updates }: ViagemUpdate) => {
      const { data, error } = await supabase
        .from('viagens_contrato')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, contrato_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viagens', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['viagens', 'total', data.contrato_id] });
    }
  });
}

export function useDeleteViagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ viagemId, contratoId }: { viagemId: string; contratoId: string }) => {
      const { error } = await supabase
        .from('viagens_contrato')
        .delete()
        .eq('id', viagemId);

      if (error) throw error;
      return { contratoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viagens', data.contratoId] });
      queryClient.invalidateQueries({ queryKey: ['viagens', 'total', data.contratoId] });
    }
  });
}
