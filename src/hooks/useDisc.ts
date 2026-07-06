import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PerfilDisc = {
  perfil_primario: 'D' | 'I' | 'S' | 'C';
  perfil_secundario: 'D' | 'I' | 'S' | 'C';
  scores: { D: number; I: number; S: number; C: number };
  pontos_fortes: string[];
  pontos_de_atencao: string[];
  sob_pressao: string;
  estilo_comunicacao: string;
  necessidades_do_ambiente: string[];
  como_motivar: string;
  como_gerar_estresse: string;
  resumo_livre: string;
};

export type CruzamentoDisc = {
  compatibilidade_geral: string;
  pontos_de_sinergia: string[];
  pontos_de_tensao: string[];
  recomendacoes_comunicacao: string[];
  recomendacoes_delegacao: string[];
  sinais_de_alerta: string[];
  como_dar_feedback: string;
};

export function usePerfilDisc(consultor_id: string | null | undefined) {
  return useQuery({
    queryKey: ['perfil-disc', consultor_id],
    enabled: !!consultor_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis_comportamentais' as any)
        .select('*')
        .eq('consultor_id', consultor_id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as any;
    },
  });
}

// Perfis DISC de vários consultores (para radar)
export function usePerfisDiscBatch(consultor_ids: string[]) {
  const key = consultor_ids.slice().sort().join(',');
  return useQuery({
    queryKey: ['perfis-disc-batch', key],
    enabled: consultor_ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis_comportamentais' as any)
        .select('consultor_id, perfil_resumo')
        .in('consultor_id', consultor_ids);
      if (error) throw error;
      const map = new Map<string, PerfilDisc>();
      (data ?? []).forEach((r: any) => map.set(r.consultor_id, r.perfil_resumo));
      return map;
    },
  });
}

export function useCruzamentoDisc(diretor_id: string | null | undefined, consultor_id: string | null | undefined) {
  return useQuery({
    queryKey: ['cruzamento-disc', diretor_id, consultor_id],
    enabled: !!diretor_id && !!consultor_id && diretor_id !== consultor_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cruzamentos_disc' as any)
        .select('*')
        .eq('diretor_id', diretor_id!)
        .eq('consultor_id', consultor_id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as any;
    },
  });
}

export function useSignedDiscPdf(pdf_url: string | null | undefined) {
  return useMutation({
    mutationFn: async (path?: string) => {
      const full = path ?? pdf_url ?? '';
      const key = full.replace(/^perfis-disc\//, '');
      const { data, error } = await supabase.storage
        .from('perfis-disc')
        .createSignedUrl(key, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useProcessarDisc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      consultor_id: string;
      file: File;
      data_avaliacao?: string;
    }) => {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(input.file);
      });
      const { data, error } = await supabase.functions.invoke('processar-disc', {
        body: {
          consultor_id: input.consultor_id,
          pdf_base64: b64,
          nome_arquivo: input.file.name,
          data_avaliacao: input.data_avaliacao,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['perfil-disc', vars.consultor_id] });
      qc.invalidateQueries({ queryKey: ['perfis-disc-batch'] });
      qc.invalidateQueries({ queryKey: ['cruzamento-disc'] });
    },
  });
}

export function useRegerarCruzamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { diretor_id: string; consultor_id: string }) => {
      const { data, error } = await supabase.functions.invoke('gerar-analise-cruzamento-disc', {
        body: input,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cruzamento-disc', vars.diretor_id, vars.consultor_id] });
    },
  });
}

export function useMyConsultorId() {
  return useQuery({
    queryKey: ['my-consultor-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('consultor_user')
        .select('consultor_id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.consultor_id ?? null;
    },
  });
}

export const DISC_COLORS: Record<'D'|'I'|'S'|'C', string> = {
  D: 'bg-red-500',
  I: 'bg-amber-500',
  S: 'bg-emerald-500',
  C: 'bg-blue-500',
};