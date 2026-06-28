import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, StopCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useOraculoChat, OraculoMsg } from "@/hooks/useOraculoChat";
import { useOraculoContext } from "@/hooks/useOraculoContext";
import { cn } from "@/lib/utils";

interface Props {
  conversaId?: string | null;
  initialMessages?: OraculoMsg[];
  onConversaCriada?: (id: string) => void;
  className?: string;
  compact?: boolean;
}

export function OraculoChatPanel({ conversaId, initialMessages = [], onConversaCriada, className, compact }: Props) {
  const { contexto } = useOraculoContext();
  const { messages, isStreaming, error, send, stop, reset, conversaId: currentConv } =
    useOraculoChat(initialMessages, conversaId ?? null);
  const [input, setInput] = useState("");
  const [usarContexto, setUsarContexto] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reset(initialMessages, conversaId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (currentConv && currentConv !== conversaId) onConversaCriada?.(currentConv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConv]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    await send(text, {
      contextoPagina: usarContexto && contexto ? contexto.resumo : undefined,
      contextoOrigem: usarContexto && contexto ? contexto.origem : undefined,
    });
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header com toggle de contexto */}
      {contexto && (
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-xs">
          <Switch checked={usarContexto} onCheckedChange={setUsarContexto} />
          <span className="text-muted-foreground">Usar contexto desta página</span>
          {usarContexto && (
            <Badge variant="secondary" className="ml-auto truncate max-w-[60%]">
              {contexto.origem.nome || contexto.origem.tipo}
            </Badge>
          )}
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              <p className="font-medium mb-2">Pergunte ao Oráculo da Cupola</p>
              <p>Tire dúvidas sobre o método, condução de reuniões, materiais e orientações para clientes.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className="max-w-[85%] flex flex-col gap-1">
                <div className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  compact && "text-xs"
                )}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                      <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === "assistant" && m.usou_rag && (
                  <Badge variant="outline" className="self-start gap-1 text-[10px] py-0 px-1.5 h-5 border-primary/40 text-primary">
                    <BookOpen className="h-3 w-3" /> Baseado no Método CUPOLA
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
        </div>
      </ScrollArea>

      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Pergunte ao Oráculo..."
          rows={2}
          className="resize-none min-h-[44px]"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button size="icon" variant="outline" onClick={stop}>
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}