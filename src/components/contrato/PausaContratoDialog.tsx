import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Pause } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePausarContrato } from '@/hooks/usePausasContrato';
import { toast } from '@/hooks/use-toast';

interface PausaContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  clienteId: string;
  clienteNome: string;
  onSuccess?: () => void;
}

export function PausaContratoDialog({
  open,
  onOpenChange,
  contratoId,
  clienteId,
  clienteNome,
  onSuccess
}: PausaContratoDialogProps) {
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [motivo, setMotivo] = useState('');
  const pausarContrato = usePausarContrato();

  const handleSubmit = async () => {
    try {
      await pausarContrato.mutateAsync({
        contrato_id: contratoId,
        cliente_id: clienteId,
        data_inicio: format(dataInicio, 'yyyy-MM-dd'),
        motivo: motivo || null
      });

      toast({
        title: 'Contrato pausado',
        description: `O contrato de ${clienteNome} foi pausado com sucesso.`
      });

      onOpenChange(false);
      setMotivo('');
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao pausar contrato',
        description: 'Ocorreu um erro ao pausar o contrato.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5" />
            Pausar Contrato
          </DialogTitle>
          <DialogDescription>
            Pausar o atendimento de <strong>{clienteNome}</strong>. A data de término será 
            automaticamente prorrogada quando o contrato for retomado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Data de início da pausa</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !dataInicio && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={(date) => date && setDataInicio(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Motivo da pausa (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Solicitação do cliente para viagem, reforma na empresa..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={pausarContrato.isPending}
          >
            {pausarContrato.isPending ? 'Pausando...' : 'Confirmar Pausa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
