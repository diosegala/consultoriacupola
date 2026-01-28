import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { addDays, addWeeks, addMonths, parseISO, isBefore, startOfDay } from 'date-fns';

export type Atendimento = Tables<'atendimentos'>;
export type AtendimentoInsert = TablesInsert<'atendimentos'>;
export type AtendimentoUpdate = TablesUpdate<'atendimentos'>;

export function useAtendimento(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['atendimento', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId
  });
}

export function useCreateAtendimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (atendimento: AtendimentoInsert) => {
      const { data, error } = await supabase
        .from('atendimentos')
        .insert(atendimento)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['atendimento', variables.cliente_id] });
    }
  });
}

export function useUpdateAtendimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cliente_id, ...updates }: AtendimentoUpdate & { id: string; cliente_id: string }) => {
      const { data, error } = await supabase
        .from('atendimentos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, cliente_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['atendimento', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos', 'atrasados'] });
    }
  });
}

export function useRegistrarReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      atendimentoId, 
      clienteId,
      dataReuniao, 
      periodicidade 
    }: { 
      atendimentoId: string;
      clienteId: string;
      dataReuniao: string; 
      periodicidade: 'semanal' | 'quinzenal' | 'mensal';
    }) => {
      const data = parseISO(dataReuniao);
      let proximaReuniao: Date;

      switch (periodicidade) {
        case 'semanal':
          proximaReuniao = addWeeks(data, 1);
          break;
        case 'quinzenal':
          proximaReuniao = addWeeks(data, 2);
          break;
        case 'mensal':
          proximaReuniao = addMonths(data, 1);
          break;
      }

      const { data: result, error } = await supabase
        .from('atendimentos')
        .update({
          ultima_reuniao: dataReuniao,
          proxima_reuniao: proximaReuniao.toISOString().split('T')[0]
        })
        .eq('id', atendimentoId)
        .select()
        .single();

      if (error) throw error;
      return { ...result, cliente_id: clienteId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['atendimento', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos', 'atrasados'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useReunioesAtrasadas() {
  return useQuery({
    queryKey: ['atendimentos', 'atrasados'],
    queryFn: async () => {
      const hoje = startOfDay(new Date()).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('atendimentos')
        .select(`
          *,
          cliente:clientes!atendimentos_cliente_id_fkey(id, nome, status)
        `)
        .lt('proxima_reuniao', hoje);

      if (error) throw error;

      // Filtrar apenas clientes ativos
      return (data as any[]).filter(a => a.cliente?.status === 'ativo');
    }
  });
}
