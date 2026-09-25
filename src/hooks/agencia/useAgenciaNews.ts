import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { agencia } from '@/integrations/supabase/agencia';

export interface ArtigoDoMes {
  id: string;
  status: string;
  titulo: string;
  texto_revisado: string;
}

export interface EdicaoNews {
  selecionados: string[];
  orientacoes: string;
  texto: string;
  assinatura: string;
}

export const mesDeHoje = () => new Date().toISOString().slice(0, 7);
export const aptoParaNews = (p: ArtigoDoMes) =>
  (p.status === 'aprovado' || p.status === 'publicado') && !!p.texto_revisado.trim();
export const assinaturaDe = (artigos: ArtigoDoMes[]) =>
  JSON.stringify(artigos.map((p) => [p.id, p.titulo, p.texto_revisado]));

const tituloDe = (p: { texto_revisado?: string | null; h1?: string | null; titulo?: string | null; tema?: string | null }) =>
  (p.texto_revisado ?? '').match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || p.h1 || p.titulo || p.tema || 'Artigo';

export function useArtigosDoMes(clienteId?: string, mes?: string) {
  return useQuery({
    queryKey: ['agencia', 'news-artigos', clienteId, mes],
    enabled: !!clienteId && !!mes,
    queryFn: async (): Promise<ArtigoDoMes[]> => {
      const { data, error } = await agencia()
        .from('blog_posts')
        .select('id, status, titulo, h1, tema, texto_revisado')
        .eq('cliente_id', clienteId)
        .eq('mes', mes)
        .order('criado_em');
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id, status: p.status ?? 'rascunho', titulo: tituloDe(p), texto_revisado: p.texto_revisado ?? '',
      }));
    },
  });
}

export function useEdicaoNews(clienteId?: string, mes?: string) {
  return useQuery({
    queryKey: ['agencia', 'news', clienteId, mes],
    enabled: !!clienteId && !!mes,
    queryFn: async (): Promise<EdicaoNews | null> => {
      const { data, error } = await agencia()
        .from('news_edicoes')
        .select('conteudo')
        .eq('cliente_id', clienteId)
        .eq('mes', mes)
        .eq('tipo', 'blog')
        .maybeSingle();
      if (error) throw error;
      const c = (data?.conteudo ?? null) as Partial<EdicaoNews> | null;
      return c ? { selecionados: c.selecionados ?? [], orientacoes: c.orientacoes ?? '', texto: c.texto ?? '', assinatura: c.assinatura ?? '' } : null;
    },
  });
}

export function useAcoesNews(clienteId: string, mes: string) {
  const qc = useQueryClient();
  const salvar = async (edicao: EdicaoNews, pessoaId?: string) => {
    const { error } = await agencia().from('news_edicoes').upsert({
      cliente_id: clienteId, mes, tipo: 'blog', conteudo: edicao, atualizado_por: pessoaId ?? null, atualizado_em: new Date().toISOString(),
    });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ['agencia', 'news', clienteId, mes] });
  };
  const gerar = async (postIds: string[], orientacoes: string): Promise<{ texto: string; assinatura: string }> => {
    const { data, error } = await supabase.functions.invoke('agencia-news', {
      body: { cliente_id: clienteId, mes, post_ids: postIds, orientacoes },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = (await error.context.json()).error ?? msg; } catch { /* mantém */ }
      }
      throw new Error(msg);
    }
    qc.invalidateQueries({ queryKey: ['agencia', 'news', clienteId, mes] });
    return data as { texto: string; assinatura: string };
  };
  return { salvar, gerar };
}
