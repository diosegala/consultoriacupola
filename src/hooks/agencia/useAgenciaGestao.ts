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
/** Uso de IA no período, já somado por agente × conta × modelo. */
export interface UsoIa {
  agente: string | null;
  cliente_id: string | null;
  modelo: string | null;
  chamadas: number;
  custo: number;
}

/** Grava um evento no registro da agência. Falha de registro não trava a ação. */
export async function registrarAuditoria(pessoaId: string | undefined, acao: string, alvo?: string, detalhe?: string) {
  if (!pessoaId) return;
  const { error } = await agencia().from('auditoria').insert({
    id: crypto.randomUUID(), em: new Date().toISOString(), pessoa_id: pessoaId,
    acao, alvo: alvo ?? null, detalhe: detalhe ?? null, negado: false,
  });
  if (error) console.warn('[auditoria] registro recusado:', acao, error.message);
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
      // Histórico importado do CupolaOS + uso deste sistema (public.ai_usage_logs), pela função do banco.
      const { data, error } = await agencia().rpc('uso_ia_desde', { p_desde: desde });
      if (error) throw error;
      return ((data ?? []) as UsoIa[]).map((u) => ({ ...u, chamadas: Number(u.chamadas), custo: Number(u.custo ?? 0) }));
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

  /** Tira do catálogo ou devolve, pela função do banco (só a liderança). */
  const arquivarAgente = async (agenteId: string, arquivar: boolean, rotulo: string) => {
    const { error } = await agencia().rpc('arquivar_agente', { p_id: agenteId, p_arquivado: arquivar });
    if (!falhou(error)) return;
    await registrarAuditoria(pessoaId, arquivar ? 'agente.arquivado' : 'agente.devolvido', rotulo);
    await qc.invalidateQueries({ queryKey: ['agencia', 'agentes'] });
    toast.success(arquivar ? `${rotulo} saiu do catálogo.` : `${rotulo} voltou ao catálogo.`);
  };

  return { salvarSquad, alternarVinculo, alternarAcessoAgente, arquivarAgente };
}

/** A camada da casa (essência e escrita) que entra em toda conversa com os agentes. */
export function useCamadaCupola() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'contexto-cupola'],
    queryFn: async () => {
      const { data, error } = await agencia()
        .from('contexto_camadas').select('essencia, escrita, atualizado_em, atualizado_por').eq('escopo', 'cupola').maybeSingle();
      if (error) throw error;
      return (data ?? null) as { essencia: string; escrita: string; atualizado_em: string; atualizado_por: string | null } | null;
    },
  });
}

/** Grava pela função do banco, que confere a liderança (ninguém escreve direto na tabela). */
export function useSalvarCamadaCupola(pessoaId?: string) {
  const client = useQueryClient();
  return async (essencia: string, escrita: string) => {
    const { error } = await agencia().rpc('salvar_camada_contexto', { p_escopo: 'cupola', p_essencia: essencia, p_escrita: escrita });
    if (error) throw error;
    await registrarAuditoria(pessoaId, 'contexto.alterado', 'cupola');
    await client.invalidateQueries({ queryKey: ['agencia', 'gestao', 'contexto-cupola'] });
  };
}

/* ---------------- Teto de gasto de IA ---------------- */

export type PortaIa = 'conversa' | 'geracao';
export interface LimiteIa {
  escopo: string;
  porta: PortaIa;
  teto_usd: number;
  definido_em: string;
  definido_por: string | null;
}
export interface GastoIa {
  pessoa_id: string | null;
  area_id: string | null;
  porta: PortaIa;
  gasto: number;
}
export interface AvisoSistema {
  id: string;
  tom: 'risco' | 'atencao' | 'neutro';
  titulo: string;
  detalhe: string;
  visto_em: string;
}

/** Os tetos em vigor. Sem linha = sem limite. */
export function useLimitesIa() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'limites-ia'],
    queryFn: async () => {
      const { data, error } = await agencia().from('limites_ia').select('*');
      if (error) throw error;
      return ((data ?? []) as LimiteIa[]).map((l) => ({ ...l, teto_usd: Number(l.teto_usd) }));
    },
  });
}

/** O gasto do mês corrente (horário de São Paulo), por pessoa e porta. */
export function useGastoIaDoMes() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'gasto-ia-mes'],
    queryFn: async () => {
      const { data, error } = await agencia().rpc('gasto_ia_do_mes');
      if (error) throw error;
      return ((data ?? []) as GastoIa[]).map((g) => ({ ...g, gasto: Number(g.gasto ?? 0) }));
    },
  });
}

/** Os avisos que o banco cria (hoje, o dos 80% do teto). Só a liderança lê. */
export function useAvisosSistema() {
  return useQuery({
    queryKey: ['agencia', 'gestao', 'avisos'],
    queryFn: async () => {
      const { data, error } = await agencia().from('avisos_sistema').select('*').order('visto_em', { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as AvisoSistema[];
    },
  });
}

/**
 * Define, altera ou tira (teto nulo) um limite, pela função do banco, que confere
 * quem pode mexer e grava a mudança na auditoria com o valor de antes e o de depois.
 */
export function useDefinirLimiteIa() {
  const qc = useQueryClient();
  return async (escopo: string, porta: PortaIa, teto: number | null) => {
    const { error } = await agencia().rpc('definir_limite_ia', { p_escopo: escopo, p_teto: teto, p_porta: porta });
    if (error) throw error;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['agencia', 'gestao', 'limites-ia'] }),
      qc.invalidateQueries({ queryKey: ['agencia', 'gestao', 'auditoria'] }),
    ]);
  };
}
