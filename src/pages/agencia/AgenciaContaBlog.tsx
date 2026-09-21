import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Plus, ShieldCheck, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgenciaCliente } from '@/hooks/agencia/useAgencia';
import { useBlogAcoes, useBlogPost, useBlogPosts, type BlogPost, type PassoBlog } from '@/hooks/agencia/useAgenciaBlog';
import { toast } from '@/hooks/use-toast';
import { conferir as conferirForma, type Ressalva } from '@/lib/agencia/blogConferencia';

const PASSOS: { id: PassoBlog; nome: string }[] = [
  { id: 'estrutura', nome: 'Estrutura (H1 e títulos)' },
  { id: 'introducao', nome: 'Introdução' },
  { id: 'desenvolvimento', nome: 'Desenvolvimento' },
  { id: 'faq', nome: 'Perguntas frequentes' },
  { id: 'encerramento', nome: 'Encerramento e chamada' },
  { id: 'seo', nome: 'Título e descrição de busca' },
];

function textoCompleto(p: BlogPost): string {
  const partes: string[] = [];
  if (p.h1) partes.push(`# ${p.h1}`);
  if (p.introducao) partes.push(p.introducao);
  if (p.desenvolvimento) partes.push(p.desenvolvimento);
  if (p.faq?.length) {
    partes.push('## Perguntas frequentes');
    p.faq.forEach((f) => partes.push(`**${f.pergunta}**\n\n${f.resposta}`));
  }
  if (p.encerramento) partes.push(p.encerramento);
  return partes.join('\n\n');
}

