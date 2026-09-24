import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Pencil, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/design-system/design-system-hub-ba3841';
import { Skeleton } from '@/components/ui/skeleton';
import { AgenteFormDialog } from '@/components/agencia/AgenteFormDialog';
import {
  useAgenciaAgentes,
  useAgenciaEspacos,
  useAgenciaPessoa,
} from '@/hooks/agencia/useAgencia';

export default function AgenciaAgentes() {
  const { data: pessoa } = useAgenciaPessoa();
  const podeGerenciar = pessoa?.papel === 'admin' || pessoa?.papel === 'gestor';
  const { data: agentes, isLoading } = useAgenciaAgentes(podeGerenciar);
  const { data: espacos } = useAgenciaEspacos();
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState<{ aberto: boolean; id: string | null }>({
    aberto: false,
    id: null,
  });

  const agenteAlvo = (agentes ?? []).find((a) => a.id === alvo.id) ?? null;

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
            <div key={a.id} className="relative">
              <Link to={`/agencia/agentes/${a.slug}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight">{a.nome}</h2>
                    <div className="flex gap-1">
                      {a.oculto && <Badge variant="outline">Oculto</Badge>}
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
              {podeGerenciar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 bottom-2"
                  onClick={() => setAlvo({ aberto: true, id: a.id })}
                  aria-label={`Editar ${a.nome}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {agenteAlvo && (
        <AgenteFormDialog
          aberto={alvo.aberto}
          onOpenChange={(aberto) => setAlvo({ aberto, id: aberto ? alvo.id : null })}
          agente={agenteAlvo}
          espacos={espacos ?? []}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Clique em um agente para conversar com ele.
      </p>
    </div>
  );
}
