import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CompromissoStatus = 'pendente' | 'concluido' | 'cancelado' | 'adiado';
export type CompromissoResponsavel = 'cliente' | 'consultor';
export type CompromissoOrigem = 'ia' | 'manual';

export interface Compromisso {
  id: string;
  cliente_id: string;
  reuniao_id: string | null;
  descricao: string;
  responsavel: CompromissoResponsavel;
  prazo: string | null;
  status: CompromissoStatus;
  origem: CompromissoOrigem;
  created_at: string;
  updated_at: string;
  reunioes?: { id: string; data_reuniao: string } | null;
}

export function useCompromissos(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['compromissos', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compromissos')
        .select('*, reunioes(id, data_reuniao)')
        .eq('cliente_id', clienteId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Compromisso[];
    },
  });
}

export function useCompromissosPorReuniao(reuniaoId: string | undefined) {
  return useQuery({
    queryKey: ['compromissos', 'reuniao', reuniaoId],
    enabled: !!reuniaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compromissos')
        .select('*')
        .eq('reuniao_id', reuniaoId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Compromisso[];
    },
  });
}

export function useCompromissosPendentesCliente(clienteIds: string[]) {
  return useQuery({
    queryKey: ['compromissos_pendentes_cliente', [...clienteIds].sort().join(',')],
    enabled: clienteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compromissos')
        .select('cliente_id')
        .eq('status', 'pendente')
        .eq('responsavel', 'cliente')
        .in('cliente_id', clienteIds);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        map.set((row as any).cliente_id, (map.get((row as any).cliente_id) ?? 0) + 1);
      }
      return map;
    },
  });
}

export function useCriarCompromisso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cliente_id: string;
      descricao: string;
      responsavel: CompromissoResponsavel;
      prazo?: string | null;
      reuniao_id?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('compromissos')
        .insert({
          cliente_id: params.cliente_id,
          descricao: params.descricao.trim(),
          responsavel: params.responsavel,
          prazo: params.prazo || null,
          reuniao_id: params.reuniao_id ?? null,
          origem: 'manual',
          status: 'pendente',
          created_by: userData?.user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Compromisso;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['compromissos', vars.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['compromissos_pendentes_cliente'] });
      toast.success('Compromisso registrado.');
    },
    onError: (e: Error) => toast.error(`Erro ao registrar compromisso: ${e.message}`),
  });
}

export function useAtualizarStatusCompromisso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: CompromissoStatus; cliente_id: string }) => {
      const { error } = await supabase
        .from('compromissos')
        .update({ status: params.status })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['compromissos', vars.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['compromissos', 'reuniao'] });
      queryClient.invalidateQueries({ queryKey: ['compromissos_pendentes_cliente'] });
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar status: ${e.message}`),
  });
}

export function useRemoverCompromisso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; cliente_id: string }) => {
      const { error } = await supabase.from('compromissos').delete().eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['compromissos', vars.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['compromissos_pendentes_cliente'] });
    },
  });
}