export default function AgenciaContaBlog() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cliente } = useAgenciaCliente(slug);
  const { data: posts } = useBlogPosts(cliente?.id);
  const [postId, setPostId] = useState<string | undefined>();
  const { data: post } = useBlogPost(postId);
  const { criarPost, salvarCampos, gerarPasso, conferirTexto, apagarPost, gerando, validar } = useBlogAcoes(cliente?.id);

  const [novoTema, setNovoTema] = useState('');
  const [rascunho, setRascunho] = useState<Partial<BlogPost>>({});
  const [conferindo, setConferindo] = useState(false);
  const [laudo, setLaudo] = useState<{ afirmacoes: { trecho: string; porque: string }[]; ressalvas: Ressalva[] } | null>(null);

  useEffect(() => {
    if (post) {
      setRascunho({
        tema: post.tema ?? '',
        objetivo: post.objetivo ?? '',
        etapa: post.etapa ?? 'descoberta',
        palavra_chave: post.palavra_chave ?? '',
        secundarias: post.secundarias ?? '',
        obrigatorias: post.obrigatorias ?? '',
        motivo: post.motivo ?? '',
        intencao: post.intencao ?? '',
        fontes: post.fontes ?? '',
        prompts_de_ia: post.prompts_de_ia ?? '',
      });
    }
  }, [post?.id]);

  const campo = (k: keyof BlogPost) => (rascunho[k] as string) ?? '';
  const mudar = (k: keyof BlogPost, v: string) => setRascunho((r) => ({ ...r, [k]: v }));

  const salvarBriefing = async () => {
    if (!postId) return;
    if (await salvarCampos(postId, rascunho)) toast({ title: 'Briefing salvo' });
  };

  const conferir = async () => {
    if (!post) return;
    setConferindo(true);
    try {
      const r = await conferirTexto(post.id);
      if (!r) return;
      const faq = (post.faq ?? []).map((f) => `### ${f.pergunta}\n${f.resposta}`).join('\n\n');
      const ressalvas = conferirForma({
        material: r.material,
        introducao: post.introducao ?? '',
        desenvolvimento: post.desenvolvimento ?? '',
        faq,
        encerramento: post.encerramento ?? '',
      });
      setLaudo({ afirmacoes: r.afirmacoes, ressalvas });
    } finally {
      setConferindo(false);
    }
  };

  const copiar = async () => {
    if (!post) return;
    await navigator.clipboard.writeText(textoCompleto(post));
    toast({ title: 'Texto copiado' });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/agencia/contas/${slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Blog · {cliente?.nome ?? ''}</h1>
          <p className="text-sm text-muted-foreground">
            Um post por vez, passo a passo: você revisa e edita antes de pedir o próximo.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Tema do novo post"
                value={novoTema}
                onChange={(e) => setNovoTema(e.target.value)}
              />
              <Button
                size="icon"
                disabled={!novoTema.trim()}
                onClick={async () => {
                  const id = await criarPost(novoTema.trim());
                  if (id) {
                    setNovoTema('');
                    setPostId(id);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {(posts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum post ainda nesta conta.</p>
            )}

            {(posts ?? []).map((p) => (
              <div
                key={p.id}
                className={`flex items-start justify-between gap-2 rounded-md border p-3 ${
                  p.id === postId ? 'border-primary' : 'border-border'
                }`}
              >
                <button className="flex-1 text-left" onClick={() => setPostId(p.id)}>
                  <p className="text-sm font-medium">{p.titulo || p.tema || 'Sem título'}</p>
                  <p className="text-xs text-muted-foreground">
                    Passo {p.passo_atual ?? 0} de {PASSOS.length}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (await apagarPost(p.id) && postId === p.id) setPostId(undefined);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {!post ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-3 h-8 w-8 opacity-50" />
              Escolha um post na lista ou crie um novo para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Briefing do post</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Tema</Label>
                  <Input value={campo('tema')} onChange={(e) => mudar('tema', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Objetivo</Label>
                  <Textarea rows={2} value={campo('objetivo')} onChange={(e) => mudar('objetivo', e.target.value)} />
                </div>
                <div>
                  <Label>Etapa da jornada</Label>
                  <Select value={campo('etapa') || 'descoberta'} onValueChange={(v) => mudar('etapa', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="descoberta">Descoberta</SelectItem>
                      <SelectItem value="consideracao">Consideração</SelectItem>
                      <SelectItem value="decisao">Decisão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Palavra-chave principal</Label>
                  <Input value={campo('palavra_chave')} onChange={(e) => mudar('palavra_chave', e.target.value)} />
                </div>
                <div>
                  <Label>Palavras-chave secundárias</Label>
                  <Input value={campo('secundarias')} onChange={(e) => mudar('secundarias', e.target.value)} />
                </div>
                <div>
                  <Label>Informações obrigatórias</Label>
                  <Input value={campo('obrigatorias')} onChange={(e) => mudar('obrigatorias', e.target.value)} />
                </div>
                <div>
                  <Label>Por que este post agora</Label>
                  <Textarea rows={2} value={campo('motivo')} onChange={(e) => mudar('motivo', e.target.value)} />
                </div>
                <div>
                  <Label>Intenção de busca</Label>
                  <Textarea rows={2} value={campo('intencao')} onChange={(e) => mudar('intencao', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Dados e fontes (opcional)</Label>
                  <Textarea rows={3} value={campo('fontes')} onChange={(e) => mudar('fontes', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Perguntas coletadas em ferramentas de IA (uma por linha)</Label>
                  <Textarea rows={3} value={campo('prompts_de_ia')} onChange={(e) => mudar('prompts_de_ia', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={salvarBriefing}>Salvar briefing</Button>
                </div>
              </CardContent>
            </Card>

            {validar.length > 0 && (
              <Card className="border-amber-500/40">
                <CardHeader>
                  <CardTitle className="text-base">Pontos para você decidir</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {validar.map((v, i) => (
                    <p key={i}>
                      <span className="font-medium">{v.ponto}</span>
                      {v.motivo ? <span className="text-muted-foreground"> — {v.motivo}</span> : null}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {PASSOS.map((p, i) => {
              const feito = (post.passo_atual ?? 0) > i;
              return (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {i + 1}. {p.nome}
                      {feito && <Badge variant="secondary">pronto</Badge>}
                    </CardTitle>
                    <Button size="sm" variant={feito ? 'outline' : 'default'} disabled={!!gerando}
                      onClick={() => gerarPasso(post.id, p.id)}>
                      {gerando === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      {feito ? 'Refazer' : 'Escrever'}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.id === 'estrutura' && (
                      <>
                        <Input
                          placeholder="H1 do post"
                          value={post.h1 ?? ''}
                          onChange={(e) => salvarCampos(post.id, { h1: e.target.value })}
                        />
                        <div className="space-y-1 text-sm">
                          {(post.titulos ?? []).map((t, k) => (
                            <p key={k} style={{ paddingLeft: (t.nivel - 2) * 16 }}>
                              <span className="text-muted-foreground">H{t.nivel}</span> {t.texto}
                            </p>
                          ))}
                        </div>
                      </>
                    )}

                    {(p.id === 'introducao' || p.id === 'desenvolvimento' || p.id === 'encerramento') && (
                      <Textarea
                        rows={p.id === 'desenvolvimento' ? 16 : 6}
                        value={(post[p.id] as string) ?? ''}
                        onChange={(e) => salvarCampos(post.id, { [p.id]: e.target.value } as Partial<BlogPost>)}
                      />
                    )}

                    {p.id === 'faq' && (
                      <div className="space-y-3 text-sm">
                        {(post.faq ?? []).map((f, k) => (
                          <div key={k}>
                            <p className="font-medium">{f.pergunta}</p>
                            <p className="text-muted-foreground">{f.resposta}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {p.id === 'seo' && (
                      <div className="space-y-2">
                        <Input placeholder="Título de busca" value={post.seo_title ?? ''}
                          onChange={(e) => salvarCampos(post.id, { seo_title: e.target.value })} />
                        <Textarea rows={2} placeholder="Descrição de busca" value={post.seo_description ?? ''}
                          onChange={(e) => salvarCampos(post.id, { seo_description: e.target.value })} />
                        <Input placeholder="Endereço (slug)" value={post.seo_slug ?? ''}
                          onChange={(e) => salvarCampos(post.id, { seo_slug: e.target.value })} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Conferência do texto</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Aponta o que o revisor precisa olhar: o que o material não sustenta e as regras de forma.
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={conferindo} onClick={conferir}>
                  {conferindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Conferir
                </Button>
              </CardHeader>
              {laudo && (
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="mb-2 font-medium">Afirmações sem apoio no material</p>
                    {laudo.afirmacoes.length === 0 ? (
                      <p className="text-muted-foreground">Nada apontado — tudo o que o texto afirma aparece no material.</p>
                    ) : (
                      laudo.afirmacoes.map((a, i) => (
                        <p key={i} className="mb-1">
                          <span className="font-medium">“{a.trecho}”</span>
                          <span className="text-muted-foreground"> — {a.porque}</span>
                        </p>
                      ))
                    )}
                  </div>
                  <div>
                    <p className="mb-2 font-medium">Regras de forma</p>
                    {laudo.ressalvas.length === 0 ? (
                      <p className="text-muted-foreground">Nenhuma ressalva de forma.</p>
                    ) : (
                      laudo.ressalvas.map((r, i) => (
                        <div key={i} className="mb-2">
                          <p>{r.o_que}</p>
                          <ul className="ml-4 list-disc text-muted-foreground">
                            {r.onde.map((o, k) => <li key={k}>{o}</li>)}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A conferência aponta onde olhar; quem decide o que publicar é você.
                  </p>
                </CardContent>
              )}
            </Card>

            <Button variant="outline" onClick={copiar}>Copiar o post inteiro</Button>
          </div>
        )}
      </div>
    </div>
  );
}
