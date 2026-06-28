import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { registrarAuditoriaStatusCliente } from '@/lib/auditoria';

export type Contrato = Tables<'contratos'> & { pausado?: boolean };
export type ContratoInsert = TablesInsert<'contratos'>;
export type ContratoUpdate = TablesUpdate<'contratos'>;

export interface ContratoComTipo extends Contrato {
  tipo_consultoria?: Tables<'tipos_consultoria'> | null;
}

export function useContratos(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['contratos', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContratoComTipo[];
    },
    enabled: !!clienteId
  });
}

export function useContratoAtivo(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['contrato-ativo', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*)
        `)
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      return data as ContratoComTipo | null;
    },
    enabled: !!clienteId
  });
}

export function useCreateContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contrato: ContratoInsert) => {
      const { data, error } = await supabase
        .from('contratos')
        .insert(contrato)
        .select()
        .single();

      if (error) throw error;

      // Atualizar status do cliente para 'ativo' se o contrato for ativo
      if (contrato.ativo !== false) {
        const { error: clienteError } = await supabase
          .from('clientes')
          .update({ status: 'ativo' })
          .eq('id', contrato.cliente_id);

        if (clienteError) throw clienteError;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useUpdateContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cliente_id, ...updates }: ContratoUpdate & { id: string; cliente_id: string }) => {
      const { data, error } = await supabase
        .from('contratos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, cliente_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useRenovarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contratoAtualId, novoContrato }: { 
      contratoAtualId: string; 
      novoContrato: ContratoInsert 
    }) => {
      // Snapshot status anterior do cliente
      const { data: clienteAntes } = await supabase
        .from('clientes')
        .select('status')
        .eq('id', novoContrato.cliente_id)
        .maybeSingle();
      const statusAnterior = (clienteAntes?.status as string | undefined) ?? null;

      // Desativar contrato atual
      const { error: updateError } = await supabase
        .from('contratos')
        .update({ ativo: false })
        .eq('id', contratoAtualId);

      if (updateError) throw updateError;

      // Criar novo contrato
      const { data, error } = await supabase
        .from('contratos')
        .insert({ ...novoContrato, ativo: true })
        .select()
        .single();

      if (error) throw error;

      // Atualizar status do cliente para ativo (caso esteja aguardando renovação)
      const { error: clienteError } = await supabase
        .from('clientes')
        .update({ status: 'ativo' })
        .eq('id', novoContrato.cliente_id);

      if (clienteError) throw clienteError;

      // Sincronizar Kanban: mover projeto existente para a etapa mapeada como 'ativo'.
      // Se não houver projeto, criar um novo na primeira etapa ativa.
      const { data: etapaAtiva } = await supabase
        .from('projetos_etapas')
        .select('id')
        .eq('status_cliente', 'ativo')
        .eq('ativo', true)
        .order('ordem')
        .limit(1)
        .maybeSingle();

      if (etapaAtiva?.id && novoContrato.cliente_id) {
        const { data: projetosCliente } = await supabase
          .from('projetos')
          .select('id, etapa_id, tipo')
          .eq('cliente_id', novoContrato.cliente_id)
          .order('updated_at', { ascending: false });

        const projetoNormal = projetosCliente?.find((p: any) => p.tipo !== 'renovacao') ?? projetosCliente?.[0];

        let projetoMovidoId: string | null = null;
        let etapaAnteriorId: string | null = null;
        if (projetoNormal) {
          projetoMovidoId = projetoNormal.id;
          etapaAnteriorId = projetoNormal.etapa_id;
          if (projetoNormal.etapa_id !== etapaAtiva.id) {
            await supabase
              .from('projetos')
              .update({ etapa_id: etapaAtiva.id, ordem_na_etapa: 0 })
              .eq('id', projetoNormal.id);
          }
        } else {
          // Sem projeto: buscar consultor do cliente e criar
          const { data: clienteRow } = await supabase
            .from('clientes')
            .select('consultor_id')
            .eq('id', novoContrato.cliente_id)
            .maybeSingle();
          if (clienteRow?.consultor_id) {
            const { data: novoProj } = await supabase.from('projetos').insert({
              cliente_id: novoContrato.cliente_id,
              contrato_id: data.id,
              consultor_id: clienteRow.consultor_id,
              etapa_id: etapaAtiva.id,
              ordem_na_etapa: 0,
              tipo: 'normal',
            }).select('id').single();
            projetoMovidoId = novoProj?.id ?? null;
          }
        }

        await registrarAuditoriaStatusCliente({
          clienteId: novoContrato.cliente_id,
          origem: 'renovar_contrato',
          contratoId: data.id,
          projetoId: projetoMovidoId,
          etapaAnteriorId,
          etapaNovaId: etapaAtiva.id,
          statusAnterior,
          statusNovo: 'ativo',
          metadata: { contrato_anterior_id: contratoAtualId },
        });
      } else if (novoContrato.cliente_id) {
        await registrarAuditoriaStatusCliente({
          clienteId: novoContrato.cliente_id,
          origem: 'renovar_contrato',
          contratoId: data.id,
          statusAnterior,
          statusNovo: 'ativo',
          metadata: { contrato_anterior_id: contratoAtualId },
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    }
  });
}

export interface ContratoComCliente extends ContratoComTipo {
  cliente?: Tables<'clientes'> & {
    consultor?: Tables<'consultores'> | null;
  } | null;
}

export interface AllContratosFilters {
  ativo?: boolean | 'all';
  consultor_id?: string;
  tipo_consultoria_id?: string;
  search?: string;
  vencimento?: 'all' | '30' | '60' | '90' | 'vencidos';
}

export function useAllContratos(filters?: AllContratosFilters) {
  return useQuery({
    queryKey: ['all-contratos', filters],
    queryFn: async () => {
      let query = supabase
        .from('contratos')
        .select(`
          *,
          tipo_consultoria:tipos_consultoria(*),
          cliente:clientes!contratos_cliente_id_fkey(
            id, nome, cidade, uf, status,
            consultor:consultores(id, nome)
          )
        `)
        .order('data_fim', { ascending: true });

      // Filtro de status
      if (filters?.ativo !== undefined && filters.ativo !== 'all') {
        query = query.eq('ativo', filters.ativo);
      }

      // Filtro por tipo de consultoria
      if (filters?.tipo_consultoria_id) {
        query = query.eq('tipo_consultoria_id', filters.tipo_consultoria_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = data as ContratoComCliente[];

      // Filtro por consultor (via cliente)
      if (filters?.consultor_id) {
        result = result.filter(c => c.cliente?.consultor?.id === filters.consultor_id);
      }

      // Filtro por busca de cliente
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(c => 
          c.cliente?.nome?.toLowerCase().includes(searchLower)
        );
      }

      // Filtro por vencimento
      if (filters?.vencimento && filters.vencimento !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filters.vencimento === 'vencidos') {
          result = result.filter(c => {
            const dataFim = new Date(c.data_fim);
            return dataFim < today && c.ativo;
          });
        } else {
          const days = parseInt(filters.vencimento);
          const futureDate = new Date(today);
          futureDate.setDate(futureDate.getDate() + days);

          result = result.filter(c => {
            const dataFim = new Date(c.data_fim);
            return dataFim >= today && dataFim <= futureDate && c.ativo;
          });
        }
      }

      return result;
    }
  });
}

export function useMRRTotal(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'mrr-total', consultorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          remuneracao_mensal,
          cliente:clientes!contratos_cliente_id_fkey(status, consultor_id)
        `)
        .eq('ativo', true);

      if (error) throw error;

      const total = (data as any[])
        .filter(c => c.cliente?.status === 'ativo')
        .filter(c => !consultorIds?.length || consultorIds.includes(c.cliente?.consultor_id))
        .reduce((sum, c) => sum + (Number(c.remuneracao_mensal) || 0), 0);

      return total;
    }
  });
}

