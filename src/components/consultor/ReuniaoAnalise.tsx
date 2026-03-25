import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ReuniaoComDetalhes } from '@/hooks/useReunioes';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ReuniaoAnaliseProps {
  reuniao: ReuniaoComDetalhes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const criterioLabels: Record<string, string> = {
  empatia: 'Empatia e Escuta Ativa',
  clareza: 'Clareza na Comunicação',
  proatividade: 'Proatividade',
  dominio_tecnico: 'Domínio Técnico',
  orientacao_resultados: 'Orientação para Resultados',
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

export function ReuniaoAnalise({ reuniao, open, onOpenChange }: ReuniaoAnaliseProps) {
  if (!reuniao) return null;

  const analise = reuniao.analise_ia as Record<string, any> | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Análise da Reunião — {reuniao.clientes?.nome}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(reuniao.data_reuniao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {reuniao.duracao_minutos && ` · ${reuniao.duracao_minutos} min`}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Score geral */}
            {reuniao.score_ia != null && (
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${getScoreColor(reuniao.score_ia)}`}>
                  {reuniao.score_ia.toFixed(1)}
                </div>
                <div>
                  <p className="text-foreground font-medium">Score Geral</p>
                  <p className="text-sm text-muted-foreground">Média dos 5 critérios avaliados</p>
                </div>
              </div>
            )}

            <Separator className="bg-border" />

            {/* Resumo */}
            {reuniao.resumo_ia && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Resumo</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{reuniao.resumo_ia}</p>
              </div>
            )}

            {/* Critérios */}
            {analise && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Critérios de Avaliação</h3>
                <div className="space-y-3">
                  {Object.entries(criterioLabels).map(([key, label]) => {
                    const nota = Number(analise[key]) || 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground">{label}</span>
                          <span className={`font-semibold ${getScoreColor(nota)}`}>{nota.toFixed(1)}</span>
                        </div>
                        <Progress value={nota * 10} className={`h-2 bg-muted ${getProgressColor(nota)}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pontos fortes e melhoria */}
            {analise && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analise.pontos_fortes?.length > 0 && (
                  <Card className="bg-secondary border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-success">
                        <CheckCircle className="h-4 w-4" /> Pontos Fortes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {analise.pontos_fortes.map((p: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground">• {p}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {analise.pontos_melhoria?.length > 0 && (
                  <Card className="bg-secondary border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" /> Pontos de Melhoria
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {analise.pontos_melhoria.map((p: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground">• {p}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Transcrição */}
            {reuniao.transcricao && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Transcrição</h3>
                <div className="bg-secondary rounded-md p-4 max-h-[300px] overflow-y-auto">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {reuniao.transcricao}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
