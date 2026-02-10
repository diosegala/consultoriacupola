import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, subMonths, startOfMonth, endOfMonth, parseISO, isBefore, startOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface Alerta {
  tipo: 'contrato_vencendo' | 'reuniao_atrasada' | 'onboarding_pendente';
  cliente_id: string;
  cliente_nome: string;
  detalhe: string;
}

export function useAlertas(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'alertas', consultorIds],
    queryFn: async () => {
      const alertas: Alerta[] = [];
      const hoje = startOfDay(new Date());
      const em30Dias = addDays(hoje, 30);

      // 1. Contratos vencendo nos próximos 30 dias
      let contratosQuery = supabase
        .from('contratos')
        .select(`
          data_fim,
          cliente:clientes!contratos_cliente_id_fkey(id, nome, status, consultor_id)
        `)
        .eq('ativo', true)
        .lte('data_fim', format(em30Dias, 'yyyy-MM-dd'))
        .gte('data_fim', format(hoje, 'yyyy-MM-dd'));

      const { data: contratos } = await contratosQuery;

      (contratos as any[])?.forEach(c => {
        if (c.cliente?.status === 'ativo') {
          if (!consultorIds?.length || consultorIds.includes(c.cliente?.consultor_id)) {
            alertas.push({
              tipo: 'contrato_vencendo',
              cliente_id: c.cliente.id,
              cliente_nome: c.cliente.nome,
              detalhe: `Contrato vence em ${format(parseISO(c.data_fim), 'dd/MM/yyyy')}`
            });
          }
        }
      });

      // 2. Reuniões atrasadas
      let reunioesQuery = supabase
        .from('atendimentos')
        .select(`
          proxima_reuniao,
          cliente:clientes!atendimentos_cliente_id_fkey(id, nome, status, consultor_id)
        `)
        .lt('proxima_reuniao', format(hoje, 'yyyy-MM-dd'));

      const { data: reunioes } = await reunioesQuery;

      (reunioes as any[])?.forEach(r => {
        if (r.cliente?.status === 'ativo') {
          if (!consultorIds?.length || consultorIds.includes(r.cliente?.consultor_id)) {
            alertas.push({
              tipo: 'reuniao_atrasada',
              cliente_id: r.cliente.id,
              cliente_nome: r.cliente.nome,
              detalhe: `Reunião prevista para ${format(parseISO(r.proxima_reuniao), 'dd/MM/yyyy')}`
            });
          }
        }
      });

      // 3. Onboardings pendentes
      let onboardingsQuery = supabase
        .from('onboarding')
        .select(`
          etapa_atual,
          cliente:clientes!onboarding_cliente_id_fkey(id, nome, status, consultor_id)
        `)
        .neq('etapa_atual', 'concluido');

      const { data: onboardings } = await onboardingsQuery;

      const etapasLabel: Record<string, string> = {
        pre_onboarding: 'Pré-onboarding',
        imersao_1: 'Imersão 1',
        imersao_2: 'Imersão 2',
        imersao_3: 'Imersão 3'
      };

      (onboardings as any[])?.forEach(o => {
        if (o.cliente?.status === 'ativo') {
          if (!consultorIds?.length || consultorIds.includes(o.cliente?.consultor_id)) {
            alertas.push({
              tipo: 'onboarding_pendente',
              cliente_id: o.cliente.id,
              cliente_nome: o.cliente.nome,
              detalhe: `Etapa atual: ${etapasLabel[o.etapa_atual] || o.etapa_atual}`
            });
          }
        }
      });

      return alertas;
    }
  });
}

export function useMRRHistorico(consultorIds?: string[], mesesFuturos: number = 0) {
  return useQuery({
    queryKey: ['dashboard', 'mrr-historico', consultorIds, mesesFuturos],
    queryFn: async () => {
      const resultado: { mes: string; mrr: number | null; mrr_projetado: number | null }[] = [];
      
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          data_inicio, data_fim, remuneracao_mensal, ativo,
          cliente:clientes!contratos_cliente_id_fkey(consultor_id)
        `);

      if (error) throw error;

      const contratosFiltrados = consultorIds?.length 
        ? (contratos as any[])?.filter(c => consultorIds.includes(c.cliente?.consultor_id))
        : contratos;

      const hoje = new Date();
      const mesAtualIndex = 0; // will be calculated relative to loop

      // Past 11 months + current month + future months
      for (let i = 11; i >= -mesesFuturos; i--) {
        const mesRef = subMonths(hoje, i);
        const inicioMes = startOfMonth(mesRef);
        const fimMes = endOfMonth(mesRef);
        const isFuturo = i < 0;
        const isAtual = i === 0;

        const mrrMes = (contratosFiltrados || [])
          .filter(c => {
            const inicio = parseISO(c.data_inicio);
            const fim = parseISO(c.data_fim);
            return isBefore(inicio, fimMes) && isBefore(inicioMes, fim);
          })
          .reduce((sum, c) => sum + Number(c.remuneracao_mensal || 0), 0);

        resultado.push({
          mes: format(mesRef, 'MMM/yy', { locale: ptBR }),
          mrr: isFuturo ? null : mrrMes,
          mrr_projetado: (isFuturo || isAtual) ? mrrMes : null
        });
      }

      return resultado;
    }
  });
}

export function useContratosHistorico(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'contratos-historico', consultorIds],
    queryFn: async () => {
      const resultado: { mes: string; novos: number; encerrados: number }[] = [];

      const { data: contratos, error: contratosError } = await supabase
        .from('contratos')
        .select(`
          data_inicio,
          cliente:clientes!contratos_cliente_id_fkey(consultor_id)
        `);

      if (contratosError) throw contratosError;

      const { data: encerramentos, error: encError } = await supabase
        .from('encerramentos')
        .select(`
          data_encerramento,
          cliente:clientes!encerramentos_cliente_id_fkey(consultor_id)
        `);

      if (encError) throw encError;

      const contratosFiltrados = consultorIds?.length 
        ? (contratos as any[])?.filter(c => consultorIds.includes(c.cliente?.consultor_id))
        : contratos;
      
      const encerramentosFiltrados = consultorIds?.length 
        ? (encerramentos as any[])?.filter(e => consultorIds.includes(e.cliente?.consultor_id))
        : encerramentos;

      for (let i = 11; i >= 0; i--) {
        const mesRef = subMonths(new Date(), i);
        const inicioMes = startOfMonth(mesRef);
        const fimMes = endOfMonth(mesRef);

        const novosNoMes = (contratosFiltrados || []).filter(c => {
          const dataInicio = parseISO(c.data_inicio);
          return isWithinInterval(dataInicio, { start: inicioMes, end: fimMes });
        }).length;

        const encerradosNoMes = (encerramentosFiltrados || []).filter(e => {
          const dataEnc = parseISO(e.data_encerramento);
          return isWithinInterval(dataEnc, { start: inicioMes, end: fimMes });
        }).length;

        resultado.push({
          mes: format(mesRef, 'MMM/yy', { locale: ptBR }),
          novos: novosNoMes,
          encerrados: encerradosNoMes
        });
      }

      return resultado;
    }
  });
}

export function useMediaDespesasViagens(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'media-despesas-viagens', consultorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viagens_contrato')
        .select(`
          valor, contrato_id,
          cliente:clientes!viagens_contrato_cliente_id_fkey(consultor_id)
        `);

      if (error) throw error;

      const filtrados = consultorIds?.length
        ? (data as any[])?.filter(v => consultorIds.includes(v.cliente?.consultor_id))
        : data;

      if (!filtrados || filtrados.length === 0) return 0;

      const totalDespesas = filtrados.reduce((sum, v) => sum + Number(v.valor || 0), 0);
      const contratosUnicos = new Set(filtrados.map(v => v.contrato_id)).size;

      return contratosUnicos > 0 ? totalDespesas / contratosUnicos : 0;
    }
  });
}

export function useDespesasViagensMensal(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['dashboard', 'despesas-viagens-mensal', consultorIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viagens_contrato')
        .select(`
          data_viagem, valor,
          cliente:clientes!viagens_contrato_cliente_id_fkey(consultor_id)
        `);

      if (error) throw error;

      const filtrados = consultorIds?.length
        ? (data as any[])?.filter(v => consultorIds.includes(v.cliente?.consultor_id))
        : data;

      const resultado: { mes: string; total: number }[] = [];

      for (let i = 11; i >= 0; i--) {
        const mesRef = subMonths(new Date(), i);
        const inicioMes = startOfMonth(mesRef);
        const fimMes = endOfMonth(mesRef);

        const totalMes = (filtrados || [])
          .filter(v => {
            const dataViagem = parseISO(v.data_viagem);
            return isWithinInterval(dataViagem, { start: inicioMes, end: fimMes });
          })
          .reduce((sum, v) => sum + Number(v.valor || 0), 0);

        resultado.push({
          mes: format(mesRef, 'MMM/yy', { locale: ptBR }),
          total: totalMes
        });
      }

      return resultado;
    }
  });
}
