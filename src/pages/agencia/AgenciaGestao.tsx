import { useMemo, useState } from 'react';
import { Pencil, Plus, ShieldAlert } from 'lucide-react';
import {
  Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/design-system/design-system-hub-ba3841';
import { Skeleton } from '@/components/ui/skeleton';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';
import {
  useAgenciaAgentes, useAgenciaClientes, useAgenciaEspacos, useAgenciaPessoa, useAgenciaPessoas,
} from '@/hooks/agencia/useAgencia';
import {
  useAcessosAgente, useAuditoria, useAvisosSistema, useCamadaCupola, useDefinirLimiteIa, useGastoIaDoMes,
  useGestaoAcoes, useLimitesIa, useSalvarCamadaCupola, useSessoesDesde, useSquadsCompletos, useUsoIa,
  type PortaIa, type Squad,
} from '@/hooks/agencia/useAgenciaGestao';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const ROTULOS: Record<string, string> = {
  'squad.criado': 'Squad criado',
  'squad.alterado': 'Squad alterado',
  'squad.membro.incluido': 'Pessoa entrou no squad',
  'squad.membro.removido': 'Pessoa saiu do squad',
  'squad.carteira.incluido': 'Cliente entrou na carteira do squad',
  'squad.carteira.removido': 'Cliente saiu da carteira do squad',
  'agente.acesso.liberado': 'Agente liberado para área',
  'agente.acesso.removido': 'Agente retirado de área',
  'agente.arquivado': 'Agente tirado do catálogo',
  'agente.devolvido': 'Agente devolvido ao catálogo',
  'contexto.alterado': 'Contexto da casa alterado',
  'limite.definido': 'Limite de IA definido',
  'limite.removido': 'Limite de IA retirado',
  entrou: 'Entrou no sistema',
};

const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dolar = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });

