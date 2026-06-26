import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRenovacoesKPIs(consultorIds?: string[]) {
  return useQuery({
    queryKey: ['renovacoes-kpis', consultorIds],
    queryFn: async () => {
      const { data: etapas } = await supabase
        .from('projetos_etapas')
        .select('id, nome')
        .in('nome', ['Ciclo de Renovação', 'Negociação de Renovação', 'Renovação Fechada']);

      const etapaMap = new Map((etapas ?? []).map(e => [e.nome, e.id]));
      const idCiclo = etapaMap.get('Ciclo de Renovação');
      const idNeg = etapaMap.get('Negociação de Renovação');
      const idFechada = etapaMap.get('Renovação Fechada');

      const { data: projetos } = await supabase
        .from('projetos')
        .select('id, etapa_id, consultor_id, updated_at, cliente_id, clientes(nome), contratos(data_fim)')
        .eq('tipo', 'renovacao');

      const list = ((projetos ?? []) as any[]).filter(p =>
        !consultorIds?.length || consultorIds.includes(p.consultor_id)
      );

      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const emAndamento = list.filter((p: any) => p.etapa_id === idCiclo || p.etapa_id === idNeg);
      const fechadasMes = list.filter((p: any) =>
        p.etapa_id === idFechada && new Date(p.updated_at) >= startMonth
      );

      return {
        emAndamento: emAndamento.length,
        fechadasMes: fechadasMes.length,
        listaEmAndamento: emAndamento,
        listaFechadasMes: fechadasMes,
      };
    },
  });
}