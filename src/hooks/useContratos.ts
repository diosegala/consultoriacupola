import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Contrato = Tables<'contratos'>;
export type ContratoInsert = TablesInsert<'contratos'>;
export type ContratoUpdate = TablesUpdate<'contratos'>;

export interface ContratoComTipo extends Contrato {
  tipo_consultoria?: Tables<'tipos_consultoria'> | null;
}

export function useContratos(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['contratos', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContratoComTipo[];
    },
    enabled: !!clienteId
  });
}

export function useContratoAtivo(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['contrato-ativo', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*)
        `)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      return data as ContratoComTipo | null;
    },
    enabled: !!clienteId
  });
}

export function useCreateContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contrato: ContratoInsert) => {
      const { data, error } = await supabase
        .from('contratos')
        .insert(contrato)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useUpdateContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cliente_id, ...updates }: ContratoUpdate & { id: string; cliente_id: string }) => {
      const { data, error } = await supabase
        .from('contratos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, cliente_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useRenovarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contratoAtualId, novoContrato }: { 
      contratoAtualId: string; 
      novoContrato: ContratoInsert 
    }) => {
      // Desativar contrato atual
      const { error: updateError } = await supabase
        .from('contratos')
        .update({ ativo: false })
        .eq('id', contratoAtualId);

      if (updateError) throw updateError;

      // Criar novo contrato
      const { data, error } = await supabase
        .from('contratos')
        .insert({ ...novoContrato, ativo: true })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useMRRTotal() {
  return useQuery({
    queryKey: ['dashboard', 'mrr-total'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          remuneracao_mensal,
          cliente:clientes!contratos_cliente_id_fkey(status)
        `)
        .eq('ativo', true);

      if (error) throw error;

      const total = (data as any[])
        .filter(c => c.cliente?.status === 'ativo')
        .reduce((sum, c) => sum + (Number(c.remuneracao_mensal) || 0), 0);

      return total;
    }
  });
}
