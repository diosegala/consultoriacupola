import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProjetoDocumento {
  id: string;
  projeto_id: string;
  tipo: string;
  conteudo: string;
  created_by: string | null;
  created_at: string;
}

export function useProjetoDocumentos(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto_documentos', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_documentos' as any)
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ProjetoDocumento[];
    },
  });
}

export function useParseDocumento() {
  return useMutation({
    mutationFn: async (params: { tipo?: string; conteudo_base64?: string; nome_arquivo?: string; gdrive_url?: string }) => {
      const { data, error } = await supabase.functions.invoke('parse-documento', {
        body: params,
      });
      if (error) throw new Error(error.message || 'Erro ao processar documento');
      if (data?.error) throw new Error(data.error);
      return data.texto as string;
    },
    onError: (err: Error) => {
      toast.error(`Erro ao processar arquivo: ${err.message}`);
    },
  });
}

export function useGerarDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tipo, projeto_id, contexto_usuario }: { tipo: string; projeto_id: string; contexto_usuario?: string }) => {
      const { data, error } = await supabase.functions.invoke('agente-projeto', {
        body: { tipo, projeto_id, contexto_usuario },
      });

      if (error) {
        const message = typeof error.message === 'string' && error.message.includes('{')
          ? (() => {
              try {
                const parsed = JSON.parse(error.message.slice(error.message.indexOf('{')));
                return parsed.error ?? error.message;
              } catch {
                return error.message;
              }
            })()
          : error.message;
        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);
      return data.conteudo as string;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projeto_documentos', vars.projeto_id] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar documento: ${err.message}`);
    },
  });
}
