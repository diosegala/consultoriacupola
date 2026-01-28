import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Search, Eye, Filter, X } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { useAllContratos, AllContratosFilters, ContratoComCliente } from '@/hooks/useContratos';
import { useConsultores } from '@/hooks/useConsultores';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
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

export default function Contratos() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AllContratosFilters>({
    ativo: 'all',
    vencimento: 'all',
  });
  const [searchInput, setSearchInput] = useState('');

  const { data: contratos, isLoading } = useAllContratos({
    ...filters,
    search: searchInput,
  });
  const { data: consultores } = useConsultores();
  const { data: tiposConsultoria } = useTiposConsultoria();

  // Calcular KPIs
  const kpis = useMemo(() => {
    if (!contratos) return { ativos: 0, vencendo30: 0, vencidos: 0, mrrTotal: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let ativos = 0;
    let vencendo30 = 0;
    let vencidos = 0;
    let mrrTotal = 0;

    contratos.forEach(c => {
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
  }, [contratos]);

  const handleClearFilters = () => {
    setFilters({ ativo: 'all', vencimento: 'all' });
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Status</TableHead>
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
                      <TableRow key={contrato.id}>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/clientes/${contrato.cliente_id}`)}
                            className="font-medium hover:text-primary transition-colors text-left"
                          >
                            {contrato.cliente?.nome || 'Cliente não encontrado'}
                          </button>
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
                            onClick={() => navigate(`/clientes/${contrato.cliente_id}`)}
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
    </div>
  );
}
