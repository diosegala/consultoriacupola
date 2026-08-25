import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useConsultores } from '@/hooks/useConsultores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Building2, FileText, Key, Layers, Lightbulb, MessageSquareQuote, RefreshCw, Save, TrendingUp, Wand2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from 'recharts';
import { toast } from 'sonner';

const PERIODOS = [
  { value: '1', label: 'Último mês' },
  { value: '3', label: 'Último trimestre' },
  { value: '6', label: 'Último semestre' },
  { value: '12', label: 'Últimos 12 meses' },
];


type Insight = {
  id: string;
  tipo: string;
  periodo_analisado: string | null;
  filtros: any;
  conteudo: any;
  created_at: string;
};

type Operacao = 'vendas' | 'aluguel' | 'ambas';

const OPERACOES: { value: Operacao; label: string; icon: typeof Building2; chartColor: string; badgeClass: string }[] = [
  { value: 'vendas', label: 'Vendas', icon: Building2, chartColor: 'hsl(var(--primary))', badgeClass: 'border-primary/40 text-primary' },
  { value: 'aluguel', label: 'Locação', icon: Key, chartColor: 'hsl(var(--chart-2, 199 89% 55%))', badgeClass: 'border-sky-500/40 text-sky-400' },
  { value: 'ambas', label: 'Transversal', icon: Layers, chartColor: 'hsl(var(--muted-foreground))', badgeClass: 'border-muted-foreground/40 text-muted-foreground' },
];

function opMeta(op?: string) {
  return OPERACOES.find((o) => o.value === normalizeOp(op)) ?? OPERACOES[2];
}

function normalizeOp(op?: string): Operacao {
  const v = (op || '').toLowerCase();
  if (v.startsWith('venda')) return 'vendas';
  if (v.startsWith('alug') || v.startsWith('loca')) return 'aluguel';
  return 'ambas';
}

