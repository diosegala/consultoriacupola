import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, MessageSquarePlus, CalendarIcon, CheckSquare, MessageSquare } from 'lucide-react';
import { format, isPast, addDays, isAfter, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Projeto } from '@/hooks/useProjetos';

interface KanbanCardProps {
  projeto: Projeto & { due_date?: string | null; _comentarios_count?: number; _checklist_done?: number; _checklist_total?: number; _reunioes_count?: number };
  index: number;
  onRegistrarReuniao: (projeto: Projeto) => void;
  onClick: (projeto: Projeto) => void;
}

export function KanbanCard({ projeto, index, onRegistrarReuniao, onClick }: KanbanCardProps) {
  const dueDate = projeto.due_date ? new Date(projeto.due_date + 'T00:00:00') : null;
  const now = new Date();
  const isOverdue = dueDate && isPast(dueDate) && dueDate.toDateString() !== now.toDateString();
  const isSoon = dueDate && !isOverdue && isBefore(dueDate, addDays(now, 3));

  return (
    <Draggable draggableId={projeto.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card
            className={cn(
              'mb-2 cursor-grab active:cursor-grabbing transition-shadow',
              snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : 'hover:shadow-md'
            )}
            onClick={() => onClick(projeto)}
          >
            <CardContent className="p-3 space-y-2">
              <p className="font-medium text-sm leading-tight text-foreground">
                {projeto.clientes?.nome ?? 'Cliente'}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{projeto.clientes?.cidade}/{projeto.clientes?.uf}</span>
              </div>

              {/* Due date */}
              {dueDate && (
                <div className={cn(
                  'flex items-center gap-1 text-[10px] font-medium',
                  isOverdue ? 'text-destructive' : isSoon ? 'text-yellow-600' : 'text-muted-foreground'
                )}>
                  <CalendarIcon className="h-3 w-3" />
                  {format(dueDate, 'dd/MM/yyyy')}
                </div>
              )}

              {/* Indicators row */}
              <div className="flex items-center gap-2 flex-wrap">
                {projeto.consultores?.nome && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {projeto.consultores.nome}
                  </Badge>
                )}
                {(projeto._checklist_total ?? 0) > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <CheckSquare className="h-3 w-3" />
                    {projeto._checklist_done ?? 0}/{projeto._checklist_total}
                  </span>
                )}
                {(projeto._comentarios_count ?? 0) > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" />
                    {projeto._comentarios_count}
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegistrarReuniao(projeto);
                }}
              >
                <MessageSquarePlus className="h-3 w-3 mr-1" />
                Registrar Reunião
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}
