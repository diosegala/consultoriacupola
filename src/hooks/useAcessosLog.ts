import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface AcessoLog {
  id: string;
  user_id: string;
  email: string | null;
  evento: string;
  user_agent: string | null;
  created_at: string;
}

export interface AcessosLogFilters {
  startDate?: Date;
  endDate?: Date;
  email?: string;
}

export interface AcessosLogResult {
  rows: AcessoLog[];
  count: number;
}

export function useAcessosLog(
  enabled = true,
  page = 1,
  pageSize = 20,
  filters: AcessosLogFilters = {}
) {
  return useQuery({
    queryKey: ['acessos-log', page, pageSize, filters],
    enabled,
    queryFn: async (): Promise<AcessosLogResult> => {
      let q = supabase
        .from('acessos_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.startDate) {
        q = q.gte('created_at', startOfDay(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        q = q.lte('created_at', endOfDay(filters.endDate).toISOString());
      }
      if (filters.email?.trim()) {
        q = q.ilike('email', `%${filters.email.trim().toLowerCase()}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AcessoLog[], count: count ?? 0 };
    },
  });
}
