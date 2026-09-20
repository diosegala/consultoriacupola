import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RedesTema {
  id: string;
  cliente_id: string;
  mes: string;
  titulo: string;
  justificativa: string | null;
  estado: string | null;
  ordem: number | null;
  formato: string | null;
  instrucoes: string | null;
  legenda: string | null;
  texto_imagem: string | null;
  slides: { papel: string; texto: string }[] | null;
  stories: string[] | null;
}

export interface RedesMes {
  cliente_id: string;
  mes: string;
  tarefa: string | null;
  briefing: string | null;
  datas: string | null;
  sugeridos: string | null;
  palavras: unknown;
}

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('agencia-redes', { body });
  if (error) {
    let detalhe = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const txt = await ctx.text().catch(() => '');
      try {
        detalhe = JSON.parse(txt)?.error ?? txt ?? detalhe;
      } catch {
        detalhe = txt || detalhe;
      }
    }
    throw new Error(detalhe);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data;
}

export function useRedesMes(clienteId?: string, mes?: string) {
  return useQuery({
    queryKey: ['agencia', 'redes-mes', clienteId, mes],
    enabled: !!clienteId && !!mes,
    queryFn: async (): Promise<RedesMes | null> => {
      const { data, error } = await agencia()
        .from('redes_conteudo_meses')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('mes', mes)
        .maybeSingle();
      if (error) throw error;
      return (data as RedesMes) ?? null;
    },
  });
}

export function useRedesTemas(clienteId?: string, mes?: string) {
  return useQuery({
    queryKey: ['agencia', 'redes-temas', clienteId, mes],
    enabled: !!clienteId && !!mes,
    queryFn: async (): Promise<RedesTema[]> => {
      const { data, error } = await agencia()
        .from('redes_conteudo_temas')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('mes', mes)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RedesTema[];
    },
  });
}

export function useRedesConteudo(clienteId?: string, mes?: string) {
  const queryClient = useQueryClient();
  const [gerandoTemas, setGerandoTemas] = useState(false);
  const [escrevendo, setEscrevendo] = useState<string | null>(null);
  const [salvandoBriefing, setSalvandoBriefing] = useState(false);

  const recarregar = () =>
    queryClient.invalidateQueries({ queryKey: ['agencia', 'redes-temas', clienteId, mes] });

  const salvarBriefing = async (campos: { tarefa?: string; briefing?: string; datas?: string; sugeridos?: string }) => {
    if (!clienteId || !mes) return;
    setSalvandoBriefing(true);
    try {
      const { error } = await agencia()
        .from('redes_conteudo_meses')
        .upsert(
          { cliente_id: clienteId, mes, ...campos, atualizado_em: new Date().toISOString() },
          { onConflict: 'cliente_id,mes' },
        );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['agencia', 'redes-mes', clienteId, mes] });
      toast.success('Briefing salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o briefing.');
    } finally {
      setSalvandoBriefing(false);
    }
  };

  const gerarTemas = async () => {
    if (!clienteId || !mes) return;
    setGerandoTemas(true);
    try {
      await chamar({ acao: 'temas', cliente_id: clienteId, mes });
      await recarregar();
      toast.success('Temas sugeridos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível sugerir os temas.');
    } finally {
      setGerandoTemas(false);
    }
  };

  const escreverPeca = async (temaId: string, formato: 'card' | 'carrossel', instrucoes?: string) => {
    if (!clienteId || !mes) return;
    setEscrevendo(temaId);
    try {
      await chamar({ acao: 'peca', cliente_id: clienteId, mes, tema_id: temaId, formato, instrucoes });
      await recarregar();
      toast.success('Texto pronto.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível escrever o texto.');
    } finally {
      setEscrevendo(null);
    }
  };

  return { gerandoTemas, escrevendo, salvandoBriefing, gerarTemas, escreverPeca, salvarBriefing };
}
