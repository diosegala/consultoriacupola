import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AgentePrompt {
  id: string;
  tipo: string;
  prompt: string;
  documento_modelo: string | null;
  updated_at: string;
}

export function useAgentePrompts() {
  return useQuery({
    queryKey: ['agente-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agente_prompts')
        .select('*')
        .order('tipo');
      if (error) throw error;
      return data as AgentePrompt[];
    },
  });
}

export function useUpdateAgentePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, prompt, documento_modelo }: { id: string; prompt: string; documento_modelo?: string | null }) => {
      const { error } = await supabase
        .from('agente_prompts')
        .update({ prompt, documento_modelo: documento_modelo ?? null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agente-prompts'] });
    },
  });
}
