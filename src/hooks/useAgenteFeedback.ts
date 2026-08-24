import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const MARCADORES_FEEDBACK = [
  'Genérico demais',
  'Faltou dado do cliente',
  'Tom errado',
  'Seção incompleta',
  'Estrutura fora do padrão',
  'Longo demais',
  'Excelente',
] as const;

export interface AgenteFeedback {
  id: string;
  documento_id: string | null;
  tipo_agente: string;
  cliente_id: string | null;
  nota: number;
  marcadores: string[];
  comentario: string | null;
  user_id: string;
  consolidado_em: string | null;
  created_at: string;
}

export interface AgenteDiretriz {
  id: string;
  tipo_agente: string;
  conteudo: string;
  status: 'rascunho' | 'ativa' | 'arquivada';
  versao: number;
  origem: string;
  feedbacks_considerados: number;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
}

export function useFeedbacksDocumento(documentoId: string | undefined) {
  return useQuery({
    queryKey: ['agente_feedbacks', 'doc', documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agente_feedbacks' as any)
        .select('*')
        .eq('documento_id', documentoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as AgenteFeedback[];
    },
  });
}

export function useFeedbacksAgentes(tipoAgente?: string) {
  return useQuery({
    queryKey: ['agente_feedbacks', 'lista', tipoAgente ?? 'todos'],
    queryFn: async () => {
      let query = supabase
        .from('agente_feedbacks' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (tipoAgente) query = query.eq('tipo_agente', tipoAgente);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AgenteFeedback[];
    },
  });
}

export function useSalvarFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      tipo_agente: string;
      cliente_id?: string | null;
      nota: number;
      marcadores: string[];
      comentario?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Sessão não encontrada');
      const { error } = await supabase.from('agente_feedbacks' as any).insert({
        documento_id: params.documento_id,
        tipo_agente: params.tipo_agente,
        cliente_id: params.cliente_id ?? null,
        nota: params.nota,
        marcadores: params.marcadores,
        comentario: params.comentario?.trim() || null,
        user_id: userData.user.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agente_feedbacks'] });
      toast.success('Feedback registrado. Obrigado — ele ajuda o agente a melhorar.');
      void vars;
    },
    onError: (err: Error) => toast.error(`Erro ao salvar feedback: ${err.message}`),
  });
}

export function useMarcarComoExemplo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { documento_id: string; aprovado: boolean; conteudo_revisado?: string | null }) => {
      const payload: Record<string, unknown> = { aprovado_como_exemplo: params.aprovado };
      if (params.conteudo_revisado !== undefined) payload.conteudo_revisado = params.conteudo_revisado;
      const { error } = await supabase
        .from('projeto_documentos' as any)
        .update(payload)
        .eq('id', params.documento_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cliente_documentos'] });
      queryClient.invalidateQueries({ queryKey: ['projeto_documentos'] });
      toast.success(vars.aprovado ? 'Documento marcado como versão aprovada de referência.' : 'Marcação removida.');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDiretrizes(tipoAgente?: string) {
  return useQuery({
    queryKey: ['agente_diretrizes', tipoAgente ?? 'todos'],
    queryFn: async () => {
      let query = supabase
        .from('agente_diretrizes' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (tipoAgente) query = query.eq('tipo_agente', tipoAgente);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AgenteDiretriz[];
    },
  });
}

export function useAtualizarDiretriz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; conteudo?: string; status?: AgenteDiretriz['status'] }) => {
      const payload: Record<string, unknown> = {};
      if (params.conteudo !== undefined) payload.conteudo = params.conteudo;
      if (params.status !== undefined) {
        payload.status = params.status;
        if (params.status === 'ativa') {
          const { data: userData } = await supabase.auth.getUser();
          payload.aprovado_por = userData.user?.id ?? null;
          payload.aprovado_em = new Date().toISOString();
        }
      }
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from('agente_diretrizes' as any).update(payload).eq('id', params.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agente_diretrizes'] }),
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useCriarDiretriz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tipo_agente: string; conteudo: string }) => {
      const { error } = await supabase.from('agente_diretrizes' as any).insert({
        tipo_agente: params.tipo_agente,
        conteudo: params.conteudo,
        status: 'ativa',
        origem: 'manual',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agente_diretrizes'] });
      toast.success('Diretriz criada e ativada.');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useExcluirDiretriz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agente_diretrizes' as any).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agente_diretrizes'] }),
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useConsolidarFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tipoAgente: string) => {
      const { data, error } = await supabase.functions.invoke('consolidar-feedback-agentes', {
        body: { tipo_agente: tipoAgente },
      });
      if (error) {
        let message = error.message || 'Erro ao consolidar feedbacks';
        const response = (error as any)?.context;
        if (response && typeof response.json === 'function') {
          try {
            const body = await response.json();
            if (typeof body?.error === 'string') message = body.error;
          } catch { /* mantém */ }
        }
        throw new Error(message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { diretrizes: AgenteDiretriz[]; feedbacks_considerados: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agente_diretrizes'] });
      queryClient.invalidateQueries({ queryKey: ['agente_feedbacks'] });
      toast.success(`${data.diretrizes?.length ?? 0} diretrizes propostas a partir de ${data.feedbacks_considerados} feedbacks. Revise e aprove.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
