import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChatConversas } from '@/hooks/useChat';
import { ConversaList } from '@/components/chat/ConversaList';
import { ConversaThread } from '@/components/chat/ConversaThread';
import { NovaConversaDialog } from '@/components/chat/NovaConversaDialog';
import { MessageSquare } from 'lucide-react';

export default function Mensagens() {
  const { conversas, loading, recarregar } = useChatConversas();
  const [novaOpen, setNovaOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const ativaId = searchParams.get('c');
  const navigate = useNavigate();

  const ativa = conversas.find((c) => c.id === ativaId) ?? null;

  const selecionar = (id: string) => setSearchParams({ c: id });

  return (
    <div className="h-[calc(100vh-7rem)] flex border border-border rounded-lg overflow-hidden bg-background">
      <div className={`w-full md:w-80 flex-shrink-0 ${ativaId ? 'hidden md:block' : ''}`}>
        <ConversaList
          conversas={conversas}
          ativa={ativaId}
          onSelecionar={selecionar}
          onNova={() => setNovaOpen(true)}
          loading={loading}
          onAvatarAtualizado={recarregar}
        />
      </div>
      <div className={`flex-1 ${ativaId ? '' : 'hidden md:flex'} flex-col`}>
        {ativa ? (
          <ConversaThread key={ativa.id} conversa={ativa} onRefreshLista={recarregar} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">Selecione uma conversa ou inicie uma nova.</p>
          </div>
        )}
        {ativaId && !ativa && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <button className="text-sm text-primary hover:underline" onClick={() => navigate('/mensagens')}>
              Conversa não encontrada. Voltar para a lista
            </button>
          </div>
        )}
      </div>
      <NovaConversaDialog open={novaOpen} onOpenChange={setNovaOpen} onCriada={selecionar} />
    </div>
  );
}
