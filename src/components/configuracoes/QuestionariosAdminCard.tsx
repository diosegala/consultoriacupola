import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSalvarEstruturaTemplate, useTemplatesAtivos } from '@/hooks/useQuestionario';
import { Estrutura, Pergunta, SEGMENTOS_QUESTIONARIO, isAtiva } from '@/lib/questionario';

const TIPOS: { id: Pergunta['tipo']; label: string }[] = [
  { id: 'texto_longo', label: 'Texto longo' },
  { id: 'texto_curto', label: 'Texto curto' },
  { id: 'numero', label: 'Número' },
  { id: 'sim_nao', label: 'Sim / Não' },
  { id: 'escolha_unica', label: 'Escolha única' },
  { id: 'escolha_multipla', label: 'Escolha múltipla' },
  { id: 'escala_1_10', label: 'Escala de 1 a 10' },
  { id: 'data', label: 'Data' },
];

interface Edicao {
  secaoId: string;
  /** undefined = pergunta nova */
  perguntaId?: string;
  label: string;
  dica: string;
  tipo: Pergunta['tipo'];
  opcoes: string;
}

/**
 * Admin: gerencia as perguntas dos questionários de pré-onboarding.
 * Só o admin edita, inativa ou reordena (a política do banco também exige admin).
 */
export function QuestionariosAdminCard() {
  const { data: templates = [], isLoading } = useTemplatesAtivos();
  const salvar = useSalvarEstruturaTemplate();
  const [segmento, setSegmento] = useState<string>('vendas');
  const [mostrarInativas, setMostrarInativas] = useState(true);
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  const template = templates.find((t) => t.segmento === segmento);
  const estrutura = template?.estrutura;

  const totais = useMemo(() => {
    const todas = (estrutura?.secoes ?? []).flatMap((s) => s.perguntas);
    return { total: todas.length, ativas: todas.filter(isAtiva).length };
  }, [estrutura]);

  const persistir = async (proxima: Estrutura, msg?: string) => {
    if (!template) return;
    try {
      await salvar.mutateAsync({ templateId: template.id, estrutura: proxima });
      if (msg) toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível salvar. Só admins editam as perguntas.');
    }
  };

  const alterarPergunta = (secaoId: string, perguntaId: string, fn: (p: Pergunta) => Pergunta) => {
    if (!estrutura) return;
    void persistir({
      secoes: estrutura.secoes.map((s) =>
        s.id !== secaoId ? s : { ...s, perguntas: s.perguntas.map((p) => (p.id === perguntaId ? fn(p) : p)) },
      ),
    });
  };

  const alternarAtiva = (secaoId: string, p: Pergunta) =>
    alterarPergunta(secaoId, p.id, (x) => {
      const { ativo: _a, ...resto } = x;
      return isAtiva(x) ? { ...resto, ativo: false } : resto;
    });

  const mover = (secaoId: string, perguntaId: string, delta: -1 | 1) => {
    if (!estrutura) return;
    void persistir({
      secoes: estrutura.secoes.map((s) => {
        if (s.id !== secaoId) return s;
        const i = s.perguntas.findIndex((p) => p.id === perguntaId);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= s.perguntas.length) return s;
        const perguntas = [...s.perguntas];
        [perguntas[i], perguntas[j]] = [perguntas[j], perguntas[i]];
        return { ...s, perguntas };
      }),
    });
  };

  const abrirEdicao = (secaoId: string, p?: Pergunta) =>
    setEdicao({
      secaoId,
      perguntaId: p?.id,
      label: p?.label ?? '',
      dica: p?.dica ?? '',
      tipo: p?.tipo ?? 'texto_longo',
      opcoes: (p?.opcoes ?? []).join('\n'),
    });

  const confirmarEdicao = async () => {
    if (!edicao || !estrutura) return;
    const label = edicao.label.trim();
    if (!label) {
      toast.error('Escreva o texto da pergunta.');
      return;
    }
    const usaOpcoes = edicao.tipo === 'escolha_unica' || edicao.tipo === 'escolha_multipla';
    const opcoes = edicao.opcoes.split('\n').map((o) => o.trim()).filter(Boolean);
    if (usaOpcoes && opcoes.length < 2) {
      toast.error('Informe ao menos duas opções (uma por linha).');
      return;
    }
    const aplicar = (base: Partial<Pergunta>): Pergunta => {
      const { dica: _d, opcoes: _o, ...resto } = base as Pergunta;
      return {
        ...resto,
        id: base.id!,
        obrigatorio: base.obrigatorio ?? false,
        label,
        tipo: edicao.tipo,
        ...(edicao.dica.trim() ? { dica: edicao.dica.trim() } : {}),
        ...(usaOpcoes ? { opcoes } : {}),
      };
    };
    const prefixo = (estrutura.secoes[0]?.perguntas[0]?.id ?? 'q').split('_')[0];
    const secoes = estrutura.secoes.map((s) => {
      if (s.id !== edicao.secaoId) return s;
      if (edicao.perguntaId) {
        return { ...s, perguntas: s.perguntas.map((p) => (p.id === edicao.perguntaId ? aplicar(p) : p)) };
      }
      const nova = aplicar({ id: `${prefixo}_${s.id}_${Date.now().toString(36)}` });
      return { ...s, perguntas: [...s.perguntas, nova] };
    });
    await persistir({ secoes }, edicao.perguntaId ? 'Pergunta atualizada' : 'Pergunta adicionada');
    setEdicao(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const usaOpcoesEdicao = edicao && (edicao.tipo === 'escolha_unica' || edicao.tipo === 'escolha_multipla');

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Questionários de pré-onboarding</CardTitle>
        <CardDescription>
          Perguntas preenchidas pelo consultor com o cliente na reunião online, antes da imersão. Perguntas inativas não
          aparecem no preenchimento, mas as respostas já dadas são mantidas. Apenas admins editam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={segmento} onValueChange={setSegmento}>
            <TabsList className="bg-secondary">
              {SEGMENTOS_QUESTIONARIO.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{totais.ativas} ativas de {totais.total}</span>
            <label className="flex items-center gap-2">
              <Switch checked={mostrarInativas} onCheckedChange={setMostrarInativas} />
              Mostrar inativas
            </label>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>

        {!template ? (
          <p className="text-sm text-muted-foreground">Nenhum modelo ativo para este segmento.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {estrutura!.secoes.map((s) => {
              const ativas = s.perguntas.filter(isAtiva).length;
              const lista = mostrarInativas ? s.perguntas : s.perguntas.filter(isAtiva);
              return (
                <AccordionItem key={s.id} value={s.id} className="border-border">
                  <AccordionTrigger className="text-foreground hover:no-underline">
                    <span className="flex items-center gap-3">
                      {s.titulo}
                      <Badge variant="secondary">{ativas}/{s.perguntas.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {lista.map((p) => {
                      const posicao = s.perguntas.findIndex((x) => x.id === p.id);
                      const ativa = isAtiva(p);
                      return (
                        <div key={p.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                          <Switch
                            checked={ativa}
                            onCheckedChange={() => alternarAtiva(s.id, p)}
                            disabled={salvar.isPending}
                            aria-label={ativa ? 'Inativar pergunta' : 'Ativar pergunta'}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className={`text-sm ${ativa ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                              {p.codigo && <span className="mr-2 text-xs font-mono text-muted-foreground no-underline">{p.codigo}</span>}
                              {p.label}
                            </p>
                            {p.dica && <p className="text-xs text-muted-foreground">Dica: {p.dica}</p>}
                            {p.nota_revisao && <p className="text-xs italic text-muted-foreground">{p.nota_revisao}</p>}
                            <Badge variant="outline" className="text-[10px]">
                              {TIPOS.find((t) => t.id === p.tipo)?.label ?? p.tipo}
                            </Badge>
                          </div>
                          <div className="flex shrink-0 items-center">
                            <Button variant="ghost" size="icon" disabled={posicao === 0 || salvar.isPending} onClick={() => mover(s.id, p.id, -1)} title="Subir">
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" disabled={posicao === s.perguntas.length - 1 || salvar.isPending} onClick={() => mover(s.id, p.id, 1)} title="Descer">
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => abrirEdicao(s.id, p)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button variant="outline" size="sm" onClick={() => abrirEdicao(s.id)}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar pergunta
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>

      <Dialog open={!!edicao} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edicao?.perguntaId ? 'Editar pergunta' : 'Nova pergunta'}</DialogTitle>
          </DialogHeader>
          {edicao && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="q-label">Pergunta</Label>
                <Textarea id="q-label" rows={3} value={edicao.label} onChange={(e) => setEdicao({ ...edicao, label: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-dica">Dica para quem conduz (opcional)</Label>
                <Textarea id="q-dica" rows={2} value={edicao.dica} onChange={(e) => setEdicao({ ...edicao, dica: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de resposta</Label>
                <Select value={edicao.tipo} onValueChange={(v) => setEdicao({ ...edicao, tipo: v as Pergunta['tipo'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {usaOpcoesEdicao && (
                <div className="space-y-2">
                  <Label htmlFor="q-opcoes">Opções (uma por linha)</Label>
                  <Textarea id="q-opcoes" rows={4} value={edicao.opcoes} onChange={(e) => setEdicao({ ...edicao, opcoes: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdicao(null)}>Cancelar</Button>
            <Button onClick={confirmarEdicao} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
