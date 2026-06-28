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
import { Search, Plus, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClientes, useDeleteCliente, ClienteComDetalhes } from '@/hooks/useClientes';
import { useConsultores } from '@/hooks/useConsultores';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [consultorFilter, setConsultorFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<ClienteComDetalhes | null>(null);

  const { data: clientes, isLoading } = useClientes({
    search: search || undefined,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    consultor_id: consultorFilter !== 'todos' ? consultorFilter : undefined
  });

  const { data: consultores } = useConsultores();
  const { data: tiposConsultoria } = useTiposConsultoria();
  const deleteCliente = useDeleteCliente();

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

  const openDeleteDialog = (cliente: ClienteComDetalhes, e: React.MouseEvent) => {
    e.stopPropagation();
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!clienteToDelete) return;

    try {
      await deleteCliente.mutateAsync(clienteToDelete.id);
      toast({
        title: 'Sucesso',
        description: 'Cliente excluído com sucesso'
      });
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir cliente',
        variant: 'destructive'
      });
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
              </SelectContent>
            </Select>

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
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => openDeleteDialog(cliente, e)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{clienteToDelete?.nome}</strong>?
              Esta ação irá remover também todos os contratos, atendimentos e dados relacionados.
              <span className="block mt-2 text-destructive font-medium">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteCliente.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCliente.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
