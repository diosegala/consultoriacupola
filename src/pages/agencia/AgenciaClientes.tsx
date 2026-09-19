import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Search, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAgenciaClientes,
  useAgenciaContratos,
  type AgenciaContrato,
} from '@/hooks/agencia/useAgencia';

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Contrato ativo',
  renovacao: 'Em renovação',
  encerrado: 'Encerrado',
};

const TIPO_LABEL: Record<string, string> = {
  imobiliaria: 'Imobiliária',
  incorporadora: 'Incorporadora',
  servicos: 'Serviços',
};

export default function AgenciaClientes() {
  const { data: clientes, isLoading } = useAgenciaClientes();
  const { data: contratos } = useAgenciaContratos();
  const [busca, setBusca] = useState('');

  const contratoPorCliente = useMemo(() => {
    const m = new Map<string, AgenciaContrato>();
    (contratos ?? []).forEach((c) => m.set(c.cliente_id, c));
    return m;
  }, [contratos]);

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    return (clientes ?? []).filter(
      (c) =>
        !alvo ||
        c.nome.toLowerCase().includes(alvo) ||
        (c.sigla ?? '').toLowerCase().includes(alvo) ||
        (c.cidade ?? '').toLowerCase().includes(alvo),
    );
  }, [clientes, busca]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Contas da Agência</h1>
          <p className="text-sm text-muted-foreground">
            Carteira da unidade de marketing.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, sigla ou cidade…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma conta por aqui ainda. As contas aparecem depois da importação
            dos dados da agência.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lista.map((c) => {
            const contrato = contratoPorCliente.get(c.id);
            return (
              <Link key={c.id} to={`/agencia/contas/${c.slug}`}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-semibold leading-tight">{c.nome}</h2>
                        <p className="text-xs text-muted-foreground">
                          {[TIPO_LABEL[c.tipo ?? ''] ?? c.tipo, c.cidade]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {c.resumo && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.resumo}</p>
                    )}
                    {contrato?.status && (
                      <Badge variant="outline">
                        {STATUS_LABEL[contrato.status] ?? contrato.status}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
