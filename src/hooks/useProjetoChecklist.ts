import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjetoChecklistItem {
  id: string;
  projeto_id: string;
  titulo: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
}

export function useProjetoChecklist(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto_checklist', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_checklist')
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('ordem')
        .order('created_at');
      if (error) throw error;
      return data as ProjetoChecklistItem[];
    },
  });
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projeto_id, titulo, ordem }: { projeto_id: string; titulo: string; ordem?: number }) => {
      const { error } = await supabase
        .from('projeto_checklist')
        .insert({ projeto_id, titulo, ordem: ordem ?? 0 });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projeto_checklist', vars.projeto_id] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}

export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, concluido, projeto_id }: { id: string; concluido: boolean; projeto_id: string }) => {
      const { error } = await supabase
        .from('projeto_checklist')
        .update({ concluido })
        .eq('id', id);
      if (error) throw error;
      return projeto_id;
    },
    onSuccess: (projeto_id) => {
      queryClient.invalidateQueries({ queryKey: ['projeto_checklist', projeto_id] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projeto_id }: { id: string; projeto_id: string }) => {
      const { error } = await supabase
        .from('projeto_checklist')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return projeto_id;
    },
    onSuccess: (projeto_id) => {
      queryClient.invalidateQueries({ queryKey: ['projeto_checklist', projeto_id] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}
