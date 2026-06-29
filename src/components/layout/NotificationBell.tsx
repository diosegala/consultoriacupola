import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useNotificacoes,
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
  type Notificacao,
} from '@/hooks/useNotificacoes';
import { cn } from '@/lib/utils';

const tipoLabel: Record<string, string> = {
  tarefa_atribuida: 'Tarefa',
  projeto_etapa: 'Projeto',
  projeto_comentario: 'Comentário',
  checklist_concluido: 'Checklist',
  questionario_finalizado: 'Onboarding',
  contrato_vencendo: 'Contrato',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notificacoes = [] } = useNotificacoes();
  const marcarLida = useMarcarNotificacaoLida();
  const marcarTodas = useMarcarTodasLidas();

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const handleClick = (n: Notificacao) => {
    if (!n.lida) marcarLida.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-card border border-border shadow-sm hover:bg-accent"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Notificações</div>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => marcarTodas.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[460px]">
          {notificacoes.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui.
            </div>
          ) : (
            <div className="divide-y">
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-accent transition-colors flex gap-3',
                    !n.lida && 'bg-accent/40'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {tipoLabel[n.tipo] ?? n.tipo}
                      </Badge>
                      {!n.lida && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div className="text-sm font-medium truncate">{n.titulo}</div>
                    {n.descricao && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {n.descricao}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                  {!n.lida && (
                    <Check
                      className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}