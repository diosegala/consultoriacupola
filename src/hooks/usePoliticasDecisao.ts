import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PoliticaDecisao {
  id: string;
  tipo: string;
  parametros: Record<string, number>;
  ativo: boolean;
  versao: number;
  atualizado_em: string;
  atualizado_por: string | null;
}

export function usePoliticaDecisao(tipo: string) {
  return useQuery({
    queryKey: ['politicas-decisao', tipo],
    queryFn: async (): Promise<PoliticaDecisao | null> => {
      const { data, error } = await supabase
        .from('politicas_decisao')
        .select('id, tipo, parametros, ativo, versao, atualizado_em, atualizado_por')
        .eq('tipo', tipo)
        .eq('ativo', true)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PoliticaDecisao) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAtualizarPoliticaDecisao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      tipo,
      parametros,
      versao,
    }: {
      id: string;
      tipo: string;
      parametros: Record<string, number>;
      versao: number;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('politicas_decisao')
        .update({
          parametros,
          versao: versao + 1,
          atualizado_por: userData.user?.id ?? null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return { tipo };
    },
    onSuccess: ({ tipo }) => {
      queryClient.invalidateQueries({ queryKey: ['politicas-decisao', tipo] });
      queryClient.invalidateQueries({ queryKey: ['risco-engajamento'] });
      toast.success('Política atualizada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar política'),
  });
}
