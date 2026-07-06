import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TranscricaoSumario {
  id: string;
  cliente_id: string;
  label: string;
  papel: string | null;
  data_entrevista: string | null;
  sumario: string;
  num_chars_original: number | null;
  hash_conteudo: string | null;
  created_at: string;
}

export function useTranscricoesSumarios(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['transcricoes_sumarios', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transcricoes_sumarios')
        .select('*')
        .eq('cliente_id', clienteId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as TranscricaoSumario[];
    },
  });
}

export function useSumarizarTranscricao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cliente_id: string;
      label: string;
      papel?: string;
      data_entrevista?: string | null;
      conteudo: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('sumarizar-transcricao', {
        body: params,
      });
      if (error) {
        let message = error.message || 'Falha ao sumarizar transcrição';
        const response = (error as any)?.context;
        if (response && typeof response.json === 'function') {
          try {
            const body = await response.json();
            if (typeof body?.error === 'string') message = body.error;
          } catch { /* ignore */ }
        }
        throw new Error(message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { sumario_id: string; sumario: string; deduplicado: boolean };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['transcricoes_sumarios', vars.cliente_id] });
    },
  });
}

export function useRemoverSumario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; cliente_id: string }) => {
      const { error } = await supabase
        .from('transcricoes_sumarios')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['transcricoes_sumarios', vars.cliente_id] });
    },
  });
}