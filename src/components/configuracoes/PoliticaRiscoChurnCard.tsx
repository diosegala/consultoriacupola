import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, ShieldAlert } from 'lucide-react';
import { usePoliticaDecisao, useAtualizarPoliticaDecisao } from '@/hooks/usePoliticasDecisao';
import { normalizarParametrosRiscoChurn, type ParametrosRiscoChurn } from '@/lib/riscoEngajamento';

const CAMPOS: Array<{ key: keyof ParametrosRiscoChurn; label: string; step: string; help: string }> = [
  { key: 'score_critico', label: 'Score crítico da última reunião', step: '0.1', help: 'Abaixo disso o cliente vira crítico' },
  { key: 'media_critica', label: 'Média crítica das 3 últimas', step: '0.1', help: 'Média recente abaixo disso vira crítico' },
  { key: 'queda_minima', label: 'Queda mínima para alerta', step: '0.1', help: 'Diferença entre médias que gera "atenção"' },
  { key: 'min_reunioes', label: 'Mínimo de reuniões analisadas', step: '1', help: 'Abaixo disso o cliente não é avaliado' },
  { key: 'janela_dias', label: 'Janela de análise (dias)', step: '1', help: 'Período de reuniões considerado' },
  { key: 'contrato_vence_em_dias', label: 'Contrato vencendo em (dias)', step: '1', help: 'Eleva a severidade para crítico' },
];

export function PoliticaRiscoChurnCard() {
  const { data: politica, isLoading } = usePoliticaDecisao('risco_churn');
  const atualizar = useAtualizarPoliticaDecisao();
  const [valores, setValores] = useState<ParametrosRiscoChurn | null>(null);

  useEffect(() => {
    if (politica) setValores(normalizarParametrosRiscoChurn(politica.parametros));
  }, [politica]);

  if (isLoading) return <Skeleton className="h-64 w-full max-w-2xl" />;
  if (!politica || !valores) {
    return (
      <Card className="bg-card border-border max-w-2xl">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Nenhuma política ativa de risco de churn encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Limiares de risco de churn
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Versão {politica.versao} · atualizado em {new Date(politica.atualizado_em).toLocaleString('pt-BR')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CAMPOS.map((c) => (
            <div key={c.key} className="space-y-1">
              <Label htmlFor={c.key}>{c.label}</Label>
              <Input
                id={c.key}
                type="number"
                step={c.step}
                value={valores[c.key]}
                onChange={(e) =>
                  setValores({ ...valores, [c.key]: Number(e.target.value) })
                }
              />
              <p className="text-[10px] text-muted-foreground">{c.help}</p>
            </div>
          ))}
        </div>
        <Button
          onClick={() =>
            atualizar.mutate({
              id: politica.id,
              tipo: politica.tipo,
              parametros: { ...valores },
              versao: politica.versao,
            })
          }
          disabled={atualizar.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar limiares
        </Button>
      </CardContent>
    </Card>
  );
}
