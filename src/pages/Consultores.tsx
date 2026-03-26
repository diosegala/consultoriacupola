import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Pencil, Trash2, Loader2, Eye } from 'lucide-react';
import { useConsultoresComStats, useCreateConsultor, useUpdateConsultor, useDeleteConsultor, Consultor } from '@/hooks/useConsultores';
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: consultores, isLoading } = useConsultoresComStats();
  const createConsultor = useCreateConsultor();
  const updateConsultor = useUpdateConsultor();
  const deleteConsultor = useDeleteConsultor();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConsultor, setEditingConsultor] = useState<Consultor | null>(null);
  const [formData, setFormData] = useState({ nome: '', email: '' });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [consultorToDelete, setConsultorToDelete] = useState<Consultor | null>(null);

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

  const openDeleteDialog = (consultor: Consultor) => {
    setConsultorToDelete(consultor);
    setDeleteDialogOpen(true);
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

  const handleDelete = async () => {
    if (!consultorToDelete) return;

    try {
      await deleteConsultor.mutateAsync(consultorToDelete.id);
      toast({
        title: 'Sucesso',
        description: 'Consultor excluído com sucesso'
      });
      setDeleteDialogOpen(false);
      setConsultorToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir consultor',
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
                   <TableHead className="text-muted-foreground text-center">Score</TableHead>
                   <TableHead className="text-muted-foreground">Status</TableHead>
                   <TableHead className="w-[200px] text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultores?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                       <TableCell className="text-center text-foreground">{consultor.score_medio != null ? consultor.score_medio.toFixed(1) : '—'}</TableCell>
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
                             onClick={() => navigate(`/consultores/${consultor.id}`)}
                           >
                             <Eye className="h-4 w-4" />
                           </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(consultor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(consultor)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o consultor <strong>{consultorToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConsultor.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConsultor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
