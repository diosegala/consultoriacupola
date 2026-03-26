import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjetoTag {
  id: string;
  nome: string;
  cor: string;
  created_at: string;
}

export const TAG_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#e11d48',
];

export function useProjetoTags() {
  return useQuery({
    queryKey: ['projeto_tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tags')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as ProjetoTag[];
    },
  });
}

export function useProjetoTagVinculos(projetoId?: string) {
  return useQuery({
    queryKey: ['projeto_tag_vinculo', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tag_vinculo')
        .select('*, projeto_tags(*)')
        .eq('projeto_id', projetoId!);
      if (error) throw error;
      return data as Array<{ id: string; projeto_id: string; tag_id: string; projeto_tags: ProjetoTag }>;
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor: string }) => {
      const { data, error } = await supabase
        .from('projeto_tags')
        .insert({ nome, cor })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeto_tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto_tags'] });
      qc.invalidateQueries({ queryKey: ['projeto_tag_vinculo'] });
    },
  });
}

export function useAddTagToProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projeto_id, tag_id }: { projeto_id: string; tag_id: string }) => {
      const { error } = await supabase.from('projeto_tag_vinculo').insert({ projeto_id, tag_id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projeto_tag_vinculo', vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}

export function useRemoveTagFromProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projeto_id, tag_id }: { projeto_id: string; tag_id: string }) => {
      const { error } = await supabase
        .from('projeto_tag_vinculo')
        .delete()
        .eq('projeto_id', projeto_id)
        .eq('tag_id', tag_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projeto_tag_vinculo', vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}
