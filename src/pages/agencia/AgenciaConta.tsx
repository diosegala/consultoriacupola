import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Ban,
  Building2,
  ChevronDown,
  Compass,
  ExternalLink,
  FileText,
  Gem,
  Image as ImageIcon,
  KeyRound,
  MapPin,
  MessageSquareQuote,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Swords,
  Tags,
  Users,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FichaAutomaticaDialog } from '@/components/agencia/FichaAutomaticaDialog';
import { RecadoFaladoDialog } from '@/components/agencia/RecadoFaladoDialog';
import { ContaFormDialog } from '@/components/agencia/ContaFormDialog';
import { ContratoFormDialog } from '@/components/agencia/ContratoFormDialog';
import { ProjetoFormDialog } from '@/components/agencia/ProjetoFormDialog';
import { SeloConta } from '@/components/agencia/cliente/SeloConta';
import { PessoaLinha } from '@/components/agencia/cliente/PessoaLinha';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/design-system/design-system-hub-ba3841';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAgenciaAgentes,
  useAgenciaCliente,
  useAgenciaConhecimento,
  useAgenciaContratos,
  useAgenciaEntregaveis,
  useAgenciaEspacos,
  useAgenciaPessoa,
  useAgenciaPessoas,
  useAgenciaProjetos,
  type AgenciaProjeto,
} from '@/hooks/agencia/useAgencia';
import { useIdentidadeVisual, useLogoConta } from '@/hooks/agencia/useAgenciaArtes';
import { useLeituras } from '@/hooks/agencia/useAgenciaMercado';
import {
  STATUS_CONTRATO,
  rotaDoAgente,
  useCarteiraSquads,
  useRegrasConta,
  type RegraConta,
} from '@/hooks/agencia/useAgenciaCarteira';
import { cn } from '@/lib/utils';

const dataCurta = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '';
const dataLonga = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

function Painel({ titulo, extra, children, className }: { titulo?: string; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('rounded-3xl', className)}>
      <CardContent className="space-y-4 p-6">
        {(titulo || extra) && (
          <div className="flex items-center justify-between gap-2">
            {titulo && <h3 className="font-semibold">{titulo}</h3>}
            {extra}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Etiqueta({ children, tom = 'neutro' }: { children: React.ReactNode; tom?: 'neutro' | 'perigo' | 'marca' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest',
        tom === 'perigo' && 'border-destructive/40 text-destructive',
        tom === 'marca' && 'border-primary/40 text-foreground',
        tom === 'neutro' && 'border-border text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

function TextoDialog({ aberto, onOpenChange, titulo, texto }: { aberto: boolean; onOpenChange: (v: boolean) => void; titulo: string; texto: string }) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Informação completa da ficha do cliente</DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm">{texto}</div>
      </DialogContent>
    </Dialog>
  );
}

function ResumoCard({
  titulo,
  icone: Icone,
  texto,
  destaque,
  botao,
  onAbrir,
}: {
  titulo: string;
  icone: LucideIcon;
  texto?: string | null;
  destaque?: string;
  botao: string;
  onAbrir: () => void;
}) {
  return (
    <Painel titulo={titulo} className="h-full">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icone className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          {destaque && <p className="font-medium">{destaque}</p>}
          <p className="line-clamp-3 text-sm text-muted-foreground">{texto || 'Ainda não preenchido.'}</p>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={onAbrir} disabled={!texto}>
        {botao}
      </Button>
    </Painel>
  );
}

const TIPO_REGRA: Record<string, { rotulo: string; icone: LucideIcon; tom: 'perigo' | 'neutro' | 'marca' }> = {
  veto: { rotulo: 'Nunca', icone: Ban, tom: 'perigo' },
  posicionamento: { rotulo: 'Posição', icone: Compass, tom: 'neutro' },
  obrigatorio: { rotulo: 'Sempre', icone: CheckCircle2, tom: 'marca' },
};

function RegraItem({ regra }: { regra: RegraConta }) {
  const tipo = TIPO_REGRA[regra.tipo ?? ''] ?? TIPO_REGRA.posicionamento;
  const Icone = tipo.icone;
  return (
    <div className="flex gap-4 rounded-2xl border border-border p-5">
      <Icone className={cn('mt-1 h-5 w-5 shrink-0', tipo.tom === 'perigo' ? 'text-destructive' : 'text-muted-foreground')} />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{regra.texto}</p>
        {regra.porque && <p className="text-sm text-muted-foreground">{regra.porque}</p>}
        {(regra.termos ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Conferido na saída</span>
            {regra.termos!.map((t) => (
              <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Etiqueta tom={tipo.tom}>{tipo.rotulo}</Etiqueta>
        <span className="text-xs text-muted-foreground">{dataCurta(regra.desde)}</span>
      </div>
    </div>
  );
}

function Recolhivel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Card className="rounded-3xl">
      <CardContent className="p-6">
        <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{titulo}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', aberto && 'rotate-180')} />
        </button>
        {aberto && <div className="mt-4 space-y-3">{children}</div>}
      </CardContent>
    </Card>
  );
}

const FUNDOS_AREA = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];

export default function AgenciaConta() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cliente, isLoading } = useAgenciaCliente(slug);
  const { data: contratos } = useAgenciaContratos();
  const { data: entregaveis } = useAgenciaEntregaveis(cliente?.id);
  const { data: conhecimento } = useAgenciaConhecimento(cliente?.id);
  const { data: projetos } = useAgenciaProjetos();
  const { data: espacos } = useAgenciaEspacos();
  const { data: pessoa } = useAgenciaPessoa();
  const { data: pessoas } = useAgenciaPessoas();
  const { data: agentes } = useAgenciaAgentes();
  const { data: leituras } = useLeituras();
  const { data: logoUrl } = useLogoConta(cliente?.id);
  const { data: identidade } = useIdentidadeVisual(cliente?.id);
  const { data: carteira } = useCarteiraSquads();
  const { data: regras } = useRegrasConta(cliente?.id);

  const [aba, setAba] = useState('geral');
  const [fichaAberta, setFichaAberta] = useState(false);
  const [recadoAberto, setRecadoAberto] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const [contratoAberto, setContratoAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<{ titulo: string; texto: string } | null>(null);
  const [projetoAlvo, setProjetoAlvo] = useState<{ aberto: boolean; projeto: AgenciaProjeto | null }>({
    aberto: false,
    projeto: null,
  });

  const podeGerenciar = pessoa?.papel === 'admin' || pessoa?.papel === 'gestor';

  const squadsDaConta = useMemo(
    () => (carteira?.squads ?? []).filter((s) => carteira?.squadsPorCliente[cliente?.id ?? '']?.includes(s.id)),
    [carteira, cliente],
  );

  const quemAtende = useMemo(() => {
    if (!cliente) return [];
    const ids = new Set<string>();
    if (cliente.atendimento_id) ids.add(cliente.atendimento_id);
    squadsDaConta.forEach((s) => (carteira?.pessoasPorSquad[s.id] ?? []).forEach((id) => ids.add(id)));
    return (pessoas ?? []).filter((p) => ids.has(p.id) && p.ativa !== false);
  }, [cliente, squadsDaConta, carteira, pessoas]);

  const leiturasDaCidade = useMemo(() => {
    const cidade = (cliente?.cidade ?? '').split(/[-,/]/)[0].trim().toLowerCase();
    if (!cidade) return [];
    return (leituras ?? []).filter((l) =>
      (l.regioes ?? []).some((r) => r.toLowerCase().includes(cidade)) ||
      l.titulo.toLowerCase().includes(cidade),
    );
  }, [leituras, cliente]);

  const agentesDaConta = useMemo(
    () => (agentes ?? []).filter((a) => a.por_conta || a.cliente_id === cliente?.id),
    [agentes, cliente],
  );

  if (isLoading) return <Skeleton className="h-64 w-full rounded-3xl" />;
  if (!cliente) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">Cliente não encontrado.</CardContent>
      </Card>
    );
  }

  const contrato = (contratos ?? []).find((c) => c.cliente_id === cliente.id);
  const projetosDaConta = (projetos ?? []).filter((p) => p.cliente_id === cliente.id);
  const statusContrato = contrato?.status ? STATUS_CONTRATO[contrato.status] ?? contrato.status : 'Sem contrato';
  const espacoNome = (id: string | null) => (espacos ?? []).find((e) => e.id === id)?.nome ?? 'Geral';
  const temIdentidade = !!identidade && (identidade.cores.length > 0 || identidade.tipografia.length > 0 || !!identidade.guia || identidade.logos.length > 0);

  const compartilhar = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link copiado', description: 'Cole onde quiser para compartilhar este cliente.' });
  };

  const abrir = (titulo: string, texto?: string | null) => texto && setDetalhe({ titulo, texto });

  const lateralContrato = (
    <Painel titulo="Contrato atual" extra={<Etiqueta>{statusContrato}</Etiqueta>}>
      <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        {[
          ['Início', dataLonga(contrato?.inicio)],
          ['Renovação', dataLonga(contrato?.renovacao)],
          ['Responsável', contrato?.responsavel || '—'],
        ].map(([r, v]) => (
          <div key={r} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{r}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      {podeGerenciar && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setContratoAberto(true)}>
          <Pencil />
          {contrato ? 'Editar contrato' : 'Cadastrar contrato'}
        </Button>
      )}
    </Painel>
  );

  return (
    <div className="space-y-8">
      {/* Topo */}
      <div className="space-y-4">
        <nav className="text-sm text-muted-foreground">
          <Link to="/agencia/contas" className="hover:text-foreground">Clientes</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{cliente.nome}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <SeloConta cliente={cliente} logoUrl={logoUrl} tamanho="lg" />
            <h1 className="text-5xl font-semibold tracking-tight">{cliente.nome}</h1>
            {squadsDaConta.map((s) => (
              <Etiqueta key={s.id} tom="marca">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {s.nome}
              </Etiqueta>
            ))}
            {cliente.cidade && (
              <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">{cliente.cidade}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Etiqueta>{statusContrato}</Etiqueta>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {podeGerenciar && (
                  <DropdownMenuItem onClick={() => setContaAberta(true)}>
                    <Pencil /> Editar ficha
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setFichaAberta(true)}>
                  <Sparkles /> Preencher ficha com o material
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRecadoAberto(true)}>
                  <Mic /> Recado falado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={compartilhar}>
              <Share2 />
              Compartilhar
            </Button>
          </div>
        </div>
      </div>

      <FichaAutomaticaDialog clienteId={cliente.id} aberto={fichaAberta} onOpenChange={setFichaAberta} />
      <RecadoFaladoDialog clienteId={cliente.id} aberto={recadoAberto} onOpenChange={setRecadoAberto} />
      <ContaFormDialog aberto={contaAberta} onOpenChange={setContaAberta} conta={cliente} existentes={[cliente.id]} />
      {podeGerenciar && (
        <ContratoFormDialog aberto={contratoAberto} onOpenChange={setContratoAberto} clienteId={cliente.id} contrato={contrato ?? null} />
      )}
      {podeGerenciar && (
        <ProjetoFormDialog
          aberto={projetoAlvo.aberto}
          onOpenChange={(aberto) => setProjetoAlvo({ aberto, projeto: aberto ? projetoAlvo.projeto : null })}
          projeto={projetoAlvo.projeto}
          clienteId={cliente.id}
          clientes={[cliente]}
          espacos={(espacos ?? []).filter((e) => e.tipo !== 'pessoal')}
          pessoaId={pessoa?.id ?? ''}
          existentes={(projetos ?? []).map((p) => p.id)}
        />
      )}
      <TextoDialog
        aberto={!!detalhe}
        onOpenChange={(v) => !v && setDetalhe(null)}
        titulo={detalhe?.titulo ?? ''}
        texto={detalhe?.texto ?? ''}
      />

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="entregaveis">Entregáveis</TabsTrigger>
          <TabsTrigger value="mercado">Mercado</TabsTrigger>
          <TabsTrigger value="agentes">
            <Sparkles className="h-4 w-4" />
            Agentes
          </TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="geral" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-4">
            <div className="space-y-6 xl:col-span-3">
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                <ResumoCard titulo="Sobre o cliente" icone={Building2} texto={cliente.resumo || cliente.setor_descricao} botao="Ver mais" onAbrir={() => abrir('Sobre o cliente', [cliente.resumo, cliente.setor_descricao, cliente.produtos_servicos].filter(Boolean).join('\n\n'))} />
                <ResumoCard titulo="Tom de voz" icone={MessageSquareQuote} texto={cliente.tom_de_voz} botao="Ver detalhes" onAbrir={() => abrir('Tom de voz', cliente.tom_de_voz)} />
                <ResumoCard titulo="Público principal" icone={Users} texto={cliente.publico_alvo} botao="Ver persona" onAbrir={() => abrir('Público principal', cliente.publico_alvo)} />
                <Painel titulo="Cidade" className="h-full">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">{cliente.cidade ?? 'Não informada'}</p>
                      <p className="text-sm text-muted-foreground">
                        {leiturasDaCidade.length} {leiturasDaCidade.length === 1 ? 'leitura' : 'leituras'} de mercado nesta praça.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setAba('mercado')}>Ver mercado</Button>
                </Painel>
              </div>

              <Painel titulo="Identidade visual">
                {temIdentidade ? (
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Cores</p>
                      <div className="flex flex-wrap gap-2">
                        {identidade!.cores.map((c) => (
                          <div key={c} className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-xs">
                            <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: c }} />
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Tipografia</p>
                      <p className="text-sm">{identidade!.tipografia.join(', ') || '—'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Logotipo</p>
                      {logoUrl ? (
                        <img src={logoUrl} alt={`Logotipo da ${cliente.nome}`} className="h-12 object-contain" />
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem arquivo</p>
                      )}
                    </div>
                    {identidade!.guia && (
                      <p className="text-sm text-muted-foreground md:col-span-3">{identidade!.guia}</p>
                    )}
                  </div>
                ) : (
                  <Vazio>A identidade desta conta ainda não foi cadastrada.</Vazio>
                )}
              </Painel>

              <Painel titulo="Informações estratégicas">
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
                  {([
                    ['Posicionamento', Compass, cliente.posicionamento],
                    ['Diferenciais', Gem, cliente.diferenciais],
                    ['Concorrência', Swords, cliente.concorrencia],
                    ['Palavras-chave', Tags, cliente.palavras_chave],
                  ] as Array<[string, LucideIcon, string | null]>).map(([t, I, v]) => (
                    <button key={t} type="button" onClick={() => abrir(t, v)} className="flex gap-3 text-left" disabled={!v}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <I className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{t}</p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{v || 'Ainda não preenchido.'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Painel>

              <section className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-3xl font-semibold tracking-tight">Quem atende</h2>
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {quemAtende.length} {quemAtende.length === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </div>
                {quemAtende.length === 0 ? (
                  <Vazio>Nenhuma pessoa ou squad ligado a esta conta ainda.</Vazio>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {quemAtende.map((p) => (
                      <div key={p.id} className="rounded-full border border-border bg-card py-2 pl-2 pr-5">
                        <PessoaLinha nome={p.nome} iniciais={p.iniciais} detalhe={p.funcao} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-3xl font-semibold tracking-tight">Regras da conta</h2>
                  <span className="text-sm text-muted-foreground">{(regras ?? []).length}</span>
                </div>
                {(regras ?? []).length === 0 ? (
                  <Vazio>Nenhuma regra cadastrada para esta conta.</Vazio>
                ) : (
                  <Card className="rounded-3xl">
                    <CardContent className="space-y-3 p-4">
                      {regras!.map((r) => <RegraItem key={r.id} regra={r} />)}
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>

            <div className="space-y-6">
              {lateralContrato}
              <Painel titulo="Contato principal">
                {cliente.contato_nome ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{cliente.contato_nome}</p>
                    {cliente.contato_cargo && <p className="text-muted-foreground">{cliente.contato_cargo}</p>}
                    {cliente.contato_email && <p className="text-muted-foreground">{cliente.contato_email}</p>}
                    {cliente.contato_telefone && <p className="text-muted-foreground">{cliente.contato_telefone}</p>}
                  </div>
                ) : (
                  <Vazio>Ninguém cadastrado do lado do cliente.</Vazio>
                )}
              </Painel>
              <Painel titulo="Documentos" extra={<span className="text-sm text-muted-foreground">{(conhecimento ?? []).length}</span>}>
                <p className="text-sm text-muted-foreground">O material que a IA lê antes de escrever no nome desta conta.</p>
                {(conhecimento ?? []).length === 0 ? (
                  <Vazio>Nenhum documento ainda.</Vazio>
                ) : (
                  <div className="space-y-1">
                    {conhecimento!.map((k) => <DocumentoLinha key={k.id} doc={k} />)}
                  </div>
                )}
              </Painel>
            </div>
          </div>
        </TabsContent>

        {/* ENTREGÁVEIS */}
        <TabsContent value="entregaveis" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-4">
            <div className="space-y-6 xl:col-span-3">
              <Painel
                titulo="Projetos"
                extra={podeGerenciar && (
                  <Button size="sm" onClick={() => setProjetoAlvo({ aberto: true, projeto: null })}>
                    <Plus />
                    Novo projeto
                  </Button>
                )}
              >
                {projetosDaConta.length === 0 ? (
                  <Vazio>Nenhum projeto nesta conta.</Vazio>
                ) : (
                  <div className="divide-y divide-border">
                    {projetosDaConta.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => podeGerenciar && setProjetoAlvo({ aberto: true, projeto: p })}
                        className="flex w-full items-center justify-between gap-4 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{p.nome}</p>
                          {p.resumo && <p className="truncate text-sm text-muted-foreground">{p.resumo}</p>}
                        </div>
                        {p.status && <Etiqueta>{p.status}</Etiqueta>}
                      </button>
                    ))}
                  </div>
                )}
              </Painel>
              <Painel titulo="Entregáveis">
                {(entregaveis ?? []).length === 0 ? (
                  <Vazio>Nada em aberto.</Vazio>
                ) : (
                  <div className="divide-y divide-border">
                    {entregaveis!.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-4 py-3">
                        <span className="text-sm">{e.nome}</span>
                        <div className="flex items-center gap-3">
                          {e.prazo && <span className="text-xs text-muted-foreground">{dataLonga(e.prazo)}</span>}
                          {e.status && <Etiqueta>{e.status}</Etiqueta>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Painel>
            </div>
            <div>{lateralContrato}</div>
          </div>
        </TabsContent>

        {/* MERCADO */}
        <TabsContent value="mercado" className="mt-6">
          <Painel
            titulo={`Mercado em ${cliente.cidade ?? 'sua praça'}`}
            extra={<Link to="/agencia/mercado" className="text-sm font-medium hover:underline">Ver todas as leituras</Link>}
          >
            {leiturasDaCidade.length === 0 ? (
              <Vazio>Nenhuma leitura de mercado para esta cidade ainda.</Vazio>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {leiturasDaCidade.map((l) => (
                  <div key={l.id} className="space-y-2 rounded-2xl border border-border p-5">
                    <p className="text-xs text-muted-foreground">{dataLonga(l.publicado_em)}</p>
                    <p className="font-medium">{l.titulo}</p>
                    {l.resumo && <p className="line-clamp-3 text-sm text-muted-foreground">{l.resumo}</p>}
                    {l.link && (
                      <Button variant="ghost" size="sm" onClick={() => window.open(l.link!, '_blank', 'noopener')}>
                        <ExternalLink />
                        Abrir fonte
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Painel>
        </TabsContent>

        {/* AGENTES */}
        <TabsContent value="agentes" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-4">
            <div className="space-y-4 xl:col-span-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">Agentes</h2>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {agentesDaConta.length} ferramentas disponíveis para esta conta. Abertas daqui, as que trabalham conta a conta já entram em {cliente.nome}.
                  </p>
                </div>
                <Link to="/agencia/agentes" className="shrink-0 text-sm font-medium hover:underline">Ver a biblioteca</Link>
              </div>
              {agentesDaConta.length === 0 ? (
                <Vazio>Nenhum agente disponível para esta conta.</Vazio>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {agentesDaConta.map((a, i) => {
                    const Icone = a.slug.includes('imag') ? ImageIcon : FileText;
                    return (
                      <Link
                        key={a.id}
                        to={rotaDoAgente(a, cliente.slug, cliente.id)}
                        className={cn(
                          'group relative flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl p-6 text-background transition-transform hover:-translate-y-1',
                          FUNDOS_AREA[i % FUNDOS_AREA.length],
                        )}
                      >
                        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-background/20" />
                        <span className="w-fit rounded-full border border-background/40 px-3 py-1 text-xs">{espacoNome(a.espaco_id)}</span>
                        <div className="space-y-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-background/40">
                            <Icone className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-3xl font-medium">{a.nome}</p>
                            <p className="line-clamp-1 text-sm opacity-80">{a.resumo || 'Em construção.'}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-4">
              {lateralContrato}
              <Recolhivel titulo="Contexto">
                <p className="text-sm text-muted-foreground">{cliente.resumo || 'Sem resumo cadastrado.'}</p>
                {cliente.tom_de_voz && <p className="text-sm"><strong>Tom:</strong> {cliente.tom_de_voz}</p>}
              </Recolhivel>
              <Recolhivel titulo={`Anexos · ${(conhecimento ?? []).length}`}>
                {(conhecimento ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nada guardado ainda.</p>
                ) : (
                  conhecimento!.map((k) => <DocumentoLinha key={k.id} doc={k} />)
                )}
              </Recolhivel>
              <Recolhivel titulo={`Regras · ${(regras ?? []).length}`}>
                {(regras ?? []).map((r) => (
                  <p key={r.id} className="text-sm">
                    <KeyRound className="mr-2 inline h-3 w-3 text-muted-foreground" />
                    {r.texto}
                  </p>
                ))}
              </Recolhivel>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Doc = {
  id: string; nome: string; texto: string | null; enviado_em: string | null; url: string | null; caminho: string | null;
};

function DocumentoLinha({ doc }: { doc: Doc }) {
  const [textoAberto, setTextoAberto] = useState(false);
  const { refetch } = useQuery({
    queryKey: ['agencia', 'material-url', doc.caminho],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('conhecimento').createSignedUrl(doc.caminho!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const abrir = async () => {
    if (doc.url) return window.open(doc.url, '_blank', 'noopener');
    if (doc.caminho) {
      const { data } = await refetch();
      if (data) window.open(data, '_blank', 'noopener');
      return;
    }
    if (doc.texto) setTextoAberto(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
        title={doc.nome}
      >
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{doc.nome}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{dataCurta(doc.enviado_em)}</span>
      </button>
      {doc.texto && (
        <TextoDialog aberto={textoAberto} onOpenChange={setTextoAberto} titulo={doc.nome} texto={doc.texto} />
      )}
    </>
  );
}
