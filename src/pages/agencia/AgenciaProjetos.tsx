import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { Input } from '@/design-system/design-system-hub-ba3841';
import { useAgenciaClientes, useAgenciaProjetos } from '@/hooks/agencia/useAgencia';
import { quandoFoi } from '@/hooks/agencia/useAgenciaBase';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';
import { cn } from '@/lib/utils';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'ativo', label: 'Ativos' },
  { id: 'pausado', label: 'Pausados' },
  { id: 'concluido', label: 'Concluídos' },
];

export default function AgenciaProjetos() {
  const { data: projetos = [], isLoading } = useAgenciaProjetos();
  const { data: clientes = [] } = useAgenciaClientes();
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const visiveis = projetos.filter(
    (p) => (filtro === 'todos' || p.status === filtro) && (!termo || `${p.nome} ${p.resumo ?? ''}`.toLowerCase().includes(termo)),
  );

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        rotulo="Trabalho"
        titulo="Projetos"
        descricao="Os projetos de todas as contas. Para criar um, abra o cliente e use a aba de projetos."
      />
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              filtro === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label} ({f.id === 'todos' ? projetos.length : projetos.filter((p) => p.status === f.id).length})
          </button>
        ))}
        <div className="ml-auto w-full sm:w-72">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto" />
        </div>
      </div>
      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : visiveis.length === 0 ? (
        <Vazio>{projetos.length === 0 ? 'Nenhum projeto ainda. Os projetos vieram vazios na exportação do CupolaOS.' : 'Nenhum projeto com esse filtro.'}</Vazio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((p) => {
            const conta = clientes.find((c) => c.id === p.cliente_id);
            return (
              <Link
                key={p.id}
                to={conta ? `/agencia/contas/${conta.slug}` : '#'}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{p.nome}</span>
                </div>
                {p.resumo && <p className="line-clamp-2 text-sm text-muted-foreground">{p.resumo}</p>}
                <p className="mt-auto text-xs text-muted-foreground">
                  {conta?.nome ?? 'Sem conta'} · {p.status ?? 'ativo'} · {quandoFoi(p.atualizado_em)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
