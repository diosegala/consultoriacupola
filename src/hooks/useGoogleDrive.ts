import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGoogleConnection(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['google-connection', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultor_google_tokens' as any)
        .select('email_google, ativo, pasta_meet_id, pasta_meet_nome, pasta_meet_link, pasta_meet_owner_email, ultima_sincronizacao, escopo')
        .eq('consultor_id', consultorId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useDetectarPastaMeet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-drive-detectar-pasta', {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; pasta: { id: string; nome: string; link: string | null; owner_email: string | null; owned: boolean } };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-connection'] }),
  });
}

export function useStartGoogleOAuth() {
  return useMutation({
    mutationFn: async (redirectUri: string) => {
      const { data, error } = await supabase.functions.invoke('google-oauth-start', {
        body: { redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
  });
}

export function useFinishGoogleOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, redirect_uri }: { code: string; redirect_uri: string }) => {
      const { data, error } = await supabase.functions.invoke('google-oauth-callback', {
        body: { code, redirect_uri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-connection'] }),
  });
}

export function useListDriveArquivos() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-drive-list-arquivos', {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { arquivos: any[] };
    },
  });
}

export function useImportarDriveArquivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file_id: string; file_name: string; cliente_id: string; data_reuniao?: string }) => {
      const { data, error } = await supabase.functions.invoke('google-drive-importar-arquivo', {
        body: args,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { reuniao_id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reunioes'] }),
  });
}

export function useSyncDiarioManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-drive-sync-diario', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reunioes'] });
      qc.invalidateQueries({ queryKey: ['google-connection'] });
      qc.invalidateQueries({ queryKey: ['reunioes-importadas-log'] });
    },
  });
}

export interface ReuniaoImportadaLog {
  id: string;
  google_file_id: string;
  consultor_id: string;
  cliente_id: string | null;
  reuniao_id: string | null;
  nome_arquivo: string;
  data_importacao: string;
  status: 'importado' | 'sem_match' | 'erro';
  erro: string | null;
  cliente_nome?: string | null;
}

export function useReunioesImportadasLog(
  consultorId: string | undefined,
  opts: { status?: string; limit?: number } = {},
) {
  const { status, limit = 20 } = opts;
  return useQuery({
    queryKey: ['reunioes-importadas-log', consultorId, status, limit],
    enabled: !!consultorId,
    queryFn: async () => {
      let q = supabase
        .from('reunioes_importadas_log' as any)
        .select('*')
        .eq('consultor_id', consultorId!)
        .order('data_importacao', { ascending: false })
        .limit(limit);
      if (status && status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[] as ReuniaoImportadaLog[];
      const ids = Array.from(new Set(rows.map((r) => r.cliente_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: cs } = await supabase.from('clientes').select('id, nome').in('id', ids);
        const map = new Map((cs || []).map((c: any) => [c.id, c.nome]));
        rows.forEach((r) => { r.cliente_nome = r.cliente_id ? map.get(r.cliente_id) ?? null : null; });
      }
      return rows;
    },
  });
}

export interface ClienteAlias {
  id: string;
  cliente_id: string;
  alias: string;
}

export function useClienteAliases(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-aliases', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cliente_aliases' as any)
        .select('*')
        .eq('cliente_id', clienteId!)
        .order('alias');
      if (error) throw error;
      return (data || []) as unknown as ClienteAlias[];
    },
  });
}

export function useCreateAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { cliente_id: string; alias: string }) => {
      const { error } = await supabase.from('cliente_aliases' as any).insert(args as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cliente-aliases', vars.cliente_id] }),
  });
}

export function useDeleteAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cliente_aliases' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente-aliases'] }),
  });
}