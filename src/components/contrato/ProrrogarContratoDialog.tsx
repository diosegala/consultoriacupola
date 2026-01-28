import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useProrrogarContrato } from '@/hooks/usePausasContrato';
import { toast } from '@/hooks/use-toast';

interface ProrrogarContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  clienteId: string;
  clienteNome: string;
  dataFimAtual: string;
  onSuccess?: () => void;
}

export function ProrrogarContratoDialog({
  open,
  onOpenChange,
  contratoId,
  clienteId,
  clienteNome,
  dataFimAtual,
  onSuccess
}: ProrrogarContratoDialogProps) {
  const [diasProrrogacao, setDiasProrrogacao] = useState(30);
  const [motivo, setMotivo] = useState('');
  const prorrogarContrato = useProrrogarContrato();

  const novaDataFim = addDays(new Date(dataFimAtual), diasProrrogacao);

  const handleSubmit = async () => {
    if (diasProrrogacao <= 0) {
      toast({
        title: 'Erro',
        description: 'O número de dias deve ser maior que zero.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await prorrogarContrato.mutateAsync({
        contrato_id: contratoId,
        cliente_id: clienteId,
        dias_prorrogacao: diasProrrogacao,
        motivo: motivo || undefined
      });

      toast({
        title: 'Contrato prorrogado',
        description: `O contrato de ${clienteNome} foi prorrogado em ${diasProrrogacao} dias.`
      });

      onOpenChange(false);
      setDiasProrrogacao(30);
      setMotivo('');
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao prorrogar contrato',
        description: 'Ocorreu um erro ao prorrogar o contrato.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Prorrogar Contrato
          </DialogTitle>
          <DialogDescription>
            Estender a data de término do contrato de <strong>{clienteNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data de término atual:</span>
              <span className="font-medium">
                {format(new Date(dataFimAtual), 'dd/MM/yyyy')}
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Dias de prorrogação</Label>
            <Input
              type="number"
              min={1}
              value={diasProrrogacao}
              onChange={(e) => setDiasProrrogacao(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Motivo da prorrogação (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Compensação por período de férias, ajuste de cronograma..."
              rows={3}
            />
          </div>

          <div className="rounded-lg border border-success bg-success/10 p-4 space-y-2 text-sm">
            <p className="font-medium text-success-foreground">Nova data de término</p>
            <p className="text-lg font-bold">
              {format(novaDataFim, 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={prorrogarContrato.isPending || diasProrrogacao <= 0}
          >
            {prorrogarContrato.isPending ? 'Prorrogando...' : 'Confirmar Prorrogação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
