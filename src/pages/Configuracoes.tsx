import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, KeyRound, Bot, Save, Upload, Sparkles, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { 
  useTiposConsultoriaComContratos, useCreateTipoConsultoria, useUpdateTipoConsultoria,
  useDeleteTipoConsultoria, useCRMs, useCreateCRM, useUpdateCRM, useDeleteCRM,
  TipoConsultoriaComContratos, CRM
} from '@/hooks/useDadosAuxiliares';
import { useUserRoles, useAuthUsers, useAddUserRole, useDeleteUserRole } from '@/hooks/useUserRoles';
import { useAgentePrompts, useUpdateAgentePrompt } from '@/hooks/useAgentePrompts';
import { useParseDocumento } from '@/hooks/useProjetoDocumentos';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Configuracoes() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  
  // Tipos de Consultoria
  const { data: tiposConsultoria, isLoading: loadingTipos } = useTiposConsultoriaComContratos(false);
  const createTipo = useCreateTipoConsultoria();
  const updateTipo = useUpdateTipoConsultoria();
  const deleteTipo = useDeleteTipoConsultoria();
  
  // CRMs
  const { data: crms, isLoading: loadingCRMs } = useCRMs(false);
  const createCRM = useCreateCRM();
  const updateCRM = useUpdateCRM();
  const deleteCRM = useDeleteCRM();

  // User roles (admin only)
  const { data: userRoles, isLoading: loadingRoles } = useUserRoles();
  const { data: authUsers } = useAuthUsers();
  const addUserRole = useAddUserRole();
  const deleteUserRole = useDeleteUserRole();

  // Dialog states - Tipos
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoConsultoriaComContratos | null>(null);
  const [tipoNome, setTipoNome] = useState('');
  const [deleteTipoDialogOpen, setDeleteTipoDialogOpen] = useState(false);
  const [tipoToDelete, setTipoToDelete] = useState<TipoConsultoriaComContratos | null>(null);

  // Dialog states - CRMs
  const [crmDialogOpen, setCRMDialogOpen] = useState(false);
  const [editingCRM, setEditingCRM] = useState<CRM | null>(null);
  const [crmNome, setCRMNome] = useState('');
  const [deleteCRMDialogOpen, setDeleteCRMDialogOpen] = useState(false);
  const [crmToDelete, setCRMToDelete] = useState<CRM | null>(null);

  // Dialog states - Users
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'director'>('director');
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userRoleToDelete, setUserRoleToDelete] = useState<{ id: string; email: string } | null>(null);

  // Create user dialog
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'consultor' | 'director'>('consultor');
  const [creatingUser, setCreatingUser] = useState(false);

  // Oráculo (Notion sync)
  const [syncingOraculo, setSyncingOraculo] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  const handleSyncOraculo = async () => {
    setSyncingOraculo(true);
    setLastSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('oraculo-sync-notion');
      if (error) throw error;
      const total = data?.indexed ?? data?.total ?? 0;
      setLastSyncResult(`Sincronização concluída. ${total} documentos indexados.`);
      toast({ title: 'Oráculo sincronizado', description: `${total} documentos indexados.` });
    } catch (e: any) {
      setLastSyncResult(`Erro: ${e.message}`);
      toast({ title: 'Erro ao sincronizar', description: e.message, variant: 'destructive' });
    } finally {
      setSyncingOraculo(false);
    }
  };

  // Agente prompts (admin only)
  const { data: agentePrompts, isLoading: loadingPrompts } = useAgentePrompts();
  const updatePrompt = useUpdateAgentePrompt();
  const parseDocumento = useParseDocumento();
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [editedModelos, setEditedModelos] = useState<Record<string, string>>({});
  const [editedProvedores, setEditedProvedores] = useState<Record<string, string>>({});
  const [parsingTipo, setParsingTipo] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getPromptValue = (tipo: string) => {
    if (editedPrompts[tipo] !== undefined) return editedPrompts[tipo];
    return agentePrompts?.find(p => p.tipo === tipo)?.prompt || '';
  };

  const getModeloValue = (tipo: string) => {
    if (editedModelos[tipo] !== undefined) return editedModelos[tipo];
    return agentePrompts?.find(p => p.tipo === tipo)?.documento_modelo || '';
  };

  const getProvedorValue = (tipo: string) => {
    if (editedProvedores[tipo] !== undefined) return editedProvedores[tipo];
    return agentePrompts?.find(p => p.tipo === tipo)?.provedor || 'gemini';
  };

  const handleSavePrompt = async (tipo: string) => {
    const prompt = agentePrompts?.find(p => p.tipo === tipo);
    if (!prompt) return;
    try {
      await updatePrompt.mutateAsync({
        id: prompt.id,
        prompt: editedPrompts[tipo] ?? prompt.prompt,
        documento_modelo: editedModelos[tipo] ?? prompt.documento_modelo,
        provedor: editedProvedores[tipo] ?? prompt.provedor,
      });
      toast({ title: 'Sucesso', description: 'Prompt atualizado com sucesso' });
      setEditedPrompts(prev => { const n = { ...prev }; delete n[tipo]; return n; });
      setEditedModelos(prev => { const n = { ...prev }; delete n[tipo]; return n; });
      setEditedProvedores(prev => { const n = { ...prev }; delete n[tipo]; return n; });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleFileUploadModelo = async (tipo: string, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      toast({ title: 'Erro', description: 'Apenas arquivos .pdf e .docx são suportados', variant: 'destructive' });
      return;
    }
    const currentValue = getModeloValue(tipo);
    if (currentValue && currentValue.trim().length > 0) {
      if (!window.confirm('O conteúdo atual do Documento Modelo será substituído pelo texto extraído do arquivo. Continuar?')) return;
    }
    setParsingTipo(tipo);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const texto = await parseDocumento.mutateAsync({ tipo: ext, conteudo_base64: base64 });
      setEditedModelos(prev => ({ ...prev, [tipo]: texto }));
      toast({ title: 'Sucesso', description: 'Texto extraído do arquivo com sucesso' });
    } catch {
      // error already handled by hook
    } finally {
      setParsingTipo(null);
      if (fileInputRefs.current[tipo]) fileInputRefs.current[tipo]!.value = '';
    }
  };

  const TIPO_LABELS: Record<string, string> = {
    diagnostico: 'Diagnóstico',
    okrs: 'OKRs',
    briefing_cliente_oculto: 'Briefing Cliente Oculto',
  };

  // Password change
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loadingSenha, setLoadingSenha] = useState(false);

  const handleChangePassword = async () => {
    if (novaSenha.length < 8) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(novaSenha)) {
      toast({ title: 'Erro', description: 'A senha deve conter pelo menos 1 caractere especial', variant: 'destructive' });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast({ title: 'Erro', description: 'As senhas não conferem', variant: 'destructive' });
      return;
    }
    setLoadingSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setLoadingSenha(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso' });
      setNovaSenha('');
      setConfirmarSenha('');
    }
  };

  // Users already with a role
  const usersWithRoles = userRoles?.map(r => r.user_id) || [];
  const availableUsers = authUsers?.filter(u => !usersWithRoles.includes(u.id)) || [];

  // Enrich roles with email
  const enrichedRoles = userRoles?.map(r => ({
    ...r,
    email: authUsers?.find(u => u.id === r.user_id)?.email || r.user_id,
  })) || [];

  // Tipo handlers
  const openNewTipoDialog = () => { setEditingTipo(null); setTipoNome(''); setTipoDialogOpen(true); };
  const openEditTipoDialog = (tipo: TipoConsultoriaComContratos) => { setEditingTipo(tipo); setTipoNome(tipo.nome); setTipoDialogOpen(true); };
  const openDeleteTipoDialog = (tipo: TipoConsultoriaComContratos) => { setTipoToDelete(tipo); setDeleteTipoDialogOpen(true); };

  const handleTipoSubmit = async () => {
    if (!tipoNome.trim()) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    try {
      if (editingTipo) {
        await updateTipo.mutateAsync({ id: editingTipo.id, nome: tipoNome.trim() });
        toast({ title: 'Sucesso', description: 'Tipo atualizado com sucesso' });
      } else {
        await createTipo.mutateAsync({ nome: tipoNome.trim() });
        toast({ title: 'Sucesso', description: 'Tipo criado com sucesso' });
      }
      setTipoDialogOpen(false);
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  const handleDeleteTipo = async () => {
    if (!tipoToDelete) return;
    try {
      await deleteTipo.mutateAsync(tipoToDelete.id);
      toast({ title: 'Sucesso', description: 'Tipo excluído com sucesso' });
      setDeleteTipoDialogOpen(false); setTipoToDelete(null);
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  const toggleTipoAtivo = async (tipo: TipoConsultoriaComContratos) => {
    try {
      await updateTipo.mutateAsync({ id: tipo.id, ativo: !tipo.ativo });
      toast({ title: 'Sucesso', description: `Tipo ${tipo.ativo ? 'desativado' : 'ativado'}` });
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  // CRM handlers
  const openNewCRMDialog = () => { setEditingCRM(null); setCRMNome(''); setCRMDialogOpen(true); };
  const openEditCRMDialog = (crm: CRM) => { setEditingCRM(crm); setCRMNome(crm.nome); setCRMDialogOpen(true); };
  const openDeleteCRMDialog = (crm: CRM) => { setCRMToDelete(crm); setDeleteCRMDialogOpen(true); };

  const handleCRMSubmit = async () => {
    if (!crmNome.trim()) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    try {
      if (editingCRM) {
        await updateCRM.mutateAsync({ id: editingCRM.id, nome: crmNome.trim() });
        toast({ title: 'Sucesso', description: 'CRM atualizado com sucesso' });
      } else {
        await createCRM.mutateAsync({ nome: crmNome.trim() });
        toast({ title: 'Sucesso', description: 'CRM criado com sucesso' });
      }
      setCRMDialogOpen(false);
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  const handleDeleteCRM = async () => {
    if (!crmToDelete) return;
    try {
      await deleteCRM.mutateAsync(crmToDelete.id);
      toast({ title: 'Sucesso', description: 'CRM excluído com sucesso' });
      setDeleteCRMDialogOpen(false); setCRMToDelete(null);
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  const toggleCRMAtivo = async (crm: CRM) => {
    try {
      await updateCRM.mutateAsync({ id: crm.id, ativo: !crm.ativo });
      toast({ title: 'Sucesso', description: `CRM ${crm.ativo ? 'desativado' : 'ativado'}` });
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  // User handlers
  const handleAddUser = async () => {
    if (!selectedUserId) { toast({ title: 'Erro', description: 'Selecione um usuário', variant: 'destructive' }); return; }
    try {
      await addUserRole.mutateAsync({ userId: selectedUserId, role: selectedRole });
      toast({ title: 'Sucesso', description: 'Usuário adicionado com sucesso' });
      setUserDialogOpen(false); setSelectedUserId('');
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ title: 'Erro', description: 'Email e senha são obrigatórios', variant: 'destructive' });
      return;
    }
    if (newUserPassword.length < 8) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newUserPassword)) {
      toast({ title: 'Erro', description: 'A senha deve conter pelo menos 1 caractere especial', variant: 'destructive' });
      return;
    }
    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('create-user', {
        body: { email: newUserEmail, password: newUserPassword, role: newUserRole },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast({ title: 'Sucesso', description: `Usuário ${newUserEmail} criado. Ele precisará trocar a senha no primeiro acesso.` });
      setCreateUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('consultor');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setCreatingUser(false);
  };

  const handleDeleteUser = async () => {
    if (!userRoleToDelete) return;
    try {
      await deleteUserRole.mutateAsync(userRoleToDelete.id);
      toast({ title: 'Sucesso', description: 'Acesso removido com sucesso' });
      setDeleteUserDialogOpen(false); setUserRoleToDelete(null);
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie os cadastros auxiliares do sistema</p>
      </div>

      <Tabs defaultValue="conta" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="conta">Minha Conta</TabsTrigger>
          {isAdmin && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
          {isAdmin && <TabsTrigger value="agentes">Agentes IA</TabsTrigger>}
          <TabsTrigger value="tipos">Tipos de Consultoria</TabsTrigger>
          <TabsTrigger value="crms">CRMs</TabsTrigger>
          {isAdmin && <TabsTrigger value="oraculo">Oráculo</TabsTrigger>}
        </TabsList>

        {/* Minha Conta */}
        <TabsContent value="conta" className="mt-6">
          <Card className="bg-card border-border max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <KeyRound className="h-5 w-5 text-primary" />
                Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <Input id="novaSenha" type="password" placeholder="••••••" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="bg-input border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <Input id="confirmarSenha" type="password" placeholder="••••••" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} className="bg-input border-border" />
              </div>
              <Button onClick={handleChangePassword} disabled={loadingSenha} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {loadingSenha && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Nova Senha
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usuários (admin only) */}
        {isAdmin && (
          <TabsContent value="usuarios" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Usuários Autorizados
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setNewUserEmail(''); setNewUserPassword(''); setNewUserRole('consultor'); setCreateUserDialogOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Novo Usuário
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedUserId(''); setUserDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Existente
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRoles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Email</TableHead>
                        <TableHead className="text-muted-foreground">Papel</TableHead>
                        <TableHead className="text-muted-foreground text-right w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedRoles.map(role => (
                        <TableRow key={role.id} className="border-border">
                          <TableCell className="font-medium text-foreground">{role.email}</TableCell>
                          <TableCell>
                            <Badge className={role.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}>
                              {role.role === 'admin' ? 'Admin' : 'Diretor'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {role.user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => { setUserRoleToDelete({ id: role.id, email: role.email }); setDeleteUserDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

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
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground text-center">Contratos</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right w-[200px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiposConsultoria?.map(tipo => (
                      <TableRow key={tipo.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{tipo.nome}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-border text-foreground">{tipo.total_contratos}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={tipo.ativo ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
                            {tipo.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEditTipoDialog(tipo)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteTipoDialog(tipo)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant={tipo.ativo ? 'secondary' : 'default'} size="sm" onClick={() => toggleTipoAtivo(tipo)}>
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
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
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
                          <Badge className={crm.ativo ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
                            {crm.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEditCRMDialog(crm)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteCRMDialog(crm)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant={crm.ativo ? 'secondary' : 'default'} size="sm" onClick={() => toggleCRMAtivo(crm)}>
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
        {/* Agentes IA (admin only) */}
        {isAdmin && (
          <TabsContent value="agentes" className="mt-6 space-y-4">
            {loadingPrompts ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              ['diagnostico', 'okrs', 'briefing_cliente_oculto'].map(tipo => {
                const hasChanges = editedPrompts[tipo] !== undefined || editedModelos[tipo] !== undefined || editedProvedores[tipo] !== undefined;
                return (
                  <Card key={tipo} className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-foreground text-base">
                        <Bot className="h-5 w-5 text-primary" />
                        {TIPO_LABELS[tipo]}
                      </CardTitle>
                      <Button
                        size="sm"
                        disabled={!hasChanges || updatePrompt.isPending}
                        onClick={() => handleSavePrompt(tipo)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {updatePrompt.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Provedor de IA</Label>
                        <Select value={getProvedorValue(tipo)} onValueChange={(v) => setEditedProvedores(prev => ({ ...prev, [tipo]: v }))}>
                          <SelectTrigger className="bg-input border-border w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gemini">Gemini (Google)</SelectItem>
                            <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Prompt do Agente</Label>
                        <Textarea
                          className="bg-input border-border min-h-[200px] font-mono text-sm"
                          value={getPromptValue(tipo)}
                          onChange={(e) => setEditedPrompts(prev => ({ ...prev, [tipo]: e.target.value }))}
                          placeholder="Insira o prompt do agente..."
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Documento Modelo (opcional)</Label>
                          <div>
                            <input
                              type="file"
                              accept=".pdf,.docx"
                              className="hidden"
                              ref={el => { fileInputRefs.current[tipo] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUploadModelo(tipo, file);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={parsingTipo === tipo}
                              onClick={() => fileInputRefs.current[tipo]?.click()}
                              className="border-border"
                            >
                              {parsingTipo === tipo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                              {parsingTipo === tipo ? 'Extraindo texto...' : 'Enviar arquivo'}
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          className="bg-input border-border min-h-[150px] font-mono text-sm"
                          value={getModeloValue(tipo)}
                          onChange={(e) => setEditedModelos(prev => ({ ...prev, [tipo]: e.target.value }))}
                          placeholder="Cole aqui um exemplo de documento já produzido para servir de referência de estilo, tom e estrutura..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

      </Tabs>

      {/* Dialog Tipo de Consultoria */}
      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTipo ? 'Editar Tipo de Consultoria' : 'Novo Tipo de Consultoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tipoNome" className="text-foreground">Nome *</Label>
              <Input id="tipoNome" value={tipoNome} onChange={(e) => setTipoNome(e.target.value)} placeholder="Nome do tipo" className="bg-input border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoDialogOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleTipoSubmit} disabled={createTipo.isPending || updateTipo.isPending} className="bg-primary text-primary-foreground">
              {(createTipo.isPending || updateTipo.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
            <AlertDialogDescription>Tem certeza que deseja excluir o tipo <strong>{tipoToDelete?.nome}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTipo} disabled={deleteTipo.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            <DialogTitle className="text-foreground">{editingCRM ? 'Editar CRM' : 'Novo CRM'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crmNome" className="text-foreground">Nome *</Label>
              <Input id="crmNome" value={crmNome} onChange={(e) => setCRMNome(e.target.value)} placeholder="Nome do CRM" className="bg-input border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCRMDialogOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleCRMSubmit} disabled={createCRM.isPending || updateCRM.isPending} className="bg-primary text-primary-foreground">
              {(createCRM.isPending || updateCRM.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
            <AlertDialogDescription>Tem certeza que deseja excluir o CRM <strong>{crmToDelete?.nome}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCRM} disabled={deleteCRM.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteCRM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Adicionar Usuário */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Usuário *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione um usuário cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum usuário disponível</SelectItem>
                  ) : (
                    availableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Papel</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'director')}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Diretor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleAddUser} disabled={addUserRole.isPending || !selectedUserId} className="bg-primary text-primary-foreground">
              {addUserRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Remover Usuário */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remover Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso de <strong>{userRoleToDelete?.email}</strong>? O usuário não poderá mais acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleteUserRole.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUserRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Criar Novo Usuário */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Email *</Label>
              <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-input border-border" type="email" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Senha Temporária *</Label>
              <Input value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min. 8 caracteres + especial" className="bg-input border-border" type="password" />
              <p className="text-xs text-muted-foreground">O usuário será obrigado a trocar a senha no primeiro acesso.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Papel</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'consultor' | 'director')}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultor">Consultor</SelectItem>
                  <SelectItem value="director">Diretor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser} className="bg-primary text-primary-foreground">
              {creatingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
