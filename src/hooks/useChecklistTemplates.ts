import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChecklistTemplate {
  id: string;
  tipo_consultoria_id: string;
  titulo: string;
  ordem: number;
  created_at: string;
}

export function useChecklistTemplates(tipoConsultoriaId: string | undefined) {
  return useQuery({
    queryKey: ['checklist_templates', tipoConsultoriaId],
    enabled: !!tipoConsultoriaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_consultoria_id', tipoConsultoriaId!)
        .order('ordem');
      if (error) throw error;
      return data as ChecklistTemplate[];
    },
  });
}