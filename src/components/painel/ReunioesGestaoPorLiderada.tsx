import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Video, Users, RefreshCw, ExternalLink, AlertTriangle, Info, Sparkles, Loader2 } from 'lucide-react';
import { format, subDays, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { usePerfisDiscBatch } from '@/hooks/useDisc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TipoReuniao = '1on1' | 'weekly' | 'equipe' | 'individual';

type Reuniao = {
  id: string;
  diretor_id: string;
  tipo: TipoReuniao;
  participantes: string[];
  data_reuniao: string;
  status_analise: string;
  resumo_ia: string | null;
  analise_ia: any;
  google_file_id: string | null;
  nome_arquivo: string | null;
};

type Consultor = { id: string; nome: string };

function normalizeTipo(t: string): '1on1' | 'weekly' | 'equipe' {
  if (t === 'individual') return '1on1';
  if (t === '1on1' || t === 'weekly' || t === 'equipe') return t;
  return '1on1';
}

function firstName(nome: string): string {
  return (nome ?? '').trim().split(/\s+/)[0].toLowerCase();
}

function useReunioesGestao(diretorId?: string | null) {
  return useQuery({
    queryKey: ['painel-diretor', 'reunioes-gestao-full', diretorId ?? 'all'],
    queryFn: async () => {
      const desde = format(subDays(new Date(), 180), 'yyyy-MM-dd');
      let q = supabase
        .from('reunioes_gestao' as any)
        .select('id, diretor_id, tipo, participantes, data_reuniao, status_analise, resumo_ia, analise_ia, google_file_id, nome_arquivo')
        .gte('data_reuniao', desde)
        .order('data_reuniao', { ascending: false });
      if (diretorId) q = q.eq('diretor_id', diretorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Reuniao[];
    },
  });
}

function useConsultoresAtivos() {
  return useQuery({
    queryKey: ['consultores', 'ativos', 'basic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultores')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      const EXCLUIDOS = ['sidenir', 'cristiano'];
      return ((data ?? []) as Consultor[]).filter(
        (c) => !EXCLUIDOS.includes(firstName(c.nome)),
      );
    },
  });
}

const SCORE_LABELS: Record<string, string> = {
  clareza_direcao: 'Clareza de direção',
  delegacao: 'Delegação',
  escuta_ativa: 'Escuta ativa',
  feedback_construtivo: 'Feedback construtivo',
  desenvolvimento: 'Desenvolvimento',
  clareza_prioridades: 'Clareza de prioridades',
  identificacao_bloqueios: 'Identificação de bloqueios',
  follow_up: 'Follow-up',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{Number(value).toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReuniaoDetalhe({ r, onReanalisar, reanalisando }: { r: Reuniao; onReanalisar: () => void; reanalisando: boolean }) {
  const analise = r.analise_ia ?? {};
  const scores: Record<string, number> = analise.scores ?? {};
  const acoes: Array<{ responsavel: string; descricao: string; prazo?: string | null }> = analise.acoes ?? [];
  const pontos: string[] = analise.pontos_fortes ?? [];
  const bloqueios: string[] = analise.bloqueios ?? [];
  const sugestao: string | undefined = analise.sugestao_melhoria;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px]">{r.status_analise}</Badge>
        <div className="flex items-center gap-2">
          {r.google_file_id && (
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <a href={`https://docs.google.com/document/d/${r.google_file_id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Transcrição
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onReanalisar}
            disabled={reanalisando}
          >
            {reanalisando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Reanalisar
          </Button>
        </div>
      </div>

      {r.resumo_ia ? (
        <p className="text-xs text-foreground whitespace-pre-wrap">{r.resumo_ia}</p>
      ) : (
        <p className="text-xs text-muted-foreground italic">Análise ainda não disponível.</p>
      )}

      {Object.keys(scores).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          {Object.entries(scores).map(([k, v]) =>
            v != null ? <ScoreBar key={k} label={SCORE_LABELS[k] ?? k} value={Number(v)} /> : null,
          )}
        </div>
      )}

      {sugestao && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
          <p className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-1">Próxima reunião: melhoria</p>
          <p className="text-xs text-foreground">{sugestao}</p>
        </div>
      )}

      {pontos.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Pontos fortes</p>
          <ul className="text-xs list-disc pl-4 space-y-0.5">
            {pontos.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {bloqueios.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Bloqueios identificados</p>
          <ul className="text-xs list-disc pl-4 space-y-0.5">
            {bloqueios.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {acoes.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ações combinadas</p>
          <ul className="text-xs space-y-1">
            {acoes.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.responsavel}:</span> {a.descricao}
                {a.prazo && <span className="text-muted-foreground"> · até {a.prazo}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ListaReunioes({
  reunioes,
  onReanalisar,
  reanalisandoId,
  emptyLabel,
}: {
  reunioes: Reuniao[];
  onReanalisar: (id: string) => void;
  reanalisandoId: string | null;
  emptyLabel: string;
}) {
  if (!reunioes.length) {
    return <p className="text-xs text-muted-foreground py-6 text-center">{emptyLabel}</p>;
  }
  return (
    <Accordion type="multiple" className="w-full">
      {reunioes.map((r) => (
        <AccordionItem key={r.id} value={r.id} className="border-border/50">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2 gap-2">
              <span className="text-sm text-foreground">
                {format(new Date(r.data_reuniao + 'T00:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  r.status_analise === 'concluido' && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
                  r.status_analise === 'analisando' && 'bg-blue-500/10 text-blue-500 border-blue-500/30',
                  r.status_analise === 'erro' && 'bg-destructive/10 text-destructive border-destructive/30',
                )}
              >
                {r.status_analise}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ReuniaoDetalhe
              r={r}
              onReanalisar={() => onReanalisar(r.id)}
              reanalisando={reanalisandoId === r.id}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function ReunioesGestaoPorLiderada() {
  const { data: reunioes, isLoading } = useReunioesGestao(undefined);
  const { data: consultores } = useConsultoresAtivos();
  const consultorIds = useMemo(() => (consultores ?? []).map((c) => c.id), [consultores]);
  const { data: discMap } = usePerfisDiscBatch(consultorIds);
  const [selectedId, setSelectedId] = useState<string | 'equipe' | null>(null);
  const [reanalisandoId, setReanalisandoId] = useState<string | null>(null);
  const qc = useQueryClient();

  const reanalisar = useMutation({
    mutationFn: async (id: string) => {
      setReanalisandoId(id);
      await supabase.from('reunioes_gestao' as any).update({ status_analise: 'analisando' }).eq('id', id);
      const { error } = await supabase.functions.invoke('analisar-reuniao-gestao', {
        body: { reuniao_gestao_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reanálise disparada. Atualize em alguns instantes.');
      qc.invalidateQueries({ queryKey: ['painel-diretor', 'reunioes-gestao-full'] });
    },
    onError: (e: any) => {
      toast.error('Erro ao reanalisar: ' + (e?.message ?? 'desconhecido'));
    },
    onSettled: () => setReanalisandoId(null),
  });

  // Agrupa reuniões por consultora (participante) e separa Equipe
  const grupos = useMemo(() => {
    const map = new Map<string, Reuniao[]>(); // key = consultor.id
    const equipe: Reuniao[] = [];
    for (const r of reunioes ?? []) {
      const tipo = normalizeTipo(r.tipo);
      if (tipo === 'equipe') {
        equipe.push(r);
        continue;
      }
      const nomes = (r.participantes ?? []).map(firstName);
      for (const c of consultores ?? []) {
        if (nomes.includes(firstName(c.nome))) {
          if (!map.has(c.id)) map.set(c.id, []);
          map.get(c.id)!.push(r);
        }
      }
    }
    return { porConsultor: map, equipe };
  }, [reunioes, consultores]);

  const cardsConsultoras = useMemo(() => {
    const items: Array<{
      consultor: Consultor;
      um_a_um: Reuniao[];
      weekly: Reuniao[];
      total: number;
    }> = [];
    for (const c of consultores ?? []) {
      const rs = grupos.porConsultor.get(c.id) ?? [];
      if (!rs.length) continue;
      const um_a_um = rs.filter((r) => normalizeTipo(r.tipo) === '1on1');
      const weekly = rs.filter((r) => normalizeTipo(r.tipo) === 'weekly');
      items.push({ consultor: c, um_a_um, weekly, total: rs.length });
    }
    // Ordena: quem tem reuniões mais recentes primeiro
    items.sort((a, b) => {
      const da = Math.max(...a.um_a_um.concat(a.weekly).map((r) => Date.parse(r.data_reuniao)), 0);
      const db = Math.max(...b.um_a_um.concat(b.weekly).map((r) => Date.parse(r.data_reuniao)), 0);
      return db - da;
    });
    return items;
  }, [consultores, grupos]);

  const selecionado = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId === 'equipe') {
      return { tipo: 'equipe' as const, equipeList: grupos.equipe };
    }
    const c = (consultores ?? []).find((x) => x.id === selectedId);
    if (!c) return null;
    const rs = grupos.porConsultor.get(c.id) ?? [];
    return {
      tipo: 'consultor' as const,
      consultor: c,
      um_a_um: rs.filter((r) => normalizeTipo(r.tipo) === '1on1'),
      weekly: rs.filter((r) => normalizeTipo(r.tipo) === 'weekly'),
    };
  }, [selectedId, consultores, grupos]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" /> Minhas reuniões de gestão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : cardsConsultoras.length === 0 && grupos.equipe.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Suas reuniões de gestão serão analisadas automaticamente quando as transcrições forem importadas do Google Drive.
                Nomeie os arquivos contendo "1:1" ou "Weekly" para identificar o tipo.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {cardsConsultoras.map(({ consultor, um_a_um, weekly }) => {
                const disc = discMap?.get(consultor.id) ?? null;
                const ultima1x1 = um_a_um[0]?.data_reuniao ?? null;
                const ultimaWeekly = weekly[0]?.data_reuniao ?? null;
                const dias1x1 = ultima1x1 ? differenceInCalendarDays(new Date(), new Date(ultima1x1 + 'T00:00:00')) : null;
                const diasWeekly = ultimaWeekly ? differenceInCalendarDays(new Date(), new Date(ultimaWeekly + 'T00:00:00')) : null;
                const atrasada1x1 = dias1x1 == null || dias1x1 > 14;
                const atrasadaWeekly = diasWeekly == null || diasWeekly > 10;
                return (
                  <button
                    key={consultor.id}
                    onClick={() => setSelectedId(consultor.id)}
                    className="text-left rounded-md border border-border/50 bg-card/40 p-3 hover:bg-muted/40 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{consultor.nome}</p>
                        <p className="text-[10px] text-muted-foreground">Reuniões de gestão · 180d</p>
                      </div>
                      {disc ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          {disc.perfil_primario}/{disc.perfil_secundario}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">DISC pendente</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-md border border-border/40 p-2">
                        <p className="text-muted-foreground uppercase tracking-wide text-[9px]">1:1</p>
                        <p className="text-base font-semibold text-foreground">{um_a_um.length}</p>
                        <p className={cn('text-[10px]', atrasada1x1 ? 'text-destructive' : 'text-muted-foreground')}>
                          {ultima1x1
                            ? `Última há ${dias1x1}d${atrasada1x1 ? ' ⚠' : ''}`
                            : 'Sem registro'}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/40 p-2">
                        <p className="text-muted-foreground uppercase tracking-wide text-[9px]">Weekly</p>
                        <p className="text-base font-semibold text-foreground">{weekly.length}</p>
                        <p className={cn('text-[10px]', atrasadaWeekly ? 'text-destructive' : 'text-muted-foreground')}>
                          {ultimaWeekly
                            ? `Última há ${diasWeekly}d${atrasadaWeekly ? ' ⚠' : ''}`
                            : 'Sem registro'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {grupos.equipe.length > 0 && (
                <button
                  onClick={() => setSelectedId('equipe')}
                  className="text-left rounded-md border border-border/50 bg-card/40 p-3 hover:bg-muted/40 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                        <Users className="h-3 w-3" /> Reuniões de equipe
                      </p>
                      <p className="text-[10px] text-muted-foreground">Reuniões coletivas · 180d</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{grupos.equipe.length}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {grupos.equipe[0]
                      ? `Última em ${format(new Date(grupos.equipe[0].data_reuniao + 'T00:00:00'), 'dd/MM', { locale: ptBR })}`
                      : 'Sem registro'}
                  </p>
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selecionado?.tipo === 'consultor' && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="flex items-center gap-2">
                  {selecionado.consultor.nome}
                  {discMap?.get(selecionado.consultor.id) && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                      {discMap.get(selecionado.consultor.id)!.perfil_primario}/{discMap.get(selecionado.consultor.id)!.perfil_secundario}
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-3 text-xs">
                  <Link
                    to={`/consultores/${selecionado.consultor.id}`}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Perfil completo
                  </Link>
                  <Link
                    to={`/consultores/${selecionado.consultor.id}/relatorio`}
                    className="text-primary hover:underline"
                  >
                    Relatório de desempenho
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <Tabs defaultValue="1on1" className="mt-4">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="1on1">
                    1:1
                    <Badge variant="outline" className="ml-2 text-[10px]">{selecionado.um_a_um.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="weekly">
                    Weekly
                    <Badge variant="outline" className="ml-2 text-[10px]">{selecionado.weekly.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="1on1" className="mt-2">
                  <ListaReunioes
                    reunioes={selecionado.um_a_um}
                    onReanalisar={(id) => reanalisar.mutate(id)}
                    reanalisandoId={reanalisandoId}
                    emptyLabel="Nenhuma 1:1 registrada nos últimos 180 dias."
                  />
                </TabsContent>
                <TabsContent value="weekly" className="mt-2">
                  <ListaReunioes
                    reunioes={selecionado.weekly}
                    onReanalisar={(id) => reanalisar.mutate(id)}
                    reanalisandoId={reanalisandoId}
                    emptyLabel="Nenhuma Weekly registrada nos últimos 180 dias."
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
          {selecionado?.tipo === 'equipe' && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Reuniões de equipe
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {selecionado.equipeList.length} reunião(ões) coletivas nos últimos 180 dias.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <ListaReunioes
                  reunioes={selecionado.equipeList}
                  onReanalisar={(id) => reanalisar.mutate(id)}
                  reanalisandoId={reanalisandoId}
                  emptyLabel="Sem reuniões de equipe."
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// Silence unused warning for imports on some builds
void AlertTriangle;