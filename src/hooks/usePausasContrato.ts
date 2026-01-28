import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, addDays, format } from 'date-fns';

export interface PausaContrato {
  id: string;
  contrato_id: string;
  cliente_id: string;
  data_inicio: string;
  data_fim: string | null;
  motivo: string | null;
  dias_pausados: number | null;
  prorrogacao_aplicada: boolean;
  created_at: string;
  updated_at: string;
}

export interface PausaContratoInsert {
  contrato_id: string;
  cliente_id: string;
  data_inicio: string;
  motivo?: string | null;
}

export function usePausasContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['pausas-contrato', contratoId],
    queryFn: async () => {
      if (!contratoId) return [];

      const { data, error } = await supabase
        .from('pausas_contrato')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PausaContrato[];
    },
    enabled: !!contratoId
  });
}

export function usePausaAtiva(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['pausa-ativa', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;

      const { data, error } = await supabase
        .from('pausas_contrato')
        .select('*')
        .eq('contrato_id', contratoId)
        .is('data_fim', null)
        .maybeSingle();

      if (error) throw error;
      return data as PausaContrato | null;
    },
    enabled: !!contratoId
  });
}

export function usePausarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contrato_id, cliente_id, data_inicio, motivo }: PausaContratoInsert) => {
      // Criar registro de pausa
      const { data: pausa, error: pausaError } = await supabase
        .from('pausas_contrato')
        .insert({
          contrato_id,
          cliente_id,
          data_inicio,
          motivo
        })
        .select()
        .single();

      if (pausaError) throw pausaError;

      // Atualizar contrato para pausado
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({ pausado: true })
        .eq('id', contrato_id);

      if (contratoError) throw contratoError;

      return pausa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pausas-contrato', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['pausa-ativa', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo'] });
    }
  });
}

export function useRetomarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      pausa_id, 
      contrato_id, 
      data_retomada 
    }: { 
      pausa_id: string; 
      contrato_id: string; 
      data_retomada: string;
    }) => {
      // Buscar pausa ativa
      const { data: pausa, error: pausaFetchError } = await supabase
        .from('pausas_contrato')
        .select('*')
        .eq('id', pausa_id)
        .single();

      if (pausaFetchError) throw pausaFetchError;

      // Calcular dias pausados
      const diasPausados = differenceInDays(
        new Date(data_retomada), 
        new Date(pausa.data_inicio)
      );

      // Atualizar pausa com data_fim e dias_pausados
      const { error: pausaUpdateError } = await supabase
        .from('pausas_contrato')
        .update({
          data_fim: data_retomada,
          dias_pausados: diasPausados,
          prorrogacao_aplicada: true
        })
        .eq('id', pausa_id);

      if (pausaUpdateError) throw pausaUpdateError;

      // Buscar contrato para prorrogar
      const { data: contrato, error: contratoFetchError } = await supabase
        .from('contratos')
        .select('data_fim')
        .eq('id', contrato_id)
        .single();

      if (contratoFetchError) throw contratoFetchError;

      // Calcular nova data_fim (prorrogação automática)
      const novaDataFim = format(
        addDays(new Date(contrato.data_fim), diasPausados),
        'yyyy-MM-dd'
      );

      // Atualizar contrato: remover pausado e prorrogar
      const { error: contratoUpdateError } = await supabase
        .from('contratos')
        .update({ 
          pausado: false,
          data_fim: novaDataFim
        })
        .eq('id', contrato_id);

      if (contratoUpdateError) throw contratoUpdateError;

      return { contrato_id, diasPausados, novaDataFim };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pausas-contrato', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['pausa-ativa', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useProrrogarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contrato_id, 
      cliente_id,
      dias_prorrogacao,
      motivo 
    }: { 
      contrato_id: string; 
      cliente_id: string;
      dias_prorrogacao: number;
      motivo?: string;
    }) => {
      // Buscar contrato atual
      const { data: contrato, error: contratoFetchError } = await supabase
        .from('contratos')
        .select('data_fim')
        .eq('id', contrato_id)
        .single();

      if (contratoFetchError) throw contratoFetchError;

      // Calcular nova data_fim
      const novaDataFim = format(
        addDays(new Date(contrato.data_fim), dias_prorrogacao),
        'yyyy-MM-dd'
      );

      // Registrar prorrogação como uma "pausa" com dias já aplicados
      const { error: pausaError } = await supabase
        .from('pausas_contrato')
        .insert({
          contrato_id,
          cliente_id,
          data_inicio: format(new Date(), 'yyyy-MM-dd'),
          data_fim: format(new Date(), 'yyyy-MM-dd'),
          motivo: motivo || 'Prorrogação manual',
          dias_pausados: dias_prorrogacao,
          prorrogacao_aplicada: true
        });

      if (pausaError) throw pausaError;

      // Atualizar contrato com nova data_fim
      const { error: contratoUpdateError } = await supabase
        .from('contratos')
        .update({ data_fim: novaDataFim })
        .eq('id', contrato_id);

      if (contratoUpdateError) throw contratoUpdateError;

      return { contrato_id, novaDataFim, dias_prorrogacao };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pausas-contrato', data.contrato_id] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}
