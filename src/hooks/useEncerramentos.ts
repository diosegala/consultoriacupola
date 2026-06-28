import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { startOfMonth, endOfMonth, format, addMonths } from 'date-fns';
import { registrarAuditoriaStatusCliente } from '@/lib/auditoria';

/**
 * Calcula a data em que a última parcela do contrato é (ou foi) paga.
 * antecipado: pagamento no início → última parcela em data_inicio + (parcelas - 1) meses
 * postecipado: pagamento no fim → última parcela em data_inicio + parcelas meses
 */
export function calcularDataFimPagamento(
  dataInicio: string,
  parcelas: number,
  tipoVencimento: 'antecipado' | 'postecipado'
): Date {
  const inicio = new Date(dataInicio + 'T00:00:00');
  const meses = tipoVencimento === 'antecipado' ? Math.max(parcelas - 1, 0) : parcelas;
  return addMonths(inicio, meses);
}

export type Encerramento = Tables<'encerramentos'>;
export type EncerramentoInsert = TablesInsert<'encerramentos'>;

export function useEncerramentos(clienteId?: string) {
  return useQuery({
    queryKey: ['encerramentos', clienteId],
    queryFn: async () => {
      let query = supabase
        .from('encerramentos')
        .select(`
          *,
          cliente:clientes!encerramentos_cliente_id_fkey(nome),
          contrato:contratos!encerramentos_contrato_id_fkey(*)
        `)
        .order('data_encerramento', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

export function useEncerrarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clienteId, 
      contratoId, 
      classificacao, 
      justificativa,
      mrrPerdido
    }: { 
      clienteId: string;
      contratoId: string;
      classificacao: 'churn' | 'fim_contrato';
      justificativa?: string;
      mrrPerdido: number;
    }) => {
      // Snapshot status anterior do cliente
      const { data: clienteAntes } = await supabase
        .from('clientes')
        .select('status')
        .eq('id', clienteId)
        .maybeSingle();
      const statusAnterior = (clienteAntes?.status as string | undefined) ?? null;

      // Buscar quantidade de clientes ativos no momento
      const { count: clientesAtivos } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // Criar registro de encerramento
      const { error: encError } = await supabase
        .from('encerramentos')
        .insert({
          cliente_id: clienteId,
          contrato_id: contratoId,
          data_encerramento: new Date().toISOString().split('T')[0],
          classificacao,
          justificativa,
          mrr_perdido: mrrPerdido,
          clientes_ativos_momento: clientesAtivos
        });

      if (encError) throw encError;

      // Para 'fim_contrato', se ainda há parcelas a vencer, mantemos o contrato
      // ATIVO até a data da última parcela (continua compondo MRR).
      // Apenas marcamos `encerrado_em` para identificar o estado de "rabicho financeiro".
      let manterAtivo = false;
      if (classificacao === 'fim_contrato') {
        const { data: contratoData, error: contratoFetchError } = await supabase
          .from('contratos')
          .select('data_inicio, parcelas, tipo_vencimento, data_fim_pagamento')
          .eq('id', contratoId)
          .single();
        if (contratoFetchError) throw contratoFetchError;

        const dataFimPagamento = contratoData.data_fim_pagamento
          ? new Date(contratoData.data_fim_pagamento + 'T00:00:00')
          : calcularDataFimPagamento(
              contratoData.data_inicio,
              contratoData.parcelas,
              contratoData.tipo_vencimento as 'antecipado' | 'postecipado'
            );
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        manterAtivo = dataFimPagamento >= hoje;
      }

      if (manterAtivo) {
        // Só marca encerramento — contrato permanece ativo até a última parcela
        const { error: contratoError } = await supabase
          .from('contratos')
          .update({ encerrado_em: new Date().toISOString() })
          .eq('id', contratoId);
        if (contratoError) throw contratoError;
      } else {
        // Desativa contrato imediatamente (comportamento original)
        const { error: contratoError } = await supabase
          .from('contratos')
          .update({ ativo: false, encerrado_em: new Date().toISOString() })
          .eq('id', contratoId);
        if (contratoError) throw contratoError;

        // Atualizar status do cliente para encerrado se não houver outros ativos
        const { data: outrosContratosAtivos, error: checkError } = await supabase
          .from('contratos')
          .select('id')
          .eq('cliente_id', clienteId)
          .eq('ativo', true)
          .neq('id', contratoId);
        if (checkError) throw checkError;

        if (!outrosContratosAtivos || outrosContratosAtivos.length === 0) {
          const { error: clienteError } = await supabase
            .from('clientes')
            .update({ status: 'encerrado' })
            .eq('id', clienteId);
          if (clienteError) throw clienteError;
        }
      }

      // Sincronizar Kanban: mover projeto ativo para a etapa mapeada como 'encerrado'.
      // Fallback: se nenhuma etapa estiver mapeada como 'encerrado', apenas garante
      // o status do cliente como 'encerrado'.
      if (!manterAtivo) {
        const { data: etapaEncerrada } = await supabase
          .from('projetos_etapas')
          .select('id')
          .eq('status_cliente', 'encerrado')
          .eq('ativo', true)
          .order('ordem')
          .limit(1)
          .maybeSingle();

        let projetoMovidoId: string | null = null;
        let etapaAnteriorId: string | null = null;
        if (etapaEncerrada?.id) {
          const { data: projetosCliente } = await supabase
            .from('projetos')
            .select('id, updated_at, etapa_id')
            .eq('cliente_id', clienteId)
            .neq('etapa_id', etapaEncerrada.id)
            .order('updated_at', { ascending: false })
            .limit(1);
          const projeto = projetosCliente?.[0];
          if (projeto) {
            projetoMovidoId = projeto.id;
            etapaAnteriorId = (projeto as any).etapa_id ?? null;
            await supabase
              .from('projetos')
              .update({ etapa_id: etapaEncerrada.id, ordem_na_etapa: 0 })
              .eq('id', projeto.id);
          }
        } else {
          // Garantia explícita do status quando não há etapa mapeada
          await supabase
            .from('clientes')
            .update({ status: 'encerrado' })
            .eq('id', clienteId);
        }

        await registrarAuditoriaStatusCliente({
          clienteId,
          origem: 'encerrar_contrato',
          contratoId,
          projetoId: projetoMovidoId,
          etapaAnteriorId,
          etapaNovaId: etapaEncerrada?.id ?? null,
          statusAnterior,
          statusNovo: 'encerrado',
          metadata: { classificacao, mrr_perdido: mrrPerdido, manter_ativo: false },
        });
      } else {
        await registrarAuditoriaStatusCliente({
          clienteId,
          origem: 'encerrar_contrato',
          contratoId,
          statusAnterior,
          statusNovo: statusAnterior,
          metadata: { classificacao, mrr_perdido: mrrPerdido, manter_ativo: true },
        });
      }

      return { clienteId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['contratos', data.clienteId] });
      queryClient.invalidateQueries({ queryKey: ['all-contratos'] });
      queryClient.invalidateQueries({ queryKey: ['encerramentos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    }
  });
}

export function useChurnDoMes(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'churn-mes', consultorIds],
    queryFn: async () => {
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Buscar churns do mês com dados do cliente
      const { data: churns, error: churnsError } = await supabase
        .from('encerramentos')
        .select(`
          classificacao,
          cliente:clientes!encerramentos_cliente_id_fkey(consultor_id)
        `)
        .eq('classificacao', 'churn')
        .gte('data_encerramento', inicioMes)
        .lte('data_encerramento', fimMes);

      if (churnsError) throw churnsError;

      // Filtrar por consultor se necessário
      const churnsFiltered = consultorIds?.length 
        ? (churns as any[])?.filter(c => consultorIds.includes(c.cliente?.consultor_id))
        : churns;

      // Buscar clientes que estavam ativos no início do mês
      let clientesQuery = supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ativo', 'aguardando_renovacao', 'encerrado'])
        .lt('created_at', inicioMes);

      if (consultorIds && consultorIds.length > 0) {
        clientesQuery = clientesQuery.in('consultor_id', consultorIds);
      }

      const { count: clientesInicioMes } = await clientesQuery;

      if (!clientesInicioMes || clientesInicioMes === 0) return 0;

      const percentualChurn = ((churnsFiltered?.length || 0) / clientesInicioMes) * 100;
      return Math.round(percentualChurn * 10) / 10; // Uma casa decimal
    }
  });
}

export function useListaChurnMes(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'lista-churn-mes', consultorIds],
    queryFn: async () => {
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('encerramentos')
        .select(`
          id,
          data_encerramento,
          classificacao,
          justificativa,
          mrr_perdido,
          cliente:clientes!encerramentos_cliente_id_fkey(
            id, nome, cidade, uf, consultor_id,
            consultor:consultores(id, nome)
          ),
          contrato:contratos!encerramentos_contrato_id_fkey(
            tipo_consultoria:tipos_consultoria(nome)
          )
        `)
        .eq('classificacao', 'churn')
        .gte('data_encerramento', inicioMes)
        .lte('data_encerramento', fimMes)
        .order('data_encerramento', { ascending: false });

      if (error) throw error;

      return (data as any[]).filter(c => 
        !consultorIds?.length || consultorIds.includes(c.cliente?.consultor_id)
      );
    }
  });
}
