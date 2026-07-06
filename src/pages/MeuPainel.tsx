import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarClock,
  AlertTriangle,
  ListChecks,
  Users,
  Video,
  FileText,
  Plus,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useMinhasTarefasChecklist, useMinhasTarefasTodo } from '@/hooks/useMinhasTarefas';
import { useToggleChecklistItem } from '@/hooks/useProjetoChecklist';
import { useUpdateTodoPessoal } from '@/hooks/useTodoPessoal';
import { NovaReuniaoDialog } from '@/components/consultor/NovaReuniaoDialog';
import { NovaTarefaPessoalDialog } from '@/components/tarefas/NovaTarefaPessoalDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const TIPOS_PROATIVOS = ['sem_contato', 'checklist_parado', 'okr_sem_progresso', 'contrato_sem_renovacao'] as const;
type TipoProativo = (typeof TIPOS_PROATIVOS)[number];

const TIPO_META: Record<TipoProativo, { label: string; className: string }> = {
  sem_contato: { label: 'Reengajar', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  checklist_parado: { label: 'Checklist parado', className: 'bg-yellow-500/15 text-yellow-600 border-yellow-600/30' },
  okr_sem_progresso: { label: 'OKRs parados', className: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
  contrato_sem_renovacao: { label: 'Renovação', className: 'bg-primary/15 text-primary border-primary/30' },
};

function useAcoesSugeridas(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['meu-painel', 'acoes-sugeridas', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, tipo, titulo, descricao, link, entidade_id, entidade_tipo, metadata, created_at')
        .eq('user_id', userId!)
        .eq('lida', false)
        .in('tipo', TIPOS_PROATIVOS as unknown as string[])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

function useProximasReunioes(consultorId: string | null | undefined) {
  return useQuery({
    queryKey: ['meu-painel', 'proximas-reunioes', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const hoje = todayISO();
      const limite = format(addDays(new Date(), 14), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('atendimentos')
        .select('id, proxima_reuniao, cliente_id, clientes!inner(id, nome, consultor_id)')
        .gte('proxima_reuniao', hoje)
        .lte('proxima_reuniao', limite)
        .eq('clientes.consultor_id', consultorId!)
        .order('proxima_reuniao', { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useAlertasPortfolio(consultorId: string | null | undefined) {
  return useQuery({
    queryKey: ['meu-painel', 'alertas', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const hoje = todayISO();
      const limite60 = format(addDays(new Date(), 60), 'yyyy-MM-dd');

      const { data: clientes, error: e1 } = await supabase
        .from('clientes')
        .select('id, nome, atendimentos(proxima_reuniao)')
        .eq('consultor_id', consultorId!);
      if (e1) throw e1;

      const reunioesAtrasadas = (clientes ?? [])
        .map((c: any) => {
          const prox = c.atendimentos?.[0]?.proxima_reuniao;
          if (prox && prox < hoje) {
            return { tipo: 'reuniao_atrasada' as const, cliente_id: c.id, cliente_nome: c.nome, data: prox };
          }
          return null;
        })
        .filter(Boolean) as Array<{ tipo: 'reuniao_atrasada'; cliente_id: string; cliente_nome: string; data: string }>;

      const { data: contratos, error: e2 } = await supabase
        .from('contratos')
        .select('id, data_fim, cliente_id, clientes!inner(id, nome, consultor_id)')
        .eq('ativo', true)
        .eq('clientes.consultor_id', consultorId!)
        .gte('data_fim', hoje)
        .lte('data_fim', limite60)
        .order('data_fim', { ascending: true });
      if (e2) throw e2;

      const contratosVencendo = (contratos ?? []).map((c: any) => ({
        tipo: 'contrato_vencendo' as const,
        cliente_id: c.cliente_id,
        cliente_nome: c.clientes?.nome ?? '—',
        data: c.data_fim,
      }));

      return [...reunioesAtrasadas, ...contratosVencendo];
    },
  });
}

function useMetricasPortfolio(consultorId: string | null | undefined) {
  return useQuery({
    queryKey: ['meu-painel', 'metricas', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const inicio = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const [clientesRes, reunioesRes, docsRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('consultor_id', consultorId!)
          .eq('status', 'ativo'),
        supabase
          .from('reunioes')
          .select('id', { count: 'exact', head: true })
          .eq('consultor_id', consultorId!)
          .gte('data_reuniao', inicio)
          .lte('data_reuniao', fim),
        supabase
          .from('projeto_documentos')
          .select('id, projetos!inner(consultor_id)', { count: 'exact', head: true })
          .eq('projetos.consultor_id', consultorId!)
          .gte('created_at', inicio + 'T00:00:00')
          .lte('created_at', fim + 'T23:59:59'),
      ]);

      return {
        clientes_ativos: clientesRes.count ?? 0,
        reunioes_mes: reunioesRes.count ?? 0,
        documentos_mes: docsRes.count ?? 0,
      };
    },
  });
}

export default function MeuPainel() {
  const { data: consultorId, isLoading: loadingConsultor } = useMyConsultorId();
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // pega user id (para filtrar notificações do próprio usuário)
  useMemo(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: reunioes, isLoading: loadingReunioes } = useProximasReunioes(consultorId);
  const { data: alertas, isLoading: loadingAlertas } = useAlertasPortfolio(consultorId);
  const { data: metricas, isLoading: loadingMetricas } = useMetricasPortfolio(consultorId);
  const { data: acoesSugeridas, isLoading: loadingAcoes } = useAcoesSugeridas(userId);
  const { data: checklistItens } = useMinhasTarefasChecklist();
  const { data: todoItens } = useMinhasTarefasTodo();
  const toggleChecklist = useToggleChecklistItem();
  const updateTodo = useUpdateTodoPessoal();

  const [novaReuniao, setNovaReuniao] = useState<{ clienteId: string } | null>(null);
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);

  async function copiarMensagem(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(id);
      toast.success('Mensagem copiada para a área de transferência');
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 2500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  }

  async function marcarComoLida(id: string) {
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao marcar como resolvida');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['meu-painel', 'acoes-sugeridas'] });
  }

  const hoje = todayISO();
  const tarefasUrgentes = useMemo(() => {
    const cl = (checklistItens ?? [])
      .filter(t => !t.concluido && t.due_date && t.due_date <= hoje)
      .map(t => ({ ...t, kind: 'checklist' as const }));
    const td = (todoItens ?? [])
      .filter(t => !t.concluido && t.due_date && t.due_date <= hoje)
      .map(t => ({ ...t, kind: 'todo' as const }));
    return [...cl, ...td].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  }, [checklistItens, todoItens, hoje]);

  if (loadingConsultor) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!consultorId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um consultor. Peça ao administrador para fazer essa vinculação.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Painel</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu dia e do portfólio sob sua responsabilidade.</p>
      </div>

      {/* Ações sugeridas (proativas) */}
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ações sugeridas
          </CardTitle>
          <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">
            {acoesSugeridas?.length ?? 0}
          </Badge>
        </CardHeader>
        <CardContent>
          {loadingAcoes ? (
            <Skeleton className="h-24 w-full" />
          ) : (acoesSugeridas?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sem ações sugeridas no momento. 🎯</p>
          ) : (
            <div className="space-y-3">
              {acoesSugeridas!.map((n: any) => {
                const meta = TIPO_META[n.tipo as TipoProativo] ?? TIPO_META.sem_contato;
                const msg = n.metadata?.mensagem_sugerida as string | undefined;
                return (
                  <div key={n.id} className="p-3 rounded-md border border-border/50 bg-card/40 space-y-2">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', meta.className)}>
                        {meta.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{n.titulo}</p>
                        {n.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{n.descricao}</p>
                        )}
                      </div>
                    </div>
                    {msg && (
                      <div className="rounded-md bg-muted/40 border border-border/40 p-2 text-xs text-foreground whitespace-pre-wrap">
                        {msg}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiarMensagem(n.id, msg)}
                        >
                          {copiedId === n.id ? (
                            <><Check className="h-3 w-3 mr-1" /> Copiado</>
                          ) : (
                            <><Copy className="h-3 w-3 mr-1" /> Copiar mensagem</>
                          )}
                        </Button>
                      )}
                      {n.link && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={n.link}>Abrir</Link>
                        </Button>
                      )}
                      {n.tipo === 'contrato_sem_renovacao' && n.metadata?.link_balanco && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={n.metadata.link_balanco as string}>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Gerar balanço do período
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => marcarComoLida(n.id)}>
                        Marcar como resolvida
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-6">
          {/* Alertas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas do portfólio
              </CardTitle>
              <Badge variant="outline">{alertas?.length ?? 0}</Badge>
            </CardHeader>
            <CardContent>
              {loadingAlertas ? (
                <Skeleton className="h-20 w-full" />
              ) : (alertas?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
              ) : (
                <div className="space-y-2">
                  {alertas!.map((a, i) => (
                    <Link
                      key={`${a.tipo}-${a.cliente_id}-${i}`}
                      to={`/clientes/${a.cliente_id}`}
                      className="flex items-center gap-3 p-3 rounded-md border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          a.tipo === 'reuniao_atrasada'
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : 'bg-yellow-500/15 text-yellow-600 border-yellow-600/30',
                        )}
                      >
                        {a.tipo === 'reuniao_atrasada' ? 'Reunião atrasada' : 'Contrato vencendo'}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{a.cliente_nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(a.data + 'T00:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximas reuniões */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                Próximas reuniões (14 dias)
              </CardTitle>
              <Badge variant="outline">{reunioes?.length ?? 0}</Badge>
            </CardHeader>
            <CardContent>
              {loadingReunioes ? (
                <Skeleton className="h-20 w-full" />
              ) : (reunioes?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma reunião nas próximas duas semanas.</p>
              ) : (
                <div className="space-y-2">
                  {reunioes!.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-md border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <Link to={`/clientes/${r.cliente_id}`} className="text-sm text-foreground hover:underline">
                          {r.clientes?.nome ?? '—'}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(r.proxima_reuniao + 'T00:00:00'), "EEE, dd 'de' MMM", { locale: ptBR })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setNovaReuniao({ clienteId: r.cliente_id })}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Registrar reunião
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          {/* Tarefas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                Tarefas com prazo hoje ou vencidas
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{tarefasUrgentes.length}</Badge>
                <Button size="sm" variant="outline" onClick={() => setNovaTarefaOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Nova tarefa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tarefasUrgentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Você está em dia. 🎉</p>
              ) : (
                <div className="space-y-2">
                  {tarefasUrgentes.map((t: any) => {
                    const overdue = t.due_date && t.due_date < hoje;
                    return (
                      <div key={`${t.kind}-${t.id}`} className="flex items-center gap-3 p-2 rounded-md border border-border/50">
                        <Checkbox
                          checked={t.concluido}
                          onCheckedChange={(v) => {
                            if (t.kind === 'checklist') {
                              toggleChecklist.mutate({ id: t.checklist_item_id, concluido: !!v, projeto_id: t.projeto_id });
                            } else {
                              updateTodo.mutate({ id: t.id, concluido: !!v });
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{t.titulo}</p>
                          {t.cliente_nome && (
                            <p className="text-[10px] text-muted-foreground">{t.cliente_nome}</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            overdue
                              ? 'bg-destructive/15 text-destructive border-destructive/30'
                              : 'bg-yellow-500/15 text-yellow-600 border-yellow-600/30',
                          )}
                        >
                          {overdue ? 'Vencida' : 'Hoje'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meu portfólio</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMetricas ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border border-border/50 p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
                      <Users className="h-3 w-3" /> Clientes ativos
                    </div>
                    <p className="text-2xl font-semibold text-foreground">{metricas?.clientes_ativos ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-border/50 p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
                      <Video className="h-3 w-3" /> Reuniões / mês
                    </div>
                    <p className="text-2xl font-semibold text-foreground">{metricas?.reunioes_mes ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-border/50 p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wide">
                      <FileText className="h-3 w-3" /> Docs / mês
                    </div>
                    <p className="text-2xl font-semibold text-foreground">{metricas?.documentos_mes ?? 0}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <NovaReuniaoDialog
        open={!!novaReuniao}
        onOpenChange={(o) => !o && setNovaReuniao(null)}
        consultorId={consultorId}
        clienteId={novaReuniao?.clienteId}
      />
      <NovaTarefaPessoalDialog open={novaTarefaOpen} onOpenChange={setNovaTarefaOpen} />
    </div>
  );
}