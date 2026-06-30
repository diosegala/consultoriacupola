import { useMemo, useState, useEffect } from 'react';
import { Sparkles, FileText, Target, ClipboardList, ArrowLeft, Check } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useClientes } from '@/hooks/useClientes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AgentesTab } from '@/components/cliente/AgentesTab';

type AgenteKey = 'diagnostico' | 'okrs' | 'cliente_oculto';

const AGENTES: Array<{
  key: AgenteKey;
  titulo: string;
  descricao: string;
  icon: typeof FileText;
}> = [
  {
    key: 'diagnostico',
    titulo: 'Diagnóstico',
    descricao: 'Consolida questionário, transcrições e anotações em um diagnóstico estratégico.',
    icon: FileText,
  },
  {
    key: 'okrs',
    titulo: 'OKRs',
    descricao: 'Gera objetivos e key results trimestrais a partir do diagnóstico.',
    icon: Target,
  },
  {
    key: 'cliente_oculto',
    titulo: 'Cliente Oculto',
    descricao: 'Cria briefing de avaliação de canais e personas para cliente oculto.',
    icon: ClipboardList,
  },
];

export default function Agentes() {
  const { isConsultor } = useAuth();
  const { data: myConsultorId, isLoading: loadingMe } = useMyConsultorId();
  const consultorFilter = isConsultor && myConsultorId ? { consultor_id: myConsultorId } : undefined;
  const { data: clientes, isLoading: loadingClientes } = useClientes(consultorFilter);
  const [searchParams, setSearchParams] = useSearchParams();

  const VALID_AGENTES: AgenteKey[] = ['diagnostico', 'okrs', 'cliente_oculto'];
  const urlAgente = searchParams.get('agente') as AgenteKey | null;
  const urlCliente = searchParams.get('cliente') || undefined;
  const agente: AgenteKey | null =
    urlAgente && VALID_AGENTES.includes(urlAgente)
      ? urlAgente
      : (typeof window !== 'undefined'
          ? (localStorage.getItem('agentes.agente') as AgenteKey | null)
          : null) || null;
  const clienteId: string | undefined =
    urlCliente ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('agentes.clienteId') || undefined
      : undefined);

  const updateParams = (next: { agente?: AgenteKey | null; cliente?: string | null }) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if ('agente' in next) {
          if (next.agente) params.set('agente', next.agente);
          else params.delete('agente');
        }
        if ('cliente' in next) {
          if (next.cliente) params.set('cliente', next.cliente);
          else params.delete('cliente');
        }
        return params;
      },
      { replace: true },
    );
  };

  const setAgente = (next: AgenteKey | null) => updateParams({ agente: next });
  const setClienteId = (next: string | undefined) => updateParams({ cliente: next ?? null });

  const handleTrocarAgente = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agentes.agente');
      localStorage.removeItem('agentes.clienteId');
    }
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Sincroniza URL com valores hidratados do localStorage no primeiro mount
  useEffect(() => {
    const patch: { agente?: AgenteKey | null; cliente?: string | null } = {};
    if (!urlAgente && agente) patch.agente = agente;
    if (!urlCliente && clienteId) patch.cliente = clienteId;
    if (Object.keys(patch).length) updateParams(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste no localStorage como fallback
  useEffect(() => {
    if (agente) localStorage.setItem('agentes.agente', agente);
    else localStorage.removeItem('agentes.agente');
  }, [agente]);
  useEffect(() => {
    if (clienteId) localStorage.setItem('agentes.clienteId', clienteId);
    else localStorage.removeItem('agentes.clienteId');
  }, [clienteId]);

  // Remove clientes inativos (encerrados) da lista
  const ordenados = useMemo(
    () =>
      [...(clientes ?? [])]
        .filter((c) => c.status !== 'encerrado')
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [clientes],
  );

  const isLoading = loadingClientes || (isConsultor && loadingMe);
  const agenteAtivo = AGENTES.find((a) => a.key === agente);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Agentes de IA</h1>
          <p className="text-sm text-muted-foreground">
            {agente
              ? 'Escolha o cliente que servirá de contexto para o agente.'
              : 'Escolha qual agente deseja utilizar.'}
          </p>
        </div>
      </div>

      {!agente ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AGENTES.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setAgente(a.key)}
                className="text-left rounded-lg border border-border bg-card p-5 hover:border-primary hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">{a.titulo}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{a.descricao}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                {agenteAtivo && <agenteAtivo.icon className="h-4 w-4 text-primary" />}
                <CardTitle className="text-base">
                  Agente: {agenteAtivo?.titulo}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTrocarAgente}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Trocar agente
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              {isLoading ? (
                <Skeleton className="h-10 w-full max-w-md" />
              ) : ordenados.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum cliente ativo disponível.
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
              {clienteId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                  <Check className="h-3 w-3 text-emerald-500" />
                  Contexto do cliente carregado abaixo. Role até o painel{' '}
                  <strong>{agenteAtivo?.titulo}</strong> para gerar.
                </p>
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
        </>
      )}
    </div>
  );
}