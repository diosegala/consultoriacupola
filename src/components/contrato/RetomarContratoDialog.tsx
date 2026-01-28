import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useRetomarContrato, PausaContrato } from '@/hooks/usePausasContrato';
import { toast } from '@/hooks/use-toast';

interface RetomarContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pausa: PausaContrato;
  clienteNome: string;
  dataFimContrato: string;
  onSuccess?: () => void;
}

export function RetomarContratoDialog({
  open,
  onOpenChange,
  pausa,
  clienteNome,
  dataFimContrato,
  onSuccess
}: RetomarContratoDialogProps) {
  const [dataRetomada, setDataRetomada] = useState<Date>(new Date());
  const retomarContrato = useRetomarContrato();

  const diasPausados = differenceInDays(dataRetomada, new Date(pausa.data_inicio));
  const novaDataFim = new Date(dataFimContrato);
  novaDataFim.setDate(novaDataFim.getDate() + diasPausados);

  const handleSubmit = async () => {
    try {
      await retomarContrato.mutateAsync({
        pausa_id: pausa.id,
        contrato_id: pausa.contrato_id,
        data_retomada: format(dataRetomada, 'yyyy-MM-dd')
      });

      toast({
        title: 'Contrato retomado',
        description: `O contrato de ${clienteNome} foi retomado. A data de término foi prorrogada em ${diasPausados} dias.`
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao retomar contrato',
        description: 'Ocorreu um erro ao retomar o contrato.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Retomar Contrato
          </DialogTitle>
          <DialogDescription>
            Retomar o atendimento de <strong>{clienteNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pausado desde:</span>
              <span className="font-medium">
                {format(new Date(pausa.data_inicio), 'dd/MM/yyyy')}
              </span>
            </div>
            {pausa.motivo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Motivo:</span>
                <span className="font-medium">{pausa.motivo}</span>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Data de retomada</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !dataRetomada && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataRetomada ? format(dataRetomada, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataRetomada}
                  onSelect={(date) => date && setDataRetomada(date)}
                  locale={ptBR}
                  disabled={(date) => date < new Date(pausa.data_inicio)}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="rounded-lg border border-info bg-info/10 p-4 space-y-2 text-sm">
            <p className="font-medium text-info-foreground">Prorrogação automática</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dias pausados:</span>
              <span className="font-medium">{diasPausados} dias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nova data de término:</span>
              <span className="font-medium">
                {format(novaDataFim, 'dd/MM/yyyy')}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={retomarContrato.isPending || diasPausados < 0}
          >
            {retomarContrato.isPending ? 'Retomando...' : 'Confirmar Retomada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
