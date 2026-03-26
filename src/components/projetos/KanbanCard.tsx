import { Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, MessageSquarePlus, CalendarIcon, CheckSquare, MessageSquare, Tag } from 'lucide-react';
import { format, isPast, addDays, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { Projeto } from '@/hooks/useProjetos';

export interface ProjetoCardTag {
  id: string;
  nome: string;
  cor: string;
}

interface KanbanCardProps {
  projeto: Projeto & {
    due_date?: string | null;
    _comentarios_count?: number;
    _checklist_done?: number;
    _checklist_total?: number;
    _reunioes_count?: number;
    _tags?: ProjetoCardTag[];
  };
  index: number;
  onRegistrarReuniao: (projeto: Projeto) => void;
  onClick: (projeto: Projeto) => void;
}

export function KanbanCard({ projeto, index, onRegistrarReuniao, onClick }: KanbanCardProps) {
  const dueDate = projeto.due_date ? new Date(projeto.due_date + 'T00:00:00') : null;
  const now = new Date();
  const isOverdue = dueDate && isPast(dueDate) && dueDate.toDateString() !== now.toDateString();
  const isSoon = dueDate && !isOverdue && isBefore(dueDate, addDays(now, 3));

  const checkDone = projeto._checklist_done ?? 0;
  const checkTotal = projeto._checklist_total ?? 0;
  const checkPercent = checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0;

  return (
    <Draggable draggableId={projeto.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
        >
          <div
            className={cn(
              'kanban-card p-3 space-y-2 cursor-grab active:cursor-grabbing',
              snapshot.isDragging && 'kanban-card-dragging'
            )}
            onClick={() => onClick(projeto)}
          >
            {/* Tags */}
            {projeto._tags && projeto._tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {projeto._tags.map(tag => (
                  <span
                    key={tag.id}
                    className="h-2 w-8 rounded-full block"
                    style={{ backgroundColor: tag.cor }}
                    title={tag.nome}
                  />
                ))}
              </div>
            )}

            <p className="font-medium text-sm leading-tight text-foreground">
              {projeto.clientes?.nome ?? 'Cliente'}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{projeto.clientes?.cidade}/{projeto.clientes?.uf}</span>
            </div>

            {/* Due date badge */}
            {dueDate && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-medium gap-1',
                  isOverdue && 'bg-destructive/15 text-destructive border-destructive/30',
                  isSoon && 'bg-warning/15 text-yellow-600 border-yellow-600/30',
                  !isOverdue && !isSoon && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {dueDateStart && dueDate
                  ? `${format(dueDateStart, 'dd/MM')} - ${format(dueDate, 'dd/MM')}`
                  : format(dueDate, 'dd/MM/yyyy')}
              </Badge>
            )}

            {/* Checklist progress bar */}
            {checkTotal > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <CheckSquare className="h-3 w-3" />
                    {checkDone}/{checkTotal}
                  </span>
                </div>
                <Progress value={checkPercent} className="h-1.5" />
              </div>
            )}

            {/* Bottom indicators */}
            <div className="flex items-center gap-2 flex-wrap">
              {projeto.consultores?.nome && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {projeto.consultores.nome}
                </Badge>
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
          </div>
        </div>
      )}
    </Draggable>
  );
}