export function useListaContratosMRR(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'lista-contratos-mrr', consultorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id,
          remuneracao_mensal,
          data_fim,
          tipo_consultoria:tipos_consultoria(nome),
          cliente:clientes!contratos_cliente_id_fkey(
            id, nome, cidade, uf, status, consultor_id,
            consultor:consultores(id, nome)
          )
        `)
        .eq('ativo', true)
        .order('remuneracao_mensal', { ascending: false });

      if (error) throw error;

      return (data as any[])
        .filter(c => c.cliente?.status === 'ativo')
        .filter(c => !consultorIds?.length || consultorIds.includes(c.cliente?.consultor_id));
    }
  });
}

export function useDeleteContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contratoId, clienteId }: { contratoId: string; clienteId: string }) => {
      // Excluir registros dependentes em ordem
      
      // 1. Excluir viagens do contrato
      const { error: viagensError } = await supabase
        .from('viagens_contrato')
        .delete()
        .eq('contrato_id', contratoId);
      if (viagensError) throw viagensError;

      // 2. Excluir pausas do contrato
      const { error: pausasError } = await supabase
        .from('pausas_contrato')
        .delete()
        .eq('contrato_id', contratoId);
      if (pausasError) throw pausasError;

      // 3. Excluir encerramentos do contrato
      const { error: encError } = await supabase
        .from('encerramentos')
        .delete()
        .eq('contrato_id', contratoId);
      if (encError) throw encError;

      // 4. Excluir onboarding vinculado ao contrato
      const { error: onbError } = await supabase
        .from('onboarding')
        .delete()
        .eq('contrato_id', contratoId);
      if (onbError) throw onbError;

      // 5. Excluir o contrato
      const { error: contratoError } = await supabase
        .from('contratos')
        .delete()
        .eq('id', contratoId);
      if (contratoError) throw contratoError;

      return { clienteId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['contrato-ativo', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}
