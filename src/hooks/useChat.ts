import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatMensagem {
  id: string;
  conversa_id: string;
  user_id: string;
  conteudo: string;
  anexo_url: string | null;
  anexo_nome: string | null;
  anexo_tipo: string | null;
  anexo_tamanho: number | null;
  reply_to_id: string | null;
  reply_to?: { id: string; conteudo: string; anexo_nome: string | null; user_id: string; deletada_em: string | null } | null;
  editada_em: string | null;
  deletada_em: string | null;
  created_at: string;
}

export interface ChatConversa {
  id: string;
  tipo: 'direta' | 'grupo';
  nome: string | null;
  criado_por: string;
  ultima_mensagem_em: string;
  participantes: { user_id: string; nome: string; avatar_url: string | null }[];
  minha_leitura_em: string;
  ultima_mensagem: ChatMensagem | null;
  nao_lidas: number;
}

export interface UsuarioDiretorio {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

export function useChatDiretorio() {
  const [usuarios, setUsuarios] = useState<UsuarioDiretorio[]>([]);
  useEffect(() => {
    supabase.rpc('chat_diretorio_usuarios').then(({ data }) => {
      setUsuarios((data as UsuarioDiretorio[]) ?? []);
    });
  }, []);
  return usuarios;
}


export function useChatConversas() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<ChatConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const diretorio = useRef<Map<string, UsuarioDiretorio>>(new Map());
  const [, forceRender] = useState(0);

  const carregar = useCallback(async () => {
    if (!user) return;
    const { data: minhas } = await supabase
      .from('chat_participantes')
      .select('conversa_id, ultima_leitura_em, arquivada')
      .eq('user_id', user.id)
      .eq('arquivada', false);
    if (!minhas?.length) {
      setConversas([]);
      setLoading(false);
      return;
    }
    const ids = minhas.map((m) => m.conversa_id);
    const leituraMap = new Map(minhas.map((m) => [m.conversa_id, m.ultima_leitura_em]));

    const [{ data: convs }, { data: parts }, { data: msgs }] = await Promise.all([
      supabase.from('chat_conversas').select('*').in('id', ids),
      supabase.from('chat_participantes').select('conversa_id, user_id').in('conversa_id', ids),
      supabase
        .from('chat_mensagens')
        .select('id, conversa_id, user_id, conteudo, anexo_url, anexo_nome, anexo_tipo, anexo_tamanho, reply_to_id, editada_em, deletada_em, created_at')
        .in('conversa_id', ids)
        .is('deletada_em', null)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const nomes = diretorio.current;
    const ultimaPorConversa = new Map<string, ChatMensagem>();
    const naoLidasPorConversa = new Map<string, number>();
    for (const m of msgs ?? []) {
      if (!ultimaPorConversa.has(m.conversa_id)) ultimaPorConversa.set(m.conversa_id, m as ChatMensagem);
      const leitura = leituraMap.get(m.conversa_id) ?? '1970-01-01';
      if (m.user_id !== user.id && m.created_at > leitura) {
        naoLidasPorConversa.set(m.conversa_id, (naoLidasPorConversa.get(m.conversa_id) ?? 0) + 1);
      }
    }

    const lista: ChatConversa[] = (convs ?? []).map((c) => ({
      id: c.id,
      tipo: c.tipo as 'direta' | 'grupo',
      nome: c.nome,
      criado_por: c.criado_por,
      ultima_mensagem_em: c.ultima_mensagem_em,
      participantes: (parts ?? [])
        .filter((p) => p.conversa_id === c.id)
        .map((p) => ({
          user_id: p.user_id,
          nome: nomes.get(p.user_id)?.nome ?? 'Usuário',
          avatar_url: nomes.get(p.user_id)?.avatar_url ?? null,
        })),

      minha_leitura_em: leituraMap.get(c.id) ?? '1970-01-01',
      ultima_mensagem: ultimaPorConversa.get(c.id) ?? null,
      nao_lidas: naoLidasPorConversa.get(c.id) ?? 0,
    }));
    lista.sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em));
    setConversas(lista);
    setLoading(false);
  }, [user]);