function OperacaoBadge({ op }: { op?: string }) {
  const meta = opMeta(op);
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${meta.badgeClass}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

type CorrigirFn = (secao: string, tema: string, operacaoIa: string | undefined, operacaoCorreta: Operacao) => Promise<void>;

function CorrigirOperacao({ secao, tema, operacao, onCorrigir }: { secao: string; tema: string; operacao?: string; onCorrigir?: CorrigirFn }) {
  const [salvando, setSalvando] = useState(false);
  if (!onCorrigir) return null;
  const atual = normalizeOp(operacao);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" disabled={salvando}>
          <Wand2 className="h-3 w-3 mr-1" /> Corrigir operação
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Operação correta</DropdownMenuLabel>
        {OPERACOES.map((o) => (
          <DropdownMenuItem
            key={o.value}
            disabled={o.value === atual}
            onSelect={async () => {
              setSalvando(true);
              try {
                await onCorrigir(secao, tema, operacao, o.value);
              } finally {
                setSalvando(false);
              }
            }}
          >
            <o.icon className="h-3.5 w-3.5 mr-2" /> {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SECAO_KEY: Record<string, string> = {
  dores: 'dores',
  demandas: 'demandas',
  resistencias: 'resistencias',
  oportunidades: 'oportunidades_produto',
};

function useCorrigirOperacao(insight: Insight | null, tipoInsight: string, reload: () => Promise<void>): CorrigirFn {
  return async (secao, tema, operacaoIa, operacaoCorreta) => {
    if (!insight) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: errIns } = await supabase.from('insight_correcoes' as any).insert({
        insight_id: insight.id,
        tipo_insight: tipoInsight,
        secao,
        tema,
        operacao_ia: operacaoIa ?? null,
        operacao_correta: operacaoCorreta,
        user_id: userData.user?.id,
      });
      if (errIns) throw errIns;

      const key = SECAO_KEY[secao] ?? secao;
      const conteudo = JSON.parse(JSON.stringify(insight.conteudo || {}));
      const lista = conteudo[key];
      if (Array.isArray(lista)) {
        const alvo = lista.find((x: any) => (x?.tema ?? x?.descricao) === tema);
        if (alvo) alvo.operacao = operacaoCorreta;
      }
      const { error: errUpd } = await supabase
        .from('insights_agregados' as any)
        .update({ conteudo })
        .eq('id', insight.id);
      if (errUpd) throw errUpd;

      toast.success('Correção registrada — o agente vai considerá-la nas próximas análises.');
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao registrar correção');
    }
  };
}



function useUltimoInsight(tipo: string) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('insights_agregados' as any)
      .select('*')
      .eq('tipo', tipo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setInsight((data as any) ?? null);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [tipo]);
  return { insight, loading, reload };
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function abrirComoGdoc(titulo: string, markdown: string) {
  const { data, error } = await supabase.functions.invoke('criar-gdoc', {
    body: { titulo, conteudo_markdown: markdown },
  });
  if (error) {
    let message = error.message || 'Erro ao criar Google Doc';
    const response = (error as any)?.context;
    if (response && typeof response.json === 'function') {
      try {
        const body = await response.json();
        if (typeof body?.message === 'string') message = body.message;
        else if (typeof body?.error === 'string') message = body.error;
      } catch {
        // mantém mensagem original
      }
    }
    throw new Error(message);
  }
  const url = (data as any)?.url as string | undefined;
  if (!url) throw new Error('Google Doc criado sem URL retornada');
  window.open(url, '_blank', 'noopener,noreferrer');
}

function doresParaMarkdown(insight: Insight) {
  const c = insight.conteudo || {};
  let md = `# Dores e Temas Recorrentes\n\n_Gerado em ${formatDate(insight.created_at)} — período ${insight.periodo_analisado ?? '—'}_\n\n`;
  for (const op of OPERACOES) {
    const dores = (c.dores || []).filter((d: any) => normalizeOp(d.operacao) === op.value);
    const demandas = (c.demandas || []).filter((d: any) => normalizeOp(d.operacao) === op.value);
    const resistencias = (c.resistencias || []).filter((r: any) => normalizeOp(r.operacao) === op.value);
    if (!dores.length && !demandas.length && !resistencias.length) continue;
    md += `## Operação: ${op.label}\n\n`;
    const resumo = c.resumo_executivo?.[op.value];
    if (resumo) md += `${resumo}\n\n`;
    if (dores.length) {
      md += `### Dores mais recorrentes\n\n`;
      dores.forEach((d: any, i: number) => {
        md += `**${i + 1}. ${d.tema}** — ${d.frequencia_clientes} clientes\n${d.exemplo ? `"${d.exemplo}"\n` : ''}\n`;
      });
    }
    if (demandas.length) {
      md += `### O que os clientes pedem\n\n`;
      demandas.forEach((d: any) => { md += `- ${d.tema} (${d.frequencia_clientes} clientes)\n`; });
      md += `\n`;
    }
    if (resistencias.length) {
      md += `### Onde há mais resistência\n\n`;
      resistencias.forEach((r: any) => { md += `- ${r.tema} — ${r.descricao}\n`; });
      md += `\n`;
    }
  }
  return md;
}

function perfilParaMarkdown(insight: Insight) {
  const c = insight.conteudo || {};
  let md = `# Perfil Ideal e Oportunidades\n\n_Gerado em ${formatDate(insight.created_at)}_\n\n`;
  md += `## Perfil do cliente que mais avança\n\n`;
  (c.perfil_ideal?.caracteristicas || []).forEach((x: string) => { md += `- ${x}\n`; });
  if (c.perfil_ideal?.justificativa) md += `\n${c.perfil_ideal.justificativa}\n`;
  md += `\n## Sinais de alerta no perfil\n\n`;
  (c.perfil_risco?.caracteristicas || []).forEach((x: string) => { md += `- ${x}\n`; });
  if (c.perfil_risco?.alertas) md += `\n${c.perfil_risco.alertas}\n`;
  md += `\n## Oportunidades de produto identificadas\n\n`;
  for (const op of OPERACOES) {
    const ops = (c.oportunidades_produto || []).filter((o: any) => normalizeOp(o.operacao) === op.value);
    if (!ops.length) continue;
    md += `### Operação: ${op.label}\n\n`;
    ops.forEach((o: any, i: number) => {
      md += `**${i + 1}. ${o.descricao}**\n`;
      if (o.evidencia) md += `Evidência: ${o.evidencia}\n`;
      if (o.potencial_demanda) md += `Potencial: ${o.potencial_demanda}\n`;
      md += `\n`;
    });
  }
  return md;
}

function tituloComData(base: string) {
  return `${base} (${new Date().toLocaleDateString('pt-BR')})`;
}

function DoresChart({ dores }: { dores: any[] }) {
  const data = useMemo(
    () => dores
      .map((d) => ({
        tema: String(d.tema || '').length > 34 ? `${String(d.tema).slice(0, 32)}…` : String(d.tema || ''),
        clientes: Number(d.frequencia_clientes) || 0,
        cor: opMeta(d.operacao).chartColor,
      }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 10),
    [dores],
  );
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Frequência das dores (clientes distintos)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="tema" width={200} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="clientes" radius={[0, 4, 4, 0]} barSize={16}>
              {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function DoresPainel({ conteudo, filtro, onCorrigir }: { conteudo: any; filtro: Operacao | 'todas'; onCorrigir?: CorrigirFn }) {
  const match = (item: any) => filtro === 'todas' || normalizeOp(item?.operacao) === filtro;
  const dores = (conteudo.dores || []).filter(match);
  const demandas = (conteudo.demandas || []).filter(match);
  const resistencias = (conteudo.resistencias || []).filter(match);
  const resumo = filtro !== 'todas' ? conteudo.resumo_executivo?.[filtro] : null;
  const maxFreq = Math.max(1, ...dores.map((d: any) => Number(d.frequencia_clientes) || 0));

  if (!dores.length && !demandas.length && !resistencias.length) {
    return <p className="text-sm text-muted-foreground">Nenhum item classificado nesta operação na última análise. Gere a análise novamente para segmentar por operação.</p>;
  }

  return (
    <div className="space-y-6">
      {resumo && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 flex gap-3">
            <MessageSquareQuote className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{resumo}</p>
          </CardContent>
        </Card>
      )}

      <DoresChart dores={dores} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Dores mais recorrentes</h3>
          {dores.map((d: any, i: number) => {
            const freq = Number(d.frequencia_clientes) || 0;
            return (
              <Card key={i}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                      <p className="font-medium">{d.tema}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <OperacaoBadge op={d.operacao} />
                      <Badge variant="secondary">{freq} clientes</Badge>
                    </div>
                  </div>
                  <Progress value={(freq / maxFreq) * 100} className="h-1.5" />
                  {d.exemplo && <p className="text-sm text-muted-foreground italic">"{d.exemplo}"</p>}
                  <div className="flex justify-end">
                    <CorrigirOperacao secao="dores" tema={d.tema} operacao={d.operacao} onCorrigir={onCorrigir} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">O que os clientes pedem</h3>
            <Card>
              <CardContent className="pt-4 space-y-3">
                {demandas.map((d: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>{d.tema}</span>
                      <Badge variant="outline">{d.frequencia_clientes}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {filtro === 'todas' ? <OperacaoBadge op={d.operacao} /> : <span />}
                      <CorrigirOperacao secao="demandas" tema={d.tema} operacao={d.operacao} onCorrigir={onCorrigir} />
                    </div>
                  </div>
                ))}
                {!demandas.length && <p className="text-xs text-muted-foreground">Sem demandas nesta operação.</p>}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Onde há mais resistência</h3>
            {resistencias.map((r: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-4 flex gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{r.tema}</p>
                    <p className="text-xs text-muted-foreground">{r.descricao}</p>
                    <div className="flex items-center gap-2">
                      {filtro === 'todas' && <OperacaoBadge op={r.operacao} />}
                      <CorrigirOperacao secao="resistencias" tema={r.tema} operacao={r.operacao} onCorrigir={onCorrigir} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!resistencias.length && <p className="text-xs text-muted-foreground">Sem resistências nesta operação.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DoresSection() {
  const { insight, loading, reload } = useUltimoInsight('dores_recorrentes');
  const corrigir = useCorrigirOperacao(insight, 'dores_recorrentes', reload);
  const { data: consultores } = useConsultores(true);
  const [periodo, setPeriodo] = useState('6');
  const [tipoContrato, setTipoContrato] = useState('todos');
  const [consultorId, setConsultorId] = useState<string>('todos');
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('analisar-padroes-clientes', {
        body: {
          periodo_meses: Number(periodo),
          tipo_contrato: tipoContrato,
          consultor_id: consultorId === 'todos' ? null : consultorId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Análise gerada com ${(data as any).clientes_analisados} clientes.`);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar análise');
    } finally {
      setGerando(false);
    }
  };

  const exportarGdoc = async () => {
    if (!insight) return;
    setExportando(true);
    try {
      await abrirComoGdoc(tituloComData('Inteligência — Dores e Temas Recorrentes'), doresParaMarkdown(insight));
      toast.success('Documento criado no Google Docs.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar Google Doc');
    } finally {
      setExportando(false);
    }
  };

  const c = insight?.conteudo || {};
  const contagem = useMemo(() => {
    const base: Record<Operacao, number> = { vendas: 0, aluguel: 0, ambas: 0 };
    for (const d of c.dores || []) base[normalizeOp(d.operacao)] += 1;
    return base;
  }, [c]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Filtros e geração</span>
            <span className="text-xs font-normal text-muted-foreground">Última análise: {formatDate(insight?.created_at)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo de contrato</label>
            <Select value={tipoContrato} onValueChange={setTipoContrato}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="programa_gestao">Programa de Gestão</SelectItem>
                <SelectItem value="mapeamento">Mapeamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Consultor</label>
            <Select value={consultorId} onValueChange={setConsultorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(consultores || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={gerar} disabled={gerando} className="flex-1">
              {gerando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {insight ? 'Atualizar' : 'Gerar análise de dores'}
            </Button>
            {insight && (
              <Button variant="outline" onClick={exportarGdoc} disabled={exportando}>
                {exportando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Abrir no Google Docs
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !insight ? (
        <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {OPERACOES.map((op) => {
              const Icon = op.icon;
              return (
                <Card key={op.value}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{op.label}</p>
                        <p className="text-xs text-muted-foreground">dores identificadas</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold">{contagem[op.value]}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Tabs defaultValue="vendas">
            <TabsList>
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="aluguel">Locação</TabsTrigger>
              <TabsTrigger value="ambas">Transversal</TabsTrigger>
              <TabsTrigger value="todas">Visão geral</TabsTrigger>
            </TabsList>
            {(['vendas', 'aluguel', 'ambas', 'todas'] as const).map((f) => (
              <TabsContent key={f} value={f} className="mt-6">
                <DoresPainel conteudo={c} filtro={f} onCorrigir={corrigir} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}

function PerfilSection() {
  const { insight, loading, reload } = useUltimoInsight('perfil_clientes');
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [filtroOp, setFiltroOp] = useState<Operacao | 'todas'>('todas');
  const [periodo, setPeriodo] = useState('todos');
  const corrigir = useCorrigirOperacao(insight, 'perfil_clientes', reload);

  const exportarGdoc = async () => {
    if (!insight) return;
    setExportando(true);
    try {
      await abrirComoGdoc(tituloComData('Inteligência — Perfil Ideal e Oportunidades'), perfilParaMarkdown(insight));
      toast.success('Documento criado no Google Docs.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar Google Doc');
    } finally {
      setExportando(false);
    }
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('analisar-perfil-clientes', {
        body: { periodo_meses: periodo === 'todos' ? null : Number(periodo) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Análise gerada com ${(data as any).clientes_analisados} clientes.`);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar análise');
    } finally {
      setGerando(false);
    }
  };

  const salvarOportunidade = async (op: any) => {
    try {
      const { error } = await supabase.from('oportunidades_produto' as any).insert({
        titulo: (op.descricao || '').slice(0, 120),
        descricao: op.descricao || '',
        evidencia: op.evidencia || null,
        potencial_demanda: op.potencial_demanda || null,
        origem_insight_id: insight?.id,
      });
      if (error) throw error;
      toast.success('Oportunidade salva.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  const c = insight?.conteudo || {};
  const oportunidades = (c.oportunidades_produto || []).filter(
    (o: any) => filtroOp === 'todas' || normalizeOp(o.operacao) === filtroOp,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Perfil ideal e oportunidades</span>
            <span className="text-xs font-normal text-muted-foreground">Última análise: {formatDate(insight?.created_at)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {insight ? 'Atualizar análise' : 'Gerar análise de perfil'}
          </Button>
          {insight && (
            <Button variant="outline" onClick={exportarGdoc} disabled={exportando}>
              {exportando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Abrir no Google Docs
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !insight ? (
        <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-emerald-500" /> Perfil do cliente que mais avança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-2">
                {(c.perfil_ideal?.caracteristicas || []).map((x: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              {c.perfil_ideal?.justificativa && (
                <p className="text-muted-foreground text-xs">{c.perfil_ideal.justificativa}</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" /> Sinais de alerta no perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-2">
                {(c.perfil_risco?.caracteristicas || []).map((x: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              {c.perfil_risco?.alertas && (
                <p className="text-muted-foreground text-xs">{c.perfil_risco.alertas}</p>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Oportunidades de produto identificadas</h3>
              <div className="flex flex-wrap gap-1">
                {(['todas', 'vendas', 'aluguel', 'ambas'] as const).map((f) => (
                  <Button key={f} size="sm" variant={filtroOp === f ? 'default' : 'outline'} onClick={() => setFiltroOp(f)}>
                    {f === 'todas' ? 'Todas' : OPERACOES.find((o) => o.value === f)!.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {oportunidades.map((op: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{op.descricao}</p>
                      <OperacaoBadge op={op.operacao} />
                    </div>
                    {op.evidencia && <p className="text-xs text-muted-foreground"><span className="font-medium">Evidência:</span> {op.evidencia}</p>}
                    {op.potencial_demanda && <p className="text-xs text-muted-foreground"><span className="font-medium">Potencial:</span> {op.potencial_demanda}</p>}
                    <Button size="sm" variant="outline" onClick={() => salvarOportunidade(op)}>
                      <Save className="h-3 w-3 mr-1" /> Salvar como oportunidade
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {!oportunidades.length && <p className="text-xs text-muted-foreground">Nenhuma oportunidade nesta operação.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Inteligencia() {
  const { isAdmin, isDirector, roleLoading } = useAuth();
  if (roleLoading) return <Skeleton className="h-64 w-full" />;
  if (!isAdmin && !isDirector) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inteligência</h1>
        <p className="text-sm text-muted-foreground">Análises agregadas sobre dores, perfis e oportunidades de produto, separadas por operação de vendas e de locação.</p>
      </div>
      <Tabs defaultValue="dores">
        <TabsList>
          <TabsTrigger value="dores">Dores e temas recorrentes</TabsTrigger>
          <TabsTrigger value="perfil">Perfil ideal & oportunidades</TabsTrigger>
        </TabsList>
        <TabsContent value="dores" className="mt-6"><DoresSection /></TabsContent>
        <TabsContent value="perfil" className="mt-6"><PerfilSection /></TabsContent>
      </Tabs>
    </div>
  );
}
