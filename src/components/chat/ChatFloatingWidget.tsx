import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Maximize2, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useChatConversas } from '@/hooks/useChat';
import { ConversaList } from '@/components/chat/ConversaList';
import { ConversaThread } from '@/components/chat/ConversaThread';
import { NovaConversaDialog } from '@/components/chat/NovaConversaDialog';

export function ChatFloatingWidget() {
  const [open, setOpen] = useState(false);
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const { conversas, loading, recarregar, totalNaoLidas } = useChatConversas();
  const navigate = useNavigate();

  const ativa = conversas.find((c) => c.id === ativaId) ?? null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setOpen(true)}
              size="icon"
              variant="outline"
              className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-xl z-50 bg-card"
              aria-label="Abrir mensagens"
            >
              <MessageSquare className="h-6 w-6" />
              {totalNaoLidas > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center">
                  {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Mensagens</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                {ativaId && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAtivaId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <MessageSquare className="h-4 w-4 text-primary" /> Mensagens
              </SheetTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setNovaOpen(true)} title="Nova conversa">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    navigate(ativaId ? `/mensagens?c=${ativaId}` : '/mensagens');
                  }}
                  title="Abrir em tela cheia"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {ativa ? (
              <ConversaThread key={ativa.id} conversa={ativa} onRefreshLista={recarregar} />
            ) : (
              <ConversaList
                conversas={conversas}
                ativa={ativaId}
                onSelecionar={setAtivaId}
                onNova={() => setNovaOpen(true)}
                loading={loading}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NovaConversaDialog open={novaOpen} onOpenChange={setNovaOpen} onCriada={setAtivaId} />
    </>
  );
}
