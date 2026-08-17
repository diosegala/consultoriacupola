import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Video } from 'lucide-react';
import {
  useAllReunioes,
  useReunioesByConsultor,
  useAnalisarReuniao,
  useReunioesStats,
  useReunioesPendentesIds,
} from '@/hooks/useReunioes';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { ReunioesList } from '@/components/consultor/ReunioesList';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

/** Runs tasks with limited concurrency so the queue doesn't block the UI. */
async function runQueue<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export default function Reunioes() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [origem, setOrigem] = useState<'all' | 'drive' | 'manual'>('drive');
  const { data: myConsultorId } = useMyConsultorId();

  const allQuery = useAllReunioes({ origem });
  const consultorQuery = useReunioesByConsultor(isAdmin ? undefined : myConsultorId ?? undefined);

  const scopedConsultorId = isAdmin ? null : myConsultorId ?? null;
  const { data: stats } = useReunioesStats(scopedConsultorId);
  const { data: pendentesIds } = useReunioesPendentesIds(scopedConsultorId);

  const reunioes = useMemo(() => {
    if (isAdmin) return allQuery.data?.pages.flat() ?? [];
    return consultorQuery.data ?? [];
  }, [isAdmin, allQuery.data, consultorQuery.data]);

  const isLoading = isAdmin ? allQuery.isLoading : consultorQuery.isLoading;

  const analisar = useAnalisarReuniao();
  const [analisandoLote, setAnalisandoLote] = useState(false);
  const [progresso, setProgresso] = useState({ done: 0, total: 0 });

  if (loading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const pendentes = pendentesIds ?? [];

  const handleAnalisarTodas = async () => {
    if (!pendentes.length) {
      toast({ title: 'Nenhuma reunião pendente de análise' });
      return;
    }
    setAnalisandoLote(true);
    setProgresso({ done: 0, total: pendentes.length });
    let ok = 0;
    let fail = 0;
    await runQueue(pendentes, 3, async (id) => {
      try {
        await analisar.mutateAsync(id);
        ok++;
      } catch (err: any) {
        fail++;
        console.error('Falha ao analisar', id, err);
      } finally {
        setProgresso((p) => ({ ...p, done: p.done + 1 }));
      }
    });
    setAnalisandoLote(false);
    toast({
      title: 'Análise em lote concluída',
      description: `${ok} analisadas, ${fail} com erro.`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Video className="h-6 w-6" /> Reuniões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? 'Centralize as reuniões sincronizadas e dispare a análise de IA (desempenho do consultor + engajamento do cliente).'
              : 'Suas reuniões registradas com análise de IA de performance e engajamento.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={handleAnalisarTodas}
              disabled={analisandoLote || !pendentes.length}
              className="bg-primary text-primary-foreground"
            >
              {analisandoLote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Analisar pendentes ({pendentes.length})
            </Button>
            {analisandoLote && (
              <div className="w-56 space-y-1">
                <Progress value={(progresso.done / Math.max(progresso.total, 1)) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {progresso.done} / {progresso.total} processadas
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{stats?.total ?? '—'}</p></CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Analisadas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">{stats?.analisadas ?? '—'}</p></CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-warning">{stats?.pendentes ?? '—'}</p></CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-foreground">Listagem</CardTitle>
          {isAdmin && (
            <Tabs value={origem} onValueChange={(v) => setOrigem(v as any)}>
              <TabsList>
                <TabsTrigger value="drive">Google Drive</TabsTrigger>
                <TabsTrigger value="manual">Manuais</TabsTrigger>
                <TabsTrigger value="all">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </CardHeader>
        <CardContent>
          <ReunioesList
            reunioes={reunioes}
            isLoading={isLoading}
            showConsultorColumn={isAdmin}
            linkCliente
            hasMore={isAdmin && !!allQuery.hasNextPage}
            isLoadingMore={allQuery.isFetchingNextPage}
            onLoadMore={() => allQuery.fetchNextPage()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
