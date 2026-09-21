import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ChaveIntegracao = 'firecrawl' | 'runrunit' | 'google_drive';

export interface CampoIntegracao {
  id: string;
  segredo: boolean;
  preenchido: boolean;
  resumo: string | null;
}

export interface IntegracaoStatus {
  chave: ChaveIntegracao;
  configurada: boolean;
  ativo: boolean;
  observacao: string | null;
  atualizado_em: string | null;
  campos: CampoIntegracao[];
}

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('integracoes-admin', { body });
  if (error) {
    const detalhe = 'context' in error && (error as any).context?.text
      ? await (error as any).context.text()
      : error.message;
    throw new Error(detalhe);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useIntegracoes(enabled = true) {
  return useQuery({
    queryKey: ['integracoes-admin'],
    enabled,
    queryFn: async () => (await chamar<{ itens: IntegracaoStatus[] }>({ acao: 'listar' })).itens,
  });
}

export function useIntegracaoAcoes() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ['integracoes-admin'] });

  const salvar = useMutation({
    mutationFn: (p: { chave: ChaveIntegracao; credenciais: Record<string, string>; observacao?: string | null }) =>
      chamar<{ teste: { ok: boolean; detalhe: string } }>({ acao: 'salvar', ...p }),
    onSuccess: invalidar,
  });

  const testar = useMutation({
    mutationFn: (chave: ChaveIntegracao) =>
      chamar<{ teste: { ok: boolean; detalhe: string } }>({ acao: 'testar', chave }),
  });

  const alternar = useMutation({
    mutationFn: (p: { chave: ChaveIntegracao; ativo: boolean }) => chamar({ acao: 'alternar', ...p }),
    onSuccess: invalidar,
  });

  const remover = useMutation({
    mutationFn: (chave: ChaveIntegracao) => chamar({ acao: 'remover', chave }),
    onSuccess: invalidar,
  });

  return { salvar, testar, alternar, remover };
}
