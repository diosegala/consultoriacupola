import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { 
  useTiposConsultoria, 
  useCreateTipoConsultoria, 
  useUpdateTipoConsultoria,
  useDeleteTipoConsultoria,
  useCRMs,
  useCreateCRM,
  useUpdateCRM,
  useDeleteCRM,
  TipoConsultoria,
  CRM
} from '@/hooks/useDadosAuxiliares';
import { useToast } from '@/hooks/use-toast';

export default function Configuracoes() {
  const { toast } = useToast();
  
  // Tipos de Consultoria
  const { data: tiposConsultoria, isLoading: loadingTipos } = useTiposConsultoria(false);
  const createTipo = useCreateTipoConsultoria();
  const updateTipo = useUpdateTipoConsultoria();
  const deleteTipo = useDeleteTipoConsultoria();
  
  // CRMs
  const { data: crms, isLoading: loadingCRMs } = useCRMs(false);
  const createCRM = useCreateCRM();
  const updateCRM = useUpdateCRM();
  const deleteCRM = useDeleteCRM();

  // Dialog states
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoConsultoria | null>(null);
  const [tipoNome, setTipoNome] = useState('');
  const [deleteTipoDialogOpen, setDeleteTipoDialogOpen] = useState(false);
  const [tipoToDelete, setTipoToDelete] = useState<TipoConsultoria | null>(null);

  const [crmDialogOpen, setCRMDialogOpen] = useState(false);
  const [editingCRM, setEditingCRM] = useState<CRM | null>(null);
  const [crmNome, setCRMNome] = useState('');
  const [deleteCRMDialogOpen, setDeleteCRMDialogOpen] = useState(false);
  const [crmToDelete, setCRMToDelete] = useState<CRM | null>(null);

  // Tipo handlers
  const openNewTipoDialog = () => {
    setEditingTipo(null);
    setTipoNome('');
    setTipoDialogOpen(true);
  };

  const openEditTipoDialog = (tipo: TipoConsultoria) => {
    setEditingTipo(tipo);
    setTipoNome(tipo.nome);
    setTipoDialogOpen(true);
  };

  const openDeleteTipoDialog = (tipo: TipoConsultoria) => {
    setTipoToDelete(tipo);
    setDeleteTipoDialogOpen(true);
  };

  const handleTipoSubmit = async () => {
    if (!tipoNome.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      if (editingTipo) {
        await updateTipo.mutateAsync({ id: editingTipo.id, nome: tipoNome.trim() });
        toast({ title: 'Sucesso', description: 'Tipo atualizado com sucesso' });
      } else {
        await createTipo.mutateAsync({ nome: tipoNome.trim() });
        toast({ title: 'Sucesso', description: 'Tipo criado com sucesso' });
      }
      setTipoDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteTipo = async () => {
    if (!tipoToDelete) return;

    try {
      await deleteTipo.mutateAsync(tipoToDelete.id);
      toast({ title: 'Sucesso', description: 'Tipo excluído com sucesso' });
      setDeleteTipoDialogOpen(false);
      setTipoToDelete(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const toggleTipoAtivo = async (tipo: TipoConsultoria) => {
    try {
      await updateTipo.mutateAsync({ id: tipo.id, ativo: !tipo.ativo });
      toast({ title: 'Sucesso', description: `Tipo ${tipo.ativo ? 'desativado' : 'ativado'}` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  // CRM handlers
  const openNewCRMDialog = () => {
    setEditingCRM(null);
    setCRMNome('');
    setCRMDialogOpen(true);
  };

  const openEditCRMDialog = (crm: CRM) => {
    setEditingCRM(crm);
    setCRMNome(crm.nome);
    setCRMDialogOpen(true);
  };

  const openDeleteCRMDialog = (crm: CRM) => {
    setCRMToDelete(crm);
    setDeleteCRMDialogOpen(true);
  };

  const handleCRMSubmit = async () => {
    if (!crmNome.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      if (editingCRM) {
        await updateCRM.mutateAsync({ id: editingCRM.id, nome: crmNome.trim() });
        toast({ title: 'Sucesso', description: 'CRM atualizado com sucesso' });
      } else {
        await createCRM.mutateAsync({ nome: crmNome.trim() });
        toast({ title: 'Sucesso', description: 'CRM criado com sucesso' });
      }
      setCRMDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteCRM = async () => {
    if (!crmToDelete) return;

    try {
      await deleteCRM.mutateAsync(crmToDelete.id);
      toast({ title: 'Sucesso', description: 'CRM excluído com sucesso' });
      setDeleteCRMDialogOpen(false);
      setCRMToDelete(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const toggleCRMAtivo = async (crm: CRM) => {
    try {
      await updateCRM.mutateAsync({ id: crm.id, ativo: !crm.ativo });
      toast({ title: 'Sucesso', description: `CRM ${crm.ativo ? 'desativado' : 'ativado'}` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie os cadastros auxiliares do sistema</p>
      </div>

      <Tabs defaultValue="tipos" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="tipos">Tipos de Consultoria</TabsTrigger>
          <TabsTrigger value="crms">CRMs</TabsTrigger>
        </TabsList>

        {/* Tipos de Consultoria */}
        <TabsContent value="tipos" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Tipos de Consultoria</CardTitle>
              <Button size="sm" onClick={openNewTipoDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Novo Tipo
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTipos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right w-[200px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiposConsultoria?.map(tipo => (
                      <TableRow key={tipo.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{tipo.nome}</TableCell>
                        <TableCell>
                          <Badge 
                            className={tipo.ativo 
                              ? 'bg-success text-success-foreground' 
                              : 'bg-muted text-muted-foreground'
                            }
                          >
                            {tipo.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => openEditTipoDialog(tipo)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteTipoDialog(tipo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant={tipo.ativo ? 'secondary' : 'default'}
                              size="sm"
                              onClick={() => toggleTipoAtivo(tipo)}
                            >
                              {tipo.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CRMs */}
        <TabsContent value="crms" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">CRMs</CardTitle>
              <Button size="sm" onClick={openNewCRMDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Novo CRM
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCRMs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right w-[200px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crms?.map(crm => (
                      <TableRow key={crm.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{crm.nome}</TableCell>
                        <TableCell>
                          <Badge 
                            className={crm.ativo 
                              ? 'bg-success text-success-foreground' 
                              : 'bg-muted text-muted-foreground'
                            }
                          >
                            {crm.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => openEditCRMDialog(crm)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteCRMDialog(crm)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant={crm.ativo ? 'secondary' : 'default'}
                              size="sm"
                              onClick={() => toggleCRMAtivo(crm)}
                            >
                              {crm.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Tipo de Consultoria */}
      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingTipo ? 'Editar Tipo de Consultoria' : 'Novo Tipo de Consultoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tipoNome" className="text-foreground">Nome *</Label>
              <Input
                id="tipoNome"
                value={tipoNome}
                onChange={(e) => setTipoNome(e.target.value)}
                placeholder="Nome do tipo"
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoDialogOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button 
              onClick={handleTipoSubmit}
              disabled={createTipo.isPending || updateTipo.isPending}
              className="bg-primary text-primary-foreground"
            >
              {(createTipo.isPending || updateTipo.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir Tipo */}
      <AlertDialog open={deleteTipoDialogOpen} onOpenChange={setDeleteTipoDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Tipo de Consultoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o tipo <strong>{tipoToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTipo}
              disabled={deleteTipo.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTipo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog CRM */}
      <Dialog open={crmDialogOpen} onOpenChange={setCRMDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingCRM ? 'Editar CRM' : 'Novo CRM'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crmNome" className="text-foreground">Nome *</Label>
              <Input
                id="crmNome"
                value={crmNome}
                onChange={(e) => setCRMNome(e.target.value)}
                placeholder="Nome do CRM"
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCRMDialogOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button 
              onClick={handleCRMSubmit}
              disabled={createCRM.isPending || updateCRM.isPending}
              className="bg-primary text-primary-foreground"
            >
              {(createCRM.isPending || updateCRM.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir CRM */}
      <AlertDialog open={deleteCRMDialogOpen} onOpenChange={setDeleteCRMDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir CRM</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o CRM <strong>{crmToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCRM}
              disabled={deleteCRM.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCRM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
