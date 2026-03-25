import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Reuniao {
  id: string;
  consultor_id: string;
  cliente_id: string;
  data_reuniao: string;
  duracao_minutos: number | null;
  transcricao: string | null;
  resumo_ia: string | null;
  score_ia: number | null;
  analise_ia: Record<string, any> | null;
  google_meet_link: string | null;
  status_analise: string;
  created_at: string;
  updated_at: string;
}

export interface ReuniaoComDetalhes extends Reuniao {
  clientes?: { nome: string };
  consultores?: { nome: string };
}

export interface ReuniaoInsert {
  consultor_id: string;
  cliente_id: string;
  data_reuniao: string;
  duracao_minutos?: number | null;
  transcricao?: string | null;
  google_meet_link?: string | null;
}

export function useReunioesByConsultor(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['reunioes', 'consultor', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select('*, clientes(nome), consultores(nome)')
        .eq('consultor_id', consultorId!)
        .order('data_reuniao', { ascending: false });

      if (error) throw error;
      return data as unknown as ReuniaoComDetalhes[];
    },
  });
}

export function useReuniao(id: string | undefined) {
  return useQuery({
    queryKey: ['reunioes', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select('*, clientes(nome), consultores(nome)')
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as unknown as ReuniaoComDetalhes;
    },
  });
}

export function useCreateReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reuniao: ReuniaoInsert) => {
      const { data, error } = await supabase
        .from('reunioes')
        .insert(reuniao as any)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Reuniao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] });
    },
  });
}

export function useAnalisarReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reuniaoId: string) => {
      const { data, error } = await supabase.functions.invoke('analisar-reuniao', {
        body: { reuniao_id: reuniaoId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] });
    },
  });
}

export function useDeleteReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reunioes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] });
    },
  });
}

export function useScoreConsultor(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['score-consultor', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select('score_ia')
        .eq('consultor_id', consultorId!)
        .eq('status_analise', 'concluido')
        .not('score_ia', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const scores = data.map((r: any) => Number(r.score_ia));
      const media = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      return {
        score_medio: Math.round(media * 10) / 10,
        total_reunioes: data.length,
      };
    },
  });
}
