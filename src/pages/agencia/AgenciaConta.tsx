import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Sparkles } from 'lucide-react';
import { FichaAutomaticaDialog } from '@/components/agencia/FichaAutomaticaDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAgenciaCliente,
  useAgenciaContratos,
  useAgenciaEntregaveis,
  useAgenciaConhecimento,
  useAgenciaProjetos,
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
            <CardHeader>
              <CardTitle className="text-base">Contrato</CardTitle>
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
            <CardContent className="space-y-2 p-6">
              {projetosDaConta.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum projeto nesta conta.</p>
              ) : (
                projetosDaConta.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{p.nome}</p>
                      {p.resumo && <p className="text-xs text-muted-foreground">{p.resumo}</p>}
                    </div>
                    {p.status && <Badge variant="outline">{p.status}</Badge>}
                  </div>
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
