import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/design-system/design-system-hub-ba3841';
import { useAgenciaAgentes } from '@/hooks/agencia/useAgencia';
import { useAgenciaSessao, quandoFoi } from '@/hooks/agencia/useAgenciaBase';
import { useAgenciaMensagens } from '@/hooks/agencia/useAgenciaConversa';
import { Vazio } from '@/components/agencia/CabecalhoPagina';
import { cn } from '@/lib/utils';

export default function AgenciaSessao() {
  const { id } = useParams();
  const { data: sessao, isLoading } = useAgenciaSessao(id);
  const { data: mensagens = [] } = useAgenciaMensagens(id);
  const { data: agentes = [] } = useAgenciaAgentes(true);
  const agente = agentes.find((a) => a.id === sessao?.agente_id);

  if (isLoading) return <Vazio>Carregando…</Vazio>;
  if (!sessao) return <Vazio>Sessão não encontrada.</Vazio>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/agencia/sessoes" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">{sessao.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {agente?.nome ?? 'Agente'} · {quandoFoi(sessao.atualizada_em)}
          </p>
        </div>
      </div>
      {mensagens.length === 0 ? (
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
