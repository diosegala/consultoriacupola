import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';

export interface MensagemAgencia {
  id: string;
  papel: 'pessoa' | 'agente' | 'passo';
  conteudo: string;
  criada_em: string | null;
}

export function useAgenciaMensagens(sessaoId?: string | null) {
  return useQuery({
    queryKey: ['agencia', 'mensagens', sessaoId],
    enabled: !!sessaoId,
    queryFn: async (): Promise<MensagemAgencia[]> => {
      const { data, error } = await agencia()
        .from('mensagens')
        .select('id, papel, conteudo, criada_em')
        .eq('sessao_id', sessaoId)
        .order('criada_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MensagemAgencia[];
    },
  });
}

/** Conversa com um agente da agência através da função `agencia-conversar`. */
export function useConversarComAgente(agenteSlug: string, clienteId?: string | null) {
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Array<{ papel: 'pessoa' | 'agente'; conteudo: string }>>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || enviando) return;
      setErro(null);
      setEnviando(true);
      setMensagens((m) => [...m, { papel: 'pessoa', conteudo: pergunta }]);
      try {
        const { data, error } = await supabase.functions.invoke('agencia-conversar', {
          body: { agente_slug: agenteSlug, sessao_id: sessaoId, cliente_id: clienteId ?? null, mensagem: pergunta },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setSessaoId((data as any).sessao_id ?? sessaoId);
        setMensagens((m) => [...m, { papel: 'agente', conteudo: (data as any).resposta ?? '' }]);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível falar com o agente agora.');
      } finally {
        setEnviando(false);
      }
    },
    [agenteSlug, clienteId, sessaoId, enviando],
  );

  const reiniciar = useCallback(() => {
    setSessaoId(null);
    setMensagens([]);
    setErro(null);
  }, []);

  return { sessaoId, mensagens, enviar, enviando, erro, reiniciar };
}
