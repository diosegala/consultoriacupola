import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, Clock, TrendingDown, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// Dados mockados para demonstração inicial
const mockKPIs = {
  clientesAtivos: 28,
  mrrTotal: 285000,
  aguardandoRenovacao: 3,
  churnMes: 2.1,
};

const mockAlertas = [
  { tipo: 'contrato_vencendo', cliente_id: '1', cliente_nome: 'Imobiliária Alpha', detalhe: 'Vence em 15 dias' },
  { tipo: 'reuniao_atrasada', cliente_id: '2', cliente_nome: 'Imóveis Beta', detalhe: 'Atrasada há 5 dias' },
  { tipo: 'onboarding_pendente', cliente_id: '3', cliente_nome: 'Nova Imob', detalhe: 'Aguardando 1ª imersão' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function Dashboard() {
  const navigate = useNavigate();

  const getAlertaIcon = (tipo: string) => {
    switch (tipo) {
      case 'contrato_vencendo':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'reuniao_atrasada':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'onboarding_pendente':
        return <Users className="h-4 w-4 text-info" />;
      default:
        return null;
    }
  };

  const getAlertaLabel = (tipo: string) => {
    switch (tipo) {
      case 'contrato_vencendo':
        return 'Contrato vencendo';
      case 'reuniao_atrasada':
        return 'Reunião atrasada';
      case 'onboarding_pendente':
        return 'Onboarding pendente';
      default:
        return tipo;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do negócio</p>
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
            <div className="text-3xl font-bold text-foreground">{mockKPIs.clientesAtivos}</div>
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
            <div className="text-3xl font-bold text-foreground">
              {formatCurrency(mockKPIs.mrrTotal)}
            </div>
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
            <div className="text-3xl font-bold text-warning">{mockKPIs.aguardandoRenovacao}</div>
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
            <div className="text-3xl font-bold text-foreground">{mockKPIs.churnMes}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Alertas</CardTitle>
          <CardDescription>Itens que precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent>
          {mockAlertas.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum alerta no momento 🎉
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Detalhe</TableHead>
                  <TableHead className="text-muted-foreground text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAlertas.map((alerta, index) => (
                  <TableRow key={index} className="border-border">
                    <TableCell className="text-foreground">
                      <div className="flex items-center gap-2">
                        {getAlertaIcon(alerta.tipo)}
                        {getAlertaLabel(alerta.tipo)}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{alerta.cliente_nome}</TableCell>
                    <TableCell className="text-muted-foreground">{alerta.detalhe}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/clientes/${alerta.cliente_id}`)}
                        className="border-border text-foreground hover:bg-primary hover:text-primary-foreground"
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
