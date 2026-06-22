import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Link2, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import {
  useGoogleConnection,
  useStartGoogleOAuth,
  useSyncDiarioManual,
  useReunioesImportadasLog,
} from '@/hooks/useGoogleDrive';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MinhasIntegracoes() {
  const { toast } = useToast();
  const { data: consultorId } = useMyConsultorId();
  const { data: conn, isLoading } = useGoogleConnection(consultorId ?? undefined);
  const startOAuth = useStartGoogleOAuth();
  const syncManual = useSyncDiarioManual();
  const [syncing, setSyncing] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useReunioesImportadasLog(
    consultorId ?? undefined,
    { status: logFilter, limit: 20 },
  );

  const lastSyncStats = useMemo(() => {
    if (!conn?.ultima_sincronizacao || !logs) return null;
    const since = new Date(conn.ultima_sincronizacao).getTime() - 5 * 60 * 1000;
    const recent = logs.filter((l) => new Date(l.data_importacao).getTime() >= since);
    return {
      importadas: recent.filter((l) => l.status === 'importado').length,
      sem_cliente: recent.filter((l) => l.status === 'sem_match').length,
      erros: recent.filter((l) => l.status === 'erro').length,
    };
  }, [conn?.ultima_sincronizacao, logs]);

  const handleConnect = async () => {
    const redirectUri = `${window.location.origin}/google-callback`;
    try {
      const { url } = await startOAuth.mutateAsync(redirectUri);
      window.location.href = url;
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res: any = await syncManual.mutateAsync();
      const r = res?.resultados?.[0];
      const desc = r && typeof r.importados === 'number'
        ? `${r.importados} importada(s), ${r.pulados} sem cliente, ${r.erros} erro(s)`
        : 'Verifique as novas reuniões importadas.';
      toast({ title: 'Sincronização concluída', description: desc });
    } catch (e: any) {
      toast({ title: 'Erro na sincronização', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (!consultorId) {
    return (
      <div className="p-6 max-w-3xl">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Minhas Integrações</CardTitle>
            <CardDescription>
              Seu usuário ainda não está vinculado a um consultor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              A conexão com o Google Drive é feita por consultor — cada conta Google é
              associada a um registro em <strong>Consultores</strong>. Para usar esta página,
              vincule seu usuário a um consultor em{' '}
              <Link to="/configuracoes" className="text-primary underline">
                Configurações &gt; Usuários
              </Link>
              .
            </p>
            <p>
              Se você é apenas administrador e não atua como consultor, não precisa conectar
              o Drive aqui — a sincronização automática noturna roda para todos os consultores
              já conectados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Integrações</h1>
        <p className="text-muted-foreground text-sm">Conecte sua conta Google para importar transcrições automaticamente.</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Google Drive</CardTitle>
              <CardDescription>
                Sincroniza transcrições do Google Meet (pasta "Meet Recordings") com o sistema.
              </CardDescription>
            </div>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : conn?.ativo ? (
              <Badge className="bg-green-600/20 text-green-500 border-green-600/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <XCircle className="h-3 w-3 mr-1" /> Desconectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conn?.ativo ? (
            <>
              <div className="space-y-1 text-sm">
                <p className="text-foreground"><span className="text-muted-foreground">Conta Google:</span> {conn.email_google}</p>
                <p className="text-foreground">
                  <span className="text-muted-foreground">Pasta Meet Recordings:</span>{' '}
                  {conn.pasta_meet_id ? 'Localizada' : <span className="text-destructive">Não encontrada</span>}
                </p>
                <p className="text-foreground">
                  <span className="text-muted-foreground">Última sincronização:</span>{' '}
                  {conn.ultima_sincronizacao
                    ? format(new Date(conn.ultima_sincronizacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : 'Nunca'}
                </p>
              </div>
              {lastSyncStats && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-green-600/20 text-green-500 border-green-600/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {lastSyncStats.importadas} importada(s)
                  </Badge>
                  <Badge className="bg-yellow-600/20 text-yellow-500 border-yellow-600/30">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {lastSyncStats.sem_cliente} sem cliente
                  </Badge>
                  <Badge className="bg-red-600/20 text-red-500 border-red-600/30">
                    <XCircle className="h-3 w-3 mr-1" /> {lastSyncStats.erros} erro(s)
                  </Badge>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSync} disabled={syncing} variant="outline" className="border-border">
                  {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar agora
                </Button>
                <Button onClick={handleConnect} variant="outline" className="border-border">
                  <Link2 className="h-4 w-4 mr-2" /> Reconectar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A sincronização automática roda todas as noites e importa apenas reuniões com cliente identificado.
                Cadastre apelidos/iniciais do cliente em <strong>Clientes &gt; editar</strong> para melhorar o matching.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ao conectar, o sistema poderá ler arquivos da pasta "Meet Recordings" da sua conta Google e
                importar automaticamente as transcrições, casando-as com os clientes pelo nome do arquivo.
              </p>
              <Button onClick={handleConnect} disabled={startOAuth.isPending} className="bg-primary text-primary-foreground">
                {startOAuth.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Conectar Google Drive
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {conn?.ativo && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Últimas transcrições encontradas
                </CardTitle>
                <CardDescription>
                  Resultado da sincronização — últimos 20 arquivos processados.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchLogs()} disabled={logsLoading}>
                {logsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <Tabs value={logFilter} onValueChange={setLogFilter} className="mt-2">
              <TabsList className="bg-muted">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="importado">Importadas</TabsTrigger>
                <TabsTrigger value="sem_match">Sem cliente</TabsTrigger>
                <TabsTrigger value="erro">Erros</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-2">
            {logsLoading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
              </div>
            )}
            {!logsLoading && (!logs || logs.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum arquivo {logFilter !== 'all' ? 'nesta categoria' : 'processado ainda'}.
              </p>
            )}
            <TooltipProvider>
              {(logs || []).map((l) => (
                <div key={l.id} className="border border-border rounded-md p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-medium text-foreground truncate cursor-default">
                          {l.nome_arquivo}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md break-all">{l.nome_arquivo}</TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{format(new Date(l.data_importacao), "dd/MM HH:mm", { locale: ptBR })}</span>
                      <span>•</span>
                      <span className="text-foreground">{l.cliente_nome || '—'}</span>
                    </div>
                    {l.status === 'erro' && l.erro && (
                      <p className="text-xs text-red-400 mt-1 line-clamp-2">{l.erro}</p>
                    )}
                    {l.status === 'sem_match' && (
                      <p className="text-xs text-yellow-500 mt-1">
                        Cliente não identificado. Cadastre um apelido em Clientes &gt; editar.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {l.status === 'importado' && (
                      <Badge className="bg-green-600/20 text-green-500 border-green-600/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Importada
                      </Badge>
                    )}
                    {l.status === 'sem_match' && (
                      <Badge className="bg-yellow-600/20 text-yellow-500 border-yellow-600/30">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Sem cliente
                      </Badge>
                    )}
                    {l.status === 'erro' && (
                      <Badge className="bg-red-600/20 text-red-500 border-red-600/30">
                        <XCircle className="h-3 w-3 mr-1" /> Erro
                      </Badge>
                    )}
                    {l.status === 'importado' && l.cliente_id && (
                      <Link
                        to={`/clientes/${l.cliente_id}`}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Ver cliente <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
    </div>
  );
}