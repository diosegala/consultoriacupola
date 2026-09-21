import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  useIntegracoes,
  useIntegracaoAcoes,
  type ChaveIntegracao,
  type IntegracaoStatus,
} from '@/hooks/useIntegracoesAdmin';

interface CampoTela {
  id: string;
  rotulo: string;
  ajuda?: string;
  multilinha?: boolean;
  segredo?: boolean;
}

const TELAS: Record<ChaveIntegracao, { nome: string; descricao: string; ondeAchar: string; campos: CampoTela[] }> = {
  firecrawl: {
    nome: 'Firecrawl',
    descricao: 'Leitura de sites para os agentes e para a ficha automática das contas.',
    ondeAchar: 'A chave fica no painel do Firecrawl, em API Keys.',
    campos: [{ id: 'api_key', rotulo: 'Chave da API', segredo: true }],
  },
  runrunit: {
    nome: 'RunRun.it',
    descricao: 'Tarefas e apontamentos do time da agência.',
    ondeAchar: 'No RunRun.it, em Configurações → Integrações → API.',
    campos: [
      { id: 'app_key', rotulo: 'App Key', segredo: true },
      { id: 'user_token', rotulo: 'User Token', segredo: true },
    ],
  },
  google_drive: {
    nome: 'Google Drive',
    descricao: 'Leitura das pastas de material dos clientes da agência.',
    ondeAchar: 'Cole o conteúdo do arquivo JSON da conta de serviço e compartilhe a pasta com o e-mail dela.',
    campos: [
      { id: 'service_account_json', rotulo: 'Conta de serviço (JSON)', multilinha: true, segredo: true },
      { id: 'pasta_raiz_id', rotulo: 'ID da pasta principal (opcional)' },
    ],
  },
};

function IntegracaoItem({ item }: { item: IntegracaoStatus }) {
  const tela = TELAS[item.chave];
  const { toast } = useToast();
  const { salvar, testar, alternar, remover } = useIntegracaoAcoes();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<{ ok: boolean; detalhe: string } | null>(null);

  const emAcao = salvar.isPending || testar.isPending || alternar.isPending || remover.isPending;

  const handleSalvar = async () => {
    try {
      const res = await salvar.mutateAsync({ chave: item.chave, credenciais: valores });
      setValores({});
      setResultado(res.teste);
      toast({
        title: res.teste.ok ? 'Integração salva e testada' : 'Salvo, mas o teste falhou',
        description: res.teste.detalhe,
        variant: res.teste.ok ? undefined : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Não deu para salvar', description: e.message, variant: 'destructive' });
    }
  };

  const handleTestar = async () => {
    try {
      const res = await testar.mutateAsync(item.chave);
      setResultado(res.teste);
      toast({
        title: res.teste.ok ? 'Conexão funcionando' : 'A conexão falhou',
        description: res.teste.detalhe,
        variant: res.teste.ok ? undefined : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Não deu para testar', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemover = async () => {
    try {
      await remover.mutateAsync(item.chave);
      setResultado(null);
      toast({ title: 'Dados apagados', description: `${tela.nome} foi desconectado.` });
    } catch (e: any) {
      toast({ title: 'Não deu para apagar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            {tela.nome}
            {item.configurada ? (
              <Badge variant={item.ativo ? 'default' : 'secondary'}>{item.ativo ? 'Conectado' : 'Pausado'}</Badge>
            ) : (
              <Badge variant="outline">Não configurado</Badge>
            )}
          </CardTitle>
          <CardDescription>{tela.descricao}</CardDescription>
        </div>
        {item.configurada && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`ativo-${item.chave}`} className="text-xs text-muted-foreground">
              Ativo
            </Label>
            <Switch
              id={`ativo-${item.chave}`}
              checked={item.ativo}
              disabled={emAcao}
              onCheckedChange={(v) => alternar.mutate({ chave: item.chave, ativo: v })}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{tela.ondeAchar}</p>

        {tela.campos.map((campo) => {
          const atual = item.campos.find((c) => c.id === campo.id);
          const placeholder = atual?.preenchido
            ? campo.segredo
              ? `Salvo (${atual.resumo}) — preencha só para trocar`
              : String(atual.resumo ?? '')
            : 'Preencher';
          return (
            <div key={campo.id} className="space-y-1.5">
              <Label htmlFor={`${item.chave}-${campo.id}`}>{campo.rotulo}</Label>
              {campo.multilinha ? (
                <Textarea
                  id={`${item.chave}-${campo.id}`}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder={placeholder}
                  value={valores[campo.id] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`${item.chave}-${campo.id}`}
                  type={campo.segredo ? 'password' : 'text'}
                  autoComplete="off"
                  placeholder={placeholder}
                  value={valores[campo.id] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                />
              )}
            </div>
          );
        })}

        {resultado && (
          <div
            className={`flex items-start gap-2 text-sm ${resultado.ok ? 'text-primary' : 'text-destructive'}`}
          >
            {resultado.ok ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{resultado.detalhe}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSalvar} disabled={emAcao || !Object.values(valores).some((v) => v.trim())}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar e testar
          </Button>
          {item.configurada && (
            <>
              <Button variant="outline" onClick={handleTestar} disabled={emAcao}>
                {testar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Testar conexão
              </Button>
              <Button variant="ghost" className="text-destructive" onClick={handleRemover} disabled={emAcao}>
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar dados
              </Button>
            </>
          )}
          {item.atualizado_em && (
            <span className="text-xs text-muted-foreground ml-auto">
              Atualizado em {format(new Date(item.atualizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegracoesAgenciaCard() {
  const { data, isLoading, error } = useIntegracoes();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando integrações...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrações da Agência</h2>
        <p className="text-sm text-muted-foreground">
          Os dados de acesso ficam guardados no servidor: depois de salvos, ninguém consegue vê-los de volta pela tela,
          só o final da chave.
        </p>
      </div>
      {(data ?? []).map((item) => (
        <IntegracaoItem key={item.chave} item={item} />
      ))}
    </div>
  );
}
