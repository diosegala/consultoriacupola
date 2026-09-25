import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';
import { supabase } from '@/integrations/supabase/client';
import { streamImage } from '@/lib/streamImage';

export type FormatoArte = 'feed_4_5' | 'quadrado_1_1' | 'stories_9_16';

export interface RedesArte {
  id: string;
  tema_id: string;
  cliente_id: string;
  formato: FormatoArte;
  tipo: 'imagem_opcao' | 'arte_final';
  versao: number;
  slide_indice: number;
  caminho: string;
  prompt: string;
  composicao: { zoom?: number; x?: number; y?: number; alinhamento?: 'esquerda' | 'centro' };
  texto: string;
  aprovada: boolean;
  criado_em: string;
}

export interface IdentidadeVisual {
  cores: string[];
  tipografia: string[];
  guia: string;
  logos: Array<{ id: string; nome: string; caminho: string | null }>;
}

export function useLogoConta(clienteId?: string) {
  return useQuery({
    queryKey: ['agencia', 'logo-conta', clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<string | null> => {
      const { data: logo, error } = await agencia()
        .from('cliente_marca_arquivo')
        .select('caminho')
        .eq('cliente_id', clienteId)
        .eq('papel', 'logo')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!logo?.caminho) return null;

      const { data, error: signedUrlError } = await supabase.storage
        .from('conhecimento')
        .createSignedUrl(logo.caminho, 3600);
      if (signedUrlError) throw signedUrlError;
      return data.signedUrl;
    },
  });
}

export function useLogosContas() {
  return useQuery({
    queryKey: ['agencia', 'logos-contas'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await agencia()
        .from('cliente_marca_arquivo')
        .select('cliente_id, caminho')
        .eq('papel', 'logo');
      if (error) throw error;
      const porCliente = new Map<string, string>();
      (data ?? []).forEach((l: { cliente_id: string; caminho: string | null }) => {
        if (l.caminho && !porCliente.has(l.cliente_id)) porCliente.set(l.cliente_id, l.caminho);
      });
      if (porCliente.size === 0) return {};
      const caminhos = [...porCliente.values()];
      const { data: assinadas, error: e2 } = await supabase.storage
        .from('conhecimento')
        .createSignedUrls(caminhos, 3600);
      if (e2) throw e2;
      const urlPorCaminho = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));
      const resultado: Record<string, string> = {};
      porCliente.forEach((caminho, id) => {
        const url = urlPorCaminho.get(caminho);
        if (url) resultado[id] = url;
      });
      return resultado;
    },
  });
}

