import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgenciaAgentes, useAgenciaEspacos } from '@/hooks/agencia/useAgencia';

export default function AgenciaAgentes() {
  const { data: agentes, isLoading } = useAgenciaAgentes();
  const { data: espacos } = useAgenciaEspacos();
  const [busca, setBusca] = useState('');

  const nomeEspaco = useMemo(() => {
    const m = new Map<string, string>();
    (espacos ?? []).forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [espacos]);

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    return (agentes ?? []).filter(
      (a) =>
        !alvo ||
        a.nome.toLowerCase().includes(alvo) ||
        (a.resumo ?? '').toLowerCase().includes(alvo),
    );
  }, [agentes, busca]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Agentes da Agência</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo dos agentes da unidade de marketing.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar agente…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum agente encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lista.map((a) => (
            <Link key={a.id} to={`/agencia/agentes/${a.slug}`} className="block">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{a.nome}</h2>
                  <div className="flex gap-1">
                    {a.beta && <Badge variant="outline">Beta</Badge>}
                    {a.destaque && <Badge>Destaque</Badge>}
                  </div>
                </div>
                {a.resumo && <p className="text-sm text-muted-foreground">{a.resumo}</p>}
                <p className="text-xs text-muted-foreground">
                  {a.espaco_id ? nomeEspaco.get(a.espaco_id) ?? a.espaco_id : ''}
                </p>
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Clique em um agente para conversar com ele.
      </p>
    </div>
  );
}
