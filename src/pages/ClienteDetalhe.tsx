import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Loader2, ArrowLeft, FileText, Users, Calendar, Wrench } from 'lucide-react';
import { useCliente } from '@/hooks/useClientes';
import { ContratoTab } from '@/components/cliente/ContratoTab';
import { OnboardingTab } from '@/components/cliente/OnboardingTab';
import { AtendimentoTab } from '@/components/cliente/AtendimentoTab';
import { FerramentasTab } from '@/components/cliente/FerramentasTab';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cliente, isLoading, error } = useCliente(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center text-muted-foreground">
            Cliente não encontrado
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">{cliente.nome}</h1>
            <StatusBadge status={cliente.status} />
          </div>
          <p className="text-muted-foreground ml-10">
            {cliente.cidade}/{cliente.uf} • Consultor: {cliente.consultor?.nome || 'Não atribuído'}
          </p>
        </div>
        
        {cliente.status === 'novo' && (
          <Badge variant="secondary" className="bg-info text-info-foreground">
            Completar dados do contrato
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contrato" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="contrato" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contrato
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="atendimento" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Atendimento
          </TabsTrigger>
          <TabsTrigger value="ferramentas" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Ferramentas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contrato" className="mt-6">
          <ContratoTab clienteId={cliente.id} clienteStatus={cliente.status} />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <OnboardingTab clienteId={cliente.id} />
        </TabsContent>

        <TabsContent value="atendimento" className="mt-6">
          <AtendimentoTab clienteId={cliente.id} />
        </TabsContent>

        <TabsContent value="ferramentas" className="mt-6">
          <FerramentasTab clienteId={cliente.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
