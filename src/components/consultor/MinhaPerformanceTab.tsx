import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface MinhaPerformanceTabProps {
  consultorId: string;
  /** Optional: filter reunioes to a specific cliente. */
  clienteId?: string;
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-success';
  if (score >= 6) return 'text-warning';
  return 'text-destructive';
}

export function MinhaPerformanceTab({ consultorId, clienteId }: MinhaPerformanceTabProps) {
  const { data: reunioes, isLoading } = useQuery({
    queryKey: ['minha-performance', consultorId, clienteId ?? 'all'],
    enabled: !!consultorId,
    queryFn: async () => {
      let q = supabase
        .from('reunioes')
        .select('id, data_reuniao, score_ia, resumo_ia, status_analise, cliente_id, clientes(nome)')
        .eq('consultor_id', consultorId)
        .eq('status_analise', 'concluido')
        .not('score_ia', 'is', null)
        .order('data_reuniao', { ascending: true });
      if (clienteId) q = q.eq('cliente_id', clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!reunioes || reunioes.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma análise de performance disponível ainda.</p>
          <p className="text-sm mt-1">As notas aparecem aqui após a análise de IA das reuniões.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = reunioes.map((r) => ({
    data: format(parseISO(r.data_reuniao), 'dd/MM/yy', { locale: ptBR }),
    score: Number(r.score_ia),
    cliente: r.clientes?.nome,
  }));

  const media =
    Math.round((reunioes.reduce((s, r) => s + Number(r.score_ia || 0), 0) / reunioes.length) * 10) /
    10;

  const ultima = [...reunioes].reverse().find((r) => r.resumo_ia);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-bold ${getScoreColor(media)}`}>{media.toFixed(1)}</div>
        <div>
          <p className="text-foreground font-medium">Score médio de performance</p>
          <p className="text-sm text-muted-foreground">{reunioes.length} reunião(ões) analisada(s)</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Evolução do score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={media} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {ultima && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm">
              Última análise — {format(parseISO(ultima.data_reuniao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {ultima.clientes?.nome ? ` · ${ultima.clientes.nome}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {ultima.resumo_ia}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}