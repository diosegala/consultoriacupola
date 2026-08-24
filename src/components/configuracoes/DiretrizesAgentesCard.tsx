import { useState } from 'react';
import { Loader2, Sparkles, Check, Archive, Trash2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useDiretrizes,
  useAtualizarDiretriz,
  useCriarDiretriz,
  useExcluirDiretriz,
  useConsolidarFeedback,
  useFeedbacksAgentes,
} from '@/hooks/useAgenteFeedback';

const AGENTES = [
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'okrs', label: 'OKRs' },
  { key: 'briefing_cliente_oculto', label: 'Cliente Oculto' },
  { key: 'balanco_periodo', label: 'Balanço do Período' },
];

export function DiretrizesAgentesCard() {
  const [tipo, setTipo] = useState('diagnostico');
  const [nova, setNova] = useState('');
  const { data: diretrizes, isLoading } = useDiretrizes(tipo);
  const { data: feedbacks } = useFeedbacksAgentes(tipo);
  const atualizar = useAtualizarDiretriz();
  const criar = useCriarDiretriz();
  const excluir = useExcluirDiretriz();
  const consolidar = useConsolidarFeedback();

  const pendentes = (feedbacks ?? []).filter((f) => !f.consolidado_em).length;
  const media = feedbacks?.length
    ? (feedbacks.reduce((s, f) => s + f.nota, 0) / feedbacks.length).toFixed(1)
    : '—';

  const ativas = (diretrizes ?? []).filter((d) => d.status === 'ativa');
  const rascunhos = (diretrizes ?? []).filter((d) => d.status === 'rascunho');

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Aprendizado dos agentes
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AGENTES.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => consolidar.mutate(tipo)}
            disabled={consolidar.isPending || pendentes === 0}
          >
            {consolidar.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Consolidando…</>
              : <>Consolidar {pendentes} feedback(s)</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Nota média das avaliações: <strong>{media}</strong> · {feedbacks?.length ?? 0} feedback(s) registrado(s) ·{' '}
          {pendentes} ainda não consolidado(s).
        </p>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {rascunhos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Propostas aguardando aprovação</h4>
                {rascunhos.map((d) => (
                  <div key={d.id} className="flex items-start gap-2 rounded-md border border-border p-2">
                    <p className="flex-1 text-sm">{d.conteudo}</p>
                    <Button size="sm" variant="outline" className="h-7"
                      onClick={() => atualizar.mutate({ id: d.id, status: 'ativa' })}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7"
                      onClick={() => excluir.mutate(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Diretrizes ativas ({ativas.length})</h4>
              {ativas.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma diretriz ativa para este agente.</p>
              )}
              {ativas.map((d) => (
                <div key={d.id} className="flex items-start gap-2 rounded-md border border-border p-2">
                  <Badge variant="outline" className="text-[10px] mt-0.5">{d.origem}</Badge>
                  <p className="flex-1 text-sm">{d.conteudo}</p>
                  <Button size="sm" variant="ghost" className="h-7"
                    onClick={() => atualizar.mutate({ id: d.id, status: 'arquivada' })}>
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <Textarea
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                rows={2}
                placeholder="Adicionar diretriz manual para este agente…"
                className="text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={nova.trim().length < 10 || criar.isPending}
                onClick={() => criar.mutate({ tipo_agente: tipo, conteudo: nova.trim() }, { onSuccess: () => setNova('') })}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar diretriz
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
