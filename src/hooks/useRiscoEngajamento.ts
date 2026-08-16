import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns';
import {
  avaliarRiscoEngajamento,
  PARAMETROS_RISCO_CHURN_DEFAULT,
  normalizarParametrosRiscoChurn,
  type AvaliacaoRisco,
} from '@/lib/riscoEngajamento';
import { usePoliticaDecisao } from '@/hooks/usePoliticasDecisao';

export interface ClienteEmRisco extends AvaliacaoRisco {
  cliente_id: string;
  cliente_nome: string;
  consultor_id: string | null;
  consultor_nome: string | null;
  contrato_vence_em: number | null;
  criterios_baixos: Array<{ label: string; valor: number }>;
  pontos_melhoria: string[];
}

const CRITERIO_LABELS: Record<string, string> = {
  participacao_ativa: 'Participação ativa',
  abertura_sugestoes: 'Abertura a sugestões',
  comprometimento_acoes: 'Comprometimento com ações',
  clareza_demandas: 'Clareza nas demandas',
  engajamento_estrategico: 'Engajamento estratégico',
};

export function useClientesEmRisco() {
  const { data: politica, isLoading: politicaLoading } = usePoliticaDecisao('risco_churn');
  const parametros = politica
    ? normalizarParametrosRiscoChurn(politica.parametros)
    : PARAMETROS_RISCO_CHURN_DEFAULT;

  return useQuery({
    queryKey: ['risco-engajamento', 'clientes', parametros],
    enabled: !politicaLoading,
    queryFn: async (): Promise<ClienteEmRisco[]> => {
      const desde = format(subDays(new Date(), parametros.janela_dias), 'yyyy-MM-dd');
      const hojeISO = format(new Date(), 'yyyy-MM-dd');

      const [cliRes, reunRes, contRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nome, consultor_id, status, arquivado_em, consultores(nome)')
          .in('status', ['ativo', 'aguardando_renovacao'])
          .is('arquivado_em', null),
        supabase
          .from('reunioes')
          .select('cliente_id, data_reuniao, score_cliente, analise_cliente')
          .eq('status_analise', 'concluido')
          .not('score_cliente', 'is', null)
          .gte('data_reuniao', desde)
          .order('data_reuniao', { ascending: false }),
        supabase
          .from('contratos')
          .select('cliente_id, data_fim')
          .eq('ativo', true)
          .is('encerrado_em', null)
          .gte('data_fim', hojeISO),
      ]);

      if (cliRes.error) throw cliRes.error;
      if (reunRes.error) throw reunRes.error;

      const clientes = (cliRes.data ?? []) as any[];
      const reunioes = (reunRes.data ?? []) as any[];
      const contratos = (contRes.data ?? []) as any[];

      const venceEmPorCliente = new Map<string, number>();
      for (const c of contratos) {
        const dias = differenceInCalendarDays(parseISO(c.data_fim), new Date());
        const atual = venceEmPorCliente.get(c.cliente_id);
        if (atual == null || dias < atual) venceEmPorCliente.set(c.cliente_id, dias);
      }

      const porCliente = new Map<string, any[]>();
      for (const r of reunioes) {
        const arr = porCliente.get(r.cliente_id) ?? [];
        arr.push(r);
        porCliente.set(r.cliente_id, arr);
      }

      const resultado: ClienteEmRisco[] = [];

      for (const cli of clientes) {
        const rs = porCliente.get(cli.id) ?? [];
        if (!rs.length) continue;
        const venceEm = venceEmPorCliente.get(cli.id) ?? null;
        const avaliacao = avaliarRiscoEngajamento(
          rs.map((r) => ({ data_reuniao: r.data_reuniao, score_cliente: Number(r.score_cliente) })),
          parametros,
          { contratoVenceEmDias: venceEm },
        );
        if (!avaliacao) continue;

        const ultima = rs[0];
        const analise = (ultima?.analise_cliente ?? {}) as Record<string, any>;
        const criterios_baixos = Object.keys(CRITERIO_LABELS)
          .map((k) => ({ label: CRITERIO_LABELS[k], valor: Number(analise?.[k] ?? 0) }))
          .filter((c) => c.valor > 0 && c.valor < 7)
          .sort((a, b) => a.valor - b.valor);

        resultado.push({
          ...avaliacao,
          cliente_id: cli.id,
          cliente_nome: cli.nome,
          consultor_id: cli.consultor_id ?? null,
          consultor_nome: cli.consultores?.nome ?? null,
          contrato_vence_em: venceEm,
          criterios_baixos,
          pontos_melhoria: Array.isArray(analise?.pontos_melhoria) ? analise.pontos_melhoria.slice(0, 3) : [],
        });
      }

      return resultado.sort((a, b) => {
        if (a.severidade !== b.severidade) return a.severidade === 'critico' ? -1 : 1;
        return a.mediaRecente - b.mediaRecente;
      });
    },
  });
}
