import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
        .limit(30);
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
    },
  });
}