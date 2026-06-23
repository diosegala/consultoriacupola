import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuestionarioRow {
  id: string;
  cliente_id: string;
  template_id: string;
  token: string;
  status: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'arquivado';
  progresso_pct: number;
  respostas: Record<string, unknown>;
  ultimo_salvamento_em: string | null;
  concluido_em: string | null;
  iniciado_em: string | null;
  created_at: string;
}

export function useQuestionarioCliente(clienteId?: string) {
  return useQuery({
    queryKey: ['questionario', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from('questionarios' as any)
        .select('*')
        .eq('cliente_id', clienteId)
        .neq('status', 'arquivado')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as QuestionarioRow | null;
    },
    enabled: !!clienteId,
  });
}

export function useTemplateAtivo() {
  return useQuery({
    queryKey: ['questionario-template-ativo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionarios_template' as any)
        .select('id, nome, estrutura, versao')
        .eq('ativo', true)
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useCriarQuestionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteId, templateId }: { clienteId: string; templateId: string }) => {
      const { data, error } = await supabase
        .from('questionarios' as any)
        .insert({ cliente_id: clienteId, template_id: templateId })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as QuestionarioRow;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['questionario', v.clienteId] });
    },
  });
}

export function useRegenerarToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionarioId: string) => {
      const { data, error } = await supabase
        .from('questionarios' as any)
        .update({ token: crypto.randomUUID() })
        .eq('id', questionarioId)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as QuestionarioRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questionario'] }),
  });
}

export function useArquivarQuestionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionarioId: string) => {
      const { error } = await supabase
        .from('questionarios' as any)
        .update({ status: 'arquivado' })
        .eq('id', questionarioId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questionario'] }),
  });
}