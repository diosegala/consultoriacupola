import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, Clock, TrendingDown, AlertTriangle, CalendarX, BookOpen, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useClientesAtivos, useClientesAguardandoRenovacao, useListaClientesAtivos, useListaClientesAguardandoRenovacao } from '@/hooks/useClientes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMRRTotal, useListaContratosMRR } from '@/hooks/useContratos';
import { useChurnDoMes, useListaChurnMes } from '@/hooks/useEncerramentos';
import { useAlertas, useMRRHistorico, useContratosHistorico } from '@/hooks/useDashboard';
import { useConsultores } from '@/hooks/useConsultores';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [showClientesAtivos, setShowClientesAtivos] = useState(false);
  const [showMRR, setShowMRR] = useState(false);
  const [showAguardandoRenovacao, setShowAguardandoRenovacao] = useState(false);
  const [showChurn, setShowChurn] = useState(false);

  const consultorIdFiltro = consultorFiltro !== 'todos' ? consultorFiltro : undefined;

  const { data: clientesAtivos, isLoading: loadingClientes } = useClientesAtivos(consultorIdFiltro);
  const { data: mrrTotal, isLoading: loadingMRR } = useMRRTotal(consultorIdFiltro);
  const { data: aguardandoRenovacao, isLoading: loadingRenovacao } = useClientesAguardandoRenovacao(consultorIdFiltro);
  const { data: churnMes, isLoading: loadingChurn } = useChurnDoMes(consultorIdFiltro);
  const { data: alertas, isLoading: loadingAlertas } = useAlertas(consultorIdFiltro);
  const { data: mrrHistorico, isLoading: loadingHistorico } = useMRRHistorico(consultorIdFiltro);
  const { data: contratosHistorico, isLoading: loadingContratosHist } = useContratosHistorico(consultorIdFiltro);
  const { data: consultores } = useConsultores();
  const { data: listaClientesAtivos } = useListaClientesAtivos(consultorIdFiltro);
  const { data: listaContratosMRR } = useListaContratosMRR(consultorIdFiltro);
  const { data: listaAguardandoRenovacao } = useListaClientesAguardandoRenovacao(consultorIdFiltro);
  const { data: listaChurnMes } = useListaChurnMes(consultorIdFiltro);

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
        <Card 
          className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/50"
          onClick={() => setShowClientesAtivos(true)}
        >
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

        <Card 
          className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/50"
          onClick={() => setShowMRR(true)}
        >
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

        <Card 
          className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-warning/50"
          onClick={() => setShowAguardandoRenovacao(true)}
        >
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

        <Card 
          className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-destructive/50"
          onClick={() => setShowChurn(true)}
        >
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
      {/* Modal Clientes Ativos */}
      <Dialog open={showClientesAtivos} onOpenChange={setShowClientesAtivos}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Clientes Ativos
              {consultorFiltro !== 'todos' && (
                <Badge variant="outline" className="ml-2">
                  Filtrado por consultor
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {listaClientesAtivos?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente ativo encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {listaClientesAtivos?.map((cliente: any) => (
                  <Card 
                    key={cliente.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setShowClientesAtivos(false);
                      navigate(`/clientes/${cliente.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="font-semibold text-foreground">{cliente.nome}</span>
                          <p className="text-sm text-muted-foreground">
                            {cliente.cidade}, {cliente.uf}
                            {cliente.consultor && ` • ${cliente.consultor.nome}`}
                          </p>
                        </div>
                        {cliente.contrato_ativo && (
                          <span className="text-primary font-medium">
                            {formatCurrency(cliente.contrato_ativo.remuneracao_mensal)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal MRR */}
      <Dialog open={showMRR} onOpenChange={setShowMRR}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Contratos Ativos - MRR
              {consultorFiltro !== 'todos' && (
                <Badge variant="outline" className="ml-2">
                  Filtrado por consultor
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {listaContratosMRR?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum contrato ativo encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {listaContratosMRR?.map((contrato: any) => (
                  <Card 
                    key={contrato.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setShowMRR(false);
                      navigate(`/clientes/${contrato.cliente?.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="font-semibold text-foreground">{contrato.cliente?.nome}</span>
                          <p className="text-sm text-muted-foreground">
                            {contrato.cliente?.cidade}, {contrato.cliente?.uf}
                            {contrato.cliente?.consultor && ` • ${contrato.cliente.consultor.nome}`}
                          </p>
                          {contrato.tipo_consultoria && (
                            <Badge variant="outline" className="mt-1">
                              {contrato.tipo_consultoria.nome}
                            </Badge>
                          )}
                        </div>
                        <span className="text-primary font-medium text-lg">
                          {formatCurrency(contrato.remuneracao_mensal)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal Aguardando Renovação */}
      <Dialog open={showAguardandoRenovacao} onOpenChange={setShowAguardandoRenovacao}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Clientes Aguardando Renovação
              {consultorFiltro !== 'todos' && (
                <Badge variant="outline" className="ml-2">
                  Filtrado por consultor
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {listaAguardandoRenovacao?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente aguardando renovação
              </p>
            ) : (
              <div className="space-y-3">
                {listaAguardandoRenovacao?.map((cliente: any) => (
                  <Card 
                    key={cliente.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setShowAguardandoRenovacao(false);
                      navigate(`/clientes/${cliente.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="font-semibold text-foreground">{cliente.nome}</span>
                          <p className="text-sm text-muted-foreground">
                            {cliente.cidade}, {cliente.uf}
                            {cliente.consultor && ` • ${cliente.consultor.nome}`}
                          </p>
                        </div>
                        {cliente.contrato_ativo && (
                          <span className="text-warning font-medium">
                            {formatCurrency(cliente.contrato_ativo.remuneracao_mensal)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal Churn do Mês */}
      <Dialog open={showChurn} onOpenChange={setShowChurn}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Churns do Mês
              {consultorFiltro !== 'todos' && (
                <Badge variant="outline" className="ml-2">
                  Filtrado por consultor
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {listaChurnMes?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum churn registrado neste mês 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {listaChurnMes?.map((encerramento: any) => (
                  <Card 
                    key={encerramento.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setShowChurn(false);
                      navigate(`/clientes/${encerramento.cliente?.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="font-semibold text-foreground">{encerramento.cliente?.nome}</span>
                          <p className="text-sm text-muted-foreground">
                            {encerramento.cliente?.cidade}, {encerramento.cliente?.uf}
                            {encerramento.cliente?.consultor && ` • ${encerramento.cliente.consultor.nome}`}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Encerrado em {format(new Date(encerramento.data_encerramento), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          {encerramento.justificativa && (
                            <p className="text-sm text-muted-foreground italic mt-1">
                              "{encerramento.justificativa}"
                            </p>
                          )}
                        </div>
                        <span className="text-destructive font-medium">
                          -{formatCurrency(encerramento.mrr_perdido)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
