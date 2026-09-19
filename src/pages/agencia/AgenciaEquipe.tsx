import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgenciaPessoas, useAgenciaEspacos } from '@/hooks/agencia/useAgencia';
import { useMemo } from 'react';

export default function AgenciaEquipe() {
  const { data: pessoas, isLoading } = useAgenciaPessoas();
  const { data: espacos } = useAgenciaEspacos();

  const nomeArea = useMemo(() => {
    const m = new Map<string, string>();
    (espacos ?? []).forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [espacos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Time da Agência</h1>
          <p className="text-sm text-muted-foreground">Pessoas, funções e áreas.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(pessoas ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-1 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{p.nome}</h2>
                  {p.ativa === false && <Badge variant="outline">Inativa</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{p.funcao}</p>
                <p className="text-xs text-muted-foreground">
                  {p.area_id ? nomeArea.get(p.area_id) ?? p.area_id : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
