import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { useConsultoresComStats, useCreateConsultor, useUpdateConsultor, Consultor } from '@/hooks/useConsultores';
import { useToast } from '@/hooks/use-toast';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export default function Consultores() {
  const { toast } = useToast();
  const { data: consultores, isLoading } = useConsultoresComStats();
  const createConsultor = useCreateConsultor();
  const updateConsultor = useUpdateConsultor();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConsultor, setEditingConsultor] = useState<Consultor | null>(null);
  const [formData, setFormData] = useState({ nome: '', email: '' });

  const openNewDialog = () => {
    setEditingConsultor(null);
    setFormData({ nome: '', email: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (consultor: Consultor) => {
    setEditingConsultor(consultor);
    setFormData({ nome: consultor.nome, email: consultor.email || '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingConsultor) {
        await updateConsultor.mutateAsync({
          id: editingConsultor.id,
          nome: formData.nome.trim(),
          email: formData.email.trim() || null
        });
        toast({
          title: 'Sucesso',
          description: 'Consultor atualizado com sucesso'
        });
      } else {
        await createConsultor.mutateAsync({
          nome: formData.nome.trim(),
          email: formData.email.trim() || null
        });
        toast({
          title: 'Sucesso',
          description: 'Consultor criado com sucesso'
        });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar consultor',
        variant: 'destructive'
      });
    }
  };

  const toggleAtivo = async (consultor: Consultor) => {
    try {
      await updateConsultor.mutateAsync({
        id: consultor.id,
        ativo: !consultor.ativo
      });
      toast({
        title: 'Sucesso',
        description: `Consultor ${consultor.ativo ? 'desativado' : 'ativado'} com sucesso`
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consultores</h1>
          <p className="text-muted-foreground">Gerencie a equipe de consultores</p>
        </div>
        <Button onClick={openNewDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Consultor
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {consultores?.length || 0} consultor{(consultores?.length || 0) !== 1 ? 'es' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground text-center">Clientes Ativos</TableHead>
                  <TableHead className="text-muted-foreground">MRR sob Gestão</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[150px] text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultores?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum consultor cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  consultores?.map(consultor => (
                    <TableRow key={consultor.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{consultor.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{consultor.email || '-'}</TableCell>
                      <TableCell className="text-center text-foreground">{consultor.clientes_ativos}</TableCell>
                      <TableCell className="text-foreground">{formatCurrency(consultor.mrr_sob_gestao)}</TableCell>
                      <TableCell>
                        <Badge 
                          className={consultor.ativo 
                            ? 'bg-success text-success-foreground' 
                            : 'bg-muted text-muted-foreground'
                          }
                        >
                          {consultor.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(consultor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant={consultor.ativo ? 'secondary' : 'default'}
                            size="sm"
                            onClick={() => toggleAtivo(consultor)}
                          >
                            {consultor.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingConsultor ? 'Editar Consultor' : 'Novo Consultor'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-foreground">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do consultor"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="bg-input border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createConsultor.isPending || updateConsultor.isPending}
              className="bg-primary text-primary-foreground"
            >
              {(createConsultor.isPending || updateConsultor.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
