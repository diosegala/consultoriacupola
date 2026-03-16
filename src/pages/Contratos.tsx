import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Search, Eye, X, ExternalLink, Calendar, DollarSign, User, Building, Pencil, ArrowUpDown, ArrowUp, ArrowDown, XCircle, RefreshCw, Pause, Play, CalendarPlus, Trash2, Plane } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

import { useAllContratos, AllContratosFilters, ContratoComCliente, useDeleteContrato } from '@/hooks/useContratos';
import { useConsultores } from '@/hooks/useConsultores';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
import { usePausaAtiva } from '@/hooks/usePausasContrato';
import { ContratoFormDialog, EncerrarContratoDialog, RenovarContratoDialog } from '@/components/cliente/ClienteDialogs';
import { PausaContratoDialog } from '@/components/contrato/PausaContratoDialog';
import { RetomarContratoDialog } from '@/components/contrato/RetomarContratoDialog';
import { ProrrogarContratoDialog } from '@/components/contrato/ProrrogarContratoDialog';
import { ViagensContrato } from '@/components/contrato/ViagensContrato';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getContratoStatusInfo(contrato: ContratoComCliente & { pausado?: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dataFim = new Date(contrato.data_fim);
  const diasRestantes = differenceInDays(dataFim, today);

  if (!contrato.ativo) {
    return { label: 'Inativo', variant: 'secondary' as const, color: 'bg-muted text-muted-foreground' };
  }

  if (contrato.pausado) {
    return { label: 'Pausado', variant: 'warning' as const, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
  }

  if (diasRestantes < 0) {
    return { label: 'Vencido', variant: 'destructive' as const, color: 'bg-destructive text-destructive-foreground' };
  }

  if (diasRestantes <= 30) {
    return { label: 'Vencendo', variant: 'warning' as const, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  }

  return { label: 'Ativo', variant: 'default' as const, color: 'bg-[#b0f90a]/20 text-[#b0f90a] border-[#b0f90a]/30' };
}

type ContratoSortField = 'cliente' | 'tipo' | 'data_inicio' | 'data_fim' | 'mrr' | 'status';
type SortDirection = 'asc' | 'desc';
type CardModalType = 'ativos' | 'vencendo' | 'vencidos' | null;

export default function Contratos() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AllContratosFilters>({
    ativo: true,
    vencimento: 'all',
  });
  const [searchInput, setSearchInput] = useState('');
  const [selectedContrato, setSelectedContrato] = useState<ContratoComCliente | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState<ContratoComCliente | null>(null);
  const [showEncerrar, setShowEncerrar] = useState(false);
  const [encerrandoContrato, setEncerrandoContrato] = useState<ContratoComCliente | null>(null);
  const [showRenovar, setShowRenovar] = useState(false);
  const [renovandoContrato, setRenovandoContrato] = useState<ContratoComCliente | null>(null);
  const [showPausar, setShowPausar] = useState(false);
  const [pausandoContrato, setPausandoContrato] = useState<ContratoComCliente | null>(null);
  const [showRetomar, setShowRetomar] = useState(false);
  const [retomandoContrato, setRetomandoContrato] = useState<ContratoComCliente | null>(null);
  const [showProrrogar, setShowProrrogar] = useState(false);
  const [prorrogandoContrato, setProrrogandoContrato] = useState<ContratoComCliente | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingContrato, setDeletingContrato] = useState<ContratoComCliente | null>(null);
  const [sortField, setSortField] = useState<ContratoSortField>('cliente');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Modal para lista de contratos por status do KPI
  const [cardModalType, setCardModalType] = useState<CardModalType>(null);

  // Query para a lista principal (com filtros)
  const { data: contratosRaw, isLoading } = useAllContratos({
    ...filters,
    search: searchInput,
  });
  
  // Query separada para KPIs (sempre busca TODOS os contratos ativos, sem filtros)
  const { data: todosContratosAtivos } = useAllContratos({ ativo: true });
  
  const { data: consultores } = useConsultores();
  const { data: tiposConsultoria } = useTiposConsultoria();
  const deleteContrato = useDeleteContrato();

  // Ordenar contratos da lista principal
  const contratos = useMemo(() => {
    if (!contratosRaw) return [];
    
    return [...contratosRaw].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'cliente':
          comparison = (a.cliente?.nome || '').localeCompare(b.cliente?.nome || '');
          break;
        case 'tipo':
          comparison = (a.tipo_consultoria?.nome || '').localeCompare(b.tipo_consultoria?.nome || '');
          break;
        case 'data_inicio':
          comparison = new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime();
          break;
        case 'data_fim':
          comparison = new Date(a.data_fim).getTime() - new Date(b.data_fim).getTime();
          break;
        case 'mrr':
          comparison = Number(a.remuneracao_mensal) - Number(b.remuneracao_mensal);
          break;
        case 'status':
          const statusA = getContratoStatusInfo(a).label;
          const statusB = getContratoStatusInfo(b).label;
          comparison = statusA.localeCompare(statusB);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [contratosRaw, sortField, sortDirection]);

  const handleSort = (field: ContratoSortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: ContratoSortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Calcular KPIs com base na query separada (sem filtros)
  const kpis = useMemo(() => {
    if (!todosContratosAtivos) return { ativos: 0, vencendo30: 0, vencidos: 0, mrrTotal: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let ativos = 0;
    let vencendo30 = 0;
    let vencidos = 0;
    let mrrTotal = 0;

    todosContratosAtivos.forEach(c => {
      if (!c.ativo) return;

      const dataFim = new Date(c.data_fim);
      const diasRestantes = differenceInDays(dataFim, today);

      ativos++;
      mrrTotal += Number(c.remuneracao_mensal) || 0;

      if (diasRestantes < 0) {
        vencidos++;
      } else if (diasRestantes <= 30) {
        vencendo30++;
      }
    });

    return { ativos, vencendo30, vencidos, mrrTotal };
  }, [todosContratosAtivos]);

  // Contratos para exibir no modal (calculados a partir dos dados sem filtro)
  const contratosModal = useMemo(() => {
    if (!todosContratosAtivos || !cardModalType) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (cardModalType) {
      case 'ativos':
        return todosContratosAtivos.filter(c => c.ativo);
      case 'vencendo':
        return todosContratosAtivos.filter(c => {
          if (!c.ativo) return false;
          const dataFim = new Date(c.data_fim);
          const dias = differenceInDays(dataFim, today);
          return dias >= 0 && dias <= 30;
        });
      case 'vencidos':
        return todosContratosAtivos.filter(c => {
          if (!c.ativo) return false;
          const dataFim = new Date(c.data_fim);
          return dataFim < today;
        });
      default:
        return [];
    }
  }, [todosContratosAtivos, cardModalType]);

  const getModalTitle = () => {
    switch (cardModalType) {
      case 'ativos':
        return 'Contratos Ativos';
      case 'vencendo':
        return 'Contratos Vencendo (próximos 30 dias)';
      case 'vencidos':
        return 'Contratos Vencidos';
      default:
        return '';
    }
  };

  const handleClearFilters = () => {
    setFilters({ ativo: true, vencimento: 'all' });
    setSearchInput('');
  };

  const handleCardClick = (cardType: 'ativos' | 'vencendo' | 'vencidos') => {
    setCardModalType(cardType);
  };

  const handleContratoClickFromModal = (contrato: ContratoComCliente) => {
    setCardModalType(null);
    setSelectedContrato(contrato);
  };

  const hasActiveFilters = 
    filters.ativo !== 'all' || 
    filters.vencimento !== 'all' || 
    filters.consultor_id || 
    filters.tipo_consultoria_id ||
    searchInput;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">Visão consolidada de todos os contratos</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/50"
          onClick={() => handleCardClick('ativos')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{kpis.ativos}</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer transition-all hover:scale-[1.02] hover:border-yellow-500/50"
          onClick={() => handleCardClick('vencendo')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencendo (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">{kpis.vencendo30}</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer transition-all hover:scale-[1.02] hover:border-destructive/50"
          onClick={() => handleCardClick('vencidos')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{kpis.vencidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(kpis.mrrTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={filters.ativo === 'all' ? 'all' : filters.ativo ? 'true' : 'false'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  ativo: value === 'all' ? 'all' : value === 'true' 
                }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.vencimento || 'all'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  vencimento: value as AllContratosFilters['vencimento'] 
                }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer data</SelectItem>
                <SelectItem value="30">Próximos 30 dias</SelectItem>
                <SelectItem value="60">Próximos 60 dias</SelectItem>
                <SelectItem value="90">Próximos 90 dias</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.consultor_id || 'all'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  consultor_id: value === 'all' ? undefined : value 
                }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {consultores?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.tipo_consultoria_id || 'all'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  tipo_consultoria_id: value === 'all' ? undefined : value 
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo Consultoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposConsultoria?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={handleClearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('cliente')}
                  >
                    <div className="flex items-center">
                      Cliente <SortIcon field="cliente" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('tipo')}
                  >
                    <div className="flex items-center">
                      Tipo <SortIcon field="tipo" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('data_inicio')}
                  >
                    <div className="flex items-center">
                      Início <SortIcon field="data_inicio" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('data_fim')}
                  >
                    <div className="flex items-center">
                      Fim <SortIcon field="data_fim" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('mrr')}
                  >
                    <div className="flex items-center justify-end">
                      MRR <SortIcon field="mrr" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  contratos?.map((contrato) => {
                    const statusInfo = getContratoStatusInfo(contrato);
                    return (
                      <TableRow 
                        key={contrato.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedContrato(contrato)}
                      >
                        <TableCell>
                          <span className="font-medium">
                            {contrato.cliente?.nome || 'Cliente não encontrado'}
                          </span>
                          {contrato.cliente?.consultor && (
                            <p className="text-xs text-muted-foreground">
                              {contrato.cliente.consultor.nome}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contrato.tipo_consultoria?.nome || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(contrato.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(contrato.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(contrato.remuneracao_mensal))}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('border', statusInfo.color)}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContrato(contrato);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Lista de Contratos por Status do KPI */}
      <Dialog open={!!cardModalType} onOpenChange={(open) => !open && setCardModalType(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {getModalTitle()}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {contratosModal.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum contrato encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {contratosModal.map((contrato) => {
                  const statusInfo = getContratoStatusInfo(contrato);
                  const diasRestantes = differenceInDays(
                    new Date(contrato.data_fim),
                    new Date()
                  );
                  
                  return (
                    <Card 
                      key={contrato.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleContratoClickFromModal(contrato)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-semibold truncate">
                                {contrato.cliente?.nome || 'Cliente não encontrado'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {contrato.tipo_consultoria?.nome || 'Sem tipo'}
                              {contrato.cliente?.consultor && (
                                <> • {contrato.cliente.consultor.nome}</>
                              )}
                            </p>
                          </div>
                          <Badge className={cn('border shrink-0', statusInfo.color)}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Vence: {format(parseISO(contrato.data_fim), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </div>
                            <span className={cn(
                              "text-xs",
                              diasRestantes < 0 ? "text-destructive" : 
                              diasRestantes <= 30 ? "text-yellow-400" : "text-muted-foreground"
                            )}>
                              {diasRestantes < 0 
                                ? `(${Math.abs(diasRestantes)} dias atrás)`
                                : `(${diasRestantes} dias)`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 font-medium text-primary">
                            <DollarSign className="h-4 w-4" />
                            <span>{formatCurrency(Number(contrato.remuneracao_mensal))}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Contrato */}
      <Dialog open={!!selectedContrato} onOpenChange={(open) => !open && setSelectedContrato(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes do Contrato
            </DialogTitle>
          </DialogHeader>

          {selectedContrato && (() => {
            const statusInfo = getContratoStatusInfo(selectedContrato);
            const diasRestantes = differenceInDays(
              new Date(selectedContrato.data_fim),
              new Date()
            );
            
            return (
              <div className="space-y-6">
                {/* Cliente e Status */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-lg">{selectedContrato.cliente?.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{selectedContrato.cliente?.cidade}, {selectedContrato.cliente?.uf}</span>
                    </div>
                  </div>
                  <Badge className={cn('border', statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                </div>

                <Separator />

                {/* Informações do Contrato */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Tipo de Consultoria</p>
                    <p className="font-medium">{selectedContrato.tipo_consultoria?.nome || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Consultor</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{selectedContrato.cliente?.consultor?.nome || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Data Início</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {format(parseISO(selectedContrato.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Data Fim</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {format(parseISO(selectedContrato.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-medium">{selectedContrato.prazo_meses} meses</p>
                    {selectedContrato.ativo && (
                      <p className={cn(
                        "text-xs",
                        diasRestantes < 0 ? "text-destructive" : 
                        diasRestantes <= 30 ? "text-yellow-400" : "text-muted-foreground"
                      )}>
                        {diasRestantes < 0 
                          ? `Vencido há ${Math.abs(diasRestantes)} dias`
                          : `${diasRestantes} dias restantes`}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Valores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{formatCurrency(Number(selectedContrato.remuneracao_total))}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">MRR</p>
                    <p className="font-medium text-primary">{formatCurrency(Number(selectedContrato.remuneracao_mensal))}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Parcelas</p>
                    <p className="font-medium">{selectedContrato.parcelas}x</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="font-medium capitalize">{selectedContrato.tipo_vencimento}</p>
                  </div>
                </div>

                {/* Momento */}
                {selectedContrato.momento && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Momento</p>
                      <p className="font-medium">{selectedContrato.momento}</p>
                    </div>
                  </>
                )}

                {/* Particularidades */}
                {selectedContrato.particularidades && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Particularidades</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedContrato.particularidades}</p>
                    </div>
                  </>
                )}

                {/* Viagens e Despesas */}
                <Separator />
                <ViagensContrato
                  contratoId={selectedContrato.id}
                  clienteId={selectedContrato.cliente_id}
                  receitaTotal={Number(selectedContrato.remuneracao_total)}
                />

                {/* Ações */}
                <Separator />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditingContrato(selectedContrato);
                      setSelectedContrato(null);
                      setShowEditForm(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  {selectedContrato.ativo && (
                    <>
                      {(selectedContrato as any).pausado ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setRetomandoContrato(selectedContrato);
                            setSelectedContrato(null);
                            setShowRetomar(true);
                          }}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Retomar
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setPausandoContrato(selectedContrato);
                            setSelectedContrato(null);
                            setShowPausar(true);
                          }}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setProrrogandoContrato(selectedContrato);
                          setSelectedContrato(null);
                          setShowProrrogar(true);
                        }}
                      >
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Prorrogar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setRenovandoContrato(selectedContrato);
                          setSelectedContrato(null);
                          setShowRenovar(true);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Renovar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          setEncerrandoContrato(selectedContrato);
                          setSelectedContrato(null);
                          setShowEncerrar(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Encerrar
                      </Button>
                    </>
                  )}
                  {selectedContrato.link_contrato && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedContrato.link_contrato} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver Documento
                      </a>
                    </Button>
                  )}
                  <Button 
                    size="sm"
                    onClick={() => {
                      const clienteId = selectedContrato.cliente_id;
                      setSelectedContrato(null);
                      navigate(`/clientes/${clienteId}`);
                    }}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Ver Cliente
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setDeletingContrato(selectedContrato);
                      setSelectedContrato(null);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      {editingContrato && (
        <ContratoFormDialog
          open={showEditForm}
          onOpenChange={(open) => {
            setShowEditForm(open);
            if (!open) setEditingContrato(null);
          }}
          clienteId={editingContrato.cliente_id}
          contrato={editingContrato}
          consultorId={editingContrato.cliente?.consultor_id}
        />
      )}

      {/* Dialog de Encerramento */}
      {encerrandoContrato && (
        <EncerrarContratoDialog
          open={showEncerrar}
          onOpenChange={(open) => {
            setShowEncerrar(open);
            if (!open) setEncerrandoContrato(null);
          }}
          clienteId={encerrandoContrato.cliente_id}
          contrato={encerrandoContrato}
          onSuccess={() => setEncerrandoContrato(null)}
        />
      )}

      {/* Dialog de Renovação */}
      {renovandoContrato && (
        <RenovarContratoDialog
          open={showRenovar}
          onOpenChange={(open) => {
            setShowRenovar(open);
            if (!open) setRenovandoContrato(null);
          }}
          clienteId={renovandoContrato.cliente_id}
          contratoAtual={renovandoContrato}
          onSuccess={() => setRenovandoContrato(null)}
        />
      )}

      {/* Dialog de Pausar */}
      {pausandoContrato && (
        <PausaContratoDialog
          open={showPausar}
          onOpenChange={(open) => {
            setShowPausar(open);
            if (!open) setPausandoContrato(null);
          }}
          contratoId={pausandoContrato.id}
          clienteId={pausandoContrato.cliente_id}
          clienteNome={pausandoContrato.cliente?.nome || ''}
          onSuccess={() => setPausandoContrato(null)}
        />
      )}

      {/* Dialog de Retomar */}
      <RetomarContratoWrapper
        showRetomar={showRetomar}
        setShowRetomar={setShowRetomar}
        retomandoContrato={retomandoContrato}
        setRetomandoContrato={setRetomandoContrato}
      />

      {/* Dialog de Prorrogar */}
      {prorrogandoContrato && (
        <ProrrogarContratoDialog
          open={showProrrogar}
          onOpenChange={(open) => {
            setShowProrrogar(open);
            if (!open) setProrrogandoContrato(null);
          }}
          contratoId={prorrogandoContrato.id}
          clienteId={prorrogandoContrato.cliente_id}
          clienteNome={prorrogandoContrato.cliente?.nome || ''}
          dataFimAtual={prorrogandoContrato.data_fim}
          onSuccess={() => setProrrogandoContrato(null)}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
              Todos os dados relacionados (viagens, pausas, encerramentos e onboarding) também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingContrato(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingContrato) return;
                try {
                  await deleteContrato.mutateAsync({
                    contratoId: deletingContrato.id,
                    clienteId: deletingContrato.cliente_id
                  });
                  toast.success('Contrato excluído com sucesso');
                  setShowDeleteConfirm(false);
                  setDeletingContrato(null);
                } catch (error) {
                  toast.error('Erro ao excluir contrato');
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Wrapper component para o RetomarContratoDialog
function RetomarContratoWrapper({
  showRetomar,
  setShowRetomar,
  retomandoContrato,
  setRetomandoContrato,
}: {
  showRetomar: boolean;
  setShowRetomar: (show: boolean) => void;
  retomandoContrato: ContratoComCliente | null;
  setRetomandoContrato: (contrato: ContratoComCliente | null) => void;
}) {
  const { data: pausaAtiva } = usePausaAtiva(retomandoContrato?.id);

  if (!retomandoContrato || !pausaAtiva) return null;

  return (
    <RetomarContratoDialog
      open={showRetomar}
      onOpenChange={(open) => {
        setShowRetomar(open);
        if (!open) setRetomandoContrato(null);
      }}
      pausa={pausaAtiva}
      clienteNome={retomandoContrato.cliente?.nome || ''}
      dataFimContrato={retomandoContrato.data_fim}
      onSuccess={() => setRetomandoContrato(null)}
    />
  );
}
