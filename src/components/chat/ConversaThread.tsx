import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSameDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ChatConversa, ChatMensagem, nomeConversa, useChatMensagens, useChatPresenca } from '@/hooks/useChat';
import { MessageBubble, labelDia } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './UserAvatar';

interface Props {
  conversa: ChatConversa;
  onRefreshLista: () => void;
}

export function ConversaThread({ conversa, onRefreshLista }: Props) {
  const { user } = useAuth();
  const { mensagens, loading, hasMore, carregarMais, enviar, marcarLida, deletar } = useChatMensagens(conversa.id);
  const nomesPorId = useMemo(() => new Map(conversa.participantes.map((p) => [p.user_id, p.nome])), [conversa.participantes]);
  const { online, digitando, emitirDigitando } = useChatPresenca(conversa.id, nomesPorId);
  const [replyTo, setReplyTo] = useState<ChatMensagem | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const primeiraCarga = useRef(true);

  const nome = nomeConversa(conversa, user?.id ?? '');
  const outroDireto = conversa.tipo === 'direta' ? conversa.participantes.find((p) => p.user_id !== user?.id) : null;
  const outroOnline = outroDireto ? online.has(outroDireto.user_id) : false;

  // scroll para o fim em mensagens novas / primeira carga
  useEffect(() => {
    if (!scrollRef.current) return;
    if (primeiraCarga.current && mensagens.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      primeiraCarga.current = false;
      return;
    }
    const el = scrollRef.current;
    const pertoDoFim = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (pertoDoFim) el.scrollTop = el.scrollHeight;
  }, [mensagens.length]);

  useEffect(() => {
    primeiraCarga.current = true;
    setReplyTo(null);
    setHighlightId(null);
  }, [conversa.id]);

  // marca como lida quando abre ou chega mensagem
  useEffect(() => {
    marcarLida().then(onRefreshLista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.id, mensagens.length]);

  const irParaMensagem = useCallback(
    async (id: string) => {
      let alvo = document.getElementById(`msg-${id}`);
      let tentativas = 0;
      while (!alvo && tentativas < 5) {
        await carregarMais();
        await new Promise((r) => setTimeout(r, 250));
        alvo = document.getElementById(`msg-${id}`);
        tentativas++;
      }
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightId(id);
        setTimeout(() => setHighlightId(null), 2000);
      }
    },
    [carregarMais]
  );

  const onEnviar = useCallback(
    async (conteudo: string, anexo: File | null, replyToId: string | null) => {
      const res = await enviar({ conteudo, anexo: anexo ?? undefined, replyToId });
      if (!res.error) {
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 150);
      }
      return res;
    },
    [enviar]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar
            nome={nome}
            avatarPath={outroDireto?.avatar_url}
            online={conversa.tipo === 'direta' ? outroOnline : undefined}
          />
          <div>
          <h3 className="font-semibold text-foreground">{nome}</h3>
          {conversa.tipo === 'direta' ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${outroOnline ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
              {outroOnline ? 'Online' : 'Offline'}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {conversa.participantes.length} participantes · {conversa.participantes.map((p) => p.nome.split(' ')[0]).join(', ')}
            </span>
          )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {hasMore && (
          <div className="text-center mb-3">
            <Button variant="ghost" size="sm" onClick={carregarMais}>
              Carregar mensagens anteriores
            </Button>
          </div>
        )}
        {loading && mensagens.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>}
        {!loading && mensagens.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem ainda. Envie a primeira!</p>
        )}
        <div className="flex flex-col gap-2">
          {mensagens.map((m, i) => {
            const mostrarDia = i === 0 || !isSameDay(new Date(mensagens[i - 1].created_at), new Date(m.created_at));
            return (
              <div key={m.id} className="contents">
                {mostrarDia && (
                  <div className="self-center my-2 text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {labelDia(m.created_at)}
                  </div>
                )}
                <MessageBubble
                  mensagem={m}
                  nomesPorId={nomesPorId}
                  onReply={setReplyTo}
                  onDelete={deletar}
                  onClickReply={irParaMensagem}
                  highlight={highlightId === m.id}
                />
              </div>
            );
          })}
        </div>
        {digitando.length > 0 && (
          <p className="text-xs text-muted-foreground italic mt-2">{digitando.join(', ')} {digitando.length > 1 ? 'estão digitando' : 'está digitando'}…</p>
        )}
      </div>

      <MessageComposer
        replyTo={replyTo}
        replyNome={replyTo ? (replyTo.user_id === user?.id ? 'Você' : nomesPorId.get(replyTo.user_id) ?? 'Usuário') : ''}
        onCancelReply={() => setReplyTo(null)}
        onEnviar={onEnviar}
        onDigitando={emitirDigitando}
      />
    </div>
  );
}
