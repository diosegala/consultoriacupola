import { Link } from 'react-router-dom';
import { Bot, Pin } from 'lucide-react';
import { useAgenciaAgentes, useAgenciaClientes, useAgenciaPessoas, useTemAcessoAgencia } from '@/hooks/agencia/useAgencia';
import { useAgenciaSessoes, quandoFoi } from '@/hooks/agencia/useAgenciaBase';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';

export default function AgenciaSessoes() {
  const { pessoa } = useTemAcessoAgencia();
  const { data: sessoes = [], isLoading } = useAgenciaSessoes();
  const { data: agentes = [] } = useAgenciaAgentes(true);
  const { data: pessoas = [] } = useAgenciaPessoas();
  const { data: clientes = [] } = useAgenciaClientes();

  const lista = [...sessoes].sort((a, b) => Number(!!b.fixada) - Number(!!a.fixada));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CabecalhoPagina rotulo="Histórico" titulo="Sessões" descricao="As suas e as da equipe, nos espaços que você acompanha." />
      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : lista.length === 0 ? (
        <Vazio>Nenhuma sessão ainda. Escolha um agente para começar.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {lista.map((s) => {
            const agente = agentes.find((a) => a.id === s.agente_id);
            const autor = pessoas.find((p) => p.id === s.pessoa_id);
            const conta = clientes.find((c) => c.id === s.cliente_id);
            return (
              <Link
                key={s.id}
                to={`/agencia/sessoes/${s.id}`}
                className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {s.titulo}
                    {s.subtitulo && <span className="font-normal text-muted-foreground"> · {s.subtitulo}</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {autor?.id === pessoa?.id ? 'Você' : (autor?.nome ?? 'Alguém')}
                    {agente && ` · ${agente.nome}`}
                    {conta && ` · ${conta.nome}`}
                  </span>
                </span>
                {s.fixada && <Pin className="ml-auto h-4 w-4 text-primary" />}
                <span className={`${s.fixada ? '' : 'ml-auto'} shrink-0 font-mono text-xs text-muted-foreground`}>
                  {quandoFoi(s.atualizada_em)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
