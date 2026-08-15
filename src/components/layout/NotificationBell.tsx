import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useNotificacoes,
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
  useDecidirNotificacao,
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
  sem_contato: 'Reengajar',
  score_cliente_em_queda: 'Engajamento',
};

const TIPOS_DECIDIVEIS = ['sem_contato', 'score_cliente_em_queda'];

const decisaoLabel: Record<string, string> = {
  aprovado: 'Aprovado',
  editado: 'Editado',
  rejeitado: 'Rejeitado',
};

function NotificacaoDecisao({ n }: { n: Notificacao }) {
  const decidir = useDecidirNotificacao();
  const [modo, setModo] = useState<'idle' | 'editar' | 'rejeitar'>('idle');
  const sugestao = (n.metadata as any)?.mensagem_sugerida ?? n.descricao ?? '';
  const [texto, setTexto] = useState<string>(sugestao);
  const [motivo, setMotivo] = useState('');

  if (n.decisao) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-2">
        {decisaoLabel[n.decisao] ?? n.decisao}
      </Badge>
    );
  }

  if (modo === 'editar') {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="text-xs"
          placeholder="Mensagem revisada"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!texto.trim() || decidir.isPending}
            onClick={() =>
              decidir.mutate({ id: n.id, decisao: 'editado', decisao_texto: texto.trim() })
            }
          >
            Salvar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setModo('idle')}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (modo === 'rejeitar') {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          className="text-xs"
          placeholder="Motivo (ex: não é prioridade agora)"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!motivo.trim() || decidir.isPending}
            onClick={() =>
              decidir.mutate({ id: n.id, decisao: 'rejeitado', decisao_motivo: motivo.trim() })
            }
          >
            Confirmar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setModo('idle')}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 mt-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={decidir.isPending}
        onClick={() => decidir.mutate({ id: n.id, decisao: 'aprovado' })}
      >
        <Check className="h-3.5 w-3.5 mr-1" />
        Aprovar
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModo('editar')}>
        <Pencil className="h-3.5 w-3.5 mr-1" />
        Editar
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setModo('rejeitar')}>
        <X className="h-3.5 w-3.5 mr-1" />
        Rejeitar
      </Button>
    </div>
  );
}

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
              {notificacoes.map((n) =>
                TIPOS_DECIDIVEIS.includes(n.tipo) ? (
                  <div
                    key={n.id}
                    className={cn('px-4 py-3', !n.lida && 'bg-accent/40')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {tipoLabel[n.tipo] ?? n.tipo}
                      </Badge>
                      {!n.lida && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <button
                      onClick={() => n.link && navigate(n.link)}
                      className="text-left w-full"
                    >
                      <div className="text-sm font-medium truncate">{n.titulo}</div>
                      {n.descricao && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.descricao}
                        </div>
                      )}
                    </button>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                    <NotificacaoDecisao n={n} />
                  </div>
                ) : (
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
                )
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}