export function useIdentidadeVisual(clienteId?: string) {
  return useQuery({
    queryKey: ['agencia', 'identidade-visual', clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<IdentidadeVisual> => {
      const [identidade, logos] = await Promise.all([
        agencia().from('cliente_identidade').select('cores, tipografia, guia').eq('cliente_id', clienteId).maybeSingle(),
        agencia().from('cliente_marca_arquivo').select('id, nome, caminho').eq('cliente_id', clienteId).eq('papel', 'logo'),
      ]);
      if (identidade.error) throw identidade.error;
      if (logos.error) throw logos.error;
      return {
        cores: Array.isArray(identidade.data?.cores) ? identidade.data.cores : [],
        tipografia: Array.isArray(identidade.data?.tipografia) ? identidade.data.tipografia : [],
        guia: identidade.data?.guia ?? '',
        logos: logos.data ?? [],
      };
    },
  });
}

export function useSalvarIdentidade(clienteId?: string) {
  const client = useQueryClient();
  return async (identidade: Pick<IdentidadeVisual, 'cores' | 'tipografia' | 'guia'>) => {
    if (!clienteId) return;
    const { error } = await agencia().from('cliente_identidade').upsert({
      cliente_id: clienteId,
      cores: identidade.cores,
      tipografia: identidade.tipografia,
      guia: identidade.guia,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'cliente_id' });
    if (error) throw error;
    await client.invalidateQueries({ queryKey: ['agencia', 'identidade-visual', clienteId] });
  };
}

export function useEnviarLogo(clienteId?: string) {
  const client = useQueryClient();
  return async (arquivo: File) => {
    if (!clienteId) return;
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'png';
    const id = crypto.randomUUID();
    const caminho = `${clienteId}/marca/${id}.${extensao}`;
    const { error: uploadError } = await supabase.storage.from('conhecimento').upload(caminho, arquivo, { contentType: arquivo.type });
    if (uploadError) throw uploadError;
    const { error } = await agencia().from('cliente_marca_arquivo').insert({
      id, cliente_id: clienteId, nome: arquivo.name, papel: 'logo', caminho,
      tipo_arquivo: arquivo.type, tamanho: arquivo.size,
    });
    if (error) throw error;
    await client.invalidateQueries({ queryKey: ['agencia', 'identidade-visual', clienteId] });
  };
}

export function useArtesTema(temaId?: string) {
  return useQuery({
    queryKey: ['agencia', 'redes-artes', temaId],
    enabled: !!temaId,
    queryFn: async (): Promise<RedesArte[]> => {
      const { data, error } = await agencia().from('redes_artes').select('*').eq('tema_id', temaId).order('criado_em', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function dataUrlToBlob(dataUrl: string) {
  const [header, body] = dataUrl.split(',');
  if (!header || !body) throw new Error('Imagem inválida.');
  const type = header.match(/data:(.*?);/)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type });
}

export async function gerarImagemArte(input: {
  clienteId: string;
  mes: string;
  temaId: string;
  formato: FormatoArte;
  instrucoes: string;
  onFrame: (url: string, final: boolean) => void;
}) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agencia-redes`;
  return streamImage(endpoint, { acao: 'arte', cliente_id: input.clienteId, mes: input.mes, tema_id: input.temaId, formato_arte: input.formato, instrucoes_arte: input.instrucoes }, {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }, input.onFrame);
}

export function useSalvarArte() {
  const client = useQueryClient();
  return async (input: {
    temaId: string; clienteId: string; formato: FormatoArte; dataUrl: string; prompt: string;
    tipo: RedesArte['tipo']; texto?: string; slideIndice?: number; composicao?: RedesArte['composicao']; aprovada?: boolean;
  }) => {
    const id = crypto.randomUUID();
    const path = `${input.clienteId}/${input.temaId}/${id}.png`;
    const { error: uploadError } = await supabase.storage.from('agencia-pecas').upload(path, dataUrlToBlob(input.dataUrl), { contentType: 'image/png' });
    if (uploadError) throw uploadError;
    const { data: antigas } = await agencia().from('redes_artes').select('versao').eq('tema_id', input.temaId).eq('tipo', input.tipo).order('versao', { ascending: false }).limit(1);
    const versao = (antigas?.[0]?.versao ?? 0) + 1;
    const { data, error } = await agencia().from('redes_artes').insert({
      id, tema_id: input.temaId, cliente_id: input.clienteId, formato: input.formato, tipo: input.tipo,
      versao, slide_indice: input.slideIndice ?? 0, caminho: path, prompt: input.prompt,
      composicao: input.composicao ?? {}, texto: input.texto ?? '', aprovada: input.aprovada ?? false,
    }).select().single();
    if (error) throw error;
    await client.invalidateQueries({ queryKey: ['agencia', 'redes-artes', input.temaId] });
    return data as RedesArte;
  };
}

export async function aprovarImagem(temaId: string, arteId: string) {
  const { error: limpar } = await agencia().from('redes_artes').update({ aprovada: false }).eq('tema_id', temaId).eq('tipo', 'imagem_opcao');
  if (limpar) throw limpar;
  const { error } = await agencia().from('redes_artes').update({ aprovada: true, atualizado_em: new Date().toISOString() }).eq('id', arteId);
  if (error) throw error;
}

export async function assinarArte(path: string) {
  const { data, error } = await supabase.storage.from('agencia-pecas').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}