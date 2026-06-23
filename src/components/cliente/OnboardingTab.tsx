import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Circle } from 'lucide-react';
import { useOnboarding, useCreateOnboarding, useUpdateOnboarding } from '@/hooks/useOnboarding';
import { format, parseISO } from 'date-fns';
import { OnboardingFormDialog } from './ClienteDialogs';
import { QuestionarioBloco } from './QuestionarioBloco';

interface OnboardingTabProps {
  clienteId: string;
}

const etapas = [
  { key: 'pre_onboarding', label: 'Pré-Onboarding', dateField: 'data_pre_onboarding' },
  { key: 'imersao_1', label: 'Imersão 1', dateField: 'data_imersao_1_inicio' },
  { key: 'imersao_2', label: 'Imersão 2', dateField: 'data_imersao_2' },
  { key: 'imersao_3', label: 'Imersão 3', dateField: 'data_imersao_3' },
  { key: 'concluido', label: 'Concluído', dateField: null }
];

const etapaOrder = ['pre_onboarding', 'imersao_1', 'imersao_2', 'imersao_3', 'concluido'];

export function OnboardingTab({ clienteId }: OnboardingTabProps) {
  const { data: onboarding, isLoading } = useOnboarding(clienteId);
  const createOnboarding = useCreateOnboarding();
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async () => {
    await createOnboarding.mutateAsync({
      cliente_id: clienteId,
      etapa_atual: 'pre_onboarding'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">Nenhum onboarding iniciado</p>
          <Button onClick={handleCreate} disabled={createOnboarding.isPending}>
            {createOnboarding.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Iniciar Onboarding
          </Button>
        </CardContent>
      </Card>
    );
  }

  const etapaAtualIndex = etapaOrder.indexOf(onboarding.etapa_atual);

  const getDateForEtapa = (etapa: typeof etapas[0]) => {
    if (!etapa.dateField) return null;
    const value = onboarding[etapa.dateField as keyof typeof onboarding] as string | null;
    return value ? format(parseISO(value), 'dd/MM/yyyy') : null;
  };

  return (
    <div className="space-y-6">
      <QuestionarioBloco clienteId={clienteId} />
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Timeline do Onboarding</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Editar Datas
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Linha vertical */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-8">
              {etapas.map((etapa, index) => {
                const isConcluida = index < etapaAtualIndex;
                const isAtual = index === etapaAtualIndex;
                const isPendente = index > etapaAtualIndex;
                const data = getDateForEtapa(etapa);

                return (
                  <div key={etapa.key} className="relative flex items-start gap-4">
                    {/* Ícone */}
                    <div className={`
                      relative z-10 flex items-center justify-center w-12 h-12 rounded-full
                      ${isConcluida ? 'bg-primary text-primary-foreground' : ''}
                      ${isAtual ? 'bg-primary/20 text-primary border-2 border-primary' : ''}
                      ${isPendente ? 'bg-muted text-muted-foreground' : ''}
                    `}>
                      {isConcluida ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 pt-2">
                      <h4 className={`font-medium ${isPendente ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {etapa.label}
                      </h4>
                      {data && (
                        <p className="text-sm text-muted-foreground">{data}</p>
                      )}
                      {isAtual && (
                        <span className="inline-block mt-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          Etapa atual
                        </span>
                      )}
                      {etapa.key === 'imersao_1' && onboarding.data_imersao_1_fim && (
                        <p className="text-sm text-muted-foreground">
                          até {format(parseISO(onboarding.data_imersao_1_fim), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {onboarding.observacoes && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="text-foreground mt-1">{onboarding.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <OnboardingFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onboarding={onboarding}
        clienteId={clienteId}
      />
    </div>
  );
}
