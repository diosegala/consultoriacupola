import { useState, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { useProjetosEtapas, useProjetos, useMoverProjeto, type Projeto } from '@/hooks/useProjetos';
import { NovaReuniaoDialog } from '@/components/consultor/NovaReuniaoDialog';
import { NovoProjetoDialog } from './NovoProjetoDialog';
import { VincularConsultorDialog } from './VincularConsultorDialog';
import { ProjetoDetalheSheet } from './ProjetoDetalheSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users } from 'lucide-react';
import { useConsultores } from '@/hooks/useConsultores';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useAuth } from '@/contexts/AuthContext';

export function KanbanBoard() {
  const { isAdmin, userRole } = useAuth();
  const isConsultor = userRole === 'consultor';

  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');
  const [reuniaoDialogOpen, setReuniaoDialogOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [novoProjetoOpen, setNovoProjetoOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProjeto, setSheetProjeto] = useState<Projeto | null>(null);

  const { data: myConsultorId } = useMyConsultorId();
  const { data: etapas, isLoading: loadingEtapas } = useProjetosEtapas();
  const consultorFilter = isConsultor ? myConsultorId ?? undefined : (filtroConsultor !== 'todos' ? filtroConsultor : undefined);
  const { data: projetos, isLoading: loadingProjetos } = useProjetos(consultorFilter);
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

  const handleCardClick = useCallback((projeto: Projeto) => {
    setSheetProjeto(projeto);
    setSheetOpen(true);
  }, []);

  const getEtapaNome = (etapaId: string) => etapas?.find(e => e.id === etapaId)?.nome;

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
      <div className="flex items-center gap-3 flex-wrap">
        {!isConsultor && (
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
        )}

        <Button size="sm" onClick={() => setNovoProjetoOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Projeto
        </Button>

        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setVincularOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Vincular Consultores
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {(etapas ?? []).map((etapa) => (
            <KanbanColumn
              key={etapa.id}
              etapa={etapa}
              projetos={projetosByEtapa(etapa.id)}
              onRegistrarReuniao={handleRegistrarReuniao}
              onCardClick={handleCardClick}
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

      <NovoProjetoDialog open={novoProjetoOpen} onOpenChange={setNovoProjetoOpen} />
      <VincularConsultorDialog open={vincularOpen} onOpenChange={setVincularOpen} />

      <ProjetoDetalheSheet
        projeto={sheetProjeto}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        etapaNome={sheetProjeto ? getEtapaNome(sheetProjeto.etapa_id) : undefined}
        onRegistrarReuniao={handleRegistrarReuniao}
      />
    </div>
  );
}
