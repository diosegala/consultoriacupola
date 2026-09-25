import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agencia } from '@/integrations/supabase/agencia';

export interface Squad {
  id: string;
  nome: string;
  cor: string | null;
  coordenacao_id: string | null;
  atendimento_id: string | null;
}
export interface EventoAuditoria {
  id: string;
  em: string;
  pessoa_id: string | null;
  acao: string;
  alvo: string | null;
  detalhe: string | null;
  negado: boolean | null;
}
export interface UsoIa {
  quando: string;
  custo: number | null;
  agente: string | null;
  cliente_id: string | null;
  modelo: string | null;
  entrada: number | null;
  saida: number | null;
}

/** Grava um evento no registro da agência. Falha de registro não trava a ação. */
export async function registrarAuditoria(pessoaId: string | undefined, acao: string, alvo?: string, detalhe?: string) {
  if (!pessoaId) return;
  await agencia().from('auditoria').insert({
    id: crypto.randomUUID(), em: new Date().toISOString(), pessoa_id: pessoaId,
    acao, alvo: alvo ?? null, detalhe: detalhe ?? null, negado: false,
  });
}

export function useSquadsCompletos() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'squads'],
    queryFn: async () => {
      const [s, ps, sc] = await Promise.all([
        agencia().from('squads').select('id, nome, cor, coordenacao_id, atendimento_id').order('nome'),
        agencia().from('pessoa_squads').select('pessoa_id, squad_id'),
        agencia().from('squad_clientes').select('cliente_id, squad_id'),
      ]);
      if (s.error) throw s.error;
      return {
        squads: (s.data ?? []) as Squad[],
        membros: (ps.data ?? []) as { pessoa_id: string; squad_id: string }[],
        carteira: (sc.data ?? []) as { cliente_id: string; squad_id: string }[],
      };
    },
  });
}

export function useAcessosAgente() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'acessos-agente'],
    queryFn: async () => {
      const { data, error } = await agencia().from('acessos_agente').select('agente_id, espaco_id');
      if (error) throw error;
      return (data ?? []) as { agente_id: string; espaco_id: string }[];
    },
  });
}

export function useAuditoria() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'auditoria'],
    queryFn: async () => {
      const { data, error } = await agencia().from('auditoria').select('*').order('em', { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as EventoAuditoria[];
    },
  });
}

export function useUsoIa(desde: string) {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'uso', desde],
    queryFn: async () => {
      const { data, error } = await agencia()
        .from('uso_de_ia')
        .select('quando, custo, agente, cliente_id, modelo, entrada, saida')
        .gte('quando', desde)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as UsoIa[];
    },
  });
}

export function useSessoesDesde(desde: string) {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'sessoes', desde],
    queryFn: async () => {
      const { data, error } = await agencia().from('sessoes').select('agente_id, cliente_id, atualizada_em').gte('atualizada_em', desde);
      if (error) throw error;
      return (data ?? []) as { agente_id: string | null; cliente_id: string | null; atualizada_em: string }[];
    },
  });
}

/** Ações de escrita da gestão, sempre registradas na auditoria. */
export function useGestaoAcoes(pessoaId?: string) {
  const qc = useQueryClient();
  const recarregar = (k: string) => qc.invalidateQueries({ queryKey: ['agencia', 'gestao', k] });
  const falhou = (e: { message: string } | null) => {
    if (e) toast.error(e.message);
    return !e;
  };

  const salvarSquad = async (s: Squad, novo: boolean) => {
    const { error } = novo
      ? await agencia().from('squads').insert(s)
      : await agencia().from('squads').update(s).eq('id', s.id);
    if (!falhou(error)) return false;
    await registrarAuditoria(pessoaId, novo ? 'squad.criado' : 'squad.alterado', s.nome);
    recarregar('squads');
    toast.success('Squad salvo.');
    return true;
  };

  const alternarVinculo = async (
    tabela: 'pessoa_squads' | 'squad_clientes',
    campo: 'pessoa_id' | 'cliente_id',
    id: string,
    squadId: string,
    ligado: boolean,
    rotulo: string,
  ) => {
    const { error } = ligado
      ? await agencia().from(tabela).delete().eq(campo, id).eq('squad_id', squadId)
      : await agencia().from(tabela).insert({ [campo]: id, squad_id: squadId });
    if (!falhou(error)) return;
    await registrarAuditoria(pessoaId, `${tabela === 'pessoa_squads' ? 'squad.membro' : 'squad.carteira'}.${ligado ? 'removido' : 'incluido'}`, rotulo, squadId);
    recarregar('squads');
  };

  const alternarAcessoAgente = async (agenteId: string, espacoId: string, ligado: boolean, rotulo: string) => {
    const { error } = ligado
      ? await agencia().from('acessos_agente').delete().eq('agente_id', agenteId).eq('espaco_id', espacoId)
      : await agencia().from('acessos_agente').insert({ agente_id: agenteId, espaco_id: espacoId });
    if (!falhou(error)) return;
    await registrarAuditoria(pessoaId, `agente.acesso.${ligado ? 'removido' : 'liberado'}`, rotulo, espacoId);
    recarregar('acessos-agente');
  };

  return { salvarSquad, alternarVinculo, alternarAcessoAgente };
}
