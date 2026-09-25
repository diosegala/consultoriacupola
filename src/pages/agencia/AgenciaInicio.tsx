import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Building2, History, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ModoConversa } from '@/hooks/agencia/useAgenciaConversa';
import { cn } from '@/lib/utils';
import { useAgenciaAgentes, useAgenciaClientes, useTemAcessoAgencia } from '@/hooks/agencia/useAgencia';
import { useAgenciaSessoes, quandoFoi } from '@/hooks/agencia/useAgenciaBase';
import { Vazio } from '@/components/agencia/CabecalhoPagina';

/** Quem atende a caixa da Home: o assistente geral, e mais ninguém (ver Inicio.tsx do CupolaOS). */
const ASSISTENTE_GERAL = 'cupolaos';
const SEM_CONTA = '__sem_conta__';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function AgenciaInicio() {
  const { pessoa } = useTemAcessoAgencia();
  const { data: agentes = [] } = useAgenciaAgentes();
  const { data: clientes = [] } = useAgenciaClientes();
  const { data: sessoes = [] } = useAgenciaSessoes();
  const minhas = sessoes.filter((s) => s.pessoa_id === pessoa?.id).slice(0, 6);
  const destaque = agentes.filter((a: any) => a.destaque).slice(0, 4);
  const atalhos = (destaque.length ? destaque : agentes).slice(0, 4);
  const primeiroNome = pessoa?.nome?.split(' ')[0] ?? '';
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const [contaId, setContaId] = useState('');
  const [modo, setModo] = useState<ModoConversa>('rapido');

  /** A conversa nasce no assistente geral, com a conta escolhida, e a tela dele envia o texto. */
  const conversar = () => {
    const pergunta = texto.trim();
    if (!pergunta) return;
    if (!agentes.some((a) => a.slug === ASSISTENTE_GERAL)) {
      toast.error('Você não tem acesso ao assistente geral, que é quem atende esta caixa. Fale com a coordenação.');
      return;
    }
    const conta = contaId ? `?conta=${encodeURIComponent(contaId)}` : '';
    navigate(`/agencia/agentes/${ASSISTENTE_GERAL}${conta}`, { state: { primeira: pergunta, modo } });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="space-y-2 pt-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-4xl font-bold text-foreground">
          {saudacao()}{primeiroNome && `, ${primeiroNome}`}.
        </h1>
        <p className="text-muted-foreground">O que vamos fazer hoje?</p>
      </div>

      <section className="mx-auto max-w-3xl space-y-2 rounded-xl border border-border bg-card p-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte sobre o mercado, peça uma ideia, revise um raciocínio… (Ctrl+Enter envia)"
          rows={3}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              conversar();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={contaId || SEM_CONTA} onValueChange={(v) => setContaId(v === SEM_CONTA ? '' : v)}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Sem conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_CONTA}>Sem conta</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Modo da resposta">
            {(['rapido', 'apurado'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => setModo(m)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  modo === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'rapido' ? 'Rápido' : 'Apurado'}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={conversar} disabled={!texto.trim()} className="ml-auto gap-1.5">
            <Send className="h-3.5 w-3.5" /> Conversar
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Bot className="h-5 w-5 text-primary" /> Agentes</h2>
          <Link to="/agencia/agentes" className="flex items-center gap-1 text-sm text-primary">Ver todos <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {atalhos.map((a) => (
            <Link key={a.id} to={`/agencia/agentes/${a.slug}`} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
              <p className="font-semibold text-foreground">{a.nome}</p>
              {a.resumo && <p className="line-clamp-2 text-sm text-muted-foreground">{a.resumo}</p>}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><History className="h-5 w-5 text-primary" /> Suas sessões recentes</h2>
            <Link to="/agencia/sessoes" className="flex items-center gap-1 text-sm text-primary">Histórico <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {minhas.length === 0 ? (
            <Vazio>Você ainda não conversou com nenhum agente.</Vazio>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {minhas.map((s) => (
                <Link key={s.id} to={`/agencia/sessoes/${s.id}`} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted">
                  <span className="truncate text-sm text-foreground">{s.titulo}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{quandoFoi(s.atualizada_em)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Building2 className="h-5 w-5 text-primary" /> Carteira</h2>
            <Link to="/agencia/contas" className="flex items-center gap-1 text-sm text-primary">{clientes.length} clientes <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {clientes.slice(0, 12).map((c) => (
              <Link key={c.id} to={`/agencia/contas/${c.slug}`} className="rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground hover:border-primary">
                {c.nome}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
