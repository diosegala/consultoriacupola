import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, FileText, Users, Calendar, Pencil, Trash2, BarChart3, Video, CalendarPlus, LineChart } from 'lucide-react';
import { useCliente, useDeleteCliente } from '@/hooks/useClientes';
import { ContratoTab } from '@/components/cliente/ContratoTab';
import { OnboardingTab } from '@/components/cliente/OnboardingTab';
import { AtendimentoTab } from '@/components/cliente/AtendimentoTab';
import { DesempenhoClienteTab } from '@/components/cliente/DesempenhoClienteTab';
import { ReunioesClienteTab } from '@/components/cliente/ReunioesClienteTab';
import { MinhaPerformanceTab } from '@/components/consultor/MinhaPerformanceTab';
import { ClienteFormDialog } from '@/components/cliente/ClienteFormDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { toast } from 'sonner';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cliente, isLoading, error, refetch } = useCliente(id);
  const { isAdmin } = useAuth();
  const { data: myConsultorId } = useMyConsultorId();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const deleteCliente = useDeleteCliente();

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

  const showPerformance =
    !!cliente.consultor_id && (isAdmin || myConsultorId === cliente.consultor_id);

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
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setEditDialogOpen(true)}
              title="Editar dados do cliente"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              title="Excluir cliente"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => {
                const email = (cliente as any).email || '';
                const params = new URLSearchParams();
                if (email) params.set('attendee', email);
                params.set('title', `Reunião — ${cliente.nome}`);
                navigate(`/agenda?${params.toString()}`);
              }}
              title="Agendar reunião no Google Agenda"
            >
              <CalendarPlus className="h-4 w-4 mr-1" />
              Agendar reunião
            </Button>
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
          <TabsTrigger value="reunioes" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Reuniões
          </TabsTrigger>
          <TabsTrigger value="desempenho" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Desempenho
          </TabsTrigger>
          {showPerformance && (
            <TabsTrigger value="performance-consultor" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Performance do Consultor
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="contrato" className="mt-6">
          <ContratoTab clienteId={cliente.id} clienteStatus={cliente.status} consultorId={cliente.consultor_id} />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <OnboardingTab clienteId={cliente.id} />
        </TabsContent>

        <TabsContent value="atendimento" className="mt-6">
          <AtendimentoTab clienteId={cliente.id} />
        </TabsContent>

        <TabsContent value="reunioes" className="mt-6">
          <ReunioesClienteTab clienteId={cliente.id} />
        </TabsContent>

        <TabsContent value="desempenho" className="mt-6">
          <DesempenhoClienteTab clienteId={cliente.id} />
        </TabsContent>

        {showPerformance && (
          <TabsContent value="performance-consultor" className="mt-6">
            <MinhaPerformanceTab consultorId={cliente.consultor_id!} clienteId={cliente.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Dialog */}
      <ClienteFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        cliente={cliente}
        onSuccess={() => refetch()}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{cliente.nome}</strong>?
              <br /><br />
              Esta ação irá remover permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todos os contratos do cliente</li>
                <li>Atendimentos registrados</li>
                <li>Dados de onboarding</li>
                <li>Ferramentas configuradas</li>
                <li>Encerramentos e pausas</li>
              </ul>
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteCliente.mutate(cliente.id, {
                  onSuccess: () => {
                    toast.success('Cliente excluído com sucesso');
                    navigate('/clientes');
                  },
                  onError: (error) => {
                    toast.error('Erro ao excluir cliente: ' + error.message);
                  }
                });
              }}
              disabled={deleteCliente.isPending}
            >
              {deleteCliente.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
