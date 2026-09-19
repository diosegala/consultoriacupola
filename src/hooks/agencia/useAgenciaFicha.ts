import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FonteDaProposta {
  origem: string;
  trecho: string;
}

export interface SugestaoFicha {
  campo: string;
  valor: string;
  fontes: FonteDaProposta[];
}

export interface RegraSugerida {
  tipo: 'veto' | 'obrigatorio' | 'posicionamento';
  texto: string;
  porque?: string;
  termos?: string[];
}

export interface LeituraDaFicha {
  sugestoes: SugestaoFicha[];
  regras: RegraSugerida[];
  documentos: string[];
  cortados: string[];
  acrescimo: boolean;
}

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('agencia-ficha', { body });
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

/** Lê o material da conta e propõe o preenchimento da ficha. Nada é gravado aqui. */
export function useFichaAutomatica(clienteId?: string) {
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [leitura, setLeitura] = useState<LeituraDaFicha | null>(null);
  const queryClient = useQueryClient();

  const ler = async () => {
    if (!clienteId) return;
    setLendo(true);
    setLeitura(null);
    try {
      const data = await chamar({ acao: 'ler', cliente_id: clienteId });
      setLeitura(data as LeituraDaFicha);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível ler o material.');
    } finally {
      setLendo(false);
    }
  };

  const aplicar = async (campos: Record<string, string>, regras: RegraSugerida[]) => {
    if (!clienteId) return false;
    setSalvando(true);
    try {
      await chamar({ acao: 'aplicar', cliente_id: clienteId, campos, regras });
      await queryClient.invalidateQueries({ queryKey: ['agencia', 'cliente'] });
      toast.success('Ficha atualizada.');
      setLeitura(null);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  return { lendo, salvando, leitura, ler, aplicar, limpar: () => setLeitura(null) };
}
