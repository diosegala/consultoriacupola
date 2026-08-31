import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChatMensagem } from '@/hooks/useChat';

interface Props {
  replyTo: ChatMensagem | null;
  replyNome: string;
  onCancelReply: () => void;
  onEnviar: (conteudo: string, anexo: File | null, replyToId: string | null) => Promise<{ error: string | null }>;
  onDigitando: () => void;
}

export function MessageComposer({ replyTo, replyNome, onCancelReply, onEnviar, onDigitando }: Props) {
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    textareaRef.current?.focus();
  }, [replyTo]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if ((!conteudo && !anexo) || enviando) return;
    if (anexo && anexo.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O limite é 20 MB.', variant: 'destructive' });
      return;
    }
    setEnviando(true);
    const { error } = await onEnviar(conteudo, anexo, replyTo?.id ?? null);
    setEnviando(false);
    if (error) {
      toast({ title: 'Não foi possível enviar', description: error, variant: 'destructive' });
      return;
    }
    setTexto('');
    setAnexo(null);
    onCancelReply();
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-border bg-background">
      {replyTo && (
        <div className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground">
          <div className="flex-1 border-l-2 border-primary pl-2 py-1 truncate">
            <span className="font-medium text-foreground">{replyNome}</span>
            <span className="block truncate">{replyTo.deletada_em ? 'Mensagem apagada' : replyTo.conteudo || replyTo.anexo_nome || 'Anexo'}</span>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setAnexo(f);
            e.target.value = '';
          }}
        />
        <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} title="Anexar arquivo" className="flex-shrink-0">
          <Paperclip className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {anexo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 px-1">
              <Paperclip className="h-3 w-3" />
              <span className="truncate">{anexo.name}</span>
              <button onClick={() => setAnexo(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              onDigitando();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Digite sua mensagem…"
            className="min-h-[40px] max-h-32 resize-none"
            rows={1}
          />
        </div>
        <Button size="icon" onClick={enviar} disabled={enviando || (!texto.trim() && !anexo)} className="flex-shrink-0" title="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
