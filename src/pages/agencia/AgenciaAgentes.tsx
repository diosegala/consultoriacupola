import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlignLeft, BadgeCheck, BookOpen, Bot, Clapperboard, Clock, Grid3x3,
  Image as ImageIcon, LayoutGrid, Orbit, Pencil, Search, Terminal,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/design-system/design-system-hub-ba3841';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AgenteFormDialog } from '@/components/agencia/AgenteFormDialog';
import {
  useAgenciaAgentes,
  useAgenciaEspacos,
  useAgenciaPessoa,
  type AgenciaAgente,
  type AgenciaEspaco,
} from '@/hooks/agencia/useAgencia';

const ICONES: Record<string, typeof Bot> = {
  linhas: AlignLeft,
  mosaico: LayoutGrid,
  filme: Clapperboard,
  imagem: ImageIcon,
  grade: Grid3x3,
  confere: BadgeCheck,
  orbita: Orbit,
  terminal: Terminal,
  relogio: Clock,
  livro: BookOpen,
};

function iconeDe(a: AgenciaAgente) {
  return (a.glifo && ICONES[a.glifo]) || Bot;
}

/** Cores por área: tokens chart do design system, na ordem das áreas. */
const FUNDOS_AREA = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];

export default function AgenciaAgentes() {
  const { data: pessoa } = useAgenciaPessoa();
  const podeGerenciar = pessoa?.papel === 'admin' || pessoa?.papel === 'gestor';
  const { data: agentes, isLoading } = useAgenciaAgentes(podeGerenciar);
  const { data: espacos } = useAgenciaEspacos();
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState<string>('todas');
  const [alvo, setAlvo] = useState<{ aberto: boolean; id: string | null }>({
    aberto: false,
    id: null,
  });

  /** Áreas do tipo 'area' (Geral primeiro), com a cor de fundo fixa de cada uma. */
  const areas = useMemo(() => {
    const lista = (espacos ?? [])
      .filter((e) => e.tipo === 'area')
      .sort((x, y) => (x.id === 'geral' ? -1 : y.id === 'geral' ? 1 : x.nome.localeCompare(y.nome)));
    return lista.map((e, i) => ({ ...e, fundo: FUNDOS_AREA[i % FUNDOS_AREA.length] }));
  }, [espacos]);

  const areaDoAgente = (a: AgenciaAgente): AgenciaEspaco | undefined =>
    areas.find((e) => e.id === (a.espaco_id ?? 'geral'));

  const contagens = useMemo(() => {
    const m: Record<string, number> = { todas: (agentes ?? []).length };
    (agentes ?? []).forEach((a) => {
      const id = a.espaco_id ?? 'geral';
      m[id] = (m[id] ?? 0) + 1;
    });
    return m;
  }, [agentes]);

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    return (agentes ?? []).filter(
      (a) =>
        (area === 'todas' || (a.espaco_id ?? 'geral') === area) &&
        (!alvo ||
          a.nome.toLowerCase().includes(alvo) ||
          (a.resumo ?? '').toLowerCase().includes(alvo)),
    );
  }, [agentes, busca, area]);

  const agenteAlvo = (agentes ?? []).find((a) => a.id === alvo.id) ?? null;

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Biblioteca
        </p>
        <h1 className="text-4xl font-medium tracking-tight md:text-5xl">Agentes</h1>
        <p className="text-muted-foreground">
          Você vê {(agentes ?? []).length} agent{(agentes ?? []).length === 1 ? 'e' : 'es'} da
          agência{podeGerenciar ? ', incluindo os ocultos.' : '.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pilha
          ativa={area === 'todas'}
          onClick={() => setArea('todas')}
          contagem={contagens.todas ?? 0}
        >
          Todos
        </Pilha>
        {areas
          .filter((e) => (contagens[e.id] ?? 0) > 0)
          .map((e) => (
            <Pilha
              key={e.id}
              ativa={area === e.id}
              cor={e.cor}
              onClick={() => setArea(e.id)}
              contagem={contagens[e.id] ?? 0}
            >
              {e.nome}
            </Pilha>
          ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar agente…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="min-h-64 w-full rounded-3xl" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum agente encontrado{busca ? ` para “${busca}”` : ''}.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((a) => {
            const espaco = areaDoAgente(a);
            const Icone = iconeDe(a);
            return (
              <div key={a.id} className="relative">
                <Link
                  to={`/agencia/agentes/${a.slug}`}
                  className={cn(
                    'group flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl p-6 text-background transition-transform hover:-translate-y-1',
                    espaco?.fundo ?? 'bg-muted',
                  )}
                >
                  <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-background" />
                  <div className="flex items-start gap-2">
                    <span className="w-fit rounded-full border border-background px-3 py-1 text-xs">
                      {espaco?.nome ?? 'Geral'}
                    </span>
                    {podeGerenciar && a.oculto && (
                      <span className="w-fit rounded-full border border-background px-3 py-1 text-xs">
                        Oculto
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-background">
                      <Icone className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-3xl font-medium leading-tight">{a.nome}</p>
                      <p className="line-clamp-1 text-sm">
                        {a.resumo || 'Em construção.'}
                      </p>
                    </div>
                  </div>
                </Link>
                {podeGerenciar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-3 text-background hover:text-background"
                    onClick={() => setAlvo({ aberto: true, id: a.id })}
                    aria-label={`Editar ${a.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {agenteAlvo && (
        <AgenteFormDialog
          aberto={alvo.aberto}
          onOpenChange={(aberto) => setAlvo({ aberto, id: aberto ? alvo.id : null })}
          agente={agenteAlvo}
          espacos={(espacos ?? []).filter((e) => e.tipo !== 'pessoal')}
        />
      )}
    </div>
  );
}

function Pilha({
  ativa,
  cor,
  contagem,
  onClick,
  children,
}: {
  ativa: boolean;
  cor?: string | null;
  contagem: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
        ativa
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card hover:bg-muted',
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={cor ? { backgroundColor: cor } : undefined}
      />
      <span>{children}</span>
      <span className={cn('text-xs', ativa ? 'opacity-80' : 'text-muted-foreground')}>
        {contagem}
      </span>
    </button>
  );
}
