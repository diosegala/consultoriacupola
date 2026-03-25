import { useState, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { useProjetosEtapas, useProjetos, useMoverProjeto, type Projeto } from '@/hooks/useProjetos';
import { NovaReuniaoDialog } from '@/components/consultor/NovaReuniaoDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConsultores } from '@/hooks/useConsultores';
import { useAuth } from '@/contexts/AuthContext';

export function KanbanBoard() {
  const { isAdmin, userRole } = useAuth();
  const isConsultor = userRole === 'consultor';

  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');
  const [reuniaoDialogOpen, setReuniaoDialogOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);

  const { data: etapas, isLoading: loadingEtapas } = useProjetosEtapas();
  const { data: projetos, isLoading: loadingProjetos } = useProjetos(
    isConsultor ? undefined : (filtroConsultor !== 'todos' ? filtroConsultor : undefined)
  );
  const { data: consultores } = useConsultores();
  const moverProjeto = useMoverProjeto();

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    moverProjeto.mutate({
      projetoId: draggableId,
      etapaId: destination.droppableId,
      ordemNaEtapa: destination.index,
    });
  }, [moverProjeto]);

  const handleRegistrarReuniao = useCallback((projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setReuniaoDialogOpen(true);
  }, []);

  if (loadingEtapas || loadingProjetos) {
    return (
      <div className="flex gap-4 overflow-x-auto p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="min-w-[280px] h-[400px] rounded-lg" />
        ))}
      </div>
    );
  }

  const projetosByEtapa = (etapaId: string) =>
    (projetos ?? [])
      .filter((p) => p.etapa_id === etapaId)
      .sort((a, b) => a.ordem_na_etapa - b.ordem_na_etapa);

  return (
    <div className="space-y-4">
      {!isConsultor && (
        <div className="flex items-center gap-3">
          <Select value={filtroConsultor} onValueChange={setFiltroConsultor}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrar por consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os consultores</SelectItem>
              {consultores?.filter(c => c.ativo).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {(etapas ?? []).map((etapa) => (
            <KanbanColumn
              key={etapa.id}
              etapa={etapa}
              projetos={projetosByEtapa(etapa.id)}
              onRegistrarReuniao={handleRegistrarReuniao}
            />
          ))}
        </div>
      </DragDropContext>

      {selectedProjeto && (
        <NovaReuniaoDialog
          open={reuniaoDialogOpen}
          onOpenChange={setReuniaoDialogOpen}
          consultorId={selectedProjeto.consultor_id}
        />
      )}
    </div>
  );
}
