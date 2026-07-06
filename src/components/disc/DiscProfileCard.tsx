import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Upload, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  usePerfilDisc, useProcessarDisc, useSignedDiscPdf, DISC_COLORS, PerfilDisc,
} from '@/hooks/useDisc';

function ScoreRow({ letra, valor }: { letra: 'D'|'I'|'S'|'C'; valor: number }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{letra}</span>
        <span className="text-muted-foreground">{Math.round(valor)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${DISC_COLORS[letra]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DiscProfileCard({
  consultor_id, nome, canEdit,
}: { consultor_id: string; nome?: string; canEdit: boolean }) {
  const { data: perfil, isLoading } = usePerfilDisc(consultor_id);
  const processar = useProcessarDisc();
  const signPdf = useSignedDiscPdf(perfil?.pdf_url);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataAval, setDataAval] = useState<string>('');

  const p: PerfilDisc | null = perfil?.perfil_resumo ?? null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Envie um PDF', variant: 'destructive' });
      return;
    }
    try {
      await processar.mutateAsync({ consultor_id, file, data_avaliacao: dataAval || undefined });
      toast({ title: 'Perfil DISC processado', description: 'Análise IA concluída.' });
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: any) {
      toast({ title: 'Erro ao processar', description: err?.message ?? '', variant: 'destructive' });
    }
  }

  async function abrirPdf() {
    try {
      const url = await signPdf.mutateAsync(undefined);
      window.open(url, '_blank');
    } catch (err: any) {
      toast({ title: 'Erro ao abrir PDF', description: err?.message ?? '', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> Perfil Comportamental (DISC){nome ? ` — ${nome}` : ''}
        </CardTitle>
        {canEdit && p && (
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={processar.isPending}>
            {processar.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Atualizar DISC
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !p ? (
          canEdit ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhum perfil DISC cadastrado. Envie o PDF do resultado da avaliação e a IA extrai o perfil.
              </p>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Data da avaliação</Label>
                  <Input type="date" value={dataAval} onChange={(e) => setDataAval(e.target.value)} className="w-40" />
                </div>
                <Button onClick={() => inputRef.current?.click()} disabled={processar.isPending}>
                  {processar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Enviar resultado DISC (PDF)
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Perfil DISC ainda não cadastrado.</p>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="text-base px-3 py-1">
                {p.perfil_primario}/{p.perfil_secundario}
              </Badge>
              {perfil?.data_avaliacao && (
                <span className="text-xs text-muted-foreground">
                  Avaliado em {new Date(perfil.data_avaliacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              {perfil?.pdf_url && (
                <Button size="sm" variant="ghost" onClick={abrirPdf} disabled={signPdf.isPending}>
                  <FileText className="h-3 w-3 mr-1" /> Ver PDF original
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['D','I','S','C'] as const).map((l) => (
                <ScoreRow key={l} letra={l} valor={p.scores?.[l] ?? 0} />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">Pontos fortes</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-foreground">
                  {(p.pontos_fortes ?? []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1">Pontos de atenção</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-foreground">
                  {(p.pontos_de_atencao ?? []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-md bg-muted/30">
                <p className="text-[11px] uppercase text-muted-foreground mb-1">Estilo de comunicação</p>
                <p>{p.estilo_comunicacao}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30">
                <p className="text-[11px] uppercase text-muted-foreground mb-1">Sob pressão</p>
                <p>{p.sob_pressao}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30">
                <p className="text-[11px] uppercase text-muted-foreground mb-1">Como motivar</p>
                <p>{p.como_motivar}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30">
                <p className="text-[11px] uppercase text-muted-foreground mb-1">O que gera estresse</p>
                <p>{p.como_gerar_estresse}</p>
              </div>
            </div>

            {p.resumo_livre && (
              <div className="p-3 rounded-md border border-border/50">
                <p className="text-[11px] uppercase text-muted-foreground mb-1">Síntese</p>
                <p className="text-sm whitespace-pre-wrap">{p.resumo_livre}</p>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFile}
        />
      </CardContent>
    </Card>
  );
}