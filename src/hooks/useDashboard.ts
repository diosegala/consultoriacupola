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

export function useAlertas(consultorId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'alertas', consultorId],
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
          if (!consultorId || c.cliente?.consultor_id === consultorId) {
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
          if (!consultorId || r.cliente?.consultor_id === consultorId) {
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
          if (!consultorId || o.cliente?.consultor_id === consultorId) {
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

export function useMRRHistorico() {
  return useQuery({
    queryKey: ['dashboard', 'mrr-historico'],
    queryFn: async () => {
      const resultado: { mes: string; mrr: number }[] = [];
      
      // Buscar todos os contratos com datas
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select('data_inicio, data_fim, remuneracao_mensal, ativo');

      if (error) throw error;

      // Calcular MRR para cada mês dos últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const mesRef = subMonths(new Date(), i);
        const inicioMes = startOfMonth(mesRef);
        const fimMes = endOfMonth(mesRef);

        // Contratos ativos naquele mês
        const mrrMes = (contratos || [])
          .filter(c => {
            const inicio = parseISO(c.data_inicio);
            const fim = parseISO(c.data_fim);
            // Contrato estava ativo durante o mês
            return isBefore(inicio, fimMes) && isBefore(inicioMes, fim);
          })
          .reduce((sum, c) => sum + Number(c.remuneracao_mensal || 0), 0);

        resultado.push({
          mes: format(mesRef, 'MMM/yy', { locale: ptBR }),
          mrr: mrrMes
        });
      }

      return resultado;
    }
  });
}

export function useContratosHistorico() {
  return useQuery({
    queryKey: ['dashboard', 'contratos-historico'],
    queryFn: async () => {
      const resultado: { mes: string; novos: number; encerrados: number }[] = [];

      // Buscar todos os contratos (data_inicio para novos)
      const { data: contratos, error: contratosError } = await supabase
        .from('contratos')
        .select('data_inicio');

      if (contratosError) throw contratosError;

      // Buscar todos os encerramentos (data_encerramento para encerrados)
      const { data: encerramentos, error: encError } = await supabase
        .from('encerramentos')
        .select('data_encerramento');

      if (encError) throw encError;

      // Calcular para cada mês dos últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const mesRef = subMonths(new Date(), i);
        const inicioMes = startOfMonth(mesRef);
        const fimMes = endOfMonth(mesRef);

        // Contratos que iniciaram naquele mês
        const novosNoMes = (contratos || []).filter(c => {
          const dataInicio = parseISO(c.data_inicio);
          return isWithinInterval(dataInicio, { start: inicioMes, end: fimMes });
        }).length;

        // Encerramentos naquele mês
        const encerradosNoMes = (encerramentos || []).filter(e => {
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
