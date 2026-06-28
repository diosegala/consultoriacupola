import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Video } from 'lucide-react';
import { useAllReunioes, useReunioesByConsultor, useAnalisarReuniao, ReuniaoComDetalhes } from '@/hooks/useReunioes';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { ReunioesList } from '@/components/consultor/ReunioesList';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function Reunioes() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [origem, setOrigem] = useState<'all' | 'drive' | 'manual'>('drive');
  const { data: myConsultorId } = useMyConsultorId();
  const allQuery = useAllReunioes({ origem });
  const consultorQuery = useReunioesByConsultor(isAdmin ? undefined : myConsultorId ?? undefined);
  const reunioesRaw = isAdmin ? allQuery.data : consultorQuery.data;
  const isLoading = isAdmin ? allQuery.isLoading : consultorQuery.isLoading;
  const reunioes = useMemo(() => {
    if (isAdmin || !reunioesRaw) return reunioesRaw;
    // consultor view: ignore origem tabs (no log filter); just return all his reunioes
    return reunioesRaw;
  }, [isAdmin, reunioesRaw]);
  const analisar = useAnalisarReuniao();
  const [analisandoLote, setAnalisandoLote] = useState(false);

  if (loading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const pendentes = (reunioes || []).filter(
    (r: ReuniaoComDetalhes) => r.transcricao && (r.status_analise === 'pendente' || r.status_analise === 'erro'),
  );

  const handleAnalisarTodas = async () => {
    if (!pendentes.length) {
      toast({ title: 'Nenhuma reunião pendente de análise' });
      return;
    }
    setAnalisandoLote(true);
    let ok = 0;
    let fail = 0;
    for (const r of pendentes) {
      try {
        await analisar.mutateAsync(r.id);
        ok++;
      } catch (err: any) {
        fail++;
        console.error('Falha ao analisar', r.id, err);
      }
    }
    setAnalisandoLote(false);
    toast({
      title: 'Análise em lote concluída',
      description: `${ok} analisadas, ${fail} com erro.`,
    });
  };

  const total = reunioes?.length || 0;
  const analisadas = (reunioes || []).filter((r) => r.status_analise === 'concluido').length;

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
          <Button
            onClick={handleAnalisarTodas}
            disabled={analisandoLote || !pendentes.length}
            className="bg-primary text-primary-foreground"
          >
            {analisandoLote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analisar pendentes ({pendentes.length})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{total}</p></CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Analisadas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">{analisadas}</p></CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-warning">{pendentes.length}</p></CardContent>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
