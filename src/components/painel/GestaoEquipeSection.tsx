import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Video,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertOctagon,
  Calendar as CalendarIcon,
  MessageSquareWarning,
  Sparkles,
  Info,
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { EventoFormDialog } from '@/components/agenda/EventoFormDialog';
import { usePerfisDiscBatch } from '@/hooks/useDisc';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReunioesGestaoPorLiderada } from './ReunioesGestaoPorLiderada';

type RadarConsultor = {
  id: string;
  nome: string;
  ativo: boolean;
  clientes_ativos: number;
  reunioes_14d: number;
  score_medio: number | null;
  tendencia: 'up' | 'down' | 'stable';
  proxima_reuniao: { data: string; cliente_nome: string } | null;
  alertas: { sem_contato: number; checklist_parado: number; compromisso_vencido: number };
};

function useRadarEquipe(userId: string | null) {
  return useQuery({
    queryKey: ['painel-diretor', 'radar-equipe', userId],
    queryFn: async (): Promise<RadarConsultor[]> => {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const ha14 = format(subDays(new Date(), 14), 'yyyy-MM-dd');
      const ha28 = format(subDays(new Date(), 28), 'yyyy-MM-dd');

      // Descobre o consultor vinculado ao próprio diretor logado para excluí-lo do radar
      let selfConsultorId: string | null = null;
      if (userId) {
        const { data: cu } = await supabase
          .from('consultor_user')
          .select('consultor_id')
          .eq('user_id', userId)
          .maybeSingle();
        selfConsultorId = (cu as any)?.consultor_id ?? null;
      }

      const [consRes, cliRes, reunRes, atendRes, checkRes, compRes] = await Promise.all([
        supabase.from('consultores').select('id, nome, ativo').eq('ativo', true).order('nome'),
        supabase.from('clientes').select('id, consultor_id, nome').eq('status', 'ativo'),
        supabase
          .from('reunioes')
          .select('consultor_id, data_reuniao, score_ia, status_analise')
          .gte('data_reuniao', ha28),
        supabase
          .from('atendimentos')
          .select('cliente_id, proxima_reuniao, clientes!inner(nome, consultor_id)')
          .gte('proxima_reuniao', hoje)
          .order('proxima_reuniao', { ascending: true }),
        supabase
          .from('projeto_checklist')
          .select('id, projetos!inner(consultor_id, cliente_id), concluido, updated_at')
          .eq('concluido', false),
        supabase
          .from('compromissos' as any)
          .select('*')
          .lt('prazo', hoje)
          .eq('status', 'pendente') as any,
      ]);

      const consultores = ((consRes.data ?? []) as Array<{ id: string; nome: string; ativo: boolean }>)
        .filter((c) => c.id !== selfConsultorId);
      const clientes = (cliRes.data ?? []) as Array<{ id: string; consultor_id: string | null }>;
      const reunioes = (reunRes.data ?? []) as Array<{ consultor_id: string; data_reuniao: string; score_ia: number | null; status_analise: string }>;
      const atendimentos = (atendRes.data ?? []) as any[];
      const compromissos = (compRes.data ?? []) as any[];

      return consultores.map((c) => {
        const clientesDoConsultor = clientes.filter((x) => x.consultor_id === c.id);
        const clienteIds = new Set(clientesDoConsultor.map((x) => x.id));

        const reunioesDoConsultor = reunioes.filter((r) => r.consultor_id === c.id);
        const reunioes14d = reunioesDoConsultor.filter((r) => r.data_reuniao >= ha14).length;

        // score: últimas 5 concluídas com score
        const scored = reunioesDoConsultor
          .filter((r) => r.status_analise === 'concluido' && r.score_ia != null)
          .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao));
        const last5 = scored.slice(0, 5);
        const prev5 = scored.slice(5, 10);
        const avg = (arr: typeof scored) =>
          arr.length ? arr.reduce((s, x) => s + Number(x.score_ia), 0) / arr.length : null;
        const scoreMedio = avg(last5);
        const prevScore = avg(prev5);
        let tendencia: 'up' | 'down' | 'stable' = 'stable';
        if (scoreMedio != null && prevScore != null) {
          if (scoreMedio - prevScore >= 0.5) tendencia = 'up';
          else if (prevScore - scoreMedio >= 0.5) tendencia = 'down';
        }

        const proxima = atendimentos.find((a: any) => a.clientes?.consultor_id === c.id);
        const proxObj = proxima
          ? { data: proxima.proxima_reuniao as string, cliente_nome: proxima.clientes?.nome ?? '—' }
          : null;

        const semContato = clientesDoConsultor.filter((cli) => {
          const prox = atendimentos.find((a: any) => a.cliente_id === cli.id);
          return !prox;
        }).length;

        const checklistParado = 0; // heurística leve; detalhe fica no relatório do consultor

        const compromissoVencido = compromissos.filter((cp: any) => clienteIds.has(cp.cliente_id)).length;

        return {
          id: c.id,
          nome: c.nome,
          ativo: c.ativo,
          clientes_ativos: clientesDoConsultor.length,
          reunioes_14d: reunioes14d,
          score_medio: scoreMedio,
          tendencia,
          proxima_reuniao: proxObj,
          alertas: {
            sem_contato: semContato,
            checklist_parado: checklistParado,
            compromisso_vencido: compromissoVencido,
          },
        };
      });
    },
  });
}

