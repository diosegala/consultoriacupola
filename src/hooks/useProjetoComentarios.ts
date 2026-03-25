import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjetoComentario {
  id: string;
  projeto_id: string;
  user_id: string;
  texto: string;
  created_at: string;
}

export function useProjetoComentarios(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto_comentarios', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_comentarios')
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ProjetoComentario[];
    },
  });
}

export function useCreateComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projeto_id, user_id, texto }: { projeto_id: string; user_id: string; texto: string }) => {
      const { error } = await supabase
        .from('projeto_comentarios')
        .insert({ projeto_id, user_id, texto });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projeto_comentarios', vars.projeto_id] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}

export function useDeleteComentario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projeto_id }: { id: string; projeto_id: string }) => {
      const { error } = await supabase
        .from('projeto_comentarios')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return projeto_id;
    },
    onSuccess: (projeto_id) => {
      queryClient.invalidateQueries({ queryKey: ['projeto_comentarios', projeto_id] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}
