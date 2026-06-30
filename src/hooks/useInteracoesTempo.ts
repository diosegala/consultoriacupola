import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyConsultorId } from './useConsultorUser';

export type TipoAgente = 'diagnostico' | 'okrs' | 'briefing_cliente_oculto';

export interface InteracaoTempoInput {
  cliente_id: string;
  tipo: TipoAgente;
  inicio_preparacao: string; // ISO
  fim_preparacao: string;    // ISO
  duracao_preparacao_segundos: number;
  tempo_total_decorrido_segundos: number;
  duracao_geracao_ia_segundos?: number | null;
  metadata?: Record<string, unknown>;
}

export function useRegistrarInteracaoTempo() {
  const { data: consultorId } = useMyConsultorId();
  return useMutation({
    mutationFn: async (input: InteracaoTempoInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = {
        user_id: user.id,
        consultor_id: consultorId ?? null,
        cliente_id: input.cliente_id,
        tipo: input.tipo,
        inicio_preparacao: input.inicio_preparacao,
        fim_preparacao: input.fim_preparacao,
        duracao_preparacao_segundos: input.duracao_preparacao_segundos,
        duracao_geracao_ia_segundos: input.duracao_geracao_ia_segundos ?? null,
        tempo_total_decorrido_segundos: input.tempo_total_decorrido_segundos,
        metadata: (input.metadata ?? {}) as Record<string, unknown>,
      };
      const { error } = await (supabase.from('interacoes_tempo') as any).insert(payload);
      if (error) throw error;
    },
  });
}

export interface InteracaoTempoRow {
  id: string;
  cliente_id: string | null;
  consultor_id: string | null;
  tipo: TipoAgente | string;
  inicio_preparacao: string;
  fim_preparacao: string | null;
  duracao_preparacao_segundos: number | null;
  duracao_geracao_ia_segundos: number | null;
  tempo_total_decorrido_segundos: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useInteracoesTempoConsultor(consultorId?: string, from?: Date, to?: Date) {
  return useQuery({
    queryKey: ['interacoes-tempo', consultorId, from?.toISOString(), to?.toISOString()],
    enabled: !!consultorId,
    queryFn: async () => {
      let q = supabase
        .from('interacoes_tempo')
        .select('*')
        .eq('consultor_id', consultorId!)
        .order('created_at', { ascending: false });
      if (from) q = q.gte('created_at', from.toISOString());
      if (to) q = q.lte('created_at', to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InteracaoTempoRow[];
    },
  });
}