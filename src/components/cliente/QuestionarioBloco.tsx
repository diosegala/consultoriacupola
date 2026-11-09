import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Copy, RefreshCw, Eye, ClipboardList, Sparkles, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  useQuestionarioCliente,
  useTemplatesAtivos,
  useTemplateDoQuestionario,
  useCriarQuestionario,
  useRegenerarToken,
} from '@/hooks/useQuestionario';
import { Estrutura, isAtiva, isPreenchida, SEGMENTOS_QUESTIONARIO } from '@/lib/questionario';

interface Props {
  clienteId: string;
  compact?: boolean;
}

function statusLabel(s: string) {
  return s === 'concluido' ? 'Concluído' : s === 'em_andamento' ? 'Em andamento' : 'Não iniciado';
}
function statusVariant(s: string): 'default' | 'secondary' | 'outline' {
  return s === 'concluido' ? 'default' : s === 'em_andamento' ? 'secondary' : 'outline';
}

function buildLink(token: string) {
  return `${window.location.origin}/q/${token}`;
}

export function QuestionarioBloco({ clienteId, compact }: Props) {
  const { data: q, isLoading } = useQuestionarioCliente(clienteId);
  const { data: templates = [] } = useTemplatesAtivos();
  const { data: template } = useTemplateDoQuestionario(q?.template_id);
  const criar = useCriarQuestionario();
  const regenerar = useRegenerarToken();
  const [verAberto, setVerAberto] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const handleCriar = async (segmento: string) => {
    const modelo = templates.find((t) => t.segmento === segmento);
    if (!modelo) {
      toast.error('Nenhum modelo de questionário ativo para este segmento');
      return;
    }
    try {
      await criar.mutateAsync({ clienteId, templateId: modelo.id });
      toast.success('Questionário criado. Preencha com o cliente na reunião de onboarding.');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao criar questionário');
    }
  };

  const handleCopy = () => {
    if (!q) return;
    navigator.clipboard.writeText(buildLink(q.token));
    toast.success('Link copiado');
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!q) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Questionário do cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Questionário de pré-onboarding, preenchido pelo consultor junto com o cliente na reunião online.
            Escolha o segmento da imobiliária:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SEGMENTOS_QUESTIONARIO.map((seg) => (
              <Button
                key={seg.id}
                onClick={() => handleCriar(seg.id)}
                disabled={criar.isPending || !templates.some((t) => t.segmento === seg.id)}
              >
                {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Questionário de {seg.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-md border border-primary/30 bg-primary/5 text-primary px-3 py-2 mb-3 text-xs flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        As respostas deste questionário serão utilizadas automaticamente pelos agentes de mapeamento e diagnóstico.
      </div>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-foreground flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" /> Questionário do cliente
          </CardTitle>
          <Badge variant={statusVariant(q.status)}>{statusLabel(q.status)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progresso</span>
              <span className="text-foreground font-medium">{q.progresso_pct}%</span>
            </div>
            <Progress value={q.progresso_pct} />
          </div>

          {q.ultimo_salvamento_em && (
            <p className="text-xs text-muted-foreground">
              Último salvamento em {format(parseISO(q.ultimo_salvamento_em), 'dd/MM/yyyy HH:mm')}
            </p>
          )}

          {!compact && q.status !== 'concluido' && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs break-all">
              {buildLink(q.token)}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to={`/clientes/${clienteId}/questionario`}>
                <PencilLine className="h-3.5 w-3.5 mr-1.5" />
                {q.status === 'nao_iniciado' ? 'Preencher com o cliente' : q.status === 'concluido' ? 'Abrir questionário' : 'Continuar preenchimento'}
              </Link>
            </Button>
            {q.status !== 'concluido' && (
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar link
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setVerAberto(true)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver respostas
            </Button>
            {q.status !== 'concluido' && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmRegen(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Novo link
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={verAberto} onOpenChange={setVerAberto}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Respostas do questionário</DialogTitle>
          </DialogHeader>
          <RespostasView estrutura={(template?.estrutura ?? { secoes: [] }) as Estrutura} respostas={q.respostas} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual deixará de funcionar. O progresso e as respostas já preenchidas são mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await regenerar.mutateAsync(q.id);
                  toast.success('Novo link gerado');
                } catch (e: any) {
                  toast.error(e.message ?? 'Falha ao gerar novo link');
                }
              }}
            >
              Gerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RespostasView({ estrutura, respostas }: { estrutura: Estrutura; respostas: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      {estrutura.secoes.map((sec) => {
        // Perguntas inativadas só aparecem se já tinham resposta.
        const visiveis = sec.perguntas.filter((p) => isAtiva(p) || isPreenchida(p, respostas[p.id]));
        if (!visiveis.length) return null;
        return (
        <div key={sec.id} className="space-y-3">
          <h3 className="font-semibold text-foreground border-b border-border pb-1">{sec.titulo}</h3>
          <dl className="space-y-3">
            {visiveis.map((p) => {
              const v = respostas[p.id];
              const preenchida = isPreenchida(p, v);
              return (
                <div key={p.id}>
                  <dt className="text-xs text-muted-foreground">{p.label}</dt>
                  <dd className="text-sm text-foreground whitespace-pre-wrap">
                    {preenchida ? (Array.isArray(v) ? v.join(', ') : String(v)) : (
                      <span className="text-muted-foreground italic">— não preenchido</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
        );
      })}
    </div>
  );
}