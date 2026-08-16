import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Notificacao {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
  metadata?: Record<string, any> | null;
  decisao: 'aprovado' | 'editado' | 'rejeitado' | null;
  decisao_texto: string | null;
  decisao_motivo: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
}

export function useNotificacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notificacoes', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Notificacao[]> => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notificacoes-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notificacoes', user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['meu-painel', 'acoes-sugeridas'] });
      queryClient.invalidateQueries({ queryKey: ['painel-diretor'] });
    },
  });
}

export function useMarcarTodasLidas() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['meu-painel', 'acoes-sugeridas'] });
      queryClient.invalidateQueries({ queryKey: ['painel-diretor'] });
    },
  });
}

export interface DecidirNotificacaoInput {
  id: string;
  decisao: 'aprovado' | 'editado' | 'rejeitado';
  decisao_texto?: string;
  decisao_motivo?: string;
}

export function useDecidirNotificacao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, decisao, decisao_texto, decisao_motivo }: DecidirNotificacaoInput) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('notificacoes')
        .update({
          decisao,
          decisao_texto: decisao_texto ?? null,
          decisao_motivo: decisao_motivo ?? null,
          decidido_por: user?.id ?? null,
          decidido_em: agora,
          lida: true,
          lida_em: agora,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['meu-painel', 'acoes-sugeridas'] });
      queryClient.invalidateQueries({ queryKey: ['painel-diretor'] });
      toast.success('Decisão registrada');
    },
    onError: () => {
      toast.error('Não foi possível registrar a decisão');
    },
  });
}