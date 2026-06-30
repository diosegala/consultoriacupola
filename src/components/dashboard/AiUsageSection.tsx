import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, DollarSign } from 'lucide-react';
import { useAiUsage } from '@/hooks/useAiUsage';

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

const AGENTE_LABEL: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  okrs: 'OKRs',
  briefing_cliente_oculto: 'Cliente Oculto',
};

export function AiUsageSection() {
  const [periodo, setPeriodo] = useState<'mes' | 'tudo'>('mes');
  const { data, isLoading } = useAiUsage(periodo);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Sparkles className="h-5 w-5 text-primary" /> Custos de IA (Anthropic / Claude)
        </CardTitle>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as 'mes' | 'tudo')}>
          <SelectTrigger className="w-[140px] h-8 bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Mês atual</SelectItem>
            <SelectItem value="tudo">Total (todos)</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data || data.totalCalls === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma chamada de IA registrada {periodo === 'mes' ? 'neste mês' : 'ainda'}.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <KpiMini label="Custo total" value={formatUsd(data.totalUsd)} icon={DollarSign} />
              <KpiMini label="Chamadas" value={String(data.totalCalls)} />
              <KpiMini label="Tokens in" value={data.totalInputTokens.toLocaleString('pt-BR')} />
              <KpiMini label="Tokens out" value={data.totalOutputTokens.toLocaleString('pt-BR')} />
            </div>

            <Tabs defaultValue="cliente">
              <TabsList>
                <TabsTrigger value="cliente">Por cliente</TabsTrigger>
                <TabsTrigger value="consultor">Por consultor</TabsTrigger>
                <TabsTrigger value="agente">Por agente</TabsTrigger>
                <TabsTrigger value="recentes">Últimas chamadas</TabsTrigger>
              </TabsList>

              <TabsContent value="cliente">
                <RankingTable
                  rows={data.porCliente.map((c) => ({ label: c.nome, calls: c.calls, cost: c.cost_usd }))}
                  colLabel="Cliente"
                />
              </TabsContent>
              <TabsContent value="consultor">
                <RankingTable
                  rows={data.porConsultor.map((c) => ({ label: c.nome, calls: c.calls, cost: c.cost_usd }))}
                  colLabel="Consultor"
                />
              </TabsContent>
              <TabsContent value="agente">
                <RankingTable
                  rows={data.porAgente.map((c) => ({ label: AGENTE_LABEL[c.tipo] ?? c.tipo, calls: c.calls, cost: c.cost_usd }))}
                  colLabel="Agente"
                />
              </TabsContent>
              <TabsContent value="recentes">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-xs">{AGENTE_LABEL[r.agente_tipo ?? ''] ?? r.agente_tipo ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.clientes?.nome ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.consultores?.nome ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'success' ? 'outline' : 'destructive'} className="text-[10px]">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">{formatUsd(Number(r.cost_usd ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KpiMini({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof DollarSign }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function RankingTable({ rows, colLabel }: { rows: Array<{ label: string; calls: number; cost: number }>; colLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem dados.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{colLabel}</TableHead>
          <TableHead className="text-right">Chamadas</TableHead>
          <TableHead className="text-right">Custo (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell className="text-sm">{r.label}</TableCell>
            <TableCell className="text-right text-sm">{r.calls}</TableCell>
            <TableCell className="text-right text-sm font-medium">{formatUsd(r.cost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}