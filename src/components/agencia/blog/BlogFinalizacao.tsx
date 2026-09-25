import { useEffect, useMemo, useState } from 'react';
import { Check, Code2, Copy, Download, Loader2, RotateCcw, Sparkles, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import type { BlogPost } from '@/hooks/agencia/useAgenciaBlog';
import { comSumario, htmlAtual, htmlDoRevisado } from '@/lib/agencia/blogHtml';

interface Props {
  post: BlogPost;
  montarDasEtapas: () => string;
  salvarCampos: (id: string, campos: Partial<BlogPost>) => Promise<boolean>;
  refinar: (id: string) => Promise<{ aviso?: string; conferir: { ponto: string; motivo: string }[] } | null>;
}

function baixar(conteudo: string, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function BlogFinalizacao({ post, montarDasEtapas, salvarCampos, refinar }: Props) {
  const [revisado, setRevisado] = useState(post.texto_revisado ?? '');
  const [refinando, setRefinando] = useState(false);
  const [retorno, setRetorno] = useState<{ aviso?: string; conferir: { ponto: string; motivo: string }[] } | null>(null);

  useEffect(() => {
    setRevisado(post.texto_revisado ?? '');
    setRetorno(null);
  }, [post.id, post.texto_revisado]);

  const salvo = post.texto_revisado ?? '';
  const mudou = revisado !== salvo;
  const html = useMemo(
    () => htmlAtual({ textoRevisado: salvo, htmlFinal: post.html_final ?? '', htmlFonte: post.html_fonte ?? '' }),
    [salvo, post.html_final, post.html_fonte],
  );
  const proposta = post.texto_refinado ?? '';
  const nome = post.seo_slug || post.palavra_chave || 'post';

  const salvarRevisao = async () => {
    if (await salvarCampos(post.id, { texto_revisado: revisado, passo_atual: Math.max(post.passo_atual ?? 0, 9) } as Partial<BlogPost>)) {
      toast({ title: 'Texto final salvo' });
    }
  };

  const montar = () => {
    if (revisado.trim() && !window.confirm('Substituir o texto final pelo que está nas etapas?')) return;
    setRevisado(comSumario(montarDasEtapas()));
  };

  const pedirRefino = async () => {
    if (mudou) {
      toast({ title: 'Salve o texto final antes de refinar', variant: 'destructive' });
      return;
    }
    setRefinando(true);
    const r = await refinar(post.id);
    setRetorno(r);
    setRefinando(false);
  };

  const usarRefino = async () => {
    if (await salvarCampos(post.id, {
      texto_antes_do_refino: salvo,
      texto_revisado: proposta,
      texto_refinado: '',
    } as Partial<BlogPost>)) {
      setRetorno(null);
      toast({ title: 'Refino aplicado ao texto final' });
    }
  };

  const desfazerRefino = async () => {
    if (await salvarCampos(post.id, {
      texto_revisado: post.texto_antes_do_refino ?? '',
      texto_antes_do_refino: '',
    } as Partial<BlogPost>)) toast({ title: 'Voltou o texto de antes do refino' });
  };

  const gerarHtml = async () => {
    try {
      const final = htmlDoRevisado(salvo);
      if (await salvarCampos(post.id, { html_final: final, html_fonte: salvo, passo_atual: 11 } as Partial<BlogPost>)) {
        toast({ title: 'HTML pronto' });
      }
    } catch (e) {
      toast({ title: 'Não deu para gerar o HTML', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              9. Texto final (revisão)
              {salvo.trim() && <Badge variant="secondary">salvo</Badge>}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              O que vai ser publicado. Use ## e ### nos títulos e [texto](endereço) nos links.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={montar}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Montar das etapas
            </Button>
            <Button size="sm" disabled={!mudou} onClick={salvarRevisao}>Salvar texto final</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea rows={18} value={revisado} onChange={(e) => setRevisado(e.target.value)} className="font-mono text-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">10. Refinar com o prompt reverso (opcional)</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Uma última passada com as regras da Elaíny. Não acrescenta conteúdo; só vira texto final se você clicar em Usar.
            </p>
          </div>
          <div className="flex gap-2">
            {!!post.texto_antes_do_refino?.trim() && (
              <Button size="sm" variant="outline" onClick={desfazerRefino}>
                <Undo2 className="mr-2 h-4 w-4" />
                Desfazer refino
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={refinando || !salvo.trim()} onClick={pedirRefino}>
              {refinando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {refinando ? 'Refinando...' : proposta ? 'Refinar de novo' : 'Refinar'}
            </Button>
          </div>
        </CardHeader>
        {(proposta || retorno) && (
          <CardContent className="space-y-4">
            {retorno?.aviso && <p className="text-sm font-medium text-warning">{retorno.aviso}</p>}
            {!!retorno?.conferir.length && (
              <div className="space-y-1 text-sm">
                <p className="font-medium">Pontos a conferir</p>
                {retorno.conferir.map((c, i) => (
                  <p key={i}>
                    “{c.ponto}”{c.motivo && <span className="text-muted-foreground"> — {c.motivo}</span>}
                  </p>
                ))}
              </div>
            )}
            {proposta && (
              <>
                <p className="text-sm font-medium">Comparação: antes × depois do refino</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Texto final atual</p>
                    <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border p-3 text-sm">{salvo}</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Proposta do refino</p>
                    <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-primary p-3 text-sm">{proposta}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={usarRefino}>
                    <Check className="mr-2 h-4 w-4" />
                    Usar
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => salvarCampos(post.id, { texto_refinado: '' } as Partial<BlogPost>)}>
                    <X className="mr-2 h-4 w-4" />
                    Descartar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              11. HTML final
              {html && <Badge variant="secondary">pronto</Badge>}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Convertido direto do texto final, sem IA, com sumário e âncoras. Mudou o texto? Gere de novo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={html ? 'outline' : 'default'} disabled={!salvo.trim() || mudou} onClick={gerarHtml}>
              <Code2 className="mr-2 h-4 w-4" />
              {html ? 'Gerar de novo' : 'Gerar HTML'}
            </Button>
            {html && (
              <>
                <Button size="sm" variant="outline" onClick={async () => {
                  await navigator.clipboard.writeText(html);
                  toast({ title: 'HTML copiado' });
                }}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button size="sm" variant="outline" onClick={() => baixar(html, `${nome}.html`, 'text/html;charset=utf-8')}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        {html && (
          <CardContent>
            <iframe title="Prévia do HTML" sandbox="" srcDoc={html} className="h-96 w-full rounded-md border border-border bg-background" />
          </CardContent>
        )}
      </Card>
    </>
  );
}
