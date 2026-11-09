import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Estrutura } from '@/lib/questionario';

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

export interface TemplateQuestionario {
  id: string;
  nome: string;
  versao: number;
  ativo: boolean;
  segmento: string | null;
  estrutura: Estrutura;
}

const COLUNAS_TEMPLATE = 'id, nome, versao, ativo, segmento, estrutura';

/** Templates ativos (um por segmento: vendas, locação). */
export function useTemplatesAtivos() {
  return useQuery({
    queryKey: ['questionario-templates-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionarios_template' as any)
        .select(COLUNAS_TEMPLATE)
        .eq('ativo', true)
        .not('segmento', 'is', null)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as TemplateQuestionario[];
    },
  });
}

/** Template usado por um questionário específico (mesmo que já tenha sido desativado). */
export function useTemplateDoQuestionario(templateId?: string) {
  return useQuery({
    queryKey: ['questionario-template', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionarios_template' as any)
        .select(COLUNAS_TEMPLATE)
        .eq('id', templateId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TemplateQuestionario | null;
    },
    enabled: !!templateId,
  });
}

/** Admin: salva a estrutura inteira de um template (perguntas, ativação, ordem). */
export function useSalvarEstruturaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, estrutura }: { templateId: string; estrutura: Estrutura }) => {
      const { error } = await supabase
        .from('questionarios_template' as any)
        .update({ estrutura })
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questionario-templates-ativos'] });
      qc.invalidateQueries({ queryKey: ['questionario-template'] });
    },
  });
}

/** Consultor/admin: grava as respostas direto (preenchimento em reunião). */
export function useSalvarRespostas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      respostas,
      progresso_pct,
      concluir,
      statusAtual,
    }: {
      id: string;
      respostas: Record<string, unknown>;
      progresso_pct: number;
      concluir?: boolean;
      statusAtual: QuestionarioRow['status'];
    }) => {
      const agora = new Date().toISOString();
      const update: Record<string, unknown> = {
        respostas,
        progresso_pct,
        ultimo_salvamento_em: agora,
        status: concluir || statusAtual === 'concluido' ? 'concluido' : 'em_andamento',
      };
      if (statusAtual === 'nao_iniciado') update.iniciado_em = agora;
      if (concluir) update.concluido_em = agora;
      const { error } = await supabase.from('questionarios' as any).update(update).eq('id', id);
      if (error) throw error;
      return agora;
    },
    onSuccess: (_d, v) => {
      if (v.concluir) qc.invalidateQueries({ queryKey: ['questionario'] });
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