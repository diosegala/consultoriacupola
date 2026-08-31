import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificacoes } from '@/hooks/useNotificacoes';

/**
 * Marca como lidas notificações de chat da conversa aberta e conta as
 * restantes — usado pelo widget flutuante e pela sidebar.
 */
export function useChatBadge() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const carregar = async () => {
      const { data: minhas } = await supabase
        .from('chat_participantes')
        .select('conversa_id, ultima_leitura_em, arquivada')
        .eq('user_id', user.id)
        .eq('arquivada', false);
      if (!minhas?.length) {
        setTotal(0);
        return;
      }
      let soma = 0;
      // consulta em lote: mensagens por conversa após leitura
      for (const m of minhas) {
        const { count } = await supabase
          .from('chat_mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('conversa_id', m.conversa_id)
          .neq('user_id', user.id)
          .is('deletada_em', null)
          .gt('created_at', m.ultima_leitura_em);
        soma += count ?? 0;
      }
      setTotal(soma);
    };
    carregar();
    const channel = supabase
      .channel('chat-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, carregar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participantes' }, carregar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participantes' }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // silencia ao clicar numa notificação de mensagem
  useNotificacoes(); // mantém sino funcionando normalmente

  return { total, navigate };
}
