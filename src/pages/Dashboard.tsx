import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, Clock, TrendingDown, AlertTriangle, CalendarX, BookOpen, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useClientesAtivos, useClientesAguardandoRenovacao } from '@/hooks/useClientes';
import { useMRRTotal } from '@/hooks/useContratos';
import { useChurnDoMes } from '@/hooks/useEncerramentos';
import { useAlertas, useMRRHistorico, useContratosHistorico } from '@/hooks/useDashboard';
import { useConsultores } from '@/hooks/useConsultores';
import { useState } from 'react';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [consultorFiltro, setConsultorFiltro] = useState<string>('todos');

  const consultorIdFiltro = consultorFiltro !== 'todos' ? consultorFiltro : undefined;

  const { data: clientesAtivos, isLoading: loadingClientes } = useClientesAtivos(consultorIdFiltro);
  const { data: mrrTotal, isLoading: loadingMRR } = useMRRTotal(consultorIdFiltro);
  const { data: aguardandoRenovacao, isLoading: loadingRenovacao } = useClientesAguardandoRenovacao(consultorIdFiltro);
  const { data: churnMes, isLoading: loadingChurn } = useChurnDoMes(consultorIdFiltro);
  const { data: alertas, isLoading: loadingAlertas } = useAlertas(consultorIdFiltro);
  const { data: mrrHistorico, isLoading: loadingHistorico } = useMRRHistorico(consultorIdFiltro);
  const { data: contratosHistorico, isLoading: loadingContratosHist } = useContratosHistorico(consultorIdFiltro);
  const { data: consultores } = useConsultores();

  const isLoading = loadingClientes || loadingMRR || loadingRenovacao || loadingChurn;

  const alertaIcon = {
    contrato_vencendo: Clock,
    reuniao_atrasada: CalendarX,
    onboarding_pendente: BookOpen
  };

  const alertaLabel = {
    contrato_vencendo: 'Contrato Vencendo',
    reuniao_atrasada: 'Reunião Atrasada',
    onboarding_pendente: 'Onboarding Pendente'
  };

  const alertaBadgeVariant = {
    contrato_vencendo: 'warning' as const,
    reuniao_atrasada: 'destructive' as const,
    onboarding_pendente: 'secondary' as const
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do negócio</p>
        </div>
        <Select value={consultorFiltro} onValueChange={setConsultorFiltro}>
          <SelectTrigger className="w-[200px] bg-input border-border">
            <SelectValue placeholder="Filtrar por consultor" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Todos os consultores</SelectItem>
            {consultores?.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{clientesAtivos || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(mrrTotal || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aguardando Renovação
            </CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-warning">
                {aguardandoRenovacao || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Churn do Mês
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-destructive">
                {churnMes || 0}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico MRR */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Evolução do MRR (últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistorico ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mrrHistorico || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="mes" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'MRR']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="mrr" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Gráfico Contratos Novos vs Encerrados */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Contratos Novos vs. Encerrados (últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingContratosHist ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={contratosHistorico || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="mes" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Bar 
                  dataKey="encerrados" 
                  name="Encerrados" 
                  fill="hsl(var(--destructive))" 
                  stackId="contratos"
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="novos" 
                  name="Novos" 
                  fill="hsl(var(--primary))" 
                  stackId="contratos"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Alertas */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAlertas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : alertas && alertas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Detalhe</TableHead>
                  <TableHead className="w-[100px] text-muted-foreground">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.map((alerta, index) => {
                  const Icon = alertaIcon[alerta.tipo];
                  return (
                    <TableRow key={`${alerta.cliente_id}-${alerta.tipo}-${index}`} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <Badge variant={alertaBadgeVariant[alerta.tipo]}>
                            {alertaLabel[alerta.tipo]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{alerta.cliente_nome}</TableCell>
                      <TableCell className="text-muted-foreground">{alerta.detalhe}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-border"
                          onClick={() => navigate(`/clientes/${alerta.cliente_id}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum alerta no momento 🎉
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
