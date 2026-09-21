import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FonteMercado {
  id: string;
  nome: string;
  descricao: string | null;
  cadencia: string | null;
  automatica: boolean | null;
  da_casa: boolean | null;
  url: string | null;
  feed: string | null;
  classificar: boolean | null;
  ultima_leitura: string | null;
  ultimo_erro: string | null;
}

export interface Leitura {
  id: string;
  titulo: string;
  resumo: string | null;
  fonte_id: string | null;
  publicado_em: string | null;
  regioes: string[] | null;
  temas: string[] | null;
  link: string | null;
  imagem: string | null;
  porque: string | null;
}

export function useFontesMercado() {
  return useQuery({
    queryKey: ['agencia', 'fontes-mercado'],
    queryFn: async (): Promise<FonteMercado[]> => {
      const { data, error } = await agencia().from('fontes_mercado').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as FonteMercado[];
    },
  });
}

export function useLeituras() {
  return useQuery({
    queryKey: ['agencia', 'leituras'],
    queryFn: async (): Promise<Leitura[]> => {
      const { data, error } = await agencia()
        .from('leituras')
        .select('*')
        .order('publicado_em', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Leitura[];
    },
  });
}

/** Buscar notícias novas nos feeds das fontes. */
export function useLerFontes() {
  const qc = useQueryClient();
  const [lendo, setLendo] = useState(false);

  const ler = async (fonteId?: string) => {
    setLendo(true);
    try {
      const { data, error } = await supabase.functions.invoke('agencia-mercado-ler', {
        body: fonteId ? { fonte_id: fonteId } : {},
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const resumo = (data as { resumo?: { fonte: string; novas: number; erro?: string }[] }).resumo ?? [];
      const novas = resumo.reduce((n, r) => n + r.novas, 0);
      const falhas = resumo.filter((r) => r.erro);
      toast({
        title: novas ? `${novas} notícia(s) nova(s)` : 'Nenhuma notícia nova',
        description: falhas.length ? `Não deu para ler: ${falhas.map((f) => f.fonte).join(', ')}` : undefined,
      });
      qc.invalidateQueries({ queryKey: ['agencia', 'leituras'] });
      qc.invalidateQueries({ queryKey: ['agencia', 'fontes-mercado'] });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado.';
      toast({ title: 'Não deu para buscar as notícias', description: msg, variant: 'destructive' });
      return false;
    } finally {
      setLendo(false);
    }
  };

  return { ler, lendo };
}
