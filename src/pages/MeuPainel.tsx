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
import { cn } from '@/lib/utils';

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
  const { data: reunioes, isLoading: loadingReunioes } = useProximasReunioes(consultorId);
  const { data: alertas, isLoading: loadingAlertas } = useAlertasPortfolio(consultorId);
  const { data: metricas, isLoading: loadingMetricas } = useMetricasPortfolio(consultorId);
  const { data: checklistItens } = useMinhasTarefasChecklist();
  const { data: todoItens } = useMinhasTarefasTodo();
  const toggleChecklist = useToggleChecklistItem();
  const updateTodo = useUpdateTodoPessoal();

  const [novaReuniao, setNovaReuniao] = useState<{ clienteId: string } | null>(null);

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
              <Badge variant="outline">{tarefasUrgentes.length}</Badge>
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
    </div>
  );
}