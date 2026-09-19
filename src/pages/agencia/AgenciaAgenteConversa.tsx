import { useMemo, useRef, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2, RotateCcw, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgenciaAgentes, useAgenciaClientes } from '@/hooks/agencia/useAgencia';
import { useConversarComAgente } from '@/hooks/agencia/useAgenciaConversa';

export default function AgenciaAgenteConversa() {
  const { slug = '' } = useParams();
  const { data: agentes, isLoading } = useAgenciaAgentes();
  const { data: clientes } = useAgenciaClientes();
  const agente = useMemo(() => (agentes ?? []).find((a) => a.slug === slug), [agentes, slug]);

  const [clienteId, setClienteId] = useState<string>('');
  const [texto, setTexto] = useState('');
  const { mensagens, enviar, enviando, erro, reiniciar } = useConversarComAgente(slug, clienteId || null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  const submeter = async () => {
    const t = texto;
    setTexto('');
    await enviar(t);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/agencia/agentes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="rounded-lg bg-primary/10 p-2">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{agente?.nome ?? slug}</h1>
          {agente?.resumo && <p className="text-sm text-muted-foreground">{agente.resumo}</p>}
        </div>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Sem conta vinculada" />
          </SelectTrigger>
          <SelectContent>
            {(clientes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={reiniciar} title="Nova conversa">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="min-h-[420px]">
        <CardContent className="space-y-4 p-5">
          {mensagens.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Faça a primeira pergunta para este agente.
            </p>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={m.papel === 'pessoa' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm ${
                  m.papel === 'pessoa' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                }`}
              >
                {m.conteudo}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> O agente está pensando…
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div ref={fim} />
        </CardContent>
      </Card>

      <div className="flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva sua mensagem…"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submeter();
            }
          }}
        />
        <Button onClick={submeter} disabled={enviando || !texto.trim()} className="h-[76px] px-5">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
