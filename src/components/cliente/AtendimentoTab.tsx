import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAtendimento, useCreateAtendimento } from '@/hooks/useAtendimentos';
import { format, parseISO, isBefore, startOfDay, differenceInCalendarDays } from 'date-fns';
import { AtendimentoFormDialog, RegistrarReuniaoDialog } from './ClienteDialogs';

interface AtendimentoTabProps {
  clienteId: string;
}

const periodicidadeLabel = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal'
};

export function AtendimentoTab({ clienteId }: AtendimentoTabProps) {
  const { data: atendimento, isLoading } = useAtendimento(clienteId);
  const createAtendimento = useCreateAtendimento();
  const [showForm, setShowForm] = useState(false);
  const [showReuniao, setShowReuniao] = useState(false);

  const handleCreate = async () => {
    await createAtendimento.mutateAsync({
      cliente_id: clienteId,
      periodicidade: 'quinzenal'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!atendimento) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">Nenhum atendimento configurado</p>
          <Button onClick={handleCreate} disabled={createAtendimento.isPending}>
            {createAtendimento.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Configurar Atendimento
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hoje = startOfDay(new Date());
  const reuniaoAtrasada = atendimento.proxima_reuniao && 
    isBefore(parseISO(atendimento.proxima_reuniao), hoje);
  const diasAtraso = atendimento.proxima_reuniao
    ? differenceInCalendarDays(hoje, parseISO(atendimento.proxima_reuniao))
    : 0;
  const dessincronizado = diasAtraso > 3;

  return (
    <div className="space-y-6">
      {dessincronizado && (
        <div className="rounded-md border border-yellow-600/40 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Reunião prevista para {format(parseISO(atendimento.proxima_reuniao!), 'dd/MM/yyyy')} não foi registrada.
                </p>
                <p className="text-xs text-muted-foreground">
                  Registre a reunião realizada ou atualize a próxima data prevista.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowReuniao(true)}>Registrar Reunião</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>Atualizar Data</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reuniões */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reuniões
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Editar
            </Button>
            <Button size="sm" onClick={() => setShowReuniao(true)}>
              Registrar Reunião
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Periodicidade</p>
              <Badge variant="secondary" className="mt-1">
                {periodicidadeLabel[atendimento.periodicidade]}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Última Reunião</p>
              <p className="text-foreground font-medium">
                {atendimento.ultima_reuniao 
                  ? format(parseISO(atendimento.ultima_reuniao), 'dd/MM/yyyy')
                  : 'Nenhuma registrada'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Próxima Reunião</p>
              <div className="flex items-center gap-2">
                <p className={`font-medium ${reuniaoAtrasada ? 'text-destructive' : 'text-foreground'}`}>
                  {atendimento.proxima_reuniao 
                    ? format(parseISO(atendimento.proxima_reuniao), 'dd/MM/yyyy')
                    : 'Não definida'
                  }
                </p>
                {reuniaoAtrasada && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Atrasada
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {atendimento.link_controle && (
            <div className="mt-4 pt-4 border-t border-border">
              <a 
                href={atendimento.link_controle} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir planilha de controle
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cliente Oculto */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Cliente Oculto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Última Entrega</p>
              <p className="text-foreground font-medium">
                {atendimento.cliente_oculto_ultima 
                  ? format(parseISO(atendimento.cliente_oculto_ultima), 'dd/MM/yyyy')
                  : 'Nenhuma'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Próxima Previsão</p>
              <p className="text-foreground font-medium">
                {atendimento.cliente_oculto_proxima 
                  ? format(parseISO(atendimento.cliente_oculto_proxima), 'dd/MM/yyyy')
                  : 'Não definida'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OKRs */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">OKRs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Trimestre Ativo</p>
          <p className="text-foreground font-medium">
            {atendimento.trimestre_okrs || 'Não definido'}
          </p>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AtendimentoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        atendimento={atendimento}
        clienteId={clienteId}
      />

      <RegistrarReuniaoDialog
        open={showReuniao}
        onOpenChange={setShowReuniao}
        atendimento={atendimento}
        clienteId={clienteId}
      />
    </div>
  );
}
