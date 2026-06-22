import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChecklistResponsavelRow {
  id: string;
  checklist_item_id: string;
  consultor_id: string;
  consultor?: { id: string; nome: string } | null;
}

/**
 * Lista todos os responsáveis dos itens de checklist de um projeto.
 * Uma única query por projeto, agrupada por item no consumidor.
 */
export function useChecklistResponsaveisByProjeto(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto_checklist_responsaveis', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      if (!projetoId) return [] as ChecklistResponsavelRow[];
      // Buscar IDs dos itens primeiro
      const { data: itens, error: e1 } = await supabase
        .from('projeto_checklist')
        .select('id')
        .eq('projeto_id', projetoId);
      if (e1) throw e1;
      const ids = (itens ?? []).map(i => i.id);
      if (ids.length === 0) return [] as ChecklistResponsavelRow[];
      const { data, error } = await supabase
        .from('projeto_checklist_responsaveis')
        .select('id, checklist_item_id, consultor_id, consultores(id, nome)')
        .in('checklist_item_id', ids);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        checklist_item_id: r.checklist_item_id,
        consultor_id: r.consultor_id,
        consultor: r.consultores ?? null,
      })) as ChecklistResponsavelRow[];
    },
  });
}

export function useAddChecklistResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklist_item_id, consultor_id, projeto_id }: { checklist_item_id: string; consultor_id: string; projeto_id: string }) => {
      const { error } = await supabase
        .from('projeto_checklist_responsaveis')
        .insert({ checklist_item_id, consultor_id });
      if (error && !error.message.includes('duplicate')) throw error;
      return projeto_id;
    },
    onSuccess: (projeto_id) => {
      qc.invalidateQueries({ queryKey: ['projeto_checklist_responsaveis', projeto_id] });
      qc.invalidateQueries({ queryKey: ['projetos'] });
      qc.invalidateQueries({ queryKey: ['minhas_tarefas'] });
    },
  });
}

export function useRemoveChecklistResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklist_item_id, consultor_id, projeto_id }: { checklist_item_id: string; consultor_id: string; projeto_id: string }) => {
      const { error } = await supabase
        .from('projeto_checklist_responsaveis')
        .delete()
        .eq('checklist_item_id', checklist_item_id)
        .eq('consultor_id', consultor_id);
      if (error) throw error;
      return projeto_id;
    },
    onSuccess: (projeto_id) => {
      qc.invalidateQueries({ queryKey: ['projeto_checklist_responsaveis', projeto_id] });
      qc.invalidateQueries({ queryKey: ['projetos'] });
      qc.invalidateQueries({ queryKey: ['minhas_tarefas'] });
    },
  });
}