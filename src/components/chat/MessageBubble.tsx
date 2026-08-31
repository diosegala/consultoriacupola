import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMensagem } from '@/hooks/useChat';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, FileIcon, Reply, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mensagem: ChatMensagem;
  nomesPorId: Map<string, string>;
  onReply: (m: ChatMensagem) => void;
  onDelete: (id: string) => void;
  onClickReply: (replyId: string) => void;
  highlight: boolean;
}

export function MessageBubble({ mensagem: m, nomesPorId, onReply, onDelete, onClickReply, highlight }: Props) {
  const { user } = useAuth();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const propria = m.user_id === user?.id;
  const apagada = !!m.deletada_em;
  const isImagem = m.anexo_tipo?.startsWith('image/');

  useEffect(() => {
    let ativo = true;
    if (isImagem && m.anexo_url && !apagada) {
      supabase.storage.from('chat-anexos').createSignedUrl(m.anexo_url, 3600).then(({ data }) => {
        if (ativo && data?.signedUrl) setImgUrl(data.signedUrl);
      });
    }
    return () => {
      ativo = false;
    };
  }, [m.anexo_url, isImagem, apagada]);

  const baixar = async () => {
    if (!m.anexo_url) return;
    const { data } = await supabase.storage.from('chat-anexos').createSignedUrl(m.anexo_url, 60, { download: m.anexo_nome ?? true });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const nomeAutor = propria ? 'Você' : nomesPorId.get(m.user_id) ?? 'Usuário';
  const replyNome = m.reply_to ? (m.reply_to.user_id === user?.id ? 'Você' : nomesPorId.get(m.reply_to.user_id) ?? 'Usuário') : '';

  return (
    <div
      id={`msg-${m.id}`}
      className={cn('group flex flex-col max-w-[75%] transition-colors rounded-lg', propria ? 'self-end items-end' : 'self-start items-start', highlight && 'bg-primary/10')}
    >
      {!propria && <span className="text-[11px] text-muted-foreground mb-0.5 px-1">{nomeAutor}</span>}

      <div className="flex items-center gap-1">
        {propria && !apagada && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
            <button onClick={() => onReply(m)} className="p-1 text-muted-foreground hover:text-foreground" title="Responder">
              <Reply className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(m.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Apagar">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className={cn('rounded-lg px-3 py-2 text-sm break-words', propria ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground')}>
          {m.reply_to && !apagada && (
            <button
              onClick={() => onClickReply(m.reply_to!.id)}
              className={cn(
                'block w-full text-left text-xs border-l-2 pl-2 mb-1.5 py-0.5 rounded-sm opacity-80 hover:opacity-100',
                propria ? 'border-primary-foreground/60' : 'border-primary'
              )}
            >
              <span className="font-medium">{replyNome}</span>
              <span className="block truncate">
                {m.reply_to.deletada_em ? 'Mensagem apagada' : m.reply_to.conteudo || m.reply_to.anexo_nome || 'Anexo'}
              </span>
            </button>
          )}

          {apagada ? (
            <span className="italic opacity-70">Mensagem apagada</span>
          ) : (
            <>
              {m.conteudo && <span className="whitespace-pre-wrap">{m.conteudo}</span>}
              {isImagem && imgUrl && (
                <img src={imgUrl} alt={m.anexo_nome ?? 'Imagem'} className="mt-1 rounded-md max-w-[280px] max-h-64 object-cover cursor-pointer" onClick={() => window.open(imgUrl, '_blank')} />
              )}
              {m.anexo_url && !isImagem && (
                <button onClick={baixar} className={cn('mt-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs', propria ? 'border-primary-foreground/40' : 'border-border hover:bg-accent')}>
                  <FileIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{m.anexo_nome}</span>
                  <Download className="h-3.5 w-3.5 flex-shrink-0" />
                </button>
              )}
            </>
          )}

          <span className={cn('block text-[10px] mt-1 text-right', propria ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {format(new Date(m.created_at), 'HH:mm')}
            {m.editada_em && !apagada && ' (editada)'}
          </span>
        </div>

        {!propria && !apagada && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onReply(m)} className="p-1 text-muted-foreground hover:text-foreground" title="Responder">
              <Reply className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function separadorDia(rotulo: string) {
  return rotulo;
}

export function labelDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  if (isSameDay(d, hoje)) return 'Hoje';
  if (isSameDay(d, ontem)) return 'Ontem';
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}
