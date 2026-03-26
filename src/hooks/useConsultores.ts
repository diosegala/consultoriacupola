import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Consultor = Tables<'consultores'>;
export type ConsultorInsert = TablesInsert<'consultores'>;
export type ConsultorUpdate = TablesUpdate<'consultores'>;

export interface ConsultorComStats extends Consultor {
  clientes_ativos: number;
  mrr_sob_gestao: number;
  score_medio: number | null;
}

export function useConsultores(apenasAtivos = true) {
  return useQuery({
    queryKey: ['consultores', { apenasAtivos }],
    queryFn: async () => {
      let query = supabase
        .from('consultores')
        .select('*')
        .order('nome');

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Consultor[];
    }
  });
}

export function useConsultoresComStats() {
  return useQuery({
    queryKey: ['consultores', 'com-stats'],
    queryFn: async () => {
      // Buscar consultores
      const { data: consultores, error: consultoresError } = await supabase
        .from('consultores')
        .select('*')
        .order('nome');

      if (consultoresError) throw consultoresError;

      // Buscar clientes ativos com seus contratos
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select(`
          consultor_id,
          contratos!contratos_cliente_id_fkey(remuneracao_mensal, ativo)
        `)
        .eq('status', 'ativo');

      if (clientesError) throw clientesError;

      // Buscar reuniões analisadas com score
      const { data: reunioes, error: reunioesError } = await supabase
        .from('reunioes')
        .select('consultor_id, score_ia')
        .eq('status_analise', 'concluido')
        .not('score_ia', 'is', null);

      if (reunioesError) throw reunioesError;

      // Calcular stats para cada consultor
      return consultores.map(consultor => {
        const clientesDoConsultor = (clientes as any[]).filter(
          c => c.consultor_id === consultor.id
        );

        const mrrTotal = clientesDoConsultor.reduce((sum, cliente) => {
          const contratoAtivo = cliente.contratos?.find((c: any) => c.ativo);
          return sum + (Number(contratoAtivo?.remuneracao_mensal) || 0);
        }, 0);

        return {
          ...consultor,
          clientes_ativos: clientesDoConsultor.length,
          mrr_sob_gestao: mrrTotal
        } as ConsultorComStats;
      });
    }
  });
}

export function useCreateConsultor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consultor: ConsultorInsert) => {
      const { data, error } = await supabase
        .from('consultores')
        .insert(consultor)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultores'] });
    }
  });
}

export function useUpdateConsultor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ConsultorUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('consultores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultores'] });
    }
  });
}

export function useDeleteConsultor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar se tem clientes
      const { count } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', id);

      if (count && count > 0) {
        throw new Error('Não é possível excluir consultor com clientes vinculados');
      }

      const { error } = await supabase
        .from('consultores')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultores'] });
    }
  });
}
