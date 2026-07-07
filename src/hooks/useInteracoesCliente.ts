import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

export type InteracaoCliente = Tables<'interacoes_cliente'>;
export type CanalInteracao = InteracaoCliente['canal'];

export const CANAL_LABEL: Record<CanalInteracao, string> = {
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  email: 'E-mail',
  reuniao_informal: 'Reunião informal',
  outro: 'Outro',
};

export function useInteracoesCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['interacoes-cliente', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interacoes_cliente')
        .select('*')
        .eq('cliente_id', clienteId!)
        .order('data_interacao', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InteracaoCliente[];
    },
  });
}

export function useCreateInteracaoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<'interacoes_cliente'>, 'created_by'>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('interacoes_cliente')
        .insert({ ...input, created_by: userData.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['interacoes-cliente', data.cliente_id] });
      qc.invalidateQueries({ queryKey: ['atendimento', data.cliente_id] });
      qc.invalidateQueries({ queryKey: ['notificacoes'] });
      qc.invalidateQueries({ queryKey: ['meu-painel'] });
    },
  });
}

export function useDeleteInteracaoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clienteId: string }) => {
      const { error } = await supabase.from('interacoes_cliente').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['interacoes-cliente', vars.clienteId] });
    },
  });
}