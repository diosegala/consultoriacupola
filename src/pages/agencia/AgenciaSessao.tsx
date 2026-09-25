import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/design-system/design-system-hub-ba3841';
import { useAgenciaAgentes, useAgenciaClientes, useTemAcessoAgencia } from '@/hooks/agencia/useAgencia';
import { useAgenciaSessao, quandoFoi } from '@/hooks/agencia/useAgenciaBase';
import { useAgenciaMensagens } from '@/hooks/agencia/useAgenciaConversa';
import { ConversaAgencia } from '@/components/agencia/ConversaAgencia';
import { Vazio } from '@/components/agencia/CabecalhoPagina';
import { cn } from '@/lib/utils';

export default function AgenciaSessao() {
  const { id } = useParams();
  const { pessoa } = useTemAcessoAgencia();
  const { data: sessao, isLoading } = useAgenciaSessao(id);
  const { data: mensagens, isLoading: carregandoMensagens } = useAgenciaMensagens(id);
  const { data: agentes = [] } = useAgenciaAgentes(true);
  const { data: clientes = [] } = useAgenciaClientes();
  const agente = agentes.find((a) => a.id === sessao?.agente_id);
  const conta = clientes.find((c) => c.id === sessao?.cliente_id);

  if (isLoading || carregandoMensagens) return <Vazio>Carregando…</Vazio>;
  if (!sessao) return <Vazio>Sessão não encontrada.</Vazio>;

  // Só quem começou a conversa continua nela; a equipe que acompanha o espaço só lê.
  const minha = !!pessoa && sessao.pessoa_id === pessoa.id && !!agente;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/agencia/sessoes" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">{sessao.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {agente?.nome ?? 'Agente'}
            {conta && ` · ${conta.nome}`} · {quandoFoi(sessao.atualizada_em)}
          </p>
        </div>
      </div>
      {minha ? (
        <ConversaAgencia
          agenteSlug={agente!.slug}
          clienteId={sessao.cliente_id}
          projetoId={sessao.projeto_id}
          sessaoInicial={sessao.id}
          mensagensIniciais={mensagens ?? []}
          semReiniciar
        />
      ) : !mensagens?.length ? (
        <Vazio>Esta sessão não tem mensagens.</Vazio>
      ) : (
        <div className="space-y-3">
          {mensagens.filter((m) => m.papel !== 'passo').map((m) => (
            <div
              key={m.id}
              className={cn(
                'rounded-xl border border-border p-4 text-sm',
                m.papel === 'pessoa' ? 'ml-12 bg-muted' : 'mr-12 bg-card',
              )}
            >
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{m.conteudo}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
