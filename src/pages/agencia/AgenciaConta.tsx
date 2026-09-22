import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Sparkles,
  Megaphone,
  FileText,
  Mic,
  Pencil,
  Plus,
} from 'lucide-react';
import { FichaAutomaticaDialog } from '@/components/agencia/FichaAutomaticaDialog';
import { RecadoFaladoDialog } from '@/components/agencia/RecadoFaladoDialog';
import { ContaFormDialog } from '@/components/agencia/ContaFormDialog';
import { ContratoFormDialog } from '@/components/agencia/ContratoFormDialog';
import { ProjetoFormDialog } from '@/components/agencia/ProjetoFormDialog';
import { Button } from '@/design-system/design-system-hub-ba3841';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAgenciaCliente,
  useAgenciaContratos,
  useAgenciaEntregaveis,
  useAgenciaConhecimento,
  useAgenciaEspacos,
  useAgenciaPessoa,
  useAgenciaProjetos,
  type AgenciaProjeto,
} from '@/hooks/agencia/useAgencia';

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="text-sm whitespace-pre-wrap">{valor}</p>
    </div>
  );
}

export default function AgenciaConta() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cliente, isLoading } = useAgenciaCliente(slug);
  const { data: contratos } = useAgenciaContratos();
  const { data: entregaveis } = useAgenciaEntregaveis(cliente?.id);
  const { data: conhecimento } = useAgenciaConhecimento(cliente?.id);
  const { data: projetos } = useAgenciaProjetos();
  const { data: espacos } = useAgenciaEspacos();
  const { data: pessoa } = useAgenciaPessoa();
  const [fichaAberta, setFichaAberta] = useState(false);
  const [recadoAberto, setRecadoAberto] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const [contratoAberto, setContratoAberto] = useState(false);
  const [projetoAlvo, setProjetoAlvo] = useState<{ aberto: boolean; projeto: AgenciaProjeto | null }>({
    aberto: false,
    projeto: null,
  });

  const podeGerenciar = pessoa?.papel === 'admin' || pessoa?.papel === 'gestor';

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

  const contrato = (contratos ?? []).find((c) => c.cliente_id === cliente.id);
  const projetosDaConta = (projetos ?? []).filter((p) => p.cliente_id === cliente.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/agencia/contas">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Contas
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{cliente.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {[cliente.cidade, cliente.sigla].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeGerenciar && (
            <Button variant="outline" size="sm" onClick={() => setContaAberta(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setFichaAberta(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Preencher ficha com o material
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRecadoAberto(true)}>
            <Mic className="mr-2 h-4 w-4" />
            Recado falado
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/agencia/contas/${cliente.slug}/redes`}>
              <Megaphone className="mr-2 h-4 w-4" />
              Conteúdo de redes
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/agencia/contas/${cliente.slug}/blog`}>
              <FileText className="mr-2 h-4 w-4" />
              Blog
            </Link>
          </Button>
        </div>
      </div>

      <FichaAutomaticaDialog
        clienteId={cliente.id}
        aberto={fichaAberta}
        onOpenChange={setFichaAberta}
      />

      <RecadoFaladoDialog
        clienteId={cliente.id}
        aberto={recadoAberto}
        onOpenChange={setRecadoAberto}
      />

      <ContaFormDialog
        aberto={contaAberta}
        onOpenChange={setContaAberta}
        conta={cliente}
        existentes={[cliente.id]}
      />

      {podeGerenciar && (
        <ContratoFormDialog
          aberto={contratoAberto}
          onOpenChange={setContratoAberto}
          clienteId={cliente.id}
          contrato={contrato ?? null}
        />
      )}

      {podeGerenciar && (
        <ProjetoFormDialog
          aberto={projetoAlvo.aberto}
          onOpenChange={(aberto) => setProjetoAlvo({ aberto, projeto: aberto ? projetoAlvo.projeto : null })}
          projeto={projetoAlvo.projeto}
          clienteId={cliente.id}
          clientes={cliente ? [cliente] : []}
          espacos={(espacos ?? []).filter((e) => e.tipo !== 'pessoal')}
          pessoaId={pessoa?.id ?? ''}
          existentes={(projetos ?? []).map((p) => p.id)}
        />
      )}


      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
          <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <Campo rotulo="Resumo" valor={cliente.resumo} />
              <Campo rotulo="Setor" valor={cliente.setor_descricao} />
              <Campo rotulo="Público-alvo" valor={cliente.publico_alvo} />
              <Campo rotulo="Tom de voz" valor={cliente.tom_de_voz} />
              <Campo rotulo="Produtos e serviços" valor={cliente.produtos_servicos} />
              <Campo rotulo="Posicionamento" valor={cliente.posicionamento} />
              <Campo rotulo="Diferenciais" valor={cliente.diferenciais} />
              <Campo rotulo="Concorrência" valor={cliente.concorrencia} />
              <Campo rotulo="Palavras-chave" valor={cliente.palavras_chave} />
              <Campo
                rotulo="Contato"
                valor={[cliente.contato_nome, cliente.contato_cargo, cliente.contato_email, cliente.contato_telefone]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrato" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Contrato</CardTitle>
              {podeGerenciar && (
                <Button variant="outline" size="sm" onClick={() => setContratoAberto(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {contrato ? 'Editar contrato' : 'Cadastrar contrato'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {contrato ? (
                <>
                  <Campo rotulo="Situação" valor={contrato.status} />
                  <Campo rotulo="Modalidade" valor={contrato.modalidade} />
                  <Campo rotulo="Responsável" valor={contrato.responsavel} />
                  <Campo rotulo="Início" valor={contrato.inicio} />
                  <Campo rotulo="Renovação" valor={contrato.renovacao} />
                  <Campo
                    rotulo="Horas no mês"
                    valor={
                      contrato.horas_mes
                        ? `${contrato.horas_usadas ?? 0} de ${contrato.horas_mes}`
                        : null
                    }
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem contrato cadastrado.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entregáveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(entregaveis ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada em aberto.</p>
              ) : (
                (entregaveis ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span className="text-sm">{e.nome}</span>
                    <div className="flex items-center gap-2">
                      {e.prazo && <span className="text-xs text-muted-foreground">{e.prazo}</span>}
                      {e.status && <Badge variant="outline">{e.status}</Badge>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projetos" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Projetos</CardTitle>
              {podeGerenciar && (
                <Button size="sm" onClick={() => setProjetoAlvo({ aberto: true, projeto: null })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo projeto
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {projetosDaConta.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum projeto nesta conta.</p>
              ) : (
                projetosDaConta.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => podeGerenciar && setProjetoAlvo({ aberto: true, projeto: p })}
                    className="flex w-full items-center justify-between border-b border-border pb-2 text-left last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.nome}</p>
                      {p.resumo && <p className="text-xs text-muted-foreground">{p.resumo}</p>}
                    </div>
                    {p.status && <Badge variant="outline">{p.status}</Badge>}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conhecimento" className="mt-4">
          <Card>
            <CardContent className="space-y-2 p-6">
              {(conhecimento ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum material desta conta ainda.
                </p>
              ) : (
                (conhecimento ?? []).map((k) => (
                  <div key={k.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{k.nome}</p>
                      <p className="text-xs text-muted-foreground">{k.origem}</p>
                    </div>
                    {k.enviado_em && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(k.enviado_em).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
