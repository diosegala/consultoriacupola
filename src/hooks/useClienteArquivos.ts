import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase as sb } from '@/integrations/supabase/client';
// Table types are regenerated post-migration; cast to any until then.
const supabase = sb as any;

export interface ClienteArquivo {
  id: string;
  cliente_id: string;
  titulo: string;
  tipo: 'link' | 'arquivo';
  url: string;
  categoria: string | null;
  descricao: string | null;
  adicionado_por: string | null;
  created_at: string;
  adicionado?: { nome: string } | null;
}

const BUCKET = 'cliente-arquivos';

export function useClienteArquivos(clienteId?: string) {
  return useQuery({
    queryKey: ['cliente-arquivos', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cliente_arquivos')
        .select('*, adicionado:consultores!cliente_arquivos_adicionado_por_fkey(nome)')
        .eq('cliente_id', clienteId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClienteArquivo[];
    },
  });
}

export function useAddClienteArquivoLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      cliente_id: string;
      titulo: string;
      url: string;
      categoria?: string | null;
      descricao?: string | null;
      adicionado_por?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('cliente_arquivos')
        .insert({
          cliente_id: payload.cliente_id,
          titulo: payload.titulo,
          tipo: 'link',
          url: payload.url,
          categoria: payload.categoria ?? null,
          descricao: payload.descricao ?? null,
          adicionado_por: payload.adicionado_por ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cliente-arquivos', vars.cliente_id] });
    },
  });
}

export function useUploadClienteArquivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      cliente_id: string;
      titulo: string;
      file: File;
      categoria?: string | null;
      descricao?: string | null;
      adicionado_por?: string | null;
    }) => {
      if (payload.file.size > 20 * 1024 * 1024) {
        throw new Error('Arquivo excede o limite de 20 MB.');
      }
      const safe = payload.file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${payload.cliente_id}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, payload.file, {
        upsert: false,
        contentType: payload.file.type || undefined,
      });
      if (up.error) throw up.error;

      const { data, error } = await supabase
        .from('cliente_arquivos')
        .insert({
          cliente_id: payload.cliente_id,
          titulo: payload.titulo,
          tipo: 'arquivo',
          url: path,
          categoria: payload.categoria ?? null,
          descricao: payload.descricao ?? null,
          adicionado_por: payload.adicionado_por ?? null,
        })
        .select()
        .single();
      if (error) {
        // cleanup uploaded file on metadata failure
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cliente-arquivos', vars.cliente_id] });
    },
  });
}

export function useDeleteClienteArquivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arquivo: ClienteArquivo) => {
      if (arquivo.tipo === 'arquivo') {
        await supabase.storage.from(BUCKET).remove([arquivo.url]);
      }
      const { error } = await supabase
        .from('cliente_arquivos')
        .delete()
        .eq('id', arquivo.id);
      if (error) throw error;
      return arquivo;
    },
    onSuccess: (arq) => {
      qc.invalidateQueries({ queryKey: ['cliente-arquivos', arq.cliente_id] });
    },
  });
}

export async function getClienteArquivoSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadClienteArquivoBase64(path: string): Promise<{ base64: string; name: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)) as unknown as number[],
    );
  }
  const name = path.split('/').pop() ?? 'arquivo';
  return { base64: btoa(binary), name };
}