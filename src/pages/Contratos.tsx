import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Search, Eye, X, ExternalLink, Calendar, DollarSign, User, Building, Pencil, ArrowUpDown, ArrowUp, ArrowDown, XCircle, RefreshCw } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import { useAllContratos, AllContratosFilters, ContratoComCliente } from '@/hooks/useContratos';
import { useConsultores } from '@/hooks/useConsultores';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
import { ContratoFormDialog, EncerrarContratoDialog, RenovarContratoDialog } from '@/components/cliente/ClienteDialogs';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getContratoStatusInfo(contrato: ContratoComCliente) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dataFim = new Date(contrato.data_fim);
  const diasRestantes = differenceInDays(dataFim, today);

  if (!contrato.ativo) {
    return { label: 'Inativo', variant: 'secondary' as const, color: 'bg-muted text-muted-foreground' };
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
  const [sortField, setSortField] = useState<ContratoSortField>('cliente');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data: contratosRaw, isLoading } = useAllContratos({
    ...filters,
    search: searchInput,
  });
  const { data: consultores } = useConsultores();
  const { data: tiposConsultoria } = useTiposConsultoria();

  // Ordenar contratos
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

  // Calcular KPIs
  const kpis = useMemo(() => {
    if (!contratosRaw) return { ativos: 0, vencendo30: 0, vencidos: 0, mrrTotal: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let ativos = 0;
    let vencendo30 = 0;
    let vencidos = 0;
    let mrrTotal = 0;

    contratosRaw.forEach(c => {
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
  }, [contratosRaw]);

  const handleClearFilters = () => {
    setFilters({ ativo: true, vencimento: 'all' });
    setSearchInput('');
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#b0f90a]">{kpis.ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencendo (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">{kpis.vencendo30}</p>
          </CardContent>
        </Card>
        <Card>
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

                {/* Ações */}
                <Separator />
                <div className="flex gap-2 justify-end">
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
    </div>
  );
}
