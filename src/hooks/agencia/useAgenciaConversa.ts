import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';

export interface Violacao {
  regra: string;
  termo: string;
}

export interface MensagemAgencia {
  id: string;
  papel: 'pessoa' | 'agente' | 'passo';
  conteudo: string;
  criada_em: string | null;
  avaliacao?: 'positivo' | 'negativo' | null;
  conta_sugerida?: string | null;
}

/** Uma mensagem na tela: a do agente pode estar chegando (sem id ainda). */
export interface MensagemConversa {
  id?: string;
  papel: 'pessoa' | 'agente';
  conteudo: string;
  avaliacao?: 'positivo' | 'negativo' | null;
  conta_sugerida?: string | null;
  conferencia?: Violacao[];
  chegando?: boolean;
}

export type ModoConversa = 'rapido' | 'apurado';

export function useAgenciaMensagens(sessaoId?: string | null) {
  return useQuery({
    queryKey: ['agencia', 'mensagens', sessaoId],
    enabled: !!sessaoId,
    queryFn: async (): Promise<MensagemAgencia[]> => {
      const { data, error } = await agencia()
        .from('mensagens')
        .select('id, papel, conteudo, criada_em, avaliacao, conta_sugerida')
        .eq('sessao_id', sessaoId)
        .order('criada_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MensagemAgencia[];
    },
  });
}

/** Tira da tela a marca `[[CONTA: id]]` — inteira ou ainda chegando pela metade. */
export function limparMarcaDeConta(texto: string) {
  return texto.replace(/\[\[\s*CONTA:[^\]]*\]\]/gi, '').replace(/\[\[[^\]]*$/, '').trimEnd();
}

type Evento =
  | { tipo: 'sessao'; sessao_id: string }
  | { tipo: 'delta'; texto: string }
  | { tipo: 'fim'; sessao_id: string; mensagem_id: string; resposta: string; conferencia: Violacao[]; conta_sugerida: string | null }
  | { tipo: 'erro'; error: string };

/** Chama `agencia-conversar` em modo stream e entrega cada evento SSE. */
async function conversarEmFluxo(corpo: Record<string, unknown>, aoEvento: (ev: Evento) => void) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agencia-conversar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ ...corpo, stream: true }),
  });
  if (!res.ok || !res.body) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.error ?? 'Não foi possível falar com o agente agora.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocos = buffer.split('\n\n');
    buffer = blocos.pop() ?? '';
    for (const bloco of blocos) {
      const linha = bloco.split('\n').find((l) => l.startsWith('data:'));
      if (!linha) continue;
      let ev: Evento;
      try {
        ev = JSON.parse(linha.slice(5).trim()) as Evento;
      } catch {
        continue; // evento parcial
      }
      aoEvento(ev);
    }
  }
}

interface Opcoes {
  clienteId?: string | null;
  projetoId?: string | null;
  /** Para continuar uma sessão salva. */
  sessaoInicial?: string | null;
  mensagensIniciais?: MensagemAgencia[];
  modoInicial?: ModoConversa;
}

/** Conversa com um agente da agência através da função `agencia-conversar`, com a resposta chegando aos pedaços. */
export function useConversarComAgente(agenteSlug: string, opcoes: Opcoes = {}) {
  const { clienteId, projetoId, sessaoInicial, mensagensIniciais, modoInicial } = opcoes;
  const queryClient = useQueryClient();
  const [sessaoId, setSessaoId] = useState<string | null>(sessaoInicial ?? null);
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoConversa>(modoInicial ?? 'rapido');

  // Ao abrir uma sessão salva, as mensagens chegam depois do primeiro render: carrega uma vez.
  const carregou = useRef(false);
  useEffect(() => {
    if (carregou.current || !sessaoInicial || !mensagensIniciais) return;
    carregou.current = true;
    setSessaoId(sessaoInicial);
    setMensagens(
      mensagensIniciais
        .filter((m) => m.papel !== 'passo')
        .map((m) => ({
          id: m.id,
          papel: m.papel as 'pessoa' | 'agente',
          conteudo: m.conteudo,
          avaliacao: m.avaliacao ?? null,
          conta_sugerida: m.conta_sugerida ?? null,
        })),
    );
  }, [sessaoInicial, mensagensIniciais]);

  const enviar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || enviando) return;
      setErro(null);
      setEnviando(true);
      setMensagens((m) => [...m, { papel: 'pessoa', conteudo: pergunta }, { papel: 'agente', conteudo: '', chegando: true }]);
      const atualizarUltima = (f: (m: MensagemConversa) => MensagemConversa) =>
        setMensagens((lista) => lista.map((m, i) => (i === lista.length - 1 ? f(m) : m)));
      try {
        await conversarEmFluxo(
          { agente_slug: agenteSlug, sessao_id: sessaoId, cliente_id: clienteId ?? null, projeto_id: projetoId ?? null, mensagem: pergunta, modo },
          (ev) => {
            if (ev.tipo === 'sessao') setSessaoId(ev.sessao_id);
            else if (ev.tipo === 'delta') atualizarUltima((m) => ({ ...m, conteudo: m.conteudo + ev.texto }));
            else if (ev.tipo === 'fim') {
              atualizarUltima(() => ({
                id: ev.mensagem_id,
                papel: 'agente',
                conteudo: ev.resposta,
                conferencia: ev.conferencia,
                conta_sugerida: ev.conta_sugerida,
                avaliacao: null,
              }));
            } else if (ev.tipo === 'erro') throw new Error(ev.error);
          },
        );
        void queryClient.invalidateQueries({ queryKey: ['agencia', 'sessoes'] });
      } catch (e) {
        // Resposta que não chegou não fica na tela como se fosse do agente.
        setMensagens((lista) => {
          const ultima = lista[lista.length - 1];
          return ultima?.papel === 'agente' && !ultima.id ? lista.slice(0, -1) : lista;
        });
        setErro(e instanceof Error ? e.message : 'Não foi possível falar com o agente agora.');
      } finally {
        setMensagens((lista) => lista.map((m) => (m.chegando ? { ...m, chegando: false } : m)));
        setEnviando(false);
      }
    },
    [agenteSlug, clienteId, projetoId, sessaoId, enviando, modo, queryClient],
  );

  const avaliar = useCallback(async (mensagemId: string, valor: 'positivo' | 'negativo' | null) => {
    setMensagens((lista) => lista.map((m) => (m.id === mensagemId ? { ...m, avaliacao: valor } : m)));
    const { error } = await agencia().from('mensagens').update({ avaliacao: valor }).eq('id', mensagemId);
    if (error) throw error;
  }, []);

  const reiniciar = useCallback(() => {
    setSessaoId(null);
    setMensagens([]);
    setErro(null);
  }, []);

  return { sessaoId, mensagens, enviar, enviando, erro, reiniciar, modo, setModo, avaliar };
}
