import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, ArrowRight, Check, Copy, Loader2, RotateCcw, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAgenciaClientes } from '@/hooks/agencia/useAgencia';
import {
  limparMarcaDeConta,
  useConversarComAgente,
  type MensagemAgencia,
  type MensagemConversa,
  type ModoConversa,
} from '@/hooks/agencia/useAgenciaConversa';
import { cn } from '@/lib/utils';

interface Props {
  agenteSlug: string;
  clienteId?: string | null;
  projetoId?: string | null;
  sessaoInicial?: string | null;
  mensagensIniciais?: MensagemAgencia[];
  /** Texto que chegou de outra tela (Início, funil de conta) e é enviado ao abrir. */
  primeira?: string | null;
  modoInicial?: ModoConversa;
  /** Esconde o "Nova conversa" quando a tela é de uma sessão salva. */
  semReiniciar?: boolean;
}

const MODOS: { id: ModoConversa; rotulo: string; dica: string }[] = [
  { id: 'rapido', rotulo: 'Rápido', dica: 'Resposta direta, para o dia a dia.' },
  { id: 'apurado', rotulo: 'Apurado', dica: 'Pensa mais antes de responder. Mais lento e mais caro.' },
];

export function ConversaAgencia({
  agenteSlug,
  clienteId,
  projetoId,
  sessaoInicial,
  mensagensIniciais,
  primeira,
  modoInicial,
  semReiniciar,
}: Props) {
  const navigate = useNavigate();
  const { data: clientes = [] } = useAgenciaClientes();
  const { mensagens, enviar, enviando, erro, reiniciar, modo, setModo, avaliar } = useConversarComAgente(agenteSlug, {
    clienteId,
    projetoId,
    sessaoInicial,
    mensagensIniciais,
    modoInicial,
  });
  const [texto, setTexto] = useState('');
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, enviando]);

  // O texto vindo de outra tela é enviado uma vez só, com o modo escolhido lá.
  const jaEnviou = useRef(false);
  useEffect(() => {
    if (jaEnviou.current || !primeira?.trim()) return;
    jaEnviou.current = true;
    void enviar(primeira);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primeira]);

  const submeter = async () => {
    const t = texto;
    setTexto('');
    await enviar(t);
  };

  /** Abre a conversa de novo, já dentro da conta sugerida, levando a pergunta junto. */
  const abrirNaConta = (contaId: string, indice: number) => {
    const pergunta = [...mensagens.slice(0, indice)].reverse().find((m) => m.papel === 'pessoa')?.conteudo ?? '';
    navigate(`/agencia/agentes/${agenteSlug}?conta=${encodeURIComponent(contaId)}`, { state: { primeira: pergunta, modo } });
  };

  return (
    <div className="space-y-3">
      <Card className="min-h-[420px]">
        <CardContent className="space-y-4 p-5">
          {mensagens.length === 0 && !enviando && (
            <p className="py-16 text-center text-sm text-muted-foreground">Faça a primeira pergunta para este agente.</p>
          )}
          {mensagens.map((m, i) => (
            <Mensagem
              key={m.id ?? `nova-${i}`}
              m={m}
              nomeDaConta={(id) => clientes.find((c) => c.id === id)?.nome ?? id}
              aoAbrirConta={(id) => abrirNaConta(id, i)}
              aoAvaliar={(valor) => m.id && avaliar(m.id, valor).catch(() => toast.error('Não foi possível salvar a avaliação.'))}
            />
          ))}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div ref={fim} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Modo da resposta">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={modo === m.id}
              title={m.dica}
              onClick={() => setModo(m.id)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                modo === m.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
        {!semReiniciar && mensagens.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reiniciar} disabled={enviando} className="ml-auto gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Nova conversa
          </Button>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva sua mensagem… (Ctrl+Enter envia)"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submeter();
            }
          }}
        />
        <Button onClick={submeter} disabled={enviando || !texto.trim()} className="h-[76px] px-5" aria-label="Enviar">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function Mensagem({
  m,
  nomeDaConta,
  aoAbrirConta,
  aoAvaliar,
}: {
  m: MensagemConversa;
  nomeDaConta: (id: string) => string;
  aoAbrirConta: (id: string) => void;
  aoAvaliar: (valor: 'positivo' | 'negativo' | null) => void;
}) {
  const [copiado, setCopiado] = useState(false);

  if (m.papel === 'pessoa') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">{m.conteudo}</div>
      </div>
    );
  }

  const conteudo = limparMarcaDeConta(m.conteudo);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-foreground">
          {m.chegando && !conteudo ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> O agente está pensando…
            </span>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{conteudo}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Camada 4: avisa, não bloqueia — quem decide é quem vai entregar. */}
        {!!m.conferencia?.length && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium">Confira antes de usar: a resposta toca em termos vetados pelas regras da conta.</p>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {m.conferencia.map((v, i) => (
                  <li key={i}>
                    “{v.termo}” — {v.regra}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {m.conta_sugerida && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => aoAbrirConta(m.conta_sugerida!)}>
            Continuar dentro de {nomeDaConta(m.conta_sugerida)} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}

        {m.id && !m.chegando && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <button type="button" onClick={copiar} className="rounded p-1 hover:bg-muted hover:text-foreground" title="Copiar">
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => aoAvaliar(m.avaliacao === 'positivo' ? null : 'positivo')}
              className={cn('rounded p-1 hover:bg-muted hover:text-foreground', m.avaliacao === 'positivo' && 'text-primary')}
              title="Resposta boa"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => aoAvaliar(m.avaliacao === 'negativo' ? null : 'negativo')}
              className={cn('rounded p-1 hover:bg-muted hover:text-foreground', m.avaliacao === 'negativo' && 'text-destructive')}
              title="Resposta ruim"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
