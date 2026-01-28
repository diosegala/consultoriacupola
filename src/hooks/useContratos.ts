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
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
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
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
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

export interface ContratoComCliente extends ContratoComTipo {
  cliente?: Tables<'clientes'> & {
    consultor?: Tables<'consultores'> | null;
  } | null;
}

export interface AllContratosFilters {
  ativo?: boolean | 'all';
  consultor_id?: string;
  tipo_consultoria_id?: string;
  search?: string;
  vencimento?: 'all' | '30' | '60' | '90' | 'vencidos';
}

export function useAllContratos(filters?: AllContratosFilters) {
  return useQuery({
    queryKey: ['all-contratos', filters],
    queryFn: async () => {
      let query = supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*),
          cliente:clientes!contratos_cliente_id_fkey(
            id, nome, cidade, uf, status,
            consultor:consultores(id, nome)
          )
        `)
        .order('data_fim', { ascending: true });

      // Filtro de status
      if (filters?.ativo !== undefined && filters.ativo !== 'all') {
        query = query.eq('ativo', filters.ativo);
      }

      // Filtro por tipo de consultoria
      if (filters?.tipo_consultoria_id) {
        query = query.eq('tipo_consultoria_id', filters.tipo_consultoria_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = data as ContratoComCliente[];

      // Filtro por consultor (via cliente)
      if (filters?.consultor_id) {
        result = result.filter(c => c.cliente?.consultor?.id === filters.consultor_id);
      }

      // Filtro por busca de cliente
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(c => 
          c.cliente?.nome?.toLowerCase().includes(searchLower)
        );
      }

      // Filtro por vencimento
      if (filters?.vencimento && filters.vencimento !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filters.vencimento === 'vencidos') {
          result = result.filter(c => {
            const dataFim = new Date(c.data_fim);
            return dataFim < today && c.ativo;
          });
        } else {
          const days = parseInt(filters.vencimento);
          const futureDate = new Date(today);
          futureDate.setDate(futureDate.getDate() + days);

          result = result.filter(c => {
            const dataFim = new Date(c.data_fim);
            return dataFim >= today && dataFim <= futureDate && c.ativo;
          });
        }
      }

      return result;
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
