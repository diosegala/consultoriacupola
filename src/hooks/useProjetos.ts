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
  due_date_start: string | null;
  tipo: 'normal' | 'renovacao';
  created_at: string;
  updated_at: string;
  clientes?: { nome: string; cidade: string; uf: string };
  consultores?: { nome: string };
  contratos?: { tipo_consultoria_id: string | null; data_fim: string; remuneracao_mensal: number; remuneracao_total: number; prazo_meses: number; parcelas: number; tipo_vencimento: string } | null;
  _comentarios_count?: number;
  _checklist_done?: number;
  _checklist_total?: number;
  _checklist_overdue?: number;
  _checklist_soon?: number;
  _checklist_responsaveis?: Array<{ id: string; nome: string }>;
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
        .select(`
          *,
          clientes(nome, cidade, uf),
          consultores(nome),
          contratos(tipo_consultoria_id, data_fim, remuneracao_mensal, remuneracao_total, prazo_meses, parcelas, tipo_vencimento),
          projeto_tag_vinculo(tag_id, projeto_tags(id, nome, cor)),
          projeto_checklist(id, concluido, due_date,
            projeto_checklist_responsaveis(consultor_id, consultores(id, nome))
          ),
          projeto_comentarios(id)
        `)
        .order('ordem_na_etapa');
      
      if (consultorId) {
        query = query.eq('consultor_id', consultorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soonLimit = new Date(today);
      soonLimit.setDate(soonLimit.getDate() + 3);

      return (data ?? []).map((p: any) => {
        const checklist = (p.projeto_checklist ?? []) as Array<{ id: string; concluido: boolean; due_date: string | null; projeto_checklist_responsaveis: Array<{ consultor_id: string; consultores: { id: string; nome: string } | null }> }>;
        const done = checklist.filter(i => i.concluido).length;
        const total = checklist.length;
        let overdue = 0;
        let soon = 0;
        const respMap = new Map<string, { id: string; nome: string }>();
        for (const item of checklist) {
          if (!item.concluido && item.due_date) {
            const d = new Date(item.due_date + 'T00:00:00');
            if (d < today) overdue++;
            else if (d <= soonLimit) soon++;
          }
          if (!item.concluido) {
            for (const r of item.projeto_checklist_responsaveis ?? []) {
              if (r.consultores) respMap.set(r.consultores.id, r.consultores);
            }
          }
        }
        return {
          ...p,
          _tags: (p.projeto_tag_vinculo ?? []).map((v: any) => v.projeto_tags).filter(Boolean),
          _checklist_done: done,
          _checklist_total: total,
          _checklist_overdue: overdue,
          _checklist_soon: soon,
          _checklist_responsaveis: Array.from(respMap.values()),
          _comentarios_count: (p.projeto_comentarios ?? []).length,
        };
      }) as Projeto[];
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
