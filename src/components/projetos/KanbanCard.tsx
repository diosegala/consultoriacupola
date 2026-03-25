import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, MessageSquarePlus } from 'lucide-react';
import type { Projeto } from '@/hooks/useProjetos';

interface KanbanCardProps {
  projeto: Projeto;
  index: number;
  onRegistrarReuniao: (projeto: Projeto) => void;
}

export function KanbanCard({ projeto, index, onRegistrarReuniao }: KanbanCardProps) {
  return (
    <Draggable draggableId={projeto.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card className={`mb-2 cursor-grab active:cursor-grabbing transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : 'hover:shadow-md'}`}>
            <CardContent className="p-3 space-y-2">
              <p className="font-medium text-sm leading-tight text-foreground">
                {projeto.clientes?.nome ?? 'Cliente'}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{projeto.clientes?.cidade}/{projeto.clientes?.uf}</span>
              </div>
              {projeto.consultores?.nome && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {projeto.consultores.nome}
                </Badge>
              )}
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