  // carrega diretório primeiro para resolver nomes e avatares
  useEffect(() => {
    supabase.rpc('chat_diretorio_usuarios').then(({ data }) => {
      for (const u of (data as UsuarioDiretorio[]) ?? []) diretorio.current.set(u.user_id, u);
      carregar();
    });
  }, [carregar]);


  // Realtime: mensagens novas atualizam lista
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-lista-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, () => carregar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participantes' }, () => carregar())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversas' }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, carregar]);

  const totalNaoLidas = useMemo(() => conversas.reduce((acc, c) => acc + c.nao_lidas, 0), [conversas]);

  return { conversas, loading, recarregar: carregar, totalNaoLidas, refreshDiretorio: () => forceRender((n) => n + 1) };
}

export function useChatMensagens(conversaId: string | null) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const PAGE = 50;

  const carregar = useCallback(async () => {
    if (!conversaId) {
      setMensagens([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('chat_mensagens')
      .select('id, conversa_id, user_id, conteudo, anexo_url, anexo_nome, anexo_tipo, anexo_tamanho, reply_to_id, editada_em, deletada_em, created_at')
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: false })
      .limit(PAGE + 1);
    const rows = (data ?? []) as ChatMensagem[];
    setHasMore(rows.length > PAGE);
    const lista = rows.slice(0, PAGE).reverse();
    setMensagens(lista);
    await preencherReplies(lista);
    setLoading(false);
  }, [conversaId]);

  const preencherReplies = async (lista: ChatMensagem[]) => {
    const faltam = [...new Set(lista.filter((m) => m.reply_to_id && !lista.some((x) => x.id === m.reply_to_id)).map((m) => m.reply_to_id!))];
    const replies = new Map<string, ChatMensagem['reply_to']>();
    for (const m of lista) {
      if (m.reply_to_id) {
        const orig = lista.find((x) => x.id === m.reply_to_id);
        if (orig) replies.set(m.id, { id: orig.id, conteudo: orig.conteudo, anexo_nome: orig.anexo_nome, user_id: orig.user_id, deletada_em: orig.deletada_em });
      }
    }
    if (faltam.length) {
      const { data } = await supabase
        .from('chat_mensagens')
        .select('id, conteudo, anexo_nome, user_id, deletada_em')
        .in('id', faltam);
      const byId = new Map((data ?? []).map((d) => [d.id, d]));
      for (const m of lista) {
        if (m.reply_to_id && !replies.has(m.id)) {
          const d = byId.get(m.reply_to_id);
          if (d) replies.set(m.id, d);
        }
      }
    }
    setMensagens((cur) => cur.map((m) => ({ ...m, reply_to: replies.get(m.id) ?? m.reply_to ?? null })));
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime da conversa ativa
  useEffect(() => {
    if (!conversaId || !user) return;
    const channel = supabase
      .channel(`chat-msgs-${conversaId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: `conversa_id=eq.${conversaId}` },
        (payload) => {
          const nova = payload.new as ChatMensagem;
          setMensagens((cur) => {
            if (cur.some((m) => m.id === nova.id)) return cur;
            const orig = nova.reply_to_id ? cur.find((x) => x.id === nova.reply_to_id) : null;
            const anexada = {
              ...nova,
              reply_to: orig ? { id: orig.id, conteudo: orig.conteudo, anexo_nome: orig.anexo_nome, user_id: orig.user_id, deletada_em: orig.deletada_em } : null,
            };
            // reply_to pode não estar carregado ainda (mensagem antiga); busca sob demanda
            if (nova.reply_to_id && !orig) {
              supabase.from('chat_mensagens').select('id, conteudo, anexo_nome, user_id, deletada_em').eq('id', nova.reply_to_id).maybeSingle()
                .then(({ data }) => {
                  if (data) setMensagens((c2) => c2.map((m) => (m.id === nova.id ? { ...m, reply_to: data } : m)));
                });
            }
            return [...cur, anexada];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_mensagens', filter: `conversa_id=eq.${conversaId}` },
        (payload) => {
          const upd = payload.new as ChatMensagem;
          setMensagens((cur) => cur.map((m) => (m.id === upd.id ? { ...m, ...upd } : m)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversaId, user]);

  const carregarMais = useCallback(async () => {
    if (!conversaId || !hasMore || mensagens.length === 0) return;
    const maisAntiga = mensagens[0].created_at;
    const { data } = await supabase
      .from('chat_mensagens')
      .select('id, conversa_id, user_id, conteudo, anexo_url, anexo_nome, anexo_tipo, anexo_tamanho, reply_to_id, editada_em, deletada_em, created_at')
      .eq('conversa_id', conversaId)
      .lt('created_at', maisAntiga)
      .order('created_at', { ascending: false })
      .limit(PAGE + 1);
    const rows = (data ?? []) as ChatMensagem[];
    setHasMore(rows.length > PAGE);
    const antigas = rows.slice(0, PAGE).reverse();
    setMensagens((cur) => [...antigas, ...cur]);
    await preencherReplies(antigas);
  }, [conversaId, hasMore, mensagens]);

  const enviar = useCallback(
    async (params: { conteudo: string; anexo?: File; replyToId?: string | null }) => {
      if (!user || !conversaId) return { error: 'Sem sessão' };
      const { conteudo, anexo, replyToId } = params;
      let anexo_url: string | null = null;
      let anexo_nome: string | null = null;
      let anexo_tipo: string | null = null;
      let anexo_tamanho: number | null = null;
      if (anexo) {
        if (anexo.size > 20 * 1024 * 1024) return { error: 'Arquivo excede 20 MB' };
        const path = `${conversaId}/${Date.now()}-${anexo.name.replace(/[^\w.\-À-ÿ ]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('chat-anexos').upload(path, anexo);
        if (upErr) return { error: 'Falha ao enviar anexo' };
        anexo_url = path;
        anexo_nome = anexo.name;
        anexo_tipo = anexo.type;
        anexo_tamanho = anexo.size;
      }
      const { error } = await supabase.from('chat_mensagens').insert({
        conversa_id: conversaId,
        user_id: user.id,
        conteudo,
        anexo_url,
        anexo_nome,
        anexo_tipo,
        anexo_tamanho,
        reply_to_id: replyToId ?? null,
      });
      return { error: error?.message ?? null };
    },
    [user, conversaId]
  );

  const marcarLida = useCallback(async () => {
    if (!user || !conversaId) return;
    const agora = new Date().toISOString();
    await supabase
      .from('chat_participantes')
      .update({ ultima_leitura_em: agora })
      .eq('conversa_id', conversaId)
      .eq('user_id', user.id);
    // marca notificações dessa conversa como lidas
    await supabase
      .from('notificacoes')
      .update({ lida: true, lida_em: agora })
      .eq('user_id', user.id)
      .eq('lida', false)
      .eq('entidade_tipo', 'chat_conversa')
      .eq('entidade_id', conversaId);
  }, [user, conversaId]);

  const deletar = useCallback(async (mensagemId: string) => {
    const agora = new Date().toISOString();
    await supabase.from('chat_mensagens').update({ deletada_em: agora }).eq('id', mensagemId);
  }, []);

  return { mensagens, loading, hasMore, carregarMais, enviar, marcarLida, deletar };
}

// Presença usa tópico fixo compartilhado entre todos os usuários/instâncias.
// Singleton em nível de módulo evita "cannot add callbacks after subscribe()"
// quando múltiplos componentes (página + widget) montam simultaneamente.
type PresencaShared = {
  channel: ReturnType<typeof supabase.channel>;
  userId: string;
  syncListeners: Set<(onlineIds: Set<string>) => void>;
  digitandoListeners: Set<(payload: { user_id: string; conversa_id: string }) => void>;
};
let presencaShared: PresencaShared | null = null;

function getPresencaShared(userId: string): PresencaShared {
  if (presencaShared && presencaShared.userId !== userId) {
    supabase.removeChannel(presencaShared.channel);
    presencaShared = null;
  }
  if (!presencaShared) {
    const shared: PresencaShared = {
      channel: null as unknown as ReturnType<typeof supabase.channel>,
      userId,
      syncListeners: new Set(),
      digitandoListeners: new Set(),
    };
    const channel = supabase.channel('chat-presenca', { config: { presence: { key: userId } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const ids = new Set(Object.keys(channel.presenceState()));
        shared.syncListeners.forEach((f) => f(ids));
      })
      .on('broadcast', { event: 'digitando' }, (payload) => {
        shared.digitandoListeners.forEach((f) => f(payload.payload as { user_id: string; conversa_id: string }));
      })
      .subscribe();
    shared.channel = channel;
    presencaShared = shared;
  }
  return presencaShared;
}

export function useChatPresenca(conversaId: string | null, nomesPorId: Map<string, string>) {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [digitando, setDigitando] = useState<string[]>([]);
  const digitandoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!user) return;
    const shared = getPresencaShared(user.id);

    const onSync = (ids: Set<string>) => setOnline(new Set(ids));
    const onDigitando = ({ user_id, conversa_id }: { user_id: string; conversa_id: string }) => {
      if (user_id === user.id || conversa_id !== conversaId) return;
      const nome = nomesPorId.get(user_id) ?? 'Alguém';
      setDigitando((cur) => (cur.includes(nome) ? cur : [...cur, nome]));
      const t = digitandoTimers.current.get(user_id);
      if (t) clearTimeout(t);
      digitandoTimers.current.set(
        user_id,
        setTimeout(() => {
          setDigitando((cur) => cur.filter((n) => n !== nome));
          digitandoTimers.current.delete(user_id);
        }, 3000)
      );
    };

    shared.syncListeners.add(onSync);
    shared.digitandoListeners.add(onDigitando);
    return () => {
      shared.syncListeners.delete(onSync);
      shared.digitandoListeners.delete(onDigitando);
    };
  }, [user, conversaId, nomesPorId]);

  const emitirDigitando = useCallback(() => {
    if (!conversaId || !user) return;
    presencaShared?.channel.send({
      type: 'broadcast',
      event: 'digitando',
      payload: { user_id: user.id, conversa_id: conversaId },
    });
  }, [conversaId, user]);

  return { online, digitando, emitirDigitando };
}

export async function criarConversaDireta(meUserId: string, outroUserId: string): Promise<{ id?: string; error?: string }> {
  // reutiliza conversa existente se houver
  const { data: minhas } = await supabase.from('chat_participantes').select('conversa_id').eq('user_id', meUserId);
  const { data: dele } = await supabase.from('chat_participantes').select('conversa_id').eq('user_id', outroUserId);
  const minhasSet = new Set((minhas ?? []).map((m) => m.conversa_id));
  const comum = (dele ?? []).map((d) => d.conversa_id).filter((id) => minhasSet.has(id));
  if (comum.length) {
    const { data: convs } = await supabase.from('chat_conversas').select('id').in('id', comum).eq('tipo', 'direta').limit(1);
    if (convs?.length) return { id: convs[0].id };
  }
  const { data: conv, error } = await supabase
    .from('chat_conversas')
    .insert({ tipo: 'direta', criado_por: meUserId })
    .select('id')
    .single();
  if (error || !conv) return { error: error?.message ?? 'Erro ao criar conversa' };
  const { error: pErr } = await supabase.from('chat_participantes').insert([
    { conversa_id: conv.id, user_id: meUserId },
    { conversa_id: conv.id, user_id: outroUserId },
  ]);
  if (pErr) {
    await supabase.from('chat_conversas').delete().eq('id', conv.id);
    return { error: pErr.message };
  }
  return { id: conv.id };
}

export async function criarGrupo(meUserId: string, nome: string, membros: string[]): Promise<{ id?: string; error?: string }> {
  if (!nome.trim() || membros.length === 0) return { error: 'Informe o nome e ao menos um membro' };
  const { data: conv, error } = await supabase
    .from('chat_conversas')
    .insert({ tipo: 'grupo', nome: nome.trim(), criado_por: meUserId })
    .select('id')
    .single();
  if (error || !conv) return { error: error?.message ?? 'Erro ao criar grupo' };
  const todos = [...new Set([meUserId, ...membros])];
  const { error: pErr } = await supabase
    .from('chat_participantes')
    .insert(todos.map((uid) => ({ conversa_id: conv.id, user_id: uid })));
  if (pErr) {
    await supabase.from('chat_conversas').delete().eq('id', conv.id);
    return { error: pErr.message };
  }
  return { id: conv.id };
}

export function nomeConversa(c: ChatConversa, meUserId: string): string {
  if (c.tipo === 'grupo') return c.nome ?? 'Grupo';
  const outro = c.participantes.find((p) => p.user_id !== meUserId);
  return outro?.nome ?? 'Conversa';
}
