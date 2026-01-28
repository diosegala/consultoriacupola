import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, addMonths } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useCreateContrato, useUpdateContrato, ContratoComTipo } from '@/hooks/useContratos';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
import { toast } from '@/hooks/use-toast';

const contratoSchema = z.object({
  tipo_consultoria_id: z.string().optional().nullable(),
  prazo_meses: z.coerce.number().min(1, 'Prazo deve ser maior que 0'),
  data_inicio: z.date({ required_error: 'Data de início é obrigatória' }),
  data_fim: z.date({ required_error: 'Data de fim é obrigatória' }),
  remuneracao_total: z.coerce.number().min(0, 'Valor deve ser positivo'),
  parcelas: z.coerce.number().min(1, 'Mínimo 1 parcela'),
  tipo_vencimento: z.enum(['antecipado', 'postecipado']),
  remuneracao_mensal: z.coerce.number().min(0, 'Valor deve ser positivo'),
  momento: z.string().optional().nullable(),
  link_contrato: z.string().url('URL inválida').optional().nullable().or(z.literal('')),
  particularidades: z.string().optional().nullable(),
});

type ContratoFormValues = z.infer<typeof contratoSchema>;

interface ContratoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  contrato?: ContratoComTipo | null;
}

export function ContratoFormDialog({ open, onOpenChange, clienteId, contrato }: ContratoFormDialogProps) {
  const { data: tiposConsultoria } = useTiposConsultoria();
  const createContrato = useCreateContrato();
  const updateContrato = useUpdateContrato();
  const isEditing = !!contrato;

  const form = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      tipo_consultoria_id: '',
      prazo_meses: 12,
      data_inicio: new Date(),
      data_fim: addMonths(new Date(), 12),
      remuneracao_total: 0,
      parcelas: 12,
      tipo_vencimento: 'postecipado',
      remuneracao_mensal: 0,
      momento: '',
      link_contrato: '',
      particularidades: '',
    },
  });

  useEffect(() => {
    if (contrato) {
      form.reset({
        tipo_consultoria_id: contrato.tipo_consultoria_id || '',
        prazo_meses: contrato.prazo_meses,
        data_inicio: parseISO(contrato.data_inicio),
        data_fim: parseISO(contrato.data_fim),
        remuneracao_total: Number(contrato.remuneracao_total),
        parcelas: contrato.parcelas,
        tipo_vencimento: contrato.tipo_vencimento,
        remuneracao_mensal: Number(contrato.remuneracao_mensal),
        momento: contrato.momento || '',
        link_contrato: contrato.link_contrato || '',
        particularidades: contrato.particularidades || '',
      });
    } else {
      form.reset({
        tipo_consultoria_id: '',
        prazo_meses: 12,
        data_inicio: new Date(),
        data_fim: addMonths(new Date(), 12),
        remuneracao_total: 0,
        parcelas: 12,
        tipo_vencimento: 'postecipado',
        remuneracao_mensal: 0,
        momento: '',
        link_contrato: '',
        particularidades: '',
      });
    }
  }, [contrato, form, open]);

  // Recalcular data_fim quando prazo ou data_inicio mudar
  const watchDataInicio = form.watch('data_inicio');
  const watchPrazo = form.watch('prazo_meses');

  useEffect(() => {
    if (watchDataInicio && watchPrazo && !isEditing) {
      const novaDataFim = addMonths(watchDataInicio, watchPrazo);
      form.setValue('data_fim', novaDataFim);
    }
  }, [watchDataInicio, watchPrazo, form, isEditing]);

  // Recalcular remuneracao_mensal quando remuneracao_total ou parcelas mudar
  const watchTotal = form.watch('remuneracao_total');
  const watchParcelas = form.watch('parcelas');

  useEffect(() => {
    if (watchTotal && watchParcelas) {
      const mensal = watchTotal / watchParcelas;
      form.setValue('remuneracao_mensal', Math.round(mensal * 100) / 100);
    }
  }, [watchTotal, watchParcelas, form]);

  async function onSubmit(values: ContratoFormValues) {
    try {
      const payload = {
        cliente_id: clienteId,
        tipo_consultoria_id: values.tipo_consultoria_id || null,
        prazo_meses: values.prazo_meses,
        data_inicio: format(values.data_inicio, 'yyyy-MM-dd'),
        data_fim: format(values.data_fim, 'yyyy-MM-dd'),
        remuneracao_total: values.remuneracao_total,
        parcelas: values.parcelas,
        tipo_vencimento: values.tipo_vencimento,
        remuneracao_mensal: values.remuneracao_mensal,
        momento: values.momento || null,
        link_contrato: values.link_contrato || null,
        particularidades: values.particularidades || null,
        ativo: true,
      };

      if (isEditing && contrato) {
        await updateContrato.mutateAsync({
          id: contrato.id,
          cliente_id: clienteId,
          ...payload,
        });
        toast({ title: 'Contrato atualizado com sucesso!' });
      } else {
        await createContrato.mutateAsync(payload);
        toast({ title: 'Contrato criado com sucesso!' });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar contrato',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  const isSubmitting = createContrato.isPending || updateContrato.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? 'Editar Contrato' : 'Novo Contrato'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Tipo de Consultoria */}
              <FormField
                control={form.control}
                name="tipo_consultoria_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Consultoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        {tiposConsultoria?.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Momento */}
              <FormField
                control={form.control}
                name="momento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Momento</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Imersão, Acompanhamento"
                        className="bg-background border-input"
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Prazo */}
              <FormField
                control={form.control}
                name="prazo_meses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo (meses)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        className="bg-background border-input"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data Início */}
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal bg-background border-input',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd/MM/yyyy') : 'Selecione...'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data Fim */}
              <FormField
                control={form.control}
                name="data_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fim</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal bg-background border-input',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd/MM/yyyy') : 'Selecione...'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Remuneração Total */}
              <FormField
                control={form.control}
                name="remuneracao_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remuneração Total (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min={0}
                        className="bg-background border-input"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Parcelas */}
              <FormField
                control={form.control}
                name="parcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcelas</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        className="bg-background border-input"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Remuneração Mensal (calculado) */}
              <FormField
                control={form.control}
                name="remuneracao_mensal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MRR (R$) - Calculado</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        className="bg-muted border-input"
                        readOnly
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de Vencimento */}
              <FormField
                control={form.control}
                name="tipo_vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Vencimento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="antecipado">Antecipado</SelectItem>
                        <SelectItem value="postecipado">Postecipado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Link do Contrato */}
            <FormField
              control={form.control}
              name="link_contrato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link do Contrato</FormLabel>
                  <FormControl>
                    <Input 
                      type="url"
                      placeholder="https://..."
                      className="bg-background border-input"
                      {...field} 
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Particularidades */}
            <FormField
              control={form.control}
              name="particularidades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Particularidades</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações específicas do contrato..."
                      className="bg-background border-input resize-none"
                      rows={3}
                      {...field} 
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Contrato'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EncerrarContratoDialog({ open, onOpenChange, clienteId, contrato }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Encerrar Contrato</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Formulário em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
}

export function RenovarContratoDialog({ open, onOpenChange, clienteId, contratoAtual }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Renovar Contrato</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Formulário em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingFormDialog({ open, onOpenChange, onboarding, clienteId }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Onboarding</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Formulário em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
}

export function AtendimentoFormDialog({ open, onOpenChange, atendimento, clienteId }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Atendimento</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Formulário em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrarReuniaoDialog({ open, onOpenChange, atendimento, clienteId }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Registrar Reunião</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Formulário em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
}

export function FerramentasFormDialog({ open, onOpenChange, ferramentas, clienteId }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Ferramentas</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Formulário em desenvolvimento</p>
      </DialogContent>
    </Dialog>
  );
}
