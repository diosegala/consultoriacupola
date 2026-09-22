import { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, PenLine, Copy, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAgenciaCliente } from '@/hooks/agencia/useAgencia';
import { useRedesConteudo, useRedesMes, useRedesTemas, type RedesTema } from '@/hooks/agencia/useAgenciaRedes';
import { RedesArteDialog } from '@/components/agencia/RedesArteDialog';

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function copiar(texto: string) {
  navigator.clipboard.writeText(texto).then(
    () => toast.success('Copiado.'),
    () => toast.error('Não foi possível copiar.'),
  );
}

function TemaCard({
  tema,
  escrevendo,
  onEscrever,
  clienteId,
  mes,
}: {
  tema: RedesTema;
  escrevendo: boolean;
  onEscrever: (formato: 'card' | 'carrossel', instrucoes: string) => void;
  clienteId: string;
  mes: string;
}) {
  const [formato, setFormato] = useState<'card' | 'carrossel'>((tema.formato as 'card' | 'carrossel') ?? 'card');
  const [instrucoes, setInstrucoes] = useState(tema.instrucoes ?? '');
  const [arteAberta, setArteAberta] = useState(false);
  const slides = tema.slides ?? [];

  const textoCompleto = [
    tema.texto_imagem ?? '',
    ...slides.map((s, i) => `${i + 1}. ${s.texto}`),
    tema.legenda ? `\nLegenda:\n${tema.legenda}` : '',
  ].filter(Boolean).join('\n');

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{tema.ordem ? `${tema.ordem}. ` : ''}{tema.titulo}</p>
            {tema.justificativa && (
              <p className="mt-1 text-sm text-muted-foreground">{tema.justificativa}</p>
            )}
          </div>
          <Badge variant={tema.legenda ? 'default' : 'outline'}>
            {tema.legenda ? 'texto pronto' : 'sugerido'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Label className="text-xs text-muted-foreground">Formato</Label>
            <Select value={formato} onValueChange={(v) => setFormato(v as 'card' | 'carrossel')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card único</SelectItem>
                <SelectItem value="carrossel">Carrossel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            placeholder="Instruções para o texto (opcional)"
            className="min-w-[200px] flex-1"
          />
          <Button size="sm" disabled={escrevendo} onClick={() => onEscrever(formato, instrucoes)}>
            <PenLine className="mr-2 h-4 w-4" />
            {escrevendo ? 'Escrevendo...' : tema.legenda ? 'Reescrever' : 'Escrever texto'}
          </Button>
        </div>

        {(tema.legenda || tema.texto_imagem || slides.length > 0) && (
          <div className="space-y-3 rounded-md border border-border p-4">
            {tema.texto_imagem && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Texto da arte</p>
                <p className="whitespace-pre-wrap text-sm">{tema.texto_imagem}</p>
              </div>
            )}
            {slides.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cards</p>
                {slides.map((s, i) => (
                  <div key={i} className="rounded border border-border p-2">
                    <p className="text-xs text-muted-foreground">{i + 1} · {s.papel}</p>
                    <p className="whitespace-pre-wrap text-sm">{s.texto}</p>
                  </div>
                ))}
              </div>
            )}
            {tema.legenda && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Legenda</p>
                <p className="whitespace-pre-wrap text-sm">{tema.legenda}</p>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => copiar(textoCompleto)}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar tudo
            </Button>
            <Button size="sm" onClick={() => setArteAberta(true)}>
              <Palette className="mr-2 h-4 w-4" />
              Criar arte
            </Button>
          </div>
        )}
        <RedesArteDialog tema={tema} clienteId={clienteId} mes={mes} open={arteAberta} onOpenChange={setArteAberta} />
      </CardContent>
    </Card>
  );
}

export default function AgenciaContaRedes() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cliente, isLoading } = useAgenciaCliente(slug);
  const [mes, setMes] = useState(mesAtual());

  const { data: briefingSalvo } = useRedesMes(cliente?.id, mes);
  const { data: temas, isLoading: carregandoTemas } = useRedesTemas(cliente?.id, mes);
  const { gerandoTemas, escrevendo, salvandoBriefing, gerarTemas, escreverPeca, salvarBriefing } =
    useRedesConteudo(cliente?.id, mes);

  const [briefing, setBriefing] = useState('');
  const [datas, setDatas] = useState('');
  const [sugeridos, setSugeridos] = useState('');

  useEffect(() => {
    setBriefing(briefingSalvo?.briefing ?? '');
    setDatas(briefingSalvo?.datas ?? '');
    setSugeridos(briefingSalvo?.sugeridos ?? '');
  }, [briefingSalvo?.briefing, briefingSalvo?.datas, briefingSalvo?.sugeridos, mes]);

  const ordenados = useMemo(
    () => [...(temas ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [temas],
  );

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!cliente) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Conta não encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/agencia/contas/${cliente.slug}`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {cliente.nome}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Conteúdo de redes</h1>
        <p className="text-sm text-muted-foreground">
          O briefing do mês guia os temas e o texto de cada post.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Briefing do mês</CardTitle>
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value || mesAtual())}
            className="w-44"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Objetivos e campanhas</Label>
            <Textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              rows={4}
              placeholder="O que o mês precisa comunicar, campanhas em andamento, restrições."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Datas comemorativas</Label>
              <Textarea value={datas} onChange={(e) => setDatas(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Temas que você já quer na lista</Label>
              <Textarea value={sugeridos} onChange={(e) => setSugeridos(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={salvandoBriefing}
              onClick={() => salvarBriefing({ briefing, datas, sugeridos })}
            >
              {salvandoBriefing ? 'Salvando...' : 'Salvar briefing'}
            </Button>
            <Button disabled={gerandoTemas} onClick={gerarTemas}>
              <Sparkles className="mr-2 h-4 w-4" />
              {gerandoTemas ? 'Sugerindo temas...' : 'Sugerir temas do mês'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {carregandoTemas ? (
        <Skeleton className="h-40 w-full" />
      ) : ordenados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum tema neste mês ainda. Salve o briefing e peça as sugestões.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {ordenados.map((t) => (
            <TemaCard
              key={t.id}
              tema={t}
              escrevendo={escrevendo === t.id}
              onEscrever={(formato, instrucoes) => escreverPeca(t.id, formato, instrucoes)}
              clienteId={cliente.id}
              mes={mes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
