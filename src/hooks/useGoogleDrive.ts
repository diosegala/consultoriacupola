import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGoogleConnection(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['google-connection', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultor_google_tokens' as any)
        .select('email_google, ativo, pasta_meet_id, ultima_sincronizacao')
        .eq('consultor_id', consultorId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
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