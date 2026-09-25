import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Button,
  Input,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/design-system/design-system-hub-ba3841';
import { ContaFormDialog } from '@/components/agencia/ContaFormDialog';
import { SeloConta } from '@/components/agencia/cliente/SeloConta';
import { PessoaLinha } from '@/components/agencia/cliente/PessoaLinha';
import {
  useAgenciaAgentes,
  useAgenciaClientes,
  useAgenciaContratos,
  useAgenciaPessoa,
  useAgenciaPessoas,
  useAgenciaProjetos,
  type AgenciaCliente,
  type AgenciaContrato,
} from '@/hooks/agencia/useAgencia';
import { useLogosContas } from '@/hooks/agencia/useAgenciaArtes';
import {
  STATUS_CONTRATO,
  TIPO_LABEL,
  percentualCadastro,
  useCarteiraSquads,
} from '@/hooks/agencia/useAgenciaCarteira';
import { cn } from '@/lib/utils';

type Filtro = 'todos' | 'squad' | 'atencao';
type Ordem = 'recentes' | 'az' | 'cadastro';

export default function AgenciaClientes() {
  const { data: clientes, isLoading } = useAgenciaClientes();
  const { data: contratos } = useAgenciaContratos();
  const { data: projetos } = useAgenciaProjetos();
  const { data: agentes } = useAgenciaAgentes();
  const { data: pessoas } = useAgenciaPessoas();
  const { data: pessoa } = useAgenciaPessoa();
  const { data: logos } = useLogosContas();
  const { data: carteira } = useCarteiraSquads();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [modo, setModo] = useState<'grade' | 'lista'>('grade');
  const [formAberto, setFormAberto] = useState(false);

  const podeGerenciar = pessoa?.papel === 'admin' || pessoa?.papel === 'gestor';
  const ativos = useMemo(() => (clientes ?? []).filter((c) => !(c as { arquivado?: boolean }).arquivado), [clientes]);

  const contratoPorCliente = useMemo(() => {
    const m = new Map<string, AgenciaContrato>();
    (contratos ?? []).forEach((c) => m.set(c.cliente_id, c));
    return m;
  }, [contratos]);

  const pessoaPorId = useMemo(() => new Map((pessoas ?? []).map((p) => [p.id, p])), [pessoas]);

  const meusSquads = useMemo(() => {
    const s = new Set<string>();
    if (!pessoa || !carteira) return s;
    Object.entries(carteira.pessoasPorSquad).forEach(([sq, ids]) => ids.includes(pessoa.id) && s.add(sq));
    return s;
  }, [pessoa, carteira]);

  const agentesPorConta = (clienteId: string) =>
    (agentes ?? []).filter((a) => a.por_conta || a.cliente_id === clienteId).length;

  const precisaAtencao = (c: AgenciaCliente) =>
    percentualCadastro(c) < 70 || contratoPorCliente.get(c.id)?.status !== 'ativo';

  const doMeuSquad = (c: AgenciaCliente) =>
    (carteira?.squadsPorCliente[c.id] ?? []).some((s) => meusSquads.has(s)) ||
    c.atendimento_id === pessoa?.id;

  const contagens = {
    todos: ativos.length,
    squad: ativos.filter(doMeuSquad).length,
    atencao: ativos.filter(precisaAtencao).length,
  };

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    const filtrada = ativos.filter((c) => {
      if (filtro === 'squad' && !doMeuSquad(c)) return false;
      if (filtro === 'atencao' && !precisaAtencao(c)) return false;
      return (
        !alvo ||
        c.nome.toLowerCase().includes(alvo) ||
        (c.sigla ?? '').toLowerCase().includes(alvo) ||
        (c.cidade ?? '').toLowerCase().includes(alvo)
      );
    });
    return [...filtrada].sort((a, b) => {
      if (ordem === 'az') return a.nome.localeCompare(b.nome);
      if (ordem === 'cadastro') return percentualCadastro(b) - percentualCadastro(a);
      return (b.atualizado_em ?? '').localeCompare(a.atualizado_em ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos, busca, filtro, ordem, carteira, contratoPorCliente, meusSquads]);

  const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'squad', rotulo: 'Meu squad' },
    { id: 'atencao', rotulo: 'Precisam de atenção' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Carteira</p>
          <h1 className="text-5xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Você atende os {ativos.length} clientes da carteira.
          </p>
        </div>
        {podeGerenciar && (
          <Button onClick={() => setFormAberto(true)}>
            <Plus />
            Novo cliente
          </Button>
        )}
      </div>

      <ContaFormDialog
        aberto={formAberto}
        onOpenChange={setFormAberto}
        existentes={(clientes ?? []).map((c) => c.id)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors',
                filtro === f.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.rotulo}
              <span className="text-xs opacity-60">{contagens[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente"
              className="pl-9"
            />
          </div>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Ordenar: mais recentes</SelectItem>
              <SelectItem value="az">Ordenar: nome (A–Z)</SelectItem>
              <SelectItem value="cadastro">Ordenar: cadastro mais completo</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <Button
              size="icon"
              variant={modo === 'grade' ? 'default' : 'ghost'}
              onClick={() => setModo('grade')}
              aria-label="Ver em grade"
            >
              <LayoutGrid />
            </Button>
            <Button
              size="icon"
              variant={modo === 'lista' ? 'default' : 'ghost'}
              onClick={() => setModo('lista')}
              aria-label="Ver em lista"
            >
              <List />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-3xl" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum cliente neste filtro.
          </CardContent>
        </Card>
      ) : modo === 'grade' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => {
            const contrato = contratoPorCliente.get(c.id);
            const nProjetos = (projetos ?? []).filter((p) => p.cliente_id === c.id).length;
            const nAgentes = agentesPorConta(c.id);
            const atendimento = c.atendimento_id ? pessoaPorId.get(c.atendimento_id) : undefined;
            const squad = carteira?.squads.find((s) => carteira.squadsPorCliente[c.id]?.includes(s.id));
            const cadastro = percentualCadastro(c);
            return (
              <Link key={c.id} to={`/agencia/contas/${c.slug}`} className="group">
                <Card className="h-full rounded-3xl transition-colors group-hover:border-primary">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <SeloConta cliente={c} logoUrl={logos?.[c.id]} tamanho="md" />
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold">{c.nome}</h2>
                      <p className="text-sm text-muted-foreground">{c.cidade ?? 'Cidade não informada'}</p>
                      <p className="text-sm text-muted-foreground">{TIPO_LABEL[c.tipo ?? ''] ?? c.tipo ?? '—'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            contrato?.status === 'ativo' ? 'bg-success' : 'bg-muted-foreground',
                          )}
                        />
                        {contrato?.status ? STATUS_CONTRATO[contrato.status] ?? contrato.status : 'Sem contrato'}
                      </span>
                      <span>·</span>
                      <span>{nProjetos} {nProjetos === 1 ? 'projeto' : 'projetos'}</span>
                      <span>·</span>
                      <span>{nAgentes} {nAgentes === 1 ? 'agente' : 'agentes'}</span>
                    </div>
                    <div className="space-y-3 border-t border-border pt-4">
                      {atendimento ? (
                        <PessoaLinha nome={atendimento.nome} iniciais={atendimento.iniciais} detalhe="Atendimento" />
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem coordenação definida</p>
                      )}
                      {squad && (
                        <PessoaLinha nome={squad.nome} imagem={squad.logoUrl} detalhe="Squad responsável" />
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-4 pt-2">
                      <div className="flex flex-1 items-center gap-3">
                        <Progress value={cadastro} className="w-16" />
                        <span className="text-sm text-muted-foreground">Cadastro {cadastro}%</span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-medium">
                        Abrir cliente
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-3xl">
          <CardContent className="divide-y divide-border p-2">
            {lista.map((c) => {
              const contrato = contratoPorCliente.get(c.id);
              const cadastro = percentualCadastro(c);
              return (
                <Link
                  key={c.id}
                  to={`/agencia/contas/${c.slug}`}
                  className="flex items-center gap-4 rounded-2xl p-4 hover:bg-muted"
                >
                  <SeloConta cliente={c} logoUrl={logos?.[c.id]} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {[c.cidade, TIPO_LABEL[c.tipo ?? ''] ?? c.tipo].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="hidden text-sm text-muted-foreground md:block">
                    {contrato?.status ? STATUS_CONTRATO[contrato.status] ?? contrato.status : 'Sem contrato'}
                  </span>
                  <div className="hidden w-40 items-center gap-2 md:flex">
                    <Progress value={cadastro} />
                    <span className="text-xs text-muted-foreground">{cadastro}%</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
