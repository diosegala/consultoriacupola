import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// Tipos de Consultoria
export type TipoConsultoria = Tables<'tipos_consultoria'>;
export type TipoConsultoriaInsert = TablesInsert<'tipos_consultoria'>;
export type TipoConsultoriaUpdate = TablesUpdate<'tipos_consultoria'>;

export function useTiposConsultoria(apenasAtivos = true) {
  return useQuery({
    queryKey: ['tipos-consultoria', { apenasAtivos }],
    queryFn: async () => {
      let query = supabase
        .from('tipos_consultoria')
        .select('*')
        .order('nome');

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateTipoConsultoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tipo: TipoConsultoriaInsert) => {
      const { data, error } = await supabase
        .from('tipos_consultoria')
        .insert(tipo)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-consultoria'] });
    }
  });
}

export function useUpdateTipoConsultoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TipoConsultoriaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tipos_consultoria')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-consultoria'] });
    }
  });
}

// CRMs
export type CRM = Tables<'crms'>;
export type CRMInsert = TablesInsert<'crms'>;
export type CRMUpdate = TablesUpdate<'crms'>;

export function useCRMs(apenasAtivos = true) {
  return useQuery({
    queryKey: ['crms', { apenasAtivos }],
    queryFn: async () => {
      let query = supabase
        .from('crms')
        .select('*')
        .order('nome');

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateCRM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (crm: CRMInsert) => {
      const { data, error } = await supabase
        .from('crms')
        .insert(crm)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crms'] });
    }
  });
}

export function useUpdateCRM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CRMUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('crms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crms'] });
    }
  });
}
