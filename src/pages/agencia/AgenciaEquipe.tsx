import { useMemo, useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/design-system/design-system-hub-ba3841';
import { Skeleton } from '@/components/ui/skeleton';
import { PessoaFormDialog } from '@/components/agencia/PessoaFormDialog';
import {
  useAgenciaPessoas,
  useAgenciaEspacos,
  useAgenciaPessoa,
} from '@/hooks/agencia/useAgencia';

const PAPEL_LABEL: Record<string, string> = {
  analista: 'Analista',
  gestor: 'Gestor',
  admin: 'Administrador',
};

export default function AgenciaEquipe() {
  const { data: pessoas, isLoading } = useAgenciaPessoas();
  const { data: espacos } = useAgenciaEspacos();
  const { data: pessoa } = useAgenciaPessoa();
  const [alvo, setAlvo] = useState<{ aberto: boolean; pessoa: (typeof pessoas)[number] | null }>({
    aberto: false,
    pessoa: null,
  });

  const podeGerenciar = pessoa?.papel === 'admin';

  const nomeArea = useMemo(() => {
    const m = new Map<string, string>();
    (espacos ?? []).forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [espacos]);

  const listaOrdenada = useMemo(
    () => (pessoas ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [pessoas],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Time da Agência</h1>
            <p className="text-sm text-muted-foreground">Pessoas, funções e áreas.</p>
          </div>
        </div>
        {podeGerenciar && (
          <Button onClick={() => setAlvo({ aberto: true, pessoa: null })}>
            <Plus className="mr-2 h-4 w-4" />
            Nova pessoa
          </Button>
        )}
      </div>

      <PessoaFormDialog
        aberto={alvo.aberto}
        onOpenChange={(aberto) => setAlvo({ aberto, pessoa: aberto ? alvo.pessoa : null })}
        pessoa={alvo.pessoa}
        pessoas={pessoas ?? []}
        espacos={espacos ?? []}
        existentes={(pessoas ?? []).map((p) => p.id)}
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listaOrdenada.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-1 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{p.nome}</h2>
                  <div className="flex items-center gap-1">
                    {p.ativa === false && <Badge variant="outline">Inativa</Badge>}
                    {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAlvo({ aberto: true, pessoa: p })}
                        aria-label={`Editar ${p.nome}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{p.funcao}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    p.area_id ? nomeArea.get(p.area_id) ?? p.area_id : '',
                    PAPEL_LABEL[p.papel ?? ''] ?? p.papel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
