import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type PassoBlog = 'estrutura' | 'introducao' | 'desenvolvimento' | 'faq' | 'encerramento' | 'seo';

export interface BlogPost {
  id: string;
  cliente_id: string;
  mes: string | null;
  titulo: string | null;
  status: string | null;
  passo_atual: number | null;
  tema: string | null;
  objetivo: string | null;
  etapa: string | null;
  obrigatorias: string | null;
  motivo: string | null;
  intencao: string | null;
  palavra_chave: string | null;
  secundarias: string | null;
  prompts_de_ia: string | null;
  h1: string | null;
  titulos: { nivel: number; texto: string }[] | null;
  fontes: string | null;
  introducao: string | null;
  desenvolvimento: string | null;
  encerramento: string | null;
  faq: { pergunta: string; resposta: string }[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_slug: string | null;
  atualizado_em: string | null;
}

export function useBlogPosts(clienteId?: string) {
  return useQuery({
    queryKey: ['agencia', 'blog', 'posts', clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await agencia()
        .from('blog_posts')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
  });
}

export function useBlogPost(postId?: string) {
  return useQuery({
    queryKey: ['agencia', 'blog', 'post', postId],
    enabled: !!postId,
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await agencia().from('blog_posts').select('*').eq('id', postId).maybeSingle();
      if (error) throw error;
      return (data as BlogPost) ?? null;
    },
  });
}

/** Escrever e salvar: criação do post, briefing e os seis passos da IA. */
export function useBlogAcoes(clienteId?: string) {
  const qc = useQueryClient();
  const [gerando, setGerando] = useState<PassoBlog | null>(null);
  const [validar, setValidar] = useState<{ ponto: string; motivo: string }[]>([]);

  const invalidar = (postId?: string) => {
    qc.invalidateQueries({ queryKey: ['agencia', 'blog', 'posts', clienteId] });
    if (postId) qc.invalidateQueries({ queryKey: ['agencia', 'blog', 'post', postId] });
  };

  const criarPost = async (tema: string): Promise<string | null> => {
    if (!clienteId) return null;
    const id = crypto.randomUUID();
    const agora = new Date().toISOString();
    const { error } = await agencia().from('blog_posts').insert({
      id,
      cliente_id: clienteId,
      mes: agora.slice(0, 7),
      tema,
      titulo: tema,
      status: 'rascunho',
      passo_atual: 0,
      etapa: 'descoberta',
      criado_em: agora,
      atualizado_em: agora,
    });
    if (error) {
      toast({ title: 'Não deu para criar o post', description: error.message, variant: 'destructive' });
      return null;
    }
    invalidar();
    return id;
  };

  const salvarCampos = async (postId: string, campos: Partial<BlogPost>) => {
    const { error } = await agencia()
      .from('blog_posts')
      .update({ ...campos, atualizado_em: new Date().toISOString() })
      .eq('id', postId);
    if (error) {
      toast({ title: 'Não deu para salvar', description: error.message, variant: 'destructive' });
      return false;
    }
    invalidar(postId);
    return true;
  };

  const gerarPasso = async (postId: string, passo: PassoBlog) => {
    setGerando(passo);
    setValidar([]);
    try {
      const { data, error } = await supabase.functions.invoke('agencia-blog', { body: { post_id: postId, passo } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const resposta = data as { validar?: { ponto: string; motivo: string }[]; cortados?: string[] };
      setValidar(resposta.validar ?? []);
      if (resposta.cortados?.length) {
        toast({
          title: 'Parte do material não coube',
          description: `Ficou de fora: ${resposta.cortados.join(', ')}`,
        });
      }
      invalidar(postId);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado.';
      toast({ title: 'A IA não conseguiu escrever agora', description: msg, variant: 'destructive' });
      return false;
    } finally {
      setGerando(null);
    }
  };

  /** Conferência do texto: a leitura da IA + o material para a régua mecânica. */
  const conferirTexto = async (
    postId: string,
  ): Promise<{ afirmacoes: { trecho: string; porque: string }[]; material: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('agencia-blog-conferencia', {
        body: { post_id: postId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const r = data as { afirmacoes?: { trecho: string; porque: string }[]; material?: string };
      return { afirmacoes: r.afirmacoes ?? [], material: r.material ?? '' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado.';
      toast({ title: 'Não deu para conferir agora', description: msg, variant: 'destructive' });
      return null;
    }
  };

  const apagarPost = async (postId: string) => {
    const { error } = await agencia().from('blog_posts').delete().eq('id', postId);
    if (error) {
      toast({ title: 'Não deu para apagar', description: error.message, variant: 'destructive' });
      return false;
    }
    invalidar();
    return true;
  };

  return { criarPost, salvarCampos, gerarPasso, conferirTexto, apagarPost, gerando, validar };
}
