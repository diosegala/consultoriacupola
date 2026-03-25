import { KanbanBoard } from '@/components/projetos/KanbanBoard';
import { Kanban } from 'lucide-react';

export default function Projetos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Kanban className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe a evolução dos projetos de consultoria</p>
        </div>
      </div>
      <KanbanBoard />
    </div>
  );
}