function useAlertasSentimento(userId: string | null) {
  return useQuery({
    queryKey: ['painel-diretor', 'alertas-sentimento', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', userId!)
        .eq('lida', false)
        .eq('tipo', 'sentimento_negativo_cliente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useLembretesGestao(userId: string | null) {
  return useQuery({
    queryKey: ['painel-diretor', 'lembretes-gestao', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', userId!)
        .eq('lida', false)
        .in('tipo', ['lembrete_gestao', 'briefing_1x1'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

const SCORE_DIMENSOES: Array<{ key: string; label: string }> = [
  { key: 'clareza_direcao', label: 'Clareza de direção' },
  { key: 'delegacao', label: 'Delegação' },
  { key: 'escuta_ativa', label: 'Escuta ativa' },
  { key: 'feedback_construtivo', label: 'Feedback construtivo' },
  { key: 'desenvolvimento', label: 'Desenvolvimento' },
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GestaoEquipeSection({ userId }: { userId: string | null }) {
  const { data: radar, isLoading: loadingRadar } = useRadarEquipe(userId);
  const { data: alertas, isLoading: loadingAlertas } = useAlertasSentimento(userId);
  const { data: lembretes, isLoading: loadingLembretes } = useLembretesGestao(userId);
  const consultorIds = useMemo(() => (radar ?? []).map((c) => c.id), [radar]);
  const { data: discMap } = usePerfisDiscBatch(consultorIds);

  const [agendarPara, setAgendarPara] = useState<{ consultora: string; cliente: string } | null>(null);

  const briefings = useMemo(
    () => (lembretes ?? []).filter((l: any) => l.tipo === 'briefing_1x1'),
    [lembretes],
  );
  const lembretesPuros = useMemo(
    () => (lembretes ?? []).filter((l: any) => l.tipo === 'lembrete_gestao'),
    [lembretes],
  );

  return (
    <div className="space-y-6">
      <div className="pt-4 border-t border-border/50">
        <h2 className="text-xl font-bold text-foreground">Gestão da Equipe</h2>
        <p className="text-sm text-muted-foreground">Radar consolidado das consultoras, alertas críticos e apoio às reuniões de gestão.</p>
      </div>

      {/* BLOCO A — Radar da equipe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Radar da equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRadar ? (
            <Skeleton className="h-32 w-full" />
          ) : (radar?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma consultora ativa cadastrada.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {radar!.map((c) => {
                const totalAlertas = c.alertas.sem_contato + c.alertas.checklist_parado + c.alertas.compromisso_vencido;
                const disc = discMap?.get(c.id) ?? null;
                return (
                  <Link
                    key={c.id}
                    to={`/consultores/${c.id}/relatorio`}
                    className="rounded-md border border-border/50 bg-card/40 p-3 hover:bg-muted/40 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                        <p className="text-[10px] text-muted-foreground">Portfólio ativo</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {disc ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] cursor-help bg-primary/10 text-primary border-primary/30"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                >
                                  {disc.perfil_primario}/{disc.perfil_secundario}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] cursor-help bg-muted text-muted-foreground"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                >
                                  DISC pendente
                                </Badge>
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              {disc ? (
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold">{disc.perfil_primario}/{disc.perfil_secundario} — pontos de atenção</p>
                                  <ul className="text-[11px] list-disc list-inside">
                                    {(disc.pontos_de_atencao ?? []).slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                                  </ul>
                                </div>
                              ) : (
                                <Link to={`/consultores/${c.id}`} className="text-[11px] underline">
                                  Cadastrar DISC na página do consultor
                                </Link>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {totalAlertas > 0 && (
                          <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                            {totalAlertas}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Clientes</p>
                        <p className="text-base font-semibold text-foreground">{c.clientes_ativos}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reuniões 14d</p>
                        <p className="text-base font-semibold text-foreground">{c.reunioes_14d}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Score</p>
                        <p className="text-base font-semibold text-foreground flex items-center gap-1">
                          {c.score_medio != null ? c.score_medio.toFixed(1) : '—'}
                          {c.tendencia === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                          {c.tendencia === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
                          {c.tendencia === 'stable' && c.score_medio != null && <Minus className="h-3 w-3 text-muted-foreground" />}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      {c.proxima_reuniao ? (
                        <span className="truncate">
                          Próxima: {format(new Date(c.proxima_reuniao.data + 'T00:00:00'), "dd/MM", { locale: ptBR })} · {c.proxima_reuniao.cliente_nome}
                        </span>
                      ) : (
                        <span>Sem próxima reunião agendada</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO B — Alertas críticos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-destructive" /> Alertas críticos de clientes
          </CardTitle>
          <Badge variant="outline">{alertas?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent>
          {loadingAlertas ? (
            <Skeleton className="h-20 w-full" />
          ) : (alertas?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Sem alertas críticos no momento. Serão gerados automaticamente quando o sistema detectar sinais de insatisfação nas transcrições de reuniões.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {alertas!.map((n: any) => {
                const md = n.metadata ?? {};
                return (
                  <div key={n.id} className="p-3 rounded-md border border-destructive/30 bg-destructive/5 space-y-2">
                    <div className="flex items-start gap-2">
                      <MessageSquareWarning className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{n.titulo}</p>
                        {n.descricao && <p className="text-[11px] text-muted-foreground mt-0.5">{n.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {md.reuniao_id && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/reunioes?id=${md.reuniao_id}`}>Ver análise</Link>
                        </Button>
                      )}
                      {md.consultora_nome && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAgendarPara({
                              consultora: md.consultora_nome,
                              cliente: md.cliente_nome ?? '',
                            })
                          }
                        >
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          Agendar conversa com {md.consultora_nome}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO C — Briefings + reuniões de gestão por liderada */}
      {briefings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Prepare-se para amanhã
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {briefings.map((b: any) => (
              <div key={b.id} className="p-3 rounded-md border border-primary/40 bg-primary/5 space-y-1">
                <p className="text-sm font-medium text-foreground">{b.titulo}</p>
                {b.descricao && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{b.descricao}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ReunioesGestaoPorLiderada />

      {/* BLOCO D — Lembretes de gestão */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Lembretes de gestão
          </CardTitle>
          <Badge variant="outline">{lembretesPuros.length}</Badge>
        </CardHeader>
        <CardContent>
          {loadingLembretes ? (
            <Skeleton className="h-20 w-full" />
          ) : lembretesPuros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lembrete de cadência no momento.</p>
          ) : (
            <div className="space-y-2">
              {lembretesPuros.map((l: any) => (
                <div key={l.id} className="p-3 rounded-md border border-border/50 bg-card/40">
                  <p className="text-sm text-foreground">{l.titulo}</p>
                  {l.descricao && <p className="text-[11px] text-muted-foreground mt-0.5">{l.descricao}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EventoFormDialog
        open={!!agendarPara}
        onOpenChange={(o) => !o && setAgendarPara(null)}
        initial={
          agendarPara
            ? {
                summary: `1:1 com ${agendarPara.consultora}${agendarPara.cliente ? ` · caso ${agendarPara.cliente}` : ''}`,
                description: agendarPara.cliente
                  ? `Conversa disparada por alerta de sentimento negativo do cliente ${agendarPara.cliente}.`
                  : `Conversa 1:1 com ${agendarPara.consultora}.`,
                start: addDays(new Date(new Date().setHours(10, 0, 0, 0)), 1),
                end: addDays(new Date(new Date().setHours(11, 0, 0, 0)), 1),
                addMeet: true,
              }
            : undefined
        }
      />
    </div>
  );
}