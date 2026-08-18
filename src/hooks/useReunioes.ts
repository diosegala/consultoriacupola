import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Avoids supabase-js parsing select strings at the type level (huge tsc cost). */
const sel = (s: string): string => s;

/** Columns needed by the listing tables — never includes transcricao/analises. */
const LIST_COLS =
  'id, consultor_id, cliente_id, data_reuniao, duracao_minutos, score_ia, score_cliente, status_analise, google_meet_link, created_at, updated_at, clientes(nome), consultores(nome)';

export const REUNIOES_PAGE_SIZE = 50;

/** Lightweight row used by all listings. */
export interface ReuniaoResumo {
  id: string;
  consultor_id: string;
  cliente_id: string;
  data_reuniao: string;
  duracao_minutos: number | null;
  score_ia: number | null;
  score_cliente: number | null;
  google_meet_link: string | null;
  status_analise: string;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string } | null;
  consultores?: { nome: string } | null;
  origem?: 'drive' | 'manual';
}

/** Backwards-compatible alias used across the app for list rows. */
export type ReuniaoComDetalhes = ReuniaoResumo;

/** Full row, only fetched when opening a single meeting. */
export interface ReuniaoDetalhe extends ReuniaoResumo {
  transcricao: string | null;
  resumo_ia: string | null;
  analise_ia: Record<string, any> | null;
  analise_cliente: Record<string, any> | null;
}

export type Reuniao = ReuniaoDetalhe;

export interface ReuniaoInsert {
  consultor_id: string;
  cliente_id: string;
  data_reuniao: string;
  duracao_minutos?: number | null;
  transcricao?: string | null;
  google_meet_link?: string | null;
}

/** IDs of meetings imported from Google Drive (used to derive origem). */
export function useReunioesDriveIds() {
  return useQuery({
    queryKey: ['reunioes', 'drive-ids'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes_importadas_log' as any)
        .select(sel('reuniao_id'))
        .not('reuniao_id', 'is', null);
      if (error) throw error;
      return new Set(((data || []) as any[]).map((l) => l.reuniao_id as string));
    },
  });
}

function withOrigem(rows: ReuniaoResumo[], driveIds: Set<string> | undefined): ReuniaoResumo[] {
  if (!driveIds) return rows;
  return rows.map((r) => ({ ...r, origem: driveIds.has(r.id) ? 'drive' : 'manual' } as ReuniaoResumo));
}

export function useReunioesByConsultor(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['reunioes', 'consultor', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select(sel(LIST_COLS))
        .eq('consultor_id', consultorId!)
        .order('data_reuniao', { ascending: false })
        .returns<ReuniaoResumo[]>();

      if (error) throw error;
      return data || [];
    },
  });
}

export function useReunioesByCliente(clienteId: string | undefined) {
  const { data: driveIds } = useReunioesDriveIds();
  return useQuery({
    queryKey: ['reunioes', 'cliente', clienteId, !!driveIds],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select(sel(LIST_COLS))
        .eq('cliente_id', clienteId!)
        .order('data_reuniao', { ascending: false })
        .returns<ReuniaoResumo[]>();
      if (error) throw error;
      return withOrigem(data || [], driveIds);
    },
  });
}

/** Full meeting (transcription + analyses) — only when a detail view is open. */
export function useReuniaoDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['reunioes', 'detalhe', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select(sel(`${LIST_COLS}, transcricao, resumo_ia, analise_ia, analise_cliente`))
        .eq('id', id!)
        .maybeSingle()
        .returns<ReuniaoDetalhe>();
      if (error) throw error;
      return data;
    },
  });
}

export const useReuniao = useReuniaoDetalhe;

