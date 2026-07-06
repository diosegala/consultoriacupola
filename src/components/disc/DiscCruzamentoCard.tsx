import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users2, RefreshCw, Loader2, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { useCruzamentoDisc, useRegerarCruzamento, usePerfilDisc } from '@/hooks/useDisc';
import { toast } from '@/hooks/use-toast';

export function DiscCruzamentoCard({
  diretor_id, consultor_id, consultor_nome,
}: { diretor_id: string; consultor_id: string; consultor_nome: string }) {
  const { data: cruz, isLoading } = useCruzamentoDisc(diretor_id, consultor_id);
  const { data: perfilDir } = usePerfilDisc(diretor_id);
  const { data: perfilCons } = usePerfilDisc(consultor_id);
  const regerar = useRegerarCruzamento();

  const analise = cruz?.analise as any;
  const faltaPerfil = !perfilDir || !perfilCons;

  async function onRegerar() {
    try {
      await regerar.mutateAsync({ diretor_id, consultor_id });
      toast({ title: 'Análise atualizada' });
    } catch (e: any) {
      toast({ title: 'Falha ao gerar', description: e?.message ?? '', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Users2 className="h-4 w-4 text-primary" /> Dinâmica Diretor × {consultor_nome}
        </CardTitle>
        {!faltaPerfil && (
          <Button size="sm" variant="outline" onClick={onRegerar} disabled={regerar.isPending}>
            {regerar.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            {analise ? 'Regerar análise' : 'Gerar análise'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {faltaPerfil ? (
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            Cadastre o perfil DISC do diretor e da consultora para gerar a análise de dinâmica.
          </p>
        ) : isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !analise ? (
          <p className="text-sm text-muted-foreground">Análise ainda não gerada.</p>
        ) : (
          <>
            <div>
              <Badge variant="outline" className="mb-2">Compatibilidade</Badge>
              <p className="text-sm">{analise.compatibilidade_geral}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Pontos de sinergia
                </p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {(analise.pontos_de_sinergia ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 space-y-1">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Pontos de tensão
                </p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {(analise.pontos_de_tensao ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Comunicação recomendada</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {(analise.recomendacoes_comunicacao ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Delegação eficaz</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {(analise.recomendacoes_delegacao ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/30 space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Sinais de alerta</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                {(analise.sinais_de_alerta ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            <div className="p-3 rounded-md border border-border/50">
              <p className="text-xs uppercase text-muted-foreground mb-1">Como dar feedback</p>
              <p className="text-sm whitespace-pre-wrap">{analise.como_dar_feedback}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}