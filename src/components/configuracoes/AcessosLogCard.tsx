import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, History, RefreshCw } from 'lucide-react';
import { useAcessosLog } from '@/hooks/useAcessosLog';

function resumirUserAgent(ua: string | null) {
  if (!ua) return '—';
  const nav = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Outro';
  const so = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return so ? `${nav} · ${so}` : nav;
}

export function AcessosLogCard() {
  const { data, isLoading, refetch, isFetching } = useAcessosLog();
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return data ?? [];
    return (data ?? []).filter(a => (a.email ?? '').toLowerCase().includes(termo));
  }, [data, busca]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <History className="h-5 w-5 text-primary" />
          Log de Acessos
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrar por e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-[200px] bg-input border-border"
          />
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-muted-foreground text-sm px-6 pb-6">Nenhum acesso registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Usuário</TableHead>
                <TableHead className="text-muted-foreground">Evento</TableHead>
                <TableHead className="text-muted-foreground">Dispositivo</TableHead>
                <TableHead className="text-muted-foreground">Data e hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map(acesso => (
                <TableRow key={acesso.id} className="border-border">
                  <TableCell className="font-medium text-foreground">{acesso.email ?? '—'}</TableCell>
                  <TableCell>
                    <Badge className={acesso.evento === 'login'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'}>
                      {acesso.evento === 'login' ? 'Entrada' : 'Saída'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{resumirUserAgent(acesso.user_agent)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(acesso.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
