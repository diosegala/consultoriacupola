import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useConsultores } from '@/hooks/useConsultores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Download, Lightbulb, RefreshCw, Save, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

type Insight = {
  id: string;
  tipo: string;
  periodo_analisado: string | null;
  filtros: any;
  conteudo: any;
  created_at: string;
};

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

function DoresSection() {
  const { insight, loading, reload } = useUltimoInsight('dores_recorrentes');
  const { data: consultores } = useConsultores(true);
  const [periodo, setPeriodo] = useState('6');
  const [tipoContrato, setTipoContrato] = useState('todos');
  const [consultorId, setConsultorId] = useState<string>('todos');
  const [gerando, setGerando] = useState(false);

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

  const exportar = () => {
    if (!insight) return;
    const c = insight.conteudo || {};
    let md = `# Dores e Temas Recorrentes\n\n_Gerado em ${formatDate(insight.created_at)} — período ${insight.periodo_analisado}_\n\n`;
    md += `## Dores mais recorrentes\n\n`;
    (c.dores || []).forEach((d: any, i: number) => {
      md += `**${i + 1}. ${d.tema}** — ${d.frequencia_clientes} clientes\n> ${d.exemplo}\n\n`;
    });
    md += `\n## O que os clientes pedem\n\n`;
    (c.demandas || []).forEach((d: any) => { md += `- ${d.tema} _(${d.frequencia_clientes} clientes)_\n`; });
    md += `\n## Onde há mais resistência\n\n`;
    (c.resistencias || []).forEach((r: any) => { md += `- **${r.tema}** — ${r.descricao}\n`; });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dores-recorrentes-${new Date().toISOString().slice(0,10)}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const c = insight?.conteudo || {};

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
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
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
              <Button variant="outline" onClick={exportar}><Download className="h-4 w-4" /></Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !insight ? (
        <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Dores mais recorrentes</h3>
            {(c.dores || []).map((d: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{d.tema}</p>
                    <Badge variant="secondary">{d.frequencia_clientes} clientes</Badge>
                  </div>
                  {d.exemplo && <p className="text-sm text-muted-foreground italic">"{d.exemplo}"</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">O que os clientes pedem</h3>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  {(c.demandas || []).map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{d.tema}</span>
                      <Badge variant="outline">{d.frequencia_clientes}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Onde há mais resistência</h3>
              {(c.resistencias || []).map((r: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-4 flex gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium">{r.tema}</p>
                      <p className="text-xs text-muted-foreground">{r.descricao}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PerfilSection() {
  const { insight, loading, reload } = useUltimoInsight('perfil_clientes');
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('analisar-perfil-clientes', { body: {} });
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Perfil ideal e oportunidades</span>
            <span className="text-xs font-normal text-muted-foreground">Última análise: {formatDate(insight?.created_at)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {insight ? 'Atualizar análise' : 'Gerar análise de perfil'}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !insight ? (
        <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-emerald-500" /> Perfil do cliente que mais avança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                {(c.perfil_ideal?.caracteristicas || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
              </ul>
              {c.perfil_ideal?.justificativa && (
                <p className="text-muted-foreground text-xs">{c.perfil_ideal.justificativa}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" /> Sinais de alerta no perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                {(c.perfil_risco?.caracteristicas || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
              </ul>
              {c.perfil_risco?.alertas && (
                <p className="text-muted-foreground text-xs">{c.perfil_risco.alertas}</p>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Oportunidades de produto identificadas</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {(c.oportunidades_produto || []).map((op: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-2">
                    <p className="font-medium text-sm">{op.descricao}</p>
                    {op.evidencia && <p className="text-xs text-muted-foreground"><span className="font-medium">Evidência:</span> {op.evidencia}</p>}
                    {op.potencial_demanda && <p className="text-xs text-muted-foreground"><span className="font-medium">Potencial:</span> {op.potencial_demanda}</p>}
                    <Button size="sm" variant="outline" onClick={() => salvarOportunidade(op)}>
                      <Save className="h-3 w-3 mr-1" /> Salvar como oportunidade
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
        <p className="text-sm text-muted-foreground">Análises agregadas sobre dores, perfis e oportunidades de produto. Executadas sob demanda.</p>
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