import { Droppable } from '@hello-pangea/dnd';
import { KanbanCard } from './KanbanCard';
import type { ProjetoEtapa, Projeto } from '@/hooks/useProjetos';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanColumnProps {
  etapa: ProjetoEtapa;
  projetos: Projeto[];
  onRegistrarReuniao: (projeto: Projeto) => void;
  onCardClick: (projeto: Projeto) => void;
}

export function KanbanColumn({ etapa, projetos, onRegistrarReuniao, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/50 rounded-lg">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground truncate">{etapa.nome}</h3>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {projetos.length}
          </span>
        </div>
      </div>
      <Droppable droppableId={etapa.id}>
        {(provided, snapshot) => (
          <ScrollArea className="flex-1">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-2 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
            >
              {projetos.map((projeto, index) => (
                <KanbanCard
                  key={projeto.id}
                  projeto={projeto}
                  index={index}
                  onRegistrarReuniao={onRegistrarReuniao}
                />
              ))}
              {provided.placeholder}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  );
}
