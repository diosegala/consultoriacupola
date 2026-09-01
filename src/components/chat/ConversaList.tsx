import { useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Plus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChatConversa, nomeConversa, useChatPresenca } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { AvatarUploadDialog } from './AvatarUploadDialog';

function formatHora(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem';
  return format(d, 'dd/MM');
}

interface Props {
  conversas: ChatConversa[];
  ativa: string | null;
  onSelecionar: (id: string) => void;
  onNova: () => void;
  loading: boolean;
  onAvatarAtualizado?: () => void;
}

export function ConversaList({ conversas, ativa, onSelecionar, onNova, loading, onAvatarAtualizado }: Props) {
  const { user } = useAuth();
  const vazio = useMemo(() => new Map<string, string>(), []);
  const { online } = useChatPresenca(null, vazio);
  const [perfilOpen, setPerfilOpen] = useState(false);

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground">Mensagens</h2>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setPerfilOpen(true)} title="Minha foto">
            <UserRound className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onNova} title="Nova conversa">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {!loading && conversas.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma conversa ainda. Toque em + para começar.
          </p>
        )}
        {conversas.map((c) => {
          const nome = nomeConversa(c, user?.id ?? '');
          const outro = c.tipo === 'direta' ? c.participantes.find((p) => p.user_id !== user?.id) : null;
          const ultima = c.ultima_mensagem;
          const previa = ultima
            ? ultima.deletada_em
              ? 'Mensagem apagada'
              : ultima.conteudo || (ultima.anexo_nome ? `📎 ${ultima.anexo_nome}` : '')
            : '';
          return (
            <button
              key={c.id}
              onClick={() => onSelecionar(c.id)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors flex items-center gap-3',
                ativa === c.id && 'bg-accent'
              )}
            >
              <UserAvatar
                nome={nome}
                avatarPath={outro?.avatar_url}
                online={outro ? online.has(outro.user_id) : undefined}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-foreground truncate">{nome}</span>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {formatHora(c.ultima_mensagem_em)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{previa}</span>
                  {c.nao_lidas > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center">
                      {c.nao_lidas > 99 ? '99+' : c.nao_lidas}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <AvatarUploadDialog open={perfilOpen} onOpenChange={setPerfilOpen} onAtualizado={onAvatarAtualizado} />
    </div>
  );
}
