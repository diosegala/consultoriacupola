import { useQuery } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';

export interface AgenciaSessao {
  id: string;
  agente_id: string | null;
  pessoa_id: string | null;
  espaco_id: string | null;
  projeto_id: string | null;
  cliente_id: string | null;
  titulo: string;
  subtitulo: string | null;
  atualizada_em: string | null;
  fixada: boolean | null;
  arquivada: boolean | null;
}

export interface AgenciaSkill {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  origem: string | null;
  espaco_id: string | null;
  corpo: string | null;
  requer_chaves: string[] | null;
  usos: number | null;
}

export interface AgenciaProduto {
  id: string;
  slug: string;
  nome: string;
  tipo: string | null;
  resumo: string | null;
  status: string | null;
  tagline: string | null;
  sobre: string | null;
  publico_alvo: string | null;
  proposta_de_valor: string | null;
  inicio: string | null;
  fim: string | null;
  local: string | null;
  modalidade: string | null;
  vagas: number | null;
  vendidas: number | null;
  preco_referencia: number | null;
}

export function useAgenciaSessoes() {
  return useQuery({
    queryKey: ['agencia', 'sessoes'],
    queryFn: async (): Promise<AgenciaSessao[]> => {
      const { data, error } = await agencia()
        .from('sessoes')
        .select('*')
        .eq('arquivada', false)
        .order('atualizada_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgenciaSessao[];
    },
  });
}

export function useAgenciaSessao(id?: string) {
  return useQuery({
    queryKey: ['agencia', 'sessao', id],
    enabled: !!id,
    queryFn: async (): Promise<AgenciaSessao | null> => {
      const { data, error } = await agencia().from('sessoes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as AgenciaSessao) ?? null;
    },
  });
}

export function useAgenciaSkills() {
  return useQuery({
    queryKey: ['agencia', 'skills'],
    queryFn: async (): Promise<AgenciaSkill[]> => {
      const { data, error } = await agencia().from('skills').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as AgenciaSkill[];
    },
  });
}

export function useAgenciaProdutos() {
  return useQuery({
    queryKey: ['agencia', 'produtos'],
    queryFn: async (): Promise<AgenciaProduto[]> => {
      const { data, error } = await agencia().from('produtos').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as AgenciaProduto[];
    },
  });
}

/** "há 3 dias", "hoje" — datas relativas curtas, como no CupolaOS. */
export function quandoFoi(iso?: string | null): string {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
