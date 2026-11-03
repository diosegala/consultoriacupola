import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth } from 'date-fns';

export interface AiUsageRow {
  id: string;
  created_at: string;
  provider: string;
  model: string | null;
  agente_tipo: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cliente_id: string | null;
  consultor_id: string | null;
  user_id: string | null;
  status: string;
  clientes?: { nome: string } | null;
  consultores?: { nome: string } | null;
}

export interface AiUsageAggregates {
  totalUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  porCliente: Array<{ id: string; nome: string; cost_usd: number; calls: number }>;
  porConsultor: Array<{ id: string; nome: string; cost_usd: number; calls: number }>;
  porAgente: Array<{ tipo: string; cost_usd: number; calls: number }>;
  recentes: AiUsageRow[];
}

export function useAiUsage(periodo: 'mes' | 'tudo' = 'mes') {
  return useQuery({
    queryKey: ['ai-usage', periodo],
    queryFn: async (): Promise<AiUsageAggregates> => {
      let q = supabase
        .from('ai_usage_logs' as any)
        .select('id, created_at, provider, model, agente_tipo, input_tokens, output_tokens, cost_usd, cliente_id, consultor_id, user_id, status, clientes(nome), consultores(nome)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (periodo === 'mes') {
        q = q.gte('created_at', startOfMonth(new Date()).toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = ((data ?? []) as unknown) as AiUsageRow[];

      const porClienteMap = new Map<string, { nome: string; cost_usd: number; calls: number }>();
      const porConsultorMap = new Map<string, { nome: string; cost_usd: number; calls: number }>();
      const porAgenteMap = new Map<string, { cost_usd: number; calls: number }>();
      let totalUsd = 0, totalCalls = 0, totalIn = 0, totalOut = 0;

      for (const r of rows) {
        const cost = Number(r.cost_usd ?? 0);
        totalUsd += cost;
        totalCalls += 1;
        totalIn += Number(r.input_tokens ?? 0);
        totalOut += Number(r.output_tokens ?? 0);

        if (r.cliente_id) {
          const cur = porClienteMap.get(r.cliente_id) ?? { nome: r.clientes?.nome ?? 'Cliente', cost_usd: 0, calls: 0 };
          cur.cost_usd += cost; cur.calls += 1;
          porClienteMap.set(r.cliente_id, cur);
        }
        if (r.consultor_id) {
          const cur = porConsultorMap.get(r.consultor_id) ?? { nome: r.consultores?.nome ?? 'Consultor', cost_usd: 0, calls: 0 };
          cur.cost_usd += cost; cur.calls += 1;
          porConsultorMap.set(r.consultor_id, cur);
        }
        if (r.agente_tipo) {
          const cur = porAgenteMap.get(r.agente_tipo) ?? { cost_usd: 0, calls: 0 };
          cur.cost_usd += cost; cur.calls += 1;
          porAgenteMap.set(r.agente_tipo, cur);
        }
      }

      const porCliente = Array.from(porClienteMap.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.cost_usd - a.cost_usd);
      const porConsultor = Array.from(porConsultorMap.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.cost_usd - a.cost_usd);
      const porAgente = Array.from(porAgenteMap.entries())
        .map(([tipo, v]) => ({ tipo, ...v }))
        .sort((a, b) => b.cost_usd - a.cost_usd);

      return {
        totalUsd,
        totalCalls,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        porCliente,
        porConsultor,
        porAgente,
        recentes: rows.slice(0, 20),
      };
    },
  });
}