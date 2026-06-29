import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useClientes } from '@/hooks/useClientes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AgentesTab } from '@/components/cliente/AgentesTab';

export default function Agentes() {
  const { isConsultor } = useAuth();
  const { data: myConsultorId, isLoading: loadingMe } = useMyConsultorId();
  const consultorFilter = isConsultor && myConsultorId ? { consultor_id: myConsultorId } : undefined;
  const { data: clientes, isLoading: loadingClientes } = useClientes(consultorFilter);
  const [clienteId, setClienteId] = useState<string | undefined>(undefined);

  const ordenados = useMemo(
    () => [...(clientes ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)),
    [clientes],
  );

  const isLoading = loadingClientes || (isConsultor && loadingMe);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Agentes de IA</h1>
          <p className="text-sm text-muted-foreground">
            Selecione um cliente para gerar Diagnóstico, OKRs e Briefing de Cliente Oculto.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : ordenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente disponível.
            </p>
          ) : (
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Selecione um cliente…" />
              </SelectTrigger>
              <SelectContent>
                {ordenados.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {clienteId ? (
        <AgentesTab clienteId={clienteId} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Selecione um cliente acima para começar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}