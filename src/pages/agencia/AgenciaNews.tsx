import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button, Checkbox, Input, Tabs, TabsContent, TabsList, TabsTrigger, Textarea,
} from '@/design-system/design-system-hub-ba3841';
import { useAgenciaClientes, useTemAcessoAgencia } from '@/hooks/agencia/useAgencia';
import {
  aptoParaNews, assinaturaDe, mesDeHoje, useAcoesNews, useArtigosDoMes, useEdicaoNews, type EdicaoNews,
} from '@/hooks/agencia/useAgenciaNews';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';

export default function AgenciaNews() {
  const { slug, mes } = useParams();
  const navegar = useNavigate();
  const { data: clientes = [], isLoading } = useAgenciaClientes();

  if (!slug) {
    return (
      <div className="space-y-6">
        <CabecalhoPagina rotulo="Agentes" titulo="News" descricao="Escolha a conta para criar a News Blog com os artigos aprovados do mês." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
            <Link key={c.id} to={`/agencia/news/${c.slug}/${mesDeHoje()}`} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
              <p className="font-semibold text-foreground">{c.nome}</p>
              <p className="text-sm text-muted-foreground">News Blog · artigos do mês</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }
  if (isLoading) return <Vazio>Carregando…</Vazio>;
  const cliente = clientes.find((c) => c.slug === slug);
  if (!cliente) return <Vazio>Conta não encontrada.</Vazio>;
  const noMes = mes || mesDeHoje();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        rotulo="News"
        titulo="News Blog"
        descricao={<><Link to="/agencia/news" className="text-primary">News</Link> / {cliente.nome} · conteúdos aprovados, prontos para ganhar leitores.</>}
        acoes={
          <div className="w-44">
            <Input type="month" aria-label="Mês da News" value={noMes} onChange={(e) => e.target.value && navegar(`/agencia/news/${cliente.slug}/${e.target.value}`)} />
          </div>
        }
      />
      <Edicao key={`${cliente.id}:${noMes}`} clienteId={cliente.id} slug={cliente.slug} mes={noMes} />
    </div>
  );
}

function Edicao({ clienteId, slug, mes }: { clienteId: string; slug: string; mes: string }) {
  const { pessoa } = useTemAcessoAgencia();
  const { data: posts = [], isLoading } = useArtigosDoMes(clienteId, mes);
  const { data: anterior, isLoading: carregandoEdicao } = useEdicaoNews(clienteId, mes);
  const { salvar, gerar } = useAcoesNews(clienteId, mes);
  const [edicao, setEdicao] = useState<EdicaoNews | null>(null);
  const [passo, setPasso] = useState('artigos');
  const [ocupado, setOcupado] = useState(false);
  const [salvo, setSalvo] = useState(true);

  useEffect(() => {
    if (isLoading || carregandoEdicao || edicao) return;
    if (anterior) { setEdicao(anterior); if (anterior.texto) setPasso('revisao'); }
    else setEdicao({ selecionados: posts.filter(aptoParaNews).map((p) => p.id).slice(0, 12), orientacoes: '', texto: '', assinatura: '' });
  }, [isLoading, carregandoEdicao, anterior, posts, edicao]);

  if (isLoading || carregandoEdicao || !edicao) return <Vazio>Carregando os artigos do mês…</Vazio>;

  const selecionados = edicao.selecionados.map((id) => posts.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const valido = selecionados.length > 0 && selecionados.length === edicao.selecionados.length && selecionados.every(aptoParaNews);
  const desatualizada = !!edicao.texto && (!valido || edicao.assinatura !== assinaturaDe(selecionados));
  const mexer = (m: Partial<EdicaoNews>) => { setEdicao((e) => ({ ...e!, ...m })); setSalvo(false); };
  const mover = (id: string, d: number) => {
    const ids = [...edicao.selecionados]; const i = ids.indexOf(id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; mexer({ selecionados: ids });
  };
  const alternar = (id: string, marcado: boolean) =>
    mexer({ selecionados: marcado ? [...edicao.selecionados, id].slice(0, 12) : edicao.selecionados.filter((x) => x !== id) });

  const aoGerar = async () => {
    setOcupado(true);
    try {
      const r = await gerar(edicao.selecionados, edicao.orientacoes);
      setEdicao({ ...edicao, texto: r.texto, assinatura: r.assinatura }); setSalvo(true); setPasso('revisao');
      toast.success('News gerada e salva. Revise o texto.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível gerar.'); }
    finally { setOcupado(false); }
  };
  const aoSalvar = async () => {
    setOcupado(true);
    try { await salvar(edicao, pessoa?.id); setSalvo(true); toast.success('News salva.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setOcupado(false); }
  };
  const aoCopiar = async () => {
    if (desatualizada) { toast.error('Os artigos mudaram desde a geração. Gere a News novamente.'); return; }
    await navigator.clipboard.writeText(edicao.texto);
    toast.success('Texto da News copiado.');
  };

  return (
    <Tabs value={passo} onValueChange={setPasso}>
      <TabsList>
        <TabsTrigger value="artigos">1. Artigos do mês {valido && <Check className="ml-1 h-3 w-3" />}</TabsTrigger>
        <TabsTrigger value="redacao" disabled={!valido}>2. Redação {!!edicao.texto && <Check className="ml-1 h-3 w-3" />}</TabsTrigger>
        <TabsTrigger value="revisao" disabled={!edicao.texto}>3. Revisão</TabsTrigger>
        <TabsTrigger value="design" disabled>4. Design · em breve</TabsTrigger>
      </TabsList>

      {desatualizada && (
        <div className="mt-4 rounded-xl border border-warning bg-card p-4 text-sm">
          <p className="font-semibold text-foreground">Os artigos ou a seleção mudaram.</p>
          <p className="text-muted-foreground">O texto está preservado. Gere novamente para incorporar as versões atuais.</p>
        </div>
      )}

      <TabsContent value="artigos" className="mt-4 space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A base desta edição</p>
          <h2 className="mt-1 font-semibold text-foreground">Quais blogs entram na News?</h2>
          <p className="text-sm text-muted-foreground">Selecione os aprovados (até 12) e organize a ordem de leitura.</p>
          <div className="mt-4 space-y-2">
            {posts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum blog neste mês. <Link to={`/agencia/contas/${slug}/blog`} className="text-primary">Abrir o Criador de Blog</Link>
              </p>
            )}
            {posts.map((p) => {
              const apto = aptoParaNews(p);
              const i = edicao.selecionados.indexOf(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Checkbox checked={i >= 0} disabled={!apto} onCheckedChange={(v) => alternar(p.id, !!v)} aria-label={`Incluir ${p.titulo}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{i >= 0 && `${i + 1}. `}{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">{apto ? 'Aprovado' : 'Ainda não aprovado com texto revisado'}</p>
                  </div>
                  {i >= 0 && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => mover(p.id, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => mover(p.id, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <Button disabled={!valido} onClick={() => setPasso('redacao')}>Continuar</Button>
        </div>
      </TabsContent>

      <TabsContent value="redacao" className="mt-4 space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">Orientações para esta edição (opcional)</h2>
          <Textarea rows={5} maxLength={3000} value={edicao.orientacoes} onChange={(e) => mexer({ orientacoes: e.target.value })}
            placeholder="Ex.: destacar o artigo sobre financiamento; tom mais leve neste mês." />
          <p className="text-xs text-muted-foreground">{selecionados.length} artigo(s) na ordem escolhida.</p>
        </div>
        <div className="flex justify-end">
          <Button disabled={!valido || ocupado} onClick={aoGerar}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {edicao.texto ? 'Gerar novamente' : 'Gerar News'}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="revisao" className="mt-4 space-y-4">
        <Textarea rows={24} value={edicao.texto} onChange={(e) => mexer({ texto: e.target.value })} className="font-mono" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={aoCopiar} disabled={ocupado}><Copy className="h-4 w-4" /> Copiar</Button>
          <Button onClick={aoSalvar} disabled={ocupado || salvo}>{salvo ? 'Salvo' : 'Salvar'}</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