function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/* ---------------- Squads ---------------- */
function AbaSquads({ pessoaId }: { pessoaId?: string }) {
  const { data, isLoading } = useSquadsCompletos();
  const { data: pessoas } = useAgenciaPessoas();
  const { data: clientes } = useAgenciaClientes();
  const { salvarSquad, alternarVinculo } = useGestaoAcoes(pessoaId);
  const [editando, setEditando] = useState<{ s: Squad; novo: boolean } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const ativas = (pessoas ?? []).filter((p) => p.ativa !== false);
  const nome = (id: string | null) => ativas.find((p) => p.id === id)?.nome ?? '—';

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando({ s: { id: crypto.randomUUID(), nome: '', cor: null, coordenacao_id: null, atendimento_id: null }, novo: true })}>
          <Plus className="mr-2 h-4 w-4" />
          Novo squad
        </Button>
      </div>
      {(data?.squads ?? []).map((s) => {
        const membros = new Set(data!.membros.filter((m) => m.squad_id === s.id).map((m) => m.pessoa_id));
        const carteira = new Set(data!.carteira.filter((c) => c.squad_id === s.id).map((c) => c.cliente_id));
        const expandido = aberto === s.id;
        return (
          <div key={s.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{s.nome}</p>
                <p className="text-sm text-muted-foreground">
                  Coordenação: {nome(s.coordenacao_id)} · Atendimento: {nome(s.atendimento_id)}
                </p>
                <p className="text-sm text-muted-foreground">{membros.size} pessoas · {carteira.size} clientes</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditando({ s, novo: false })}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAberto(expandido ? null : s.id)}>
                  {expandido ? 'Fechar' : 'Pessoas e carteira'}
                </Button>
              </div>
            </div>
            {expandido && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Pessoas</p>
                  {ativas.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox checked={membros.has(p.id)}
                        onCheckedChange={() => alternarVinculo('pessoa_squads', 'pessoa_id', p.id, s.id, membros.has(p.id), p.nome)} />
                      {p.nome}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Carteira de clientes</p>
                  {(clientes ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox checked={carteira.has(c.id)}
                        onCheckedChange={() => alternarVinculo('squad_clientes', 'cliente_id', c.id, s.id, carteira.has(c.id), c.nome)} />
                      {c.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando?.novo ? 'Novo squad' : 'Editar squad'}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editando.s.nome} onChange={(e) => setEditando({ ...editando, s: { ...editando.s, nome: e.target.value } })} />
              </div>
              {(['coordenacao_id', 'atendimento_id'] as const).map((campo) => (
                <div key={campo} className="space-y-1">
                  <Label>{campo === 'coordenacao_id' ? 'Coordenação' : 'Atendimento'}</Label>
                  <Select value={editando.s[campo] ?? 'nenhum'}
                    onValueChange={(v) => setEditando({ ...editando, s: { ...editando.s, [campo]: v === 'nenhum' ? null : v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Ninguém</SelectItem>
                      {ativas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!editando?.s.nome.trim()}
              onClick={async () => editando && (await salvarSquad(editando.s, editando.novo)) && setEditando(null)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Acesso a agentes ---------------- */
function AbaAcessos({ pessoaId }: { pessoaId?: string }) {
  const { data: agentes } = useAgenciaAgentes(true);
  const { data: espacos } = useAgenciaEspacos();
  const { data: acessos, isLoading } = useAcessosAgente();
  const { alternarAcessoAgente, arquivarAgente } = useGestaoAcoes(pessoaId);
  const areas = (espacos ?? []).filter((e) => e.tipo === 'area');
  const liberado = useMemo(() => new Set((acessos ?? []).map((a) => `${a.agente_id}|${a.espaco_id}`)), [acessos]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Cada agente pertence a uma área. Marque as outras áreas que também podem usá-lo.
        Arquivar tira o agente do catálogo de todo mundo e impede conversa nova com ele; o histórico continua.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3 font-medium">Agente</th>
              {areas.map((a) => <th key={a.id} className="p-3 text-center font-medium">{a.nome}</th>)}
              <th className="p-3 text-center font-medium">No catálogo</th>
            </tr>
          </thead>
          <tbody>
            {(agentes ?? []).map((ag) => (
              <tr key={ag.id} className="border-b border-border last:border-0">
                <td className="p-3 text-foreground">
                  {ag.nome}
                  {ag.arquivado && <span className="ml-2 text-xs text-muted-foreground">arquivado</span>}
                </td>
                {areas.map((a) => {
                  const dono = ag.espaco_id === a.id;
                  const ligado = liberado.has(`${ag.id}|${a.id}`);
                  return (
                    <td key={a.id} className="p-3 text-center">
                      {dono ? (
                        <span className="text-xs text-muted-foreground">dona</span>
                      ) : (
                        <Checkbox checked={ligado} aria-label={`${ag.nome} para ${a.nome}`}
                          onCheckedChange={() => alternarAcessoAgente(ag.id, a.id, ligado, `${ag.nome} → ${a.nome}`)} />
                      )}
                    </td>
                  );
                })}
                <td className="p-3 text-center">
                  <Button size="sm" variant="outline" onClick={() => arquivarAgente(ag.id, !ag.arquivado, ag.nome)}>
                    {ag.arquivado ? 'Devolver' : 'Arquivar'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Limites de IA ---------------- */
const PORTAS: { id: PortaIa; nome: string }[] = [
  { id: 'conversa', nome: 'Conversa' },
  { id: 'geracao', nome: 'Geração' },
];

type EditandoLimite = { escopo: string; porta: PortaIa; rotulo: string; atual: number | null };

/** Gasto do mês contra o teto: barra só quando há teto, e muda de cor aos 80%. */
function CelulaLimite({ gasto, teto, onEditar }: { gasto: number; teto: number | null; onEditar: () => void }) {
  const fracao = teto == null ? 0 : teto === 0 ? 1 : Math.min(1, gasto / teto);
  const cor = fracao >= 1 ? 'bg-destructive' : fracao >= 0.8 ? 'bg-amber-500' : 'bg-primary';
  return (
    <td className="p-3 align-top">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-foreground">
            {dolar(gasto)} <span className="text-muted-foreground">{teto == null ? '· sem limite' : `de ${dolar(teto)}`}</span>
          </p>
          {teto != null && (
            <div className="h-1.5 w-32 rounded-full bg-muted">
              <div className={`h-1.5 rounded-full ${cor}`} style={{ width: `${fracao * 100}%` }} />
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onEditar}>{teto == null ? 'Definir' : 'Alterar'}</Button>
      </div>
    </td>
  );
}

function AbaLimites() {
  const { data: limites, isLoading } = useLimitesIa();
  const { data: gastos } = useGastoIaDoMes();
  const { data: avisos } = useAvisosSistema();
  const { data: espacos } = useAgenciaEspacos();
  const { data: pessoas } = useAgenciaPessoas();
  const { data: auditoria } = useAuditoria();
  const definir = useDefinirLimiteIa();
  const [editando, setEditando] = useState<EditandoLimite | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [incluidas, setIncluidas] = useState<string[]>([]);

  const areas = (espacos ?? []).filter((e) => e.tipo === 'area');
  const ativas = (pessoas ?? []).filter((p) => p.ativa !== false);
  const teto = (escopo: string, porta: PortaIa) => limites?.find((l) => l.escopo === escopo && l.porta === porta)?.teto_usd ?? null;
  const somar = (filtro: (g: NonNullable<typeof gastos>[number]) => boolean) =>
    (gastos ?? []).filter(filtro).reduce((s, g) => s + g.gasto, 0);
  const comLimite = new Set((limites ?? []).filter((l) => l.escopo.startsWith('pessoa:')).map((l) => l.escopo.slice(7)));
  const listadas = ativas.filter((p) => comLimite.has(p.id) || incluidas.includes(p.id));
  const disponiveis = ativas.filter((p) => !comLimite.has(p.id) && !incluidas.includes(p.id));
  const nomeArea = (id: string | null) => areas.find((a) => a.id === id)?.nome ?? '—';

  const mes = new Date().toISOString().slice(0, 7);
  const avisosDoMes = (avisos ?? []).filter((a) => a.id.endsWith(mes));
  const historico = (auditoria ?? []).filter((e) => e.acao.startsWith('limite.')).slice(0, 15);
  const nomePessoa = (id: string | null) => pessoas?.find((p) => p.id === id)?.nome ?? 'Sistema';

  const abrir = (escopo: string, porta: PortaIa, rotulo: string) => {
    const atual = teto(escopo, porta);
    setEditando({ escopo, porta, rotulo, atual });
    setValor(atual == null ? '' : String(atual).replace('.', ','));
  };

  // "1.250,50" e "50,5" no jeito brasileiro; "50.5" também vale.
  const numero = Number(valor.includes(',') ? valor.replace(/\./g, '').replace(',', '.') : valor);
  const valorValido = valor.trim() !== '' && Number.isFinite(numero) && numero >= 0 && numero <= 100000;

  const salvar = async (novo: number | null) => {
    if (!editando) return;
    setSalvando(true);
    try {
      await definir(editando.escopo, editando.porta, novo);
      toast.success(novo == null ? `${editando.rotulo} ficou sem limite.` : `Limite de ${editando.rotulo} salvo.`);
      setEditando(null);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível salvar o limite.');
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const mesExtenso = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const tabela = (linhas: { escopo: string; rotulo: string; sub?: string; gasto: (p: PortaIa) => number }[]) => (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-3 font-medium">Nome</th>
            {PORTAS.map((p) => <th key={p.id} className="p-3 font-medium">{p.nome}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.escopo} className="border-b border-border last:border-0">
              <td className="p-3 align-top">
                <p className="font-medium text-foreground">{l.rotulo}</p>
                {l.sub && <p className="text-xs text-muted-foreground">{l.sub}</p>}
              </td>
              {PORTAS.map((p) => (
                <CelulaLimite key={p.id} gasto={l.gasto(p.id)} teto={teto(l.escopo, p.id)}
                  onEditar={() => abrir(l.escopo, p.id, l.rotulo)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Teto mensal de gasto com IA, em dólares, por área e por pessoa. <strong>Conversa</strong> é a conversa com os agentes;{' '}
        <strong>geração</strong> é o resto (blog, redes, news, ficha, recado falado, mercado). Sem limite, nada é barrado.
        Quando o gasto chega ao teto, aquela porta para até o mês virar; aos 80%, aparece um aviso aqui. Gasto de {mesExtenso}.
      </p>

      {avisosDoMes.length > 0 && (
        <div className="space-y-2">
          {avisosDoMes.map((a) => (
            <div key={a.id} className={`rounded-2xl border p-4 text-sm ${a.tom === 'risco' ? 'border-destructive/40 bg-destructive/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
              <p className="font-medium text-foreground">
                <ShieldAlert className={`mr-1 inline h-4 w-4 ${a.tom === 'risco' ? 'text-destructive' : 'text-amber-600'}`} />
                {a.titulo}
              </p>
              <p className="text-muted-foreground">{a.detalhe}</p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-medium text-foreground">Por área</h3>
        {tabela(areas.map((a) => ({
          escopo: `area:${a.id}`,
          rotulo: a.nome,
          gasto: (porta) => somar((g) => g.area_id === a.id && g.porta === porta),
        })))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-foreground">Por pessoa</h3>
          {disponiveis.length > 0 && (
            <Select value="" onValueChange={(id) => setIncluidas((x) => [...x, id])}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Incluir pessoa…" /></SelectTrigger>
              <SelectContent>
                {disponiveis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {listadas.length === 0
          ? <Vazio>Nenhuma pessoa com limite próprio. Sem ele, vale só o teto da área.</Vazio>
          : tabela(listadas.map((p) => ({
            escopo: `pessoa:${p.id}`,
            rotulo: p.nome,
            sub: nomeArea(p.area_id),
            gasto: (porta) => somar((g) => g.pessoa_id === p.id && g.porta === porta),
          })))}
      </section>

      {historico.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium text-foreground">Últimas mudanças</h3>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {historico.map((e) => (
              <div key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-medium text-foreground">{e.alvo} · {e.detalhe}</p>
                  <p className="text-muted-foreground">{nomePessoa(e.pessoa_id)}</p>
                </div>
                <span className="text-xs text-muted-foreground">{dataHora(e.em)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Limite de {editando?.porta === 'conversa' ? 'conversa' : 'geração'} · {editando?.rotulo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="teto-ia">Teto mensal (US$)</Label>
            <Input id="teto-ia" inputMode="decimal" placeholder="Ex.: 50,00" value={valor}
              onChange={(e) => setValor(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">
              {editando?.atual == null ? 'Hoje sem limite.' : `Hoje: ${dolar(editando.atual)}.`} Zero bloqueia a porta. Vale na hora, para o mês corrente.
            </p>
          </div>
          <DialogFooter className="gap-2">
            {editando?.atual != null && (
              <Button variant="outline" disabled={salvando} onClick={() => salvar(null)} className="sm:mr-auto">Tirar limite</Button>
            )}
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!valorValido || salvando} onClick={() => salvar(Math.round(numero * 100) / 100)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Auditoria ---------------- */
function AbaAuditoria() {
  const { data, isLoading } = useAuditoria();
  const { data: pessoas } = useAgenciaPessoas();
  const nome = (id: string | null) => pessoas?.find((p) => p.id === id)?.nome ?? 'Sistema';
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data?.length) return <Vazio>Nada registrado ainda. As mudanças feitas nesta tela passam a aparecer aqui.</Vazio>;
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {data.map((e) => (
        <div key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm">
          <div>
            <p className="font-medium text-foreground">
              {e.negado && <ShieldAlert className="mr-1 inline h-4 w-4 text-destructive" />}
              {ROTULOS[e.acao] ?? e.acao}{e.alvo ? ` · ${e.alvo}` : ''}
            </p>
            {e.acao.startsWith('limite.') && e.detalhe && <p className="text-muted-foreground">{e.detalhe}</p>}
            <p className="text-muted-foreground">{nome(e.pessoa_id)}{e.negado ? ' · negado' : ''}</p>
          </div>
          <span className="text-xs text-muted-foreground">{dataHora(e.em)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Métricas ---------------- */
function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{valor}</p>
    </div>
  );
}

function Ranking({ titulo, linhas }: { titulo: string; linhas: [string, number, string][] }) {
  const max = Math.max(1, ...linhas.map((l) => l[1]));
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <p className="font-medium text-foreground">{titulo}</p>
      {linhas.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
      {linhas.slice(0, 10).map(([n, v, legenda]) => (
        <div key={n} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="truncate text-foreground">{n}</span>
            <span className="text-muted-foreground">{legenda}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AbaMetricas() {
  const [dias, setDias] = useState('30');
  const desde = useMemo(() => diasAtras(Number(dias)), [dias]);
  const { data: uso, isLoading } = useUsoIa(desde);
  const { data: sessoes } = useSessoesDesde(desde);
  const { data: agentes } = useAgenciaAgentes(true);
  const { data: clientes } = useAgenciaClientes();

  const agrupar = (chave: (u: NonNullable<typeof uso>[number]) => string) => {
    const m = new Map<string, { n: number; custo: number }>();
    for (const u of uso ?? []) {
      const k = chave(u);
      const x = m.get(k) ?? { n: 0, custo: 0 };
      x.n++;
      x.custo += Number(u.custo ?? 0);
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[1].custo - a[1].custo)
      .map(([k, v]) => [k, v.custo, `${dolar(v.custo)} · ${v.n} chamadas`] as [string, number, string]);
  };
  const nomeCliente = (id: string | null) => clientes?.find((c) => c.id === id)?.nome ?? 'Sem cliente';
  const nomeAgente = (id: string | null) => agentes?.find((a) => a.id === id || a.slug === id)?.nome ?? id ?? 'Outros';
  const custo = (uso ?? []).reduce((s, u) => s + Number(u.custo ?? 0), 0);
  const agentesUsados = new Set((sessoes ?? []).map((s) => s.agente_id).filter(Boolean)).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Uso do sistema, não desempenho de pessoa: não há quebra por pessoa, de propósito.</p>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Numero rotulo="Custo de IA" valor={dolar(custo)} />
            <Numero rotulo="Chamadas de IA" valor={uso?.length ?? 0} />
            <Numero rotulo="Conversas ativas" valor={sessoes?.length ?? 0} />
            <Numero rotulo="Agentes usados" valor={agentesUsados} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Ranking titulo="Por agente" linhas={agrupar((u) => nomeAgente(u.agente))} />
            <Ranking titulo="Por cliente" linhas={agrupar((u) => nomeCliente(u.cliente_id))} />
            <Ranking titulo="Por modelo" linhas={agrupar((u) => u.modelo ?? 'Não informado')} />
          </div>
        </>
      )}
    </div>
  );
}
/**
 * A camada da CUPOLA (Administração → Contexto no CupolaOS): o que a casa é, antes
 * de qualquer conta. A essência entra em toda conversa; a escrita, em quem escreve.
 */
function AbaContexto({ pessoaId }: { pessoaId: string }) {
  const { data, isLoading } = useCamadaCupola();
  const salvar = useSalvarCamadaCupola(pessoaId);
  const [rascunho, setRascunho] = useState<{ essencia: string; escrita: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const atual = rascunho ?? { essencia: data?.essencia ?? '', escrita: data?.escrita ?? '' };
  const mudou = !!rascunho && (rascunho.essencia !== (data?.essencia ?? '') || rascunho.escrita !== (data?.escrita ?? ''));

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Este texto vai em <strong>toda conversa de todo agente</strong>, antes da conta. Mantenha curto: cada caractere é pago em cada pergunta de cada pessoa.
        {data?.atualizado_em && <> Última mudança em {dataHora(data.atualizado_em)}.</>}
      </p>
      <div className="space-y-2">
        <Label htmlFor="ctx-essencia">Essência da CUPOLA</Label>
        <Textarea
          id="ctx-essencia"
          rows={6}
          maxLength={10000}
          value={atual.essencia}
          onChange={(e) => setRascunho({ ...atual, essencia: e.target.value })}
          placeholder="O que a CUPOLA é, e o que não é."
        />
        <p className="text-xs text-muted-foreground">{atual.essencia.length.toLocaleString('pt-BR')} de 10.000 caracteres. Sem ela, os agentes usam uma frase de emergência.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ctx-escrita">Como a CUPOLA escreve</Label>
        <Textarea
          id="ctx-escrita"
          rows={10}
          maxLength={20000}
          value={atual.escrita}
          onChange={(e) => setRascunho({ ...atual, escrita: e.target.value })}
          placeholder="Tom de voz, pessoa gramatical, palavras que a casa não usa."
        />
        <p className="text-xs text-muted-foreground">{atual.escrita.length.toLocaleString('pt-BR')} de 20.000 caracteres.</p>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!mudou || salvando || !atual.essencia.trim()}
          onClick={async () => {
            setSalvando(true);
            try {
              await salvar(atual.essencia, atual.escrita);
              setRascunho(null);
              toast.success('Contexto da casa atualizado. Vale a partir da próxima pergunta.');
            } catch (e) {
              toast.error((e as { message?: string })?.message || 'Não foi possível salvar.');
            } finally {
              setSalvando(false);
            }
          }}
        >
          Salvar
        </Button>
        {mudou && <Button variant="outline" onClick={() => setRascunho(null)}>Descartar</Button>}
      </div>
    </div>
  );
}

export default function AgenciaGestao() {
  const { data: pessoa, isLoading } = useAgenciaPessoa();
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (pessoa?.papel !== 'admin') return <Vazio>Esta área é só para administradores da agência.</Vazio>;
  return (
    <div className="space-y-6">
      <CabecalhoPagina rotulo="Administração" titulo="Gestão da agência" descricao="Squads, quem usa cada agente, limites de gasto com IA, o registro de mudanças e o uso do sistema." />
      <Tabs defaultValue="squads">
        <TabsList>
          <TabsTrigger value="squads">Squads</TabsTrigger>
          <TabsTrigger value="acessos">Acesso a agentes</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="limites">Limites de IA</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="contexto">Contexto</TabsTrigger>
        </TabsList>
        <TabsContent value="squads" className="mt-6"><AbaSquads pessoaId={pessoa.id} /></TabsContent>
        <TabsContent value="acessos" className="mt-6"><AbaAcessos pessoaId={pessoa.id} /></TabsContent>
        <TabsContent value="metricas" className="mt-6"><AbaMetricas /></TabsContent>
        <TabsContent value="limites" className="mt-6"><AbaLimites /></TabsContent>
        <TabsContent value="auditoria" className="mt-6"><AbaAuditoria /></TabsContent>
        <TabsContent value="contexto" className="mt-6"><AbaContexto pessoaId={pessoa.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
