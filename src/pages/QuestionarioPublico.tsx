import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Estrutura, Pergunta, calcularProgresso, progressoSecao, isPreenchida } from '@/lib/questionario';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface InitialData {
  cliente_nome: string;
  template_nome: string;
  estrutura: Estrutura;
  respostas: Record<string, unknown>;
  status: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'arquivado';
  progresso_pct: number;
  ultimo_salvamento_em: string | null;
}

export default function QuestionarioPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [data, setData] = useState<InitialData | null>(null);
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [secaoAtiva, setSecaoAtiva] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${FN_URL}/questionario-get?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const json = await r.json();
        if (!r.ok) {
          setErro(json.error ?? 'invalid');
        } else {
          setData(json);
          setRespostas(json.respostas ?? {});
          setUltimoSalvo(json.ultimo_salvamento_em);
        }
      } catch {
        setErro('network');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const doSave = useCallback(
    async (next: Record<string, unknown>, finalizar = false) => {
      if (!token) return false;
      setSalvando(true);
      try {
        const r = await fetch(`${FN_URL}/questionario-save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON },
          body: JSON.stringify({ token, respostas: next, finalizar }),
        });
        const json = await r.json();
        if (!r.ok) {
          if (json.error === 'obrigatorias_faltando') {
            toast.error('Preencha todas as perguntas obrigatórias antes de enviar.');
          } else if (!finalizar) {
            toast.error('Falha ao salvar. Vamos tentar novamente.');
          }
          return false;
        }
        setUltimoSalvo(json.ultimo_salvamento_em);
        if (finalizar) {
          setData((d) => (d ? { ...d, status: 'concluido' } : d));
        }
        return true;
      } catch {
        if (!finalizar) toast.error('Sem conexão. Tentando novamente em breve.');
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [token],
  );

  const scheduleSave = useCallback(
    (next: Record<string, unknown>) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      pendingSave.current = true;
      saveTimer.current = window.setTimeout(async () => {
        pendingSave.current = false;
        await doSave(next, false);
      }, 900);
    },
    [doSave],
  );

  const setResposta = (id: string, value: unknown) => {
    setRespostas((prev) => {
      const next = { ...prev, [id]: value };
      scheduleSave(next);
      return next;
    });
  };

  const progresso = useMemo(() => {
    if (!data) return { pct: 0, faltam: [] as string[] };
    return calcularProgresso(data.estrutura, respostas);
  }, [data, respostas]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">Link inválido</h1>
          <p className="text-muted-foreground">
            {erro === 'expirado'
              ? 'Este link expirou. Entre em contato com seu consultor para receber um novo.'
              : erro === 'arquivado'
              ? 'Este questionário foi arquivado.'
              : 'O link do questionário não foi encontrado ou já não está mais disponível.'}
          </p>
        </div>
      </div>
    );
  }

  if (data.status === 'concluido') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-2xl font-semibold text-foreground">Respostas enviadas!</h1>
          <p className="text-muted-foreground">
            Obrigado por preencher o questionário. O time CUPOLA dará sequência ao seu onboarding em breve.
          </p>
        </div>
      </div>
    );
  }

  const secao = data.estrutura.secoes[secaoAtiva];
  const totalSecoes = data.estrutura.secoes.length;

  const handleFinalizar = async () => {
    if (progresso.faltam.length) {
      const idsPorSecao = data.estrutura.secoes.map((s) => s.perguntas.map((p) => p.id));
      const primeira = idsPorSecao.findIndex((arr) => arr.some((id) => progresso.faltam.includes(id)));
      if (primeira >= 0) setSecaoAtiva(primeira);
      toast.error(`Faltam ${progresso.faltam.length} pergunta(s) obrigatória(s).`);
      return;
    }
    setFinalizando(true);
    // garante último salvamento antes de finalizar
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await doSave(respostas, true);
    setFinalizando(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* topo fixo */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{data.template_nome}</p>
              <h1 className="font-semibold truncate">{data.cliente_nome}</h1>
            </div>
            <div className="text-right text-xs text-muted-foreground shrink-0">
              {salvando ? (
                <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> salvando…</span>
              ) : ultimoSalvo ? (
                <span className="flex items-center gap-1"><Check className="h-3 w-3" /> salvo às {format(new Date(ultimoSalvo), 'HH:mm')}</span>
              ) : (
                <span>seu progresso é salvo automaticamente</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={progresso.pct} className="flex-1 h-2" />
            <span className="text-xs font-medium text-muted-foreground w-10 text-right">{progresso.pct}%</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar seções */}
        <nav className="space-y-1 md:sticky md:top-32 self-start">
          {data.estrutura.secoes.map((s, i) => {
            const p = progressoSecao(s, respostas);
            const ativo = i === secaoAtiva;
            const completa = p.pct === 100;
            return (
              <button
                key={s.id}
                onClick={() => setSecaoAtiva(i)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
                  ativo ? 'bg-primary/10 text-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <span className="truncate">
                  <span className="opacity-60 mr-1">{i + 1}.</span>
                  {s.titulo}
                </span>
                {completa ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <span className="text-[10px] shrink-0 opacity-70">{p.preenchidas}/{p.total}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Conteúdo da seção */}
        <div className="space-y-6">
          {secao && (
            <div>
              <h2 className="text-xl font-semibold text-foreground">{secao.titulo}</h2>
              {secao.descricao && (
                <p className="text-sm text-muted-foreground mt-1">{secao.descricao}</p>
              )}
              <div className="mt-6 space-y-6">
                {secao.perguntas.map((p) => (
                  <CampoPergunta
                    key={p.id}
                    pergunta={p}
                    valor={respostas[p.id]}
                    onChange={(v) => setResposta(p.id, v)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setSecaoAtiva((i) => Math.max(0, i - 1))}
              disabled={secaoAtiva === 0}
            >
              Anterior
            </Button>

            {secaoAtiva < totalSecoes - 1 ? (
              <Button onClick={() => setSecaoAtiva((i) => Math.min(totalSecoes - 1, i + 1))}>
                Próxima seção
              </Button>
            ) : (
              <Button onClick={handleFinalizar} disabled={finalizando}>
                {finalizando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar respostas
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CampoPergunta({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: Pergunta;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `q-${pergunta.id}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {pergunta.label}
        {pergunta.obrigatorio && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput(pergunta, valor, onChange, id)}
    </div>
  );
}

function renderInput(
  p: Pergunta,
  valor: unknown,
  onChange: (v: unknown) => void,
  id: string,
) {
  switch (p.tipo) {
    case 'texto_curto':
      return <Input id={id} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'texto_longo':
      return <Textarea id={id} rows={4} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'numero':
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            value={(valor as string | number | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {p.sufixo && <span className="text-sm text-muted-foreground">{p.sufixo}</span>}
        </div>
      );
    case 'data':
      return <Input id={id} type="date" value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'sim_nao':
      return (
        <RadioGroup value={(valor as string) ?? ''} onValueChange={onChange} className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="sim" /> Sim
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="nao" /> Não
          </label>
        </RadioGroup>
      );
    case 'escolha_unica':
      return (
        <RadioGroup value={(valor as string) ?? ''} onValueChange={onChange} className="space-y-2">
          {p.opcoes?.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
    case 'escolha_multipla': {
      const arr = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <div className="space-y-2">
          {p.opcoes?.map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = c ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    }
    case 'escala_1_10':
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const ativo = valor === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      );
    default:
      return <Input id={id} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}