import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProjetoDocumento {
  id: string;
  projeto_id: string | null;
  cliente_id: string | null;
  tipo: string;
  conteudo: string;
  gdoc_url: string | null;
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

/**
 * Busca documentos vinculados diretamente ao cliente (aba Agentes em ClienteDetalhe).
 * Não inclui documentos vinculados via projeto — use `useDocumentosCliente` para consolidado.
 */
export function useClienteDocumentos(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente_documentos', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_documentos' as any)
        .select('*')
        .eq('cliente_id', clienteId!)
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
    mutationFn: async (params: {
      tipo: string;
      projeto_id?: string;
      cliente_id?: string;
      contexto_usuario?: string;
      transcricoes_textos?: Array<{ label?: string; conteudo: string }>;
      questionario_data?: Record<string, unknown> | null;
      anotacoes_consultor?: string;
      trimestre?: string;
      canais_atendimento?: string[];
      titulo_doc?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('agente-projeto', {
        body: params,
      });

      if (error) {
        let message = error.message || 'Erro ao gerar documento';
        const response = (error as any)?.context;
        if (response && typeof response.json === 'function') {
          try {
            const body = await response.json();
            if (typeof body?.error === 'string') message = body.error;
          } catch {
            // mantém a mensagem original
          }
        } else if (typeof error.message === 'string' && error.message.includes('{')) {
          try {
            const parsed = JSON.parse(error.message.slice(error.message.indexOf('{')));
            message = parsed.error ?? error.message;
          } catch {
            message = error.message;
          }
        }
        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);
      return data as { conteudo: string; gdoc_url: string | null };
    },
    onSuccess: (_, vars) => {
      if (vars.projeto_id) {
        queryClient.invalidateQueries({ queryKey: ['projeto_documentos', vars.projeto_id] });
      }
      if (vars.cliente_id) {
        queryClient.invalidateQueries({ queryKey: ['cliente_documentos', vars.cliente_id] });
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar documento: ${err.message}`);
    },
  });
}

export interface AgenteRascunhoRecord<T = Record<string, unknown>> {
  id: string;
  cliente_id: string;
  estado: T;
  updated_at: string;
}

export function useAgenteRascunho<T = Record<string, unknown>>(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['agentes_ia_rascunho', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agentes_ia_rascunhos' as any)
        .select('id, cliente_id, estado, updated_at')
        .eq('cliente_id', clienteId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AgenteRascunhoRecord<T> | null;
    },
  });
}

export function useSalvarAgenteRascunho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { cliente_id: string; estado: Record<string, unknown> }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Sessão não encontrada para salvar rascunho');

      const { data, error } = await supabase
        .from('agentes_ia_rascunhos' as any)
        .upsert(
          {
            user_id: userData.user.id,
            cliente_id: params.cliente_id,
            estado: params.estado,
          },
          { onConflict: 'user_id,cliente_id' },
        )
        .select('id, cliente_id, estado, updated_at')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agentes_ia_rascunho', vars.cliente_id] });
    },
  });
}

export function useLimparAgenteRascunho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase
        .from('agentes_ia_rascunhos' as any)
        .delete()
        .eq('cliente_id', clienteId);
      if (error) throw error;
    },
    onSuccess: (_, clienteId) => {
      queryClient.invalidateQueries({ queryKey: ['agentes_ia_rascunho', clienteId] });
    },
  });
}
