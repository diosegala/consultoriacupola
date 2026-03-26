import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, BarChart3, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface DesempenhoClienteTabProps {
  clienteId: string;
}

const criterioLabels: Record<string, string> = {
  participacao_ativa: 'Participação Ativa',
  abertura_sugestoes: 'Abertura a Sugestões',
  comprometimento_acoes: 'Comprometimento com Ações',
  clareza_demandas: 'Clareza nas Demandas',
  engajamento_estrategico: 'Engajamento Estratégico',
};

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-success';
  if (score >= 6) return 'text-warning';
  return 'text-destructive';
}

function getProgressColor(score: number): string {
  if (score >= 8) return '[&>div]:bg-success';
  if (score >= 6) return '[&>div]:bg-warning';
  return '[&>div]:bg-destructive';
}

function useReunioesClienteComAnalise(clienteId: string) {
  return useQuery({
    queryKey: ['reunioes-cliente-analise', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select('*, consultores(nome)')
        .eq('cliente_id', clienteId)
        .eq('status_analise', 'concluido')
        .not('analise_cliente', 'is', null)
        .order('data_reuniao', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });
}

export function DesempenhoClienteTab({ clienteId }: DesempenhoClienteTabProps) {
  const navigate = useNavigate();
  const { data: reunioes, isLoading } = useReunioesClienteComAnalise(clienteId);

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
          <p>Nenhuma avaliação de engajamento disponível.</p>
          <p className="text-sm mt-1">As avaliações são geradas automaticamente ao analisar reuniões.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate averages
  const criterioKeys = Object.keys(criterioLabels);
  const avgByCriterio = criterioKeys.map(key => {
    const avg = reunioes.reduce((sum, r) => sum + Number((r.analise_cliente as any)?.[key] || 0), 0) / reunioes.length;
    return { key, avg: Math.round(avg * 10) / 10 };
  }).sort((a, b) => b.avg - a.avg);

  const avgScore = Math.round(
    (reunioes.reduce((sum, r) => sum + Number(r.score_cliente || 0), 0) / reunioes.length) * 10
  ) / 10;

  return (
    <div className="space-y-6">
      {/* Header with score and report button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`text-5xl font-bold ${getScoreColor(avgScore)}`}>
            {avgScore.toFixed(1)}
          </div>
          <div>
            <p className="text-foreground font-medium">Score Médio de Engajamento</p>
            <p className="text-sm text-muted-foreground">{reunioes.length} reunião(ões) analisada(s)</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/clientes/${clienteId}/relatorio`)}
          className="border-border"
        >
          <FileText className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      {/* Média por critério */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Média por Critério</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {avgByCriterio.map(({ key, avg }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">{criterioLabels[key]}</span>
                <span className={`font-semibold ${getScoreColor(avg)}`}>{avg.toFixed(1)}</span>
              </div>
              <Progress value={avg * 10} className={`h-2 bg-muted ${getProgressColor(avg)}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reuniões individuais */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Detalhamento por Reunião</h3>
        {reunioes.map((reuniao) => {
          const analise = reuniao.analise_cliente as any;
          return (
            <Card key={reuniao.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">
                      {format(parseISO(reuniao.data_reuniao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consultor: {reuniao.consultores?.nome || 'N/A'}
                      {reuniao.duracao_minutos && ` · ${reuniao.duracao_minutos} min`}
                    </p>
                  </div>
                  <Badge variant="outline" className={getScoreColor(reuniao.score_cliente || 0)}>
                    {Number(reuniao.score_cliente || 0).toFixed(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo */}
                {analise?.resumo && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{analise.resumo}</p>
                )}

                {/* Critérios */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {criterioKeys.map(key => {
                    const nota = Number(analise?.[key] || 0);
                    return (
                      <div key={key} className="bg-secondary rounded-md p-2 text-center">
                        <p className={`text-lg font-bold ${getScoreColor(nota)}`}>{nota.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{criterioLabels[key]}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Pontos fortes e melhoria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analise?.pontos_fortes?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span className="text-xs font-semibold text-success">Pontos Fortes</span>
                      </div>
                      {analise.pontos_fortes.map((p: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground mb-1">• {p}</p>
                      ))}
                    </div>
                  )}
                  {analise?.pontos_melhoria?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <AlertTriangle className="h-3 w-3 text-warning" />
                        <span className="text-xs font-semibold text-warning">A Evoluir</span>
                      </div>
                      {analise.pontos_melhoria.map((p: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground mb-1">• {p}</p>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
