import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, ListChecks, ClipboardList, Loader2, UserPlus, Send } from 'lucide-react';
import { format, isPast, isToday, addDays, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMinhasTarefasChecklist, useMinhasTarefasTodo, useTarefasAtribuidasPorMim, useConsultoresAtribuiveis } from '@/hooks/useMinhasTarefas';
import { useToggleChecklistItem } from '@/hooks/useProjetoChecklist';
import { useCreateTodoPessoal, useUpdateTodoPessoal, useDeleteTodoPessoal } from '@/hooks/useTodoPessoal';
import { useAuth } from '@/contexts/AuthContext';

type FiltroStatus = 'aberto' | 'concluido' | 'todos';
type FiltroPrazo = 'todos' | 'vencidos' | 'hoje' | 'proximos7' | 'sem_prazo';

function PrazoBadge({ due_date }: { due_date: string | null }) {
  if (!due_date) return <span className="text-[10px] text-muted-foreground">Sem prazo</span>;
  const d = new Date(due_date + 'T00:00:00');
  const overdue = isPast(d) && !isToday(d);
  const soon = !overdue && isBefore(d, addDays(new Date(), 4));
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] gap-1',
        overdue && 'bg-destructive/15 text-destructive border-destructive/30',
        soon && 'bg-warning/15 text-yellow-600 border-yellow-600/30',
      )}
    >
      <CalendarIcon className="h-3 w-3" />
      {format(d, 'dd/MM/yyyy')}
    </Badge>
  );
}

function aplicarFiltros<T extends { concluido: boolean; due_date: string | null }>(
  items: T[],
  status: FiltroStatus,
  prazo: FiltroPrazo,
  search: string,
  getText: (t: T) => string,
): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit7 = addDays(today, 7);
  return items.filter(t => {
    if (status === 'aberto' && t.concluido) return false;
    if (status === 'concluido' && !t.concluido) return false;
    if (prazo !== 'todos') {
      if (!t.due_date && prazo !== 'sem_prazo') return false;
      if (t.due_date) {
        const d = new Date(t.due_date + 'T00:00:00');
        if (prazo === 'vencidos' && !(d < today)) return false;
        if (prazo === 'hoje' && d.toDateString() !== today.toDateString()) return false;
        if (prazo === 'proximos7' && !(d >= today && d <= limit7)) return false;
        if (prazo === 'sem_prazo') return false;
      }
    }
    if (search.trim() && !getText(t).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

export default function MinhasTarefas() {
  const { data: checklistItens, isLoading: l1 } = useMinhasTarefasChecklist();
  const { data: todoItens, isLoading: l2 } = useMinhasTarefasTodo();

  const toggleChecklist = useToggleChecklistItem();
  const createTodo = useCreateTodoPessoal();
  const updateTodo = useUpdateTodoPessoal();
  const deleteTodo = useDeleteTodoPessoal();

  const [status, setStatus] = useState<FiltroStatus>('aberto');
  const [prazo, setPrazo] = useState<FiltroPrazo>('todos');
  const [search, setSearch] = useState('');
  const [novoTodo, setNovoTodo] = useState('');

  const checklistFiltrada = useMemo(
    () => aplicarFiltros(checklistItens ?? [], status, prazo, search, t => `${t.titulo} ${t.cliente_nome ?? ''}`),
    [checklistItens, status, prazo, search],
  );
  const todosFiltrados = useMemo(
    () => aplicarFiltros(todoItens ?? [], status, prazo, search, t => `${t.titulo} ${t.cliente_nome ?? ''}`),
    [todoItens, status, prazo, search],
  );

  const isLoading = l1 || l2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas tarefas</h1>
        <p className="text-sm text-muted-foreground">Itens de checklist atribuídos a você e seu to-do pessoal.</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título ou cliente..." className="h-9" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as FiltroStatus)}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="concluido">Concluídas</SelectItem>
                <SelectItem value="todos">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prazo</label>
            <Select value={prazo} onValueChange={(v) => setPrazo(v as FiltroPrazo)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
                <SelectItem value="hoje">Vence hoje</SelectItem>
                <SelectItem value="proximos7">Próximos 7 dias</SelectItem>
                <SelectItem value="sem_prazo">Sem prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checklist">
        <TabsList>
          <TabsTrigger value="checklist">
            <ListChecks className="h-4 w-4 mr-2" />
            Checklist ({checklistFiltrada.length})
          </TabsTrigger>
          <TabsTrigger value="todo">
            <ClipboardList className="h-4 w-4 mr-2" />
            To-do pessoal ({todosFiltrados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens atribuídos a você</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
              {!isLoading && checklistFiltrada.length === 0 && (
                <p className="text-sm text-muted-foreground">Nada por aqui.</p>
              )}
              <div className="space-y-2">
                {checklistFiltrada.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-md border border-border/50">
                    <Checkbox
                      checked={t.concluido}
                      onCheckedChange={(v) => toggleChecklist.mutate({ id: t.checklist_item_id, concluido: !!v, projeto_id: t.projeto_id })}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', t.concluido && 'line-through text-muted-foreground')}>
                        {t.titulo}
                      </p>
                      {t.cliente_nome && (
                        <p className="text-[10px] text-muted-foreground">{t.cliente_nome}</p>
                      )}
                    </div>
                    <PrazoBadge due_date={t.due_date} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="todo" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Seu to-do pessoal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Nova tarefa pessoal (sem vínculo de projeto)..."
                  value={novoTodo}
                  onChange={e => setNovoTodo(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && novoTodo.trim()) {
                      createTodo.mutate({ titulo: novoTodo.trim() });
                      setNovoTodo('');
                    }
                  }}
                  className="h-9"
                />
                <Button
                  onClick={() => {
                    if (!novoTodo.trim()) return;
                    createTodo.mutate({ titulo: novoTodo.trim() });
                    setNovoTodo('');
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {!isLoading && todosFiltrados.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>
              )}
              <div className="space-y-2">
                {todosFiltrados.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-md border border-border/50 group">
                    <Checkbox
                      checked={t.concluido}
                      onCheckedChange={(v) => updateTodo.mutate({ id: t.id, concluido: !!v })}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', t.concluido && 'line-through text-muted-foreground')}>
                        {t.titulo}
                      </p>
                      {t.cliente_nome && (
                        <p className="text-[10px] text-muted-foreground">{t.cliente_nome}</p>
                      )}
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {t.due_date ? format(new Date(t.due_date + 'T00:00:00'), 'dd/MM/yy') : 'Prazo'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={t.due_date ? new Date(t.due_date + 'T00:00:00') : undefined}
                          onSelect={(d) => updateTodo.mutate({ id: t.id, due_date: d ? format(d, 'yyyy-MM-dd') : null })}
                          className="p-3 pointer-events-auto"
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteTodo.mutate({ id: t.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}