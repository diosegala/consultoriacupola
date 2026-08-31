import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AcessoLog {
  id: string;
  user_id: string;
  email: string | null;
  evento: string;
  user_agent: string | null;
  created_at: string;
}

export function useAcessosLog(enabled = true, limit = 200) {
  return useQuery({
    queryKey: ['acessos-log', limit],
    enabled,
    queryFn: async (): Promise<AcessoLog[]> => {
      const { data, error } = await supabase
        .from('acessos_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AcessoLog[];
    },
  });
}
