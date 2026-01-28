import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export type Encerramento = Tables<'encerramentos'>;
export type EncerramentoInsert = TablesInsert<'encerramentos'>;

export function useEncerramentos(clienteId?: string) {
  return useQuery({
    queryKey: ['encerramentos', clienteId],
    queryFn: async () => {
      let query = supabase
        .from('encerramentos')
        .select(`
          *,
          cliente:clientes!encerramentos_cliente_id_fkey(nome),
          contrato:contratos!encerramentos_contrato_id_fkey(*)
        `)
        .order('data_encerramento', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

export function useEncerrarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clienteId, 
      contratoId, 
      classificacao, 
      justificativa,
      mrrPerdido
    }: { 
      clienteId: string;
      contratoId: string;
      classificacao: 'churn' | 'fim_contrato';
      justificativa?: string;
      mrrPerdido: number;
    }) => {
      // Buscar quantidade de clientes ativos no momento
      const { count: clientesAtivos } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // Criar registro de encerramento
      const { error: encError } = await supabase
        .from('encerramentos')
        .insert({
          cliente_id: clienteId,
          contrato_id: contratoId,
          data_encerramento: new Date().toISOString().split('T')[0],
          classificacao,
          justificativa,
          mrr_perdido: mrrPerdido,
          clientes_ativos_momento: clientesAtivos
        });

      if (encError) throw encError;

      // Desativar contrato
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({ ativo: false })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      // Verificar se há outros contratos ativos do cliente
      const { data: outrosContratosAtivos, error: checkError } = await supabase
        .from('contratos')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .neq('id', contratoId);

      if (checkError) throw checkError;

      // Só alterar status do cliente para encerrado se não houver outros contratos ativos
      if (!outrosContratosAtivos || outrosContratosAtivos.length === 0) {
        const { error: clienteError } = await supabase
          .from('clientes')
          .update({ status: 'encerrado' })
          .eq('id', clienteId);

        if (clienteError) throw clienteError;
      }

      return { clienteId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['contratos', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['encerramentos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useChurnDoMes() {
  return useQuery({
    queryKey: ['dashboard', 'churn-mes'],
    queryFn: async () => {
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Buscar churns do mês
      const { data: churns, error: churnsError } = await supabase
        .from('encerramentos')
        .select('classificacao')
        .eq('classificacao', 'churn')
        .gte('data_encerramento', inicioMes)
        .lte('data_encerramento', fimMes);

      if (churnsError) throw churnsError;

      // Buscar clientes que estavam ativos no início do mês
      const { count: clientesInicioMes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ativo', 'aguardando_renovacao', 'encerrado'])
        .lt('created_at', inicioMes);

      if (!clientesInicioMes || clientesInicioMes === 0) return 0;

      const percentualChurn = ((churns?.length || 0) / clientesInicioMes) * 100;
      return Math.round(percentualChurn * 10) / 10; // Uma casa decimal
    }
  });
}
