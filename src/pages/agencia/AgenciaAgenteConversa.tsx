import { useMemo, useState } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgenciaAgentes, useAgenciaClientes } from '@/hooks/agencia/useAgencia';
import type { ModoConversa } from '@/hooks/agencia/useAgenciaConversa';
import { ConversaAgencia } from '@/components/agencia/ConversaAgencia';

const SEM_CONTA = '__sem_conta__';

export default function AgenciaAgenteConversa() {
  // Cada navegação (Início, funil de conta) abre uma conversa nova, com a conta do endereço.
  const location = useLocation();
  return <TelaDaConversa key={location.key} />;
}

function TelaDaConversa() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const { data: agentes, isLoading } = useAgenciaAgentes();
  const { data: clientes } = useAgenciaClientes();
  const agente = useMemo(() => (agentes ?? []).find((a) => a.slug === slug), [agentes, slug]);

  const [params] = useSearchParams();
  const [clienteId, setClienteId] = useState<string>(params.get('conta') ?? '');
  const recebido = (location.state ?? {}) as { primeira?: string; modo?: ModoConversa };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/agencia/agentes" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="rounded-lg bg-primary/10 p-2">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{agente?.nome ?? slug}</h1>
          {agente?.resumo && <p className="text-sm text-muted-foreground">{agente.resumo}</p>}
        </div>
        <Select value={clienteId || SEM_CONTA} onValueChange={(v) => setClienteId(v === SEM_CONTA ? '' : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Sem conta vinculada" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_CONTA}>Sem conta vinculada</SelectItem>
            {(clientes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ConversaAgencia
        agenteSlug={slug}
        clienteId={clienteId || null}
        primeira={recebido.primeira ?? null}
        modoInicial={recebido.modo}
      />
    </div>
  );
}
