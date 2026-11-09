import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCliente } from '@/hooks/useClientes';
import {
  useQuestionarioCliente,
  useSalvarRespostas,
  useTemplateDoQuestionario,
} from '@/hooks/useQuestionario';
import { calcularProgresso, estruturaAtiva, progressoSecao } from '@/lib/questionario';
import { CampoPergunta } from '@/components/questionario/CampoPergunta';

/**
 * Preenchimento do questionário de pré-onboarding pelo consultor, durante a
 * reunião online com o cliente. Salva sozinho a cada alteração.
 */
export default function QuestionarioPreenchimento() {
  const { id: clienteId } = useParams<{ id: string }>();
  const { data: cliente } = useCliente(clienteId);
  const { data: q, isLoading } = useQuestionarioCliente(clienteId);
  const { data: template, isLoading: carregandoTemplate } = useTemplateDoQuestionario(q?.template_id);
  const salvar = useSalvarRespostas();

  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [secaoAtiva, setSecaoAtiva] = useState(0);
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);
  const [status, setStatus] = useState<'nao_iniciado' | 'em_andamento' | 'concluido' | 'arquivado'>('nao_iniciado');
  const carregou = useRef(false);
  const timer = useRef<number | null>(null);

  const estrutura = useMemo(() => estruturaAtiva(template?.estrutura ?? { secoes: [] }), [template]);
  const estruturaRef = useRef(estrutura);
  estruturaRef.current = estrutura;
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (q && !carregou.current) {
      carregou.current = true;
      setRespostas((q.respostas ?? {}) as Record<string, unknown>);
      setUltimoSalvo(q.ultimo_salvamento_em);
      setStatus(q.status);
    }
  }, [q]);

  const gravar = useCallback(
    async (next: Record<string, unknown>, concluir = false) => {
      if (!q) return false;
      try {
        const { pct } = calcularProgresso(estruturaRef.current, next);
        const agora = await salvar.mutateAsync({
          id: q.id,
          respostas: next,
          progresso_pct: pct,
          concluir,
          statusAtual: statusRef.current,
        });
        setUltimoSalvo(agora);
        if (concluir) setStatus('concluido');
        else if (statusRef.current === 'nao_iniciado') setStatus('em_andamento');
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? 'Falha ao salvar as respostas');
        return false;
      }
    },
    [q, salvar],
  );

  const alterar = (idPergunta: string, valor: unknown) => {
    setRespostas((prev) => {
      const next = { ...prev, [idPergunta]: valor };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void gravar(next), 900);
      return next;
    });
  };

  // Salva o que estiver pendente ao sair da página.
  const respostasRef = useRef(respostas);
  respostasRef.current = respostas;
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void gravar(respostasRef.current);
      }
    },
    [gravar],
  );

  const progresso = useMemo(() => calcularProgresso(estrutura, respostas), [estrutura, respostas]);

  if (isLoading || carregandoTemplate) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const voltar = (
    <Link to={`/clientes/${clienteId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Voltar ao cliente
    </Link>
  );

  if (!q || !template) {
    return (
      <div className="space-y-4">
        {voltar}
        <p className="text-muted-foreground">
          Este cliente ainda não tem questionário. Gere um na aba Onboarding da página do cliente.
        </p>
      </div>
    );
  }

  const secao = estrutura.secoes[secaoAtiva];
  const ultima = secaoAtiva >= estrutura.secoes.length - 1;

  const concluir = async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (await gravar(respostas, true)) toast.success('Questionário concluído');
  };

  return (
    <div className="space-y-4">
      {voltar}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{template.nome}</p>
          <h1 className="titulo-marca text-lg">{cliente?.nome ?? 'Questionário'}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {status === 'concluido' && <Badge>Concluído</Badge>}
          {salvar.isPending ? (
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> salvando…</span>
          ) : ultimoSalvo ? (
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> salvo às {format(new Date(ultimoSalvo), 'HH:mm')}</span>
          ) : (
            <span>salvamento automático</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Progress value={progresso.pct} className="flex-1 h-2" />
        <span className="text-xs font-medium text-muted-foreground w-10 text-right">{progresso.pct}%</span>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        <nav className="space-y-1 md:sticky md:top-4 self-start">
          {estrutura.secoes.map((s, i) => {
            const p = progressoSecao(s, respostas);
            return (
              <button
                key={s.id}
                onClick={() => setSecaoAtiva(i)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
                  i === secaoAtiva ? 'bg-primary/10 text-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <span className="truncate">{s.titulo}</span>
                {p.pct === 100 ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <span className="text-[10px] shrink-0 opacity-70">{p.preenchidas}/{p.total}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          {secao && (
            <div>
              <h2 className="text-xl font-semibold text-foreground">{secao.titulo}</h2>
              <div className="mt-6 space-y-6">
                {secao.perguntas.map((p) => (
                  <CampoPergunta key={p.id} pergunta={p} valor={respostas[p.id]} onChange={(v) => alterar(p.id, v)} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setSecaoAtiva((i) => Math.max(0, i - 1))} disabled={secaoAtiva === 0}>
              Anterior
            </Button>
            {!ultima ? (
              <Button onClick={() => setSecaoAtiva((i) => i + 1)}>Próxima seção</Button>
            ) : status === 'concluido' ? (
              <span className="flex items-center gap-1 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Concluído</span>
            ) : (
              <Button onClick={concluir} disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Concluir questionário
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
