import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Search, Plus, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Archive, ArchiveRestore } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClientes, useArquivarCliente, useDesarquivarCliente, useHardDeleteCliente, ClienteComDetalhes } from '@/hooks/useClientes';
import { useConsultores } from '@/hooks/useConsultores';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from '@/hooks/useConsultorUser';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

type SortField = 'nome' | 'cidade' | 'consultor' | 'tipo' | 'mrr' | 'status' | 'data_fim';
type SortDirection = 'asc' | 'desc';

export default function Clientes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConsultor, isAdmin, isDirector } = useAuth();
  const canArchive = isAdmin || isDirector;
  const canHardDelete = isAdmin;
  const { data: myConsultorId } = useMyConsultorId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [consultorFilter, setConsultorFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [clienteToArchive, setClienteToArchive] = useState<ClienteComDetalhes | null>(null);
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const [clienteToHardDelete, setClienteToHardDelete] = useState<ClienteComDetalhes | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState('');

  const effectiveConsultorId = isConsultor
    ? (myConsultorId || undefined)
    : (consultorFilter !== 'todos' ? consultorFilter : undefined);

  const { data: clientes, isLoading } = useClientes({
    search: search || undefined,
    status: (statusFilter !== 'todos' && statusFilter !== 'arquivados') ? statusFilter : undefined,
    consultor_id: effectiveConsultorId,
    apenas_arquivados: statusFilter === 'arquivados',
  });

  const { data: consultores } = useConsultores();
  const { data: tiposConsultoria } = useTiposConsultoria();
  const arquivarCliente = useArquivarCliente();
  const desarquivarCliente = useDesarquivarCliente();
  const hardDeleteCliente = useHardDeleteCliente();

  // Filtro adicional por tipo de consultoria e ordenação
  const clientesFiltrados = useMemo(() => {
    let result = clientes?.filter(cliente => {
      if (tipoFilter === 'todos') return true;
      return cliente.contrato_ativo?.tipo_consultoria_id === tipoFilter;
    }) || [];

    // Ordenação
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'nome':
          comparison = a.nome.localeCompare(b.nome);
          break;
        case 'cidade':
          comparison = `${a.cidade}/${a.uf}`.localeCompare(`${b.cidade}/${b.uf}`);
          break;
        case 'consultor':
          comparison = (a.consultor?.nome || '').localeCompare(b.consultor?.nome || '');
          break;
        case 'tipo':
          comparison = (a.contrato_ativo?.tipo_consultoria?.nome || '').localeCompare(b.contrato_ativo?.tipo_consultoria?.nome || '');
          break;
        case 'mrr':
          const mrrA = Number(a.contrato_ativo?.remuneracao_mensal) || 0;
          const mrrB = Number(b.contrato_ativo?.remuneracao_mensal) || 0;
          comparison = mrrA - mrrB;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'data_fim':
          const dataA = a.contrato_ativo?.data_fim ? new Date(a.contrato_ativo.data_fim).getTime() : 0;
          const dataB = b.contrato_ativo?.data_fim ? new Date(b.contrato_ativo.data_fim).getTime() : 0;
          comparison = dataA - dataB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [clientes, tipoFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const openArchiveDialog = (cliente: ClienteComDetalhes, e: React.MouseEvent) => {
    e.stopPropagation();
    setClienteToArchive(cliente);
    setArchiveDialogOpen(true);
  };

  const openHardDeleteDialog = (cliente: ClienteComDetalhes, e: React.MouseEvent) => {
    e.stopPropagation();
    setClienteToHardDelete(cliente);
    setHardDeleteConfirm('');
    setHardDeleteDialogOpen(true);
  };

  const handleArchive = async () => {
    if (!clienteToArchive) return;
    try {
      if (clienteToArchive.arquivado_em) {
        await desarquivarCliente.mutateAsync(clienteToArchive.id);
        toast({ title: 'Sucesso', description: 'Cliente desarquivado' });
      } else {
        await arquivarCliente.mutateAsync(clienteToArchive.id);
        toast({ title: 'Sucesso', description: 'Cliente arquivado' });
      }
      setArchiveDialogOpen(false);
      setClienteToArchive(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Falha na operação', variant: 'destructive' });
    }
  };

  const handleHardDelete = async () => {
    if (!clienteToHardDelete) return;
    if (hardDeleteConfirm.trim() !== clienteToHardDelete.nome) {
      toast({ title: 'Nome não confere', description: 'Digite o nome exato do cliente para confirmar.', variant: 'destructive' });
      return;
    }
    try {
      await hardDeleteCliente.mutateAsync(clienteToHardDelete.id);
      toast({ title: 'Cliente excluído permanentemente' });
      setHardDeleteDialogOpen(false);
      setClienteToHardDelete(null);
      setHardDeleteConfirm('');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir cliente', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
        </div>
        <Button onClick={() => navigate('/clientes/novo')} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="aguardando_renovacao">Aguardando Renovação</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
                {canArchive && (
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                )}
              </SelectContent>
            </Select>

            {!isConsultor && (
            <Select value={consultorFilter} onValueChange={setConsultorFilter}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos os consultores</SelectItem>
                {consultores?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Tipo de Consultoria" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tiposConsultoria?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {clientesFiltrados?.length || 0} cliente{(clientesFiltrados?.length || 0) !== 1 ? 's' : ''}
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
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('nome')}
                  >
                    <div className="flex items-center">
                      Nome <SortIcon field="nome" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('cidade')}
                  >
                    <div className="flex items-center">
                      Cidade/UF <SortIcon field="cidade" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('consultor')}
                  >
                    <div className="flex items-center">
                      Consultor <SortIcon field="consultor" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('tipo')}
                  >
                    <div className="flex items-center">
                      Tipo <SortIcon field="tipo" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('mrr')}
                  >
                    <div className="flex items-center">
                      MRR <SortIcon field="mrr" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('data_fim')}
                  >
                    <div className="flex items-center">
                      Fim Contrato <SortIcon field="data_fim" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px] text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  clientesFiltrados?.map(cliente => (
                    <TableRow 
                      key={cliente.id} 
                      className="border-border cursor-pointer hover:bg-secondary/50"
                      onClick={() => navigate(`/clientes/${cliente.id}`)}
                    >
                      <TableCell className="font-medium text-foreground">{cliente.nome}</TableCell>
                      <TableCell className="text-foreground">{cliente.cidade}/{cliente.uf}</TableCell>
                      <TableCell className="text-foreground">{cliente.consultor?.nome || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.contrato_ativo?.tipo_consultoria?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {cliente.contrato_ativo 
                          ? formatCurrency(Number(cliente.contrato_ativo.remuneracao_mensal))
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={cliente.status} />
                          {cliente._projeto_status_cliente &&
                            cliente._projeto_status_cliente !== cliente.status && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Status divergente — etapa do Kanban "{cliente._projeto_etapa_nome}" indica
                                    <strong> {cliente._projeto_status_cliente}</strong>. Verifique o Kanban.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.contrato_ativo?.data_fim 
                          ? format(parseISO(cliente.contrato_ativo.data_fim), 'dd/MM/yyyy')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-border"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clientes/${cliente.id}`);
                            }}
                          >
                            Ver
                          </Button>
                          {canArchive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={cliente.arquivado_em ? 'Desarquivar' : 'Arquivar'}
                              className="text-muted-foreground hover:text-foreground"
                              onClick={(e) => openArchiveDialog(cliente, e)}
                            >
                              {cliente.arquivado_em
                                ? <ArchiveRestore className="h-4 w-4" />
                                : <Archive className="h-4 w-4" />}
                            </Button>
                          )}
                          {canHardDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir permanentemente"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => openHardDeleteDialog(cliente, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Dialog de Arquivamento (soft delete) */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {clienteToArchive?.arquivado_em ? 'Desarquivar cliente' : 'Arquivar cliente'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clienteToArchive?.arquivado_em ? (
                <>Restaurar <strong>{clienteToArchive?.nome}</strong> para as listagens normais?</>
              ) : (
                <>
                  <strong>{clienteToArchive?.nome}</strong> será marcado como encerrado e
                  removido das listagens padrão. Os dados históricos (contratos,
                  atendimentos, reuniões) permanecem preservados e podem ser
                  restaurados a qualquer momento.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={arquivarCliente.isPending || desarquivarCliente.isPending}
            >
              {(arquivarCliente.isPending || desarquivarCliente.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {clienteToArchive?.arquivado_em ? 'Desarquivar' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Exclusão Permanente (admin only, confirmação por digitação) */}
      <AlertDialog open={hardDeleteDialogOpen} onOpenChange={setHardDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Excluir permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você vai apagar <strong>{clienteToHardDelete?.nome}</strong> e
                  <strong> todos os dados relacionados</strong> (contratos, atendimentos,
                  onboarding, ferramentas, pausas, encerramentos, viagens, webhook logs).
                </p>
                <p className="text-destructive font-medium">
                  Esta ação é irreversível. Prefira "Arquivar" sempre que possível.
                </p>
                <p>
                  Para confirmar, digite o nome exato do cliente:
                  <span className="block mt-1 text-foreground font-mono">
                    {clienteToHardDelete?.nome}
                  </span>
                </p>
                <Input
                  value={hardDeleteConfirm}
                  onChange={(e) => setHardDeleteConfirm(e.target.value)}
                  placeholder="Digite o nome do cliente"
                  className="bg-input border-border"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              disabled={
                hardDeleteCliente.isPending ||
                hardDeleteConfirm.trim() !== clienteToHardDelete?.nome
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hardDeleteCliente.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
