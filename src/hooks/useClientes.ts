import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Cliente = Tables<'clientes'>;
export type ClienteInsert = TablesInsert<'clientes'>;
export type ClienteUpdate = TablesUpdate<'clientes'>;

export interface ClienteComDetalhes extends Cliente {
  consultor?: Tables<'consultores'> | null;
  contrato_ativo?: (Tables<'contratos'> & { 
    tipo_consultoria?: Tables<'tipos_consultoria'> | null 
  }) | null;
  _projeto_status_cliente?: 'novo' | 'ativo' | 'aguardando_renovacao' | 'encerrado' | null;
  _projeto_etapa_nome?: string | null;
}

interface UseClientesFilters {
  status?: string;
  consultor_id?: string;
  tipo_consultoria_id?: string;
  cidade?: string;
  search?: string;
  incluir_arquivados?: boolean;
  apenas_arquivados?: boolean;
}

export function useClientes(filters?: UseClientesFilters) {
  return useQuery({
    queryKey: ['clientes', filters],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          consultor:consultores(*),
          contrato_ativo:contratos!contratos_cliente_id_fkey(
            *,
            tipo_consultoria:tipos_consultoria(*)
          ),
          projetos(updated_at, tipo, projetos_etapas(nome, status_cliente))
        `)
        .order('nome');

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status as 'novo' | 'ativo' | 'aguardando_renovacao' | 'encerrado');
      }
      if (filters?.consultor_id) {
        query = query.eq('consultor_id', filters.consultor_id);
      }
      if (filters?.search) {
        query = query.ilike('nome', `%${filters.search}%`);
      }
      if (filters?.cidade) {
        query = query.ilike('cidade', `%${filters.cidade}%`);
      }
      if (filters?.apenas_arquivados) {
        query = query.not('arquivado_em', 'is', null);
      } else if (!filters?.incluir_arquivados) {
        query = query.is('arquivado_em', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar para pegar apenas o contrato ativo + projeto mais recente
      return (data as any[]).map(cliente => {
        const projetos = (cliente.projetos ?? []) as Array<{ updated_at: string; tipo: string; projetos_etapas: { nome: string; status_cliente: string | null } | null }>;
        const sorted = [...projetos].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
        const principal = sorted.find(p => p.tipo !== 'renovacao') ?? sorted[0];
        return {
          ...cliente,
          contrato_ativo: cliente.contrato_ativo?.find((c: any) => c.ativo) || null,
          _projeto_status_cliente: principal?.projetos_etapas?.status_cliente ?? null,
          _projeto_etapa_nome: principal?.projetos_etapas?.nome ?? null,
        };
      }) as ClienteComDetalhes[];
    }
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          consultor:consultores(*),
          contrato_ativo:contratos!contratos_cliente_id_fkey(
            *,
            tipo_consultoria:tipos_consultoria(*)
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        contrato_ativo: (data as any).contrato_ativo?.find((c: any) => c.ativo) || null
      } as ClienteComDetalhes;
    },
    enabled: !!id
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cliente: ClienteInsert) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(cliente)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ClienteUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useClientesAtivos(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'clientes-ativos', consultorIds],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      if (consultorIds && consultorIds.length > 0) {
        query = query.in('consultor_id', consultorIds);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });
}

export function useClientesAguardandoRenovacao(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'aguardando-renovacao', consultorIds],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aguardando_renovacao');

      if (consultorIds && consultorIds.length > 0) {
        query = query.in('consultor_id', consultorIds);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });
}

export function useListaClientesAguardandoRenovacao(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'lista-aguardando-renovacao', consultorIds],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          consultor:consultores(id, nome),
          contrato_ativo:contratos!contratos_cliente_id_fkey(
            id, remuneracao_mensal, data_fim, ativo,
            tipo_consultoria:tipos_consultoria(nome)
          )
        `)
        .eq('status', 'aguardando_renovacao')
        .order('nome');

      if (consultorIds && consultorIds.length > 0) {
        query = query.in('consultor_id', consultorIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data as any[]).map(cliente => ({
        ...cliente,
        contrato_ativo: cliente.contrato_ativo?.find((c: any) => c.ativo) || null
      }));
    }
  });
}

export function useListaClientesAtivos(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'lista-clientes-ativos', consultorIds],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          consultor:consultores(id, nome),
          contrato_ativo:contratos!contratos_cliente_id_fkey(
            id, remuneracao_mensal, data_fim, ativo,
            tipo_consultoria:tipos_consultoria(nome)
          )
        `)
        .eq('status', 'ativo')
        .order('nome');

      if (consultorIds && consultorIds.length > 0) {
        query = query.in('consultor_id', consultorIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data as any[]).map(cliente => ({
        ...cliente,
        contrato_ativo: cliente.contrato_ativo?.find((c: any) => c.ativo) || null
      }));
    }
  });
}

export function useDeleteCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: arquivamento único e atômico + trilha de auditoria.
      // Evita deixar o banco meio apagado e sobrevive a novas tabelas relacionadas.
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { data: current } = await supabase
        .from('clientes')
        .select('status')
        .eq('id', id)
        .maybeSingle();

      const { error } = await supabase
        .from('clientes')
        .update({
          status: 'encerrado',
          arquivado_em: new Date().toISOString(),
          arquivado_por: uid,
        })
        .eq('id', id);
      if (error) throw error;

      // Trilha de auditoria (best-effort — não bloqueia sucesso se falhar)
      if (uid) {
        await supabase.from('auditoria_status_cliente').insert({
          cliente_id: id,
          origem: 'arquivamento',
          status_anterior: current?.status ?? null,
          status_novo: 'encerrado',
          user_id: uid,
          metadata: { acao: 'arquivar' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

// Alias com nome mais claro para novos usos
export const useArquivarCliente = useDeleteCliente;

export function useDesarquivarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { error } = await supabase
        .from('clientes')
        .update({ arquivado_em: null, arquivado_por: null })
        .eq('id', id);
      if (error) throw error;

      if (uid) {
        await supabase.from('auditoria_status_cliente').insert({
          cliente_id: id,
          origem: 'arquivamento',
          user_id: uid,
          metadata: { acao: 'desarquivar' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente'] });
    },
  });
}

// Exclusão física — restrita a admin por RLS.
// Usa CASCADE do banco (FKs) quando existir; caso o RLS bloqueie ou faltem cascades,
// a operação falha e nada é apagado parcialmente.
export function useHardDeleteCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      // Registra intenção antes de apagar (auditoria de exclusão física)
      if (uid) {
        await supabase.from('auditoria_status_cliente').insert({
          cliente_id: id,
          origem: 'exclusao_fisica',
          user_id: uid,
          metadata: { acao: 'hard_delete' },
        });
      }

      // Cascade manual apenas para tabelas sem FK CASCADE ainda configurada.
      // Cada passo é idempotente e o cliente é o último a sair.
      const { data: contratos } = await supabase
        .from('contratos').select('id').eq('cliente_id', id);
      if (contratos && contratos.length > 0) {
        const cids = contratos.map(c => c.id);
        await supabase.from('pausas_contrato').delete().in('contrato_id', cids);
        await supabase.from('viagens_contrato').delete().in('contrato_id', cids);
      }
      await supabase.from('atendimentos').delete().eq('cliente_id', id);
      await supabase.from('ferramentas_cliente').delete().eq('cliente_id', id);
      await supabase.from('onboarding').delete().eq('cliente_id', id);
      await supabase.from('encerramentos').delete().eq('cliente_id', id);
      await supabase.from('contratos').delete().eq('cliente_id', id);
      await supabase.from('webhook_logs').delete().eq('cliente_id', id);

      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
