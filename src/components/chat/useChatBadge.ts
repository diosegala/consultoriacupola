import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Total de mensagens de chat não lidas do usuário — usado pela sidebar
 * e pelo widget flutuante. Atualiza em tempo real.
 */
export function useChatBadge() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);

  const carregar = useCallback(async () => {
    if (!user) return;
    const { data: minhas } = await supabase
      .from('chat_participantes')
      .select('conversa_id, ultima_leitura_em, arquivada')
      .eq('user_id', user.id)
      .eq('arquivada', false);
    if (!minhas?.length) {
      setTotal(0);
      return;
    }
    const { data: msgs } = await supabase
      .from('chat_mensagens')
      .select('conversa_id, user_id, created_at')
      .in('conversa_id', minhas.map((m) => m.conversa_id))
      .neq('user_id', user.id)
      .is('deletada_em', null)
      .order('created_at', { ascending: false })
      .limit(2000);
    const leitura = new Map(minhas.map((m) => [m.conversa_id, m.ultima_leitura_em]));
    let soma = 0;
    for (const m of msgs ?? []) {
      if (m.created_at > (leitura.get(m.conversa_id) ?? '1970-01-01')) soma++;
    }
    setTotal(soma);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    carregar();
    const channel = supabase
      .channel('chat-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensagens' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participantes' }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, carregar]);

  return { total, recarregar: carregar };
}
