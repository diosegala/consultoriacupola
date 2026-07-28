import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ShieldAlert, TrendingDown, MessageSquare, Sparkles, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useClientesEmRisco, type ClienteEmRisco } from '@/hooks/useRiscoEngajamento';
import { RegistrarInteracaoDialog } from '@/components/cliente/RegistrarInteracaoDialog';

function Sparkline({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const w = 96;
  const h = 24;
  const max = 10;
  const step = w / (serie.length - 1);
  const pontos = serie
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (Math.max(0, Math.min(max, v)) / max) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline points={pontos} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
    </svg>
  );
}

function severidadeClass(sev: ClienteEmRisco['severidade']) {
  return sev === 'critico'
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : 'bg-yellow-500/15 text-yellow-600 border-yellow-600/30';
}

export function RiscoChurnSection() {
  const { data: clientes, isLoading } = useClientesEmRisco();
  const [detalhe, setDetalhe] = useState<ClienteEmRisco | null>(null);
  const [interacaoAlvo, setInteracaoAlvo] = useState<ClienteEmRisco | null>(null);

  const { criticos, atencao } = useMemo(() => {
    const lista = clientes ?? [];
    return {
      criticos: lista.filter((c) => c.severidade === 'critico').length,
      atencao: lista.filter((c) => c.severidade === 'atencao').length,
    };
  }, [clientes]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Risco de churn — engajamento do cliente
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
              {criticos} crítico(s)
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/15 text-yellow-600 border-yellow-600/30 text-[10px]">
              {atencao} em atenção
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (clientes?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente com queda relevante de engajamento nas reuniões analisadas. 🎯
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clientes!.map((c) => (
                <button
                  key={c.cliente_id}
                  type="button"
                  onClick={() => setDetalhe(c)}
                  className="text-left rounded-md border border-border/50 bg-card/40 p-3 hover:bg-muted/40 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.cliente_nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {c.consultor_nome ?? 'Sem consultor'} · {c.totalAvaliadas} reunião(ões) avaliada(s)
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] shrink-0', severidadeClass(c.severidade))}>
                      {c.severidade === 'critico' ? 'Crítico' : 'Atenção'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold text-foreground leading-none">
                        {c.scoreAtual.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Média recente {c.mediaRecente.toFixed(1)}
                        {c.variacao != null && (
                          <span className={cn('ml-1 inline-flex items-center gap-0.5', c.variacao < 0 && 'text-destructive')}>
                            {c.variacao < 0 && <TrendingDown className="h-3 w-3" />}
                            {c.variacao > 0 ? '+' : ''}
                            {c.variacao.toFixed(1)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Sparkline serie={c.serie} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Última reunião em {format(parseISO(c.ultimaData), "dd 'de' MMM yyyy", { locale: ptBR })}
                    {c.contrato_vence_em != null && c.contrato_vence_em <= 90 && (
                      <> · contrato vence em {c.contrato_vence_em} dia(s)</>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detalhe && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detalhe.cliente_nome}
                  <Badge variant="outline" className={cn('text-[10px]', severidadeClass(detalhe.severidade))}>
                    {detalhe.severidade === 'critico' ? 'Crítico' : 'Atenção'}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-5">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Por que está no radar</p>
                  <ul className="space-y-1">
                    {detalhe.motivos.map((m, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {m}</li>
                    ))}
                  </ul>
                </div>

                {detalhe.criterios_baixos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Critérios mais baixos na última reunião</p>
                    <div className="space-y-1">
                      {detalhe.criterios_baixos.map((c) => (
                        <div key={c.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className="font-semibold text-destructive">{c.valor.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detalhe.pontos_melhoria.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Pontos de melhoria apontados pela IA</p>
                    <ul className="space-y-1">
                      {detalhe.pontos_melhoria.map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/clientes/${detalhe.cliente_id}?tab=desempenho`}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Abrir cliente
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setInteracaoAlvo(detalhe)}>
                    <MessageSquare className="h-3 w-3 mr-1" /> Registrar contato
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/clientes/${detalhe.cliente_id}?tab=agentes&agente=balanco_periodo`}>
                      <Sparkles className="h-3 w-3 mr-1" /> Gerar balanço do período
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {interacaoAlvo && (
        <RegistrarInteracaoDialog
          open={!!interacaoAlvo}
          onOpenChange={(o) => !o && setInteracaoAlvo(null)}
          clienteId={interacaoAlvo.cliente_id}
          consultorId={interacaoAlvo.consultor_id}
        />
      )}
    </>
  );
}
