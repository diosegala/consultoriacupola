import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, Clock, TrendingDown, AlertTriangle, CalendarX, BookOpen, Loader2, ChevronDown, X, Plane, RefreshCw, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from 'recharts';
import { useClientesAtivos, useClientesAguardandoRenovacao, useListaClientesAtivos, useListaClientesAguardandoRenovacao } from '@/hooks/useClientes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMRRTotal, useListaContratosMRR } from '@/hooks/useContratos';
import { useChurnDoMes, useListaChurnMes } from '@/hooks/useEncerramentos';
import { useRenovacoesKPIs } from '@/hooks/useRenovacoes';
import { useAlertas, useMRRHistorico, useContratosHistorico, useMediaDespesasViagens, useDespesasViagensMensal, useEngajamentoClientes } from '@/hooks/useDashboard';
import { useConsultores } from '@/hooks/useConsultores';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [consultoresSelecionados, setConsultoresSelecionados] = useState<string[]>([]);
  const [showClientesAtivos, setShowClientesAtivos] = useState(false);
  const [showMRR, setShowMRR] = useState(false);
  const [showAguardandoRenovacao, setShowAguardandoRenovacao] = useState(false);
  const [showChurn, setShowChurn] = useState(false);
  const [mesesFuturos, setMesesFuturos] = useState<number>(6);

  const consultorIdsFiltro = consultoresSelecionados.length > 0 ? consultoresSelecionados : undefined;

  const { data: clientesAtivos, isLoading: loadingClientes } = useClientesAtivos(consultorIdsFiltro);
  const { data: mrrTotal, isLoading: loadingMRR } = useMRRTotal(consultorIdsFiltro);
  const { data: aguardandoRenovacao, isLoading: loadingRenovacao } = useClientesAguardandoRenovacao(consultorIdsFiltro);
  const { data: churnMes, isLoading: loadingChurn } = useChurnDoMes(consultorIdsFiltro);
  const { data: alertas, isLoading: loadingAlertas } = useAlertas(consultorIdsFiltro);
  const { data: mrrHistorico, isLoading: loadingHistorico } = useMRRHistorico(consultorIdsFiltro, mesesFuturos);
  const { data: contratosHistorico, isLoading: loadingContratosHist } = useContratosHistorico(consultorIdsFiltro);
  const { data: mediaDespesasViagens, isLoading: loadingMediaViagens } = useMediaDespesasViagens(consultorIdsFiltro);
  const { data: despesasViagensMensal, isLoading: loadingDespesasMensal } = useDespesasViagensMensal(consultorIdsFiltro);
  const { data: engajamentoClientes, isLoading: loadingEngajamento } = useEngajamentoClientes(consultorIdsFiltro);
  const { data: consultores } = useConsultores();
  const { data: listaClientesAtivos } = useListaClientesAtivos(consultorIdsFiltro);
  const { data: listaContratosMRR } = useListaContratosMRR(consultorIdsFiltro);
  const { data: listaAguardandoRenovacao } = useListaClientesAguardandoRenovacao(consultorIdsFiltro);
  const { data: listaChurnMes } = useListaChurnMes(consultorIdsFiltro);
  const { data: renovacoesKPIs, isLoading: loadingRenovacoes } = useRenovacoesKPIs(consultorIdsFiltro);

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

  const toggleConsultor = (id: string) => {
    setConsultoresSelecionados(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const limparSelecao = () => {
    setConsultoresSelecionados([]);
  };

  const consultoresSelecionadosNomes = consultores?.filter(c => 
    consultoresSelecionados.includes(c.id)
  ) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do negócio</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between bg-input border-border">
              {consultoresSelecionados.length === 0 ? (
                <span className="text-muted-foreground">Todos os consultores</span>
              ) : (
                <div className="flex items-center gap-1 flex-wrap max-w-[300px]">
                  {consultoresSelecionadosNomes.slice(0, 2).map(c => (
                    <Badge key={c.id} variant="secondary" className="text-xs">
                      {c.nome}
                    </Badge>
                  ))}
                  {consultoresSelecionadosNomes.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{consultoresSelecionadosNomes.length - 2}
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 ml-2">
                {consultoresSelecionados.length > 0 && (
                  <X 
                    className="h-4 w-4 hover:text-destructive cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      limparSelecao();
                    }}
                  />
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-2 bg-popover border-border" align="end">
            <div className="space-y-1">
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
                onClick={limparSelecao}
              >
                <Checkbox 
                  checked={consultoresSelecionados.length === 0} 
                  className="pointer-events-none"
                />
                <span className="text-sm">Todos os consultores</span>
              </div>
              <div className="border-t border-border my-2" />
              {consultores?.map(consultor => (
                <div
                  key={consultor.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
                  onClick={() => toggleConsultor(consultor.id)}
                >
                  <Checkbox 
                    checked={consultoresSelecionados.includes(consultor.id)}
                    className="pointer-events-none"
                  />
                  <span className="text-sm">{consultor.nome}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Média Despesas Viagens
            </CardTitle>
            <Plane className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingMediaViagens ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(mediaDespesasViagens || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">por contrato</p>
          </CardContent>
        </Card>
      </div>

      {/* Renovações KPIs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-amber-500/50"
          onClick={() => navigate('/projetos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Renovações em andamento
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loadingRenovacoes ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-amber-600">{renovacoesKPIs?.emAndamento ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">cards em Ciclo ou Negociação</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card border-border cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/50"
          onClick={() => navigate('/projetos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Renovações fechadas no mês
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingRenovacoes ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-3xl font-bold text-primary">{renovacoesKPIs?.fechadasMes ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">movidos para "Renovação Fechada"</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico MRR */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Evolução do MRR</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Projeção:</span>
            <Select value={String(mesesFuturos)} onValueChange={(v) => setMesesFuturos(Number(v))}>
              <SelectTrigger className="w-[120px] h-8 bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem projeção</SelectItem>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'mrr_projetado' ? 'MRR Projetado' : 'MRR']}
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
                  name="MRR"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  connectNulls={false}
                />
                {mesesFuturos > 0 && (
                  <Line 
                    type="monotone" 
                    dataKey="mrr_projetado" 
                    name="MRR Projetado"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ fill: 'hsl(var(--primary))', strokeDasharray: '' }}
                    connectNulls={false}
                  />
                )}
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

      {/* Gráfico Despesas com Viagens por Mês */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Plane className="h-5 w-5 text-primary" />
            Despesas com Viagens por Mês (últimos 12 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDespesasMensal ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={despesasViagensMensal || []}>
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
                  formatter={(value: number) => [formatCurrency(value), 'Despesas']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar 
                  dataKey="total" 
                  name="Despesas" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Engajamento dos Clientes */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Engajamento dos Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEngajamento ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : engajamentoClientes && engajamentoClientes.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, engajamentoClientes.length * 45)}>
              <BarChart data={engajamentoClientes} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 10]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  type="category" 
                  dataKey="cliente_nome" 
                  width={150}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(1), 'Score']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar 
                  dataKey="score_medio" 
                  name="Score" 
                  radius={[0, 4, 4, 0]}
                  fill="hsl(var(--primary))"
                >
                  {engajamentoClientes.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={
                        entry.score_medio >= 8 
                          ? 'hsl(142, 71%, 45%)' 
                          : entry.score_medio >= 6 
                            ? 'hsl(48, 96%, 53%)' 
                            : 'hsl(0, 84%, 60%)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma avaliação de engajamento disponível
            </div>
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
              {consultoresSelecionados.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {consultoresSelecionados.length} consultor(es)
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
              {consultoresSelecionados.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {consultoresSelecionados.length} consultor(es)
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
                              {contrato.tipo_consultoria.nome?.toLowerCase() === 'personalizado' && (contrato as any).tipo_consultoria_personalizado
                                ? (contrato as any).tipo_consultoria_personalizado
                                : contrato.tipo_consultoria.nome}
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
              {consultoresSelecionados.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {consultoresSelecionados.length} consultor(es)
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
              {consultoresSelecionados.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {consultoresSelecionados.length} consultor(es)
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
