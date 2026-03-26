import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjetoEtapa {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface Projeto {
  id: string;
  cliente_id: string;
  contrato_id: string | null;
  consultor_id: string;
  etapa_id: string;
  ordem_na_etapa: number;
  observacoes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string; cidade: string; uf: string };
  consultores?: { nome: string };
  contratos?: { tipo_consultoria_id: string | null; data_fim: string } | null;
  _comentarios_count?: number;
  _checklist_done?: number;
  _checklist_total?: number;
  _reunioes_count?: number;
  _tags?: Array<{ id: string; nome: string; cor: string }>;
}

export function useProjetosEtapas() {
  return useQuery({
    queryKey: ['projetos_etapas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projetos_etapas')
        .select('*')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return data as ProjetoEtapa[];
    },
  });
}

export function useProjetos(consultorId?: string) {
  return useQuery({
    queryKey: ['projetos', consultorId],
    queryFn: async () => {
      let query = supabase
        .from('projetos')
        .select('*, clientes(nome, cidade, uf), consultores(nome), contratos(tipo_consultoria_id, data_fim), projeto_tag_vinculo(tag_id, projeto_tags(id, nome, cor))')
        .order('ordem_na_etapa');
      
      if (consultorId) {
        query = query.eq('consultor_id', consultorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Flatten tags into _tags array
      return (data ?? []).map((p: any) => ({
        ...p,
        _tags: (p.projeto_tag_vinculo ?? []).map((v: any) => v.projeto_tags).filter(Boolean),
      })) as Projeto[];
    },
  });
}

export function useMoverProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projetoId, etapaId, ordemNaEtapa }: { projetoId: string; etapaId: string; ordemNaEtapa: number }) => {
      const { error } = await supabase
        .from('projetos')
        .update({ etapa_id: etapaId, ordem_na_etapa: ordemNaEtapa })
        .eq('id', projetoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}

export function useCreateProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projeto: {
      cliente_id: string;
      contrato_id?: string;
      consultor_id: string;
      etapa_id: string;
      ordem_na_etapa?: number;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase
        .from('projetos')
        .insert(projeto)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    },
  });
}