/** Server-side counters for the KPI cards. */
export function useReunioesStats(consultorId?: string | null) {
  return useQuery({
    queryKey: ['reunioes', 'stats', consultorId ?? 'all'],
    queryFn: async () => {
      const base = () => {
        const q = supabase.from('reunioes').select(sel('id'), { count: 'exact', head: true });
        return consultorId ? q.eq('consultor_id', consultorId) : q;
      };
      const [total, analisadas, pendentes] = await Promise.all([
        base(),
        base().eq('status_analise', 'concluido'),
        base().in('status_analise', ['pendente', 'erro']).not('transcricao', 'is', null),
      ]);
      if (total.error) throw total.error;
      return {
        total: total.count ?? 0,
        analisadas: analisadas.count ?? 0,
        pendentes: pendentes.count ?? 0,
      };
    },
  });
}

/** IDs of meetings waiting for analysis (used by the batch queue). */
export function useReunioesPendentesIds(consultorId?: string | null) {
  return useQuery({
    queryKey: ['reunioes', 'pendentes-ids', consultorId ?? 'all'],
    queryFn: async () => {
      const ids: string[] = [];
      const pageSize = 1000;
      let from = 0;
      let done = false;

      while (!done) {
        const to = from + pageSize - 1;
        let q = supabase
          .from('reunioes')
          .select(sel('id'))
          .in('status_analise', ['pendente', 'erro'])
          .not('transcricao', 'is', null)
          .order('data_reuniao', { ascending: false })
          .range(from, to);
        if (consultorId) q = q.eq('consultor_id', consultorId);
        const { data, error } = await q.returns<{ id: string }[]>();
        if (error) throw error;
        const page = data || [];
        ids.push(...page.map((r) => r.id));
        done = page.length < pageSize;
        from += pageSize;
      }

      return ids;
    },
  });
}

/** Paginated listing (50 per page) with optional origem filter. */
export function useAllReunioes(opts: { origem?: 'all' | 'drive' | 'manual' } = {}) {
  const { origem = 'all' } = opts;
  const { data: driveIds, isLoading: loadingIds } = useReunioesDriveIds();
  const needsIds = origem !== 'all';

  return useInfiniteQuery({
    queryKey: ['reunioes', 'all', origem, driveIds ? driveIds.size : null],
    enabled: !needsIds || !loadingIds,
    initialPageParam: 0,
    getNextPageParam: (lastPage: ReuniaoResumo[], allPages) =>
      lastPage.length < REUNIOES_PAGE_SIZE ? undefined : allPages.length,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const from = page * REUNIOES_PAGE_SIZE;
      const to = from + REUNIOES_PAGE_SIZE - 1;
      const ids = driveIds ? Array.from(driveIds) : [];

      let q = supabase
        .from('reunioes')
        .select(sel(LIST_COLS))
        .order('data_reuniao', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      if (origem === 'drive') {
        if (!ids.length) return [] as ReuniaoResumo[];
        q = q.in('id', ids);
      } else if (origem === 'manual' && ids.length) {
        q = q.not('id', 'in', `(${ids.join(',')})`);
      }

      const { data, error } = await q.returns<ReuniaoResumo[]>();
      if (error) throw error;
      return withOrigem(data || [], driveIds);
    },
  });
}

export function useCreateReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reuniao: ReuniaoInsert) => {
      const { data, error } = await supabase
        .from('reunioes')
        .insert(reuniao as any)
        .select(sel('id'))
        .single();

      if (error) throw error;
      return data as unknown as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] });
    },
  });
}

export function useAnalisarReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reuniaoId: string) => {
      const { data, error } = await supabase.functions.invoke('analisar-reuniao', {
        body: { reuniao_id: reuniaoId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] });
    },
  });
}

export function useDeleteReuniao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reunioes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] });
    },
  });
}

export function useScoreConsultor(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['score-consultor', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select(sel('score_ia'))
        .eq('consultor_id', consultorId!)
        .eq('status_analise', 'concluido')
        .not('score_ia', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const scores = (data as any[]).map((r) => Number(r.score_ia));
      const media = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      return {
        score_medio: Math.round(media * 10) / 10,
        total_reunioes: data.length,
      };
    },
  });
}
