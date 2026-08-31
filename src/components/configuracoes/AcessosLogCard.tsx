import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, History, RefreshCw, CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAcessosLog } from '@/hooks/useAcessosLog';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function resumirUserAgent(ua: string | null) {
  if (!ua) return '—';
  const nav = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Outro';
  const so = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return so ? `${nav} · ${so}` : nav;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AcessosLogCard() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [emailInput, setEmailInput] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  useEffect(() => {
    const t = setTimeout(() => setEmailFilter(emailInput), 400);
    return () => clearTimeout(t);
  }, [emailInput]);

  useEffect(() => {
    setPage(1);
  }, [emailFilter, dateRange.from, dateRange.to, pageSize]);

  const filters = useMemo(
    () => ({
      email: emailFilter,
      startDate: dateRange.from,
      endDate: dateRange.to,
    }),
    [emailFilter, dateRange.from, dateRange.to]
  );

  const { data, isLoading, refetch, isFetching } = useAcessosLog(
    true,
    page,
    pageSize,
    filters
  );

  const total = data?.count ?? 0;
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);

  const applyPreset = (days: number | null) => {
    if (days === null) {
      setDateRange({});
      return;
    }
    const to = endOfDay(new Date());
    const from = startOfDay(subDays(new Date(), days));
    setDateRange({ from, to });
  };

  const dateLabel = useMemo(() => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd/MM/yy')} → ${format(dateRange.to, 'dd/MM/yy')}`;
    }
    if (dateRange.from) {
      return `A partir de ${format(dateRange.from, 'dd/MM/yy')}`;
    }
    if (dateRange.to) {
      return `Até ${format(dateRange.to, 'dd/MM/yy')}`;
    }
    return 'Selecionar período';
  }, [dateRange]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5 text-primary" />
            Log de Acessos
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1">
              <Button
                variant={dateRange.from && dateRange.to && dateRange.from.getTime() === startOfDay(new Date()).getTime() ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(0)}
              >
                Hoje
              </Button>
              <Button
                variant={dateRange.from && dateRange.to && dateRange.from.getTime() === startOfDay(subDays(new Date(), 6)).getTime() ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(6)}
              >
                7 dias
              </Button>
              <Button
                variant={dateRange.from && dateRange.to && dateRange.from.getTime() === startOfDay(subDays(new Date(), 29)).getTime() ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(29)}
              >
                30 dias
              </Button>
              <Button
                variant={!dateRange.from && !dateRange.to ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(null)}
              >
                Todo período
              </Button>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{dateLabel}</span>
                  <span className="sm:hidden">Período</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(r) => setDateRange({ from: r?.from, to: r?.to })}
                  locale={ptBR}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>

            <div className="relative">
              <Input
                placeholder="Filtrar por e-mail"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-9 w-[200px] bg-input border-border pr-8"
              />
              {emailInput && (
                <button
                  onClick={() => { setEmailInput(''); setEmailFilter(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm px-6 pb-6">Nenhum acesso registrado para os filtros selecionados.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Usuário</TableHead>
                  <TableHead className="text-muted-foreground">Evento</TableHead>
                  <TableHead className="text-muted-foreground">Dispositivo</TableHead>
                  <TableHead className="text-muted-foreground">Data e hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(acesso => (
                  <TableRow key={acesso.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{acesso.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={acesso.evento === 'login'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'}>
                        {acesso.evento === 'login' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{resumirUserAgent(acesso.user_agent)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(acesso.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {total === 0 ? '0 registros' : `${fromRow}–${toRow} de ${total} registros`}
                </span>
                <div className="flex items-center gap-2">
                  <span>Exibir</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => setPageSize(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-[70px] bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>por página</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isFetching}
                >
                  Próxima <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
