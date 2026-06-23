import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, addMonths, addDays } from 'date-fns';
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
import { useCreateContrato, useUpdateContrato, useRenovarContrato, ContratoComTipo } from '@/hooks/useContratos';
import { useTiposConsultoria } from '@/hooks/useDadosAuxiliares';
import { useConsultores } from '@/hooks/useConsultores';
import { useUpdateCliente } from '@/hooks/useClientes';
import { useEncerrarContrato, calcularDataFimPagamento } from '@/hooks/useEncerramentos';
import { toast } from '@/hooks/use-toast';
import { getTipoConsultoriaLabel, TIPO_CONSULTORIA_PERSONALIZADO_NOME } from '@/lib/contrato';

const contratoSchema = z.object({
  consultor_id: z.string().optional().nullable(),
  tipo_consultoria_id: z.string().optional().nullable(),
  tipo_consultoria_personalizado: z.string().optional().nullable(),
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
  consultorId?: string | null;
}

export function ContratoFormDialog({ open, onOpenChange, clienteId, contrato, consultorId }: ContratoFormDialogProps) {
  const { data: tiposConsultoria } = useTiposConsultoria();
  const { data: consultores } = useConsultores();
  const createContrato = useCreateContrato();
  const updateContrato = useUpdateContrato();
  const updateCliente = useUpdateCliente();
  const isEditing = !!contrato;

  const form = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      consultor_id: '',
      tipo_consultoria_id: '',
      tipo_consultoria_personalizado: '',
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
        consultor_id: consultorId || '',
        tipo_consultoria_id: contrato.tipo_consultoria_id || '',
        tipo_consultoria_personalizado: (contrato as any).tipo_consultoria_personalizado || '',
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
        consultor_id: consultorId || '',
        tipo_consultoria_id: '',
        tipo_consultoria_personalizado: '',
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
  }, [contrato, form, open, consultorId]);

  // Recalcular data_fim quando prazo ou data_inicio mudar
  const watchDataInicio = form.watch('data_inicio');
  const watchPrazo = form.watch('prazo_meses');

  useEffect(() => {
    if (watchDataInicio && watchPrazo) {
      const prazoNumero = Number(watchPrazo);
      if (!isNaN(prazoNumero) && prazoNumero > 0) {
        const novaDataFim = addMonths(watchDataInicio, prazoNumero);
        form.setValue('data_fim', novaDataFim);
      }
    }
  }, [watchDataInicio, watchPrazo, form]);

  // Recalcular remuneracao_mensal quando remuneracao_total ou parcelas mudar
  const watchTotal = form.watch('remuneracao_total');
  const watchParcelas = form.watch('parcelas');

  useEffect(() => {
    if (watchTotal && watchParcelas) {
      const mensal = watchTotal / watchParcelas;
      form.setValue('remuneracao_mensal', Math.round(mensal * 100) / 100);
    }
  }, [watchTotal, watchParcelas, form]);

  // Detecta o id do tipo "Personalizado" e limpa o campo quando o tipo muda.
  const tipoPersonalizadoId = tiposConsultoria?.find(
    (t) => t.nome.toLowerCase() === TIPO_CONSULTORIA_PERSONALIZADO_NOME.toLowerCase()
  )?.id;
  const watchTipoId = form.watch('tipo_consultoria_id');
  const isPersonalizado = !!tipoPersonalizadoId && watchTipoId === tipoPersonalizadoId;
  useEffect(() => {
    if (!isPersonalizado && form.getValues('tipo_consultoria_personalizado')) {
      form.setValue('tipo_consultoria_personalizado', '');
    }
  }, [isPersonalizado, form]);

  async function onSubmit(values: ContratoFormValues) {
    if (isPersonalizado && !values.tipo_consultoria_personalizado?.trim()) {
      form.setError('tipo_consultoria_personalizado', {
        type: 'manual',
        message: 'Informe o nome da consultoria personalizada',
      });
      return;
    }
    try {
      const payload = {
        cliente_id: clienteId,
        tipo_consultoria_id: values.tipo_consultoria_id || null,
        tipo_consultoria_personalizado: isPersonalizado
          ? values.tipo_consultoria_personalizado?.trim() || null
          : null,
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

      // Update consultor if changed
      const newConsultorId = values.consultor_id || null;
      if (newConsultorId !== (consultorId || null)) {
        await updateCliente.mutateAsync({
          id: clienteId,
          consultor_id: newConsultorId,
        });
      }

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
              {/* Consultor Responsável */}
              <FormField
                control={form.control}
                name="consultor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultor Responsável</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        {consultores?.map((consultor) => (
                          <SelectItem key={consultor.id} value={consultor.id}>
                            {consultor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            {isPersonalizado && (
              <FormField
                control={form.control}
                name="tipo_consultoria_personalizado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da consultoria personalizada</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Consultoria sob medida para X"
                        className="bg-background border-input"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
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

interface EncerrarContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  contrato: ContratoComTipo;
  onSuccess?: () => void;
}

const encerrarSchema = z.object({
  classificacao: z.enum(['churn', 'fim_contrato'], { required_error: 'Selecione a classificação' }),
  justificativa: z.string().optional(),
});

type EncerrarFormValues = z.infer<typeof encerrarSchema>;

export function EncerrarContratoDialog({ open, onOpenChange, clienteId, contrato, onSuccess }: EncerrarContratoDialogProps) {
  const encerrarContrato = useEncerrarContrato();

  const form = useForm<EncerrarFormValues>({
    resolver: zodResolver(encerrarSchema),
    defaultValues: {
      classificacao: undefined,
      justificativa: '',
    },
  });

  const classificacaoSelecionada = form.watch('classificacao');
  const dataFimPagamento = calcularDataFimPagamento(
    contrato.data_inicio,
    contrato.parcelas,
    contrato.tipo_vencimento as 'antecipado' | 'postecipado'
  );
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const aindaTemParcelas = dataFimPagamento >= hoje;
  const mostrarAvisoMRR = classificacaoSelecionada === 'fim_contrato' && aindaTemParcelas;

  useEffect(() => {
    if (open) {
      form.reset({
        classificacao: undefined,
        justificativa: '',
      });
    }
  }, [open, form]);

  async function onSubmit(values: EncerrarFormValues) {
    try {
      await encerrarContrato.mutateAsync({
        clienteId,
        contratoId: contrato.id,
        classificacao: values.classificacao,
        justificativa: values.justificativa || undefined,
        mrrPerdido: Number(contrato.remuneracao_mensal),
      });

      toast({ title: 'Contrato encerrado com sucesso!' });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao encerrar contrato',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Encerrar Contrato</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                {mostrarAvisoMRR ? 'MRR ainda em curso até a última parcela:' : 'MRR que será perdido:'}
              </p>
              <p className={cn('text-xl font-bold', mostrarAvisoMRR ? 'text-primary' : 'text-destructive')}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(contrato.remuneracao_mensal))}
              </p>
            </div>

            {mostrarAvisoMRR && (
              <div className="p-3 rounded-md border border-primary/30 bg-primary/5 text-sm text-foreground">
                Este contrato continuará compondo o MRR até <strong>{format(dataFimPagamento, 'dd/MM/yyyy')}</strong> (data da última parcela). A baixa será aplicada automaticamente após essa data.
              </div>
            )}

            <FormField
              control={form.control}
              name="classificacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Classificação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione o motivo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="churn">Churn (cancelamento)</SelectItem>
                      <SelectItem value="fim_contrato">Fim de Contrato</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="justificativa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificativa (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os motivos do encerramento..."
                      className="bg-background border-input resize-none"
                      rows={3}
                      {...field}
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
              <Button type="submit" variant="destructive" disabled={encerrarContrato.isPending}>
                {encerrarContrato.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Encerrar Contrato
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface RenovarContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  contratoAtual: ContratoComTipo;
  onSuccess?: () => void;
}

const renovarSchema = z.object({
  tipo_consultoria_id: z.string().optional().nullable(),
  tipo_consultoria_personalizado: z.string().optional().nullable(),
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

type RenovarFormValues = z.infer<typeof renovarSchema>;

export function RenovarContratoDialog({ open, onOpenChange, clienteId, contratoAtual, onSuccess }: RenovarContratoDialogProps) {
  const { data: tiposConsultoria } = useTiposConsultoria();
  const renovarContrato = useRenovarContrato();

  // Data de início da renovação: dia seguinte ao fim do contrato atual
  const dataInicioRenovacao = addDays(parseISO(contratoAtual.data_fim), 1);

  const form = useForm<RenovarFormValues>({
    resolver: zodResolver(renovarSchema),
    defaultValues: {
      tipo_consultoria_id: contratoAtual.tipo_consultoria_id || '',
      tipo_consultoria_personalizado: (contratoAtual as any).tipo_consultoria_personalizado || '',
      prazo_meses: contratoAtual.prazo_meses,
      data_inicio: dataInicioRenovacao,
      data_fim: addMonths(dataInicioRenovacao, contratoAtual.prazo_meses),
      remuneracao_total: Number(contratoAtual.remuneracao_total),
      parcelas: contratoAtual.parcelas,
      tipo_vencimento: contratoAtual.tipo_vencimento,
      remuneracao_mensal: Number(contratoAtual.remuneracao_mensal),
      momento: contratoAtual.momento || '',
      link_contrato: '',
      particularidades: contratoAtual.particularidades || '',
    },
  });

  useEffect(() => {
    if (open && contratoAtual) {
      const novaDataInicio = addDays(parseISO(contratoAtual.data_fim), 1);
      form.reset({
        tipo_consultoria_id: contratoAtual.tipo_consultoria_id || '',
        tipo_consultoria_personalizado: (contratoAtual as any).tipo_consultoria_personalizado || '',
        prazo_meses: contratoAtual.prazo_meses,
        data_inicio: novaDataInicio,
        data_fim: addMonths(novaDataInicio, contratoAtual.prazo_meses),
        remuneracao_total: Number(contratoAtual.remuneracao_total),
        parcelas: contratoAtual.parcelas,
        tipo_vencimento: contratoAtual.tipo_vencimento,
        remuneracao_mensal: Number(contratoAtual.remuneracao_mensal),
        momento: contratoAtual.momento || '',
        link_contrato: '',
        particularidades: contratoAtual.particularidades || '',
      });
    }
  }, [open, contratoAtual, form]);

  // Recalcular data_fim quando prazo ou data_inicio mudar
  const watchDataInicio = form.watch('data_inicio');
  const watchPrazo = form.watch('prazo_meses');

  useEffect(() => {
    if (watchDataInicio && watchPrazo) {
      const prazoNumero = Number(watchPrazo);
      if (!isNaN(prazoNumero) && prazoNumero > 0) {
        const novaDataFim = addMonths(watchDataInicio, prazoNumero);
        form.setValue('data_fim', novaDataFim);
      }
    }
  }, [watchDataInicio, watchPrazo, form]);

  // Recalcular remuneracao_mensal quando remuneracao_total ou parcelas mudar
  const watchTotal = form.watch('remuneracao_total');
  const watchParcelas = form.watch('parcelas');

  useEffect(() => {
    if (watchTotal && watchParcelas) {
      const mensal = watchTotal / watchParcelas;
      form.setValue('remuneracao_mensal', Math.round(mensal * 100) / 100);
    }
  }, [watchTotal, watchParcelas, form]);

  const tipoPersonalizadoId = tiposConsultoria?.find(
    (t) => t.nome.toLowerCase() === TIPO_CONSULTORIA_PERSONALIZADO_NOME.toLowerCase()
  )?.id;
  const watchTipoId = form.watch('tipo_consultoria_id');
  const isPersonalizado = !!tipoPersonalizadoId && watchTipoId === tipoPersonalizadoId;
  useEffect(() => {
    if (!isPersonalizado && form.getValues('tipo_consultoria_personalizado')) {
      form.setValue('tipo_consultoria_personalizado', '');
    }
  }, [isPersonalizado, form]);

  async function onSubmit(values: RenovarFormValues) {
    if (isPersonalizado && !values.tipo_consultoria_personalizado?.trim()) {
      form.setError('tipo_consultoria_personalizado', {
        type: 'manual',
        message: 'Informe o nome da consultoria personalizada',
      });
      return;
    }
    try {
      await renovarContrato.mutateAsync({
        contratoAtualId: contratoAtual.id,
        novoContrato: {
          cliente_id: clienteId,
          tipo_consultoria_id: values.tipo_consultoria_id || null,
          tipo_consultoria_personalizado: isPersonalizado
            ? values.tipo_consultoria_personalizado?.trim() || null
            : null,
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
        },
      });

      toast({ title: 'Contrato renovado com sucesso!' });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao renovar contrato',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Renovar Contrato</DialogTitle>
        </DialogHeader>

        <div className="p-4 rounded-lg bg-muted/50 border border-border mb-4">
          <p className="text-sm text-muted-foreground">Contrato atual:</p>
          <p className="font-medium">
            {contratoAtual.tipo_consultoria?.nome || 'Tipo não definido'} • 
            {format(parseISO(contratoAtual.data_inicio), 'dd/MM/yyyy')} a {format(parseISO(contratoAtual.data_fim), 'dd/MM/yyyy')}
          </p>
        </div>

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
                  <FormLabel>Link do Novo Contrato</FormLabel>
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
              <Button type="submit" disabled={renovarContrato.isPending}>
                {renovarContrato.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Renovar Contrato
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useUpdateOnboarding, Onboarding } from '@/hooks/useOnboarding';

const onboardingSchema = z.object({
  etapa_atual: z.enum(['pre_onboarding', 'imersao_1', 'imersao_2', 'imersao_3', 'concluido']),
  data_pre_onboarding: z.date().nullable().optional(),
  data_imersao_1_inicio: z.date().nullable().optional(),
  data_imersao_1_fim: z.date().nullable().optional(),
  data_imersao_2: z.date().nullable().optional(),
  data_imersao_3: z.date().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

interface OnboardingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboarding: Onboarding;
  clienteId: string;
}

export function OnboardingFormDialog({ open, onOpenChange, onboarding, clienteId }: OnboardingFormDialogProps) {
  const updateOnboarding = useUpdateOnboarding();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      etapa_atual: 'pre_onboarding',
      data_pre_onboarding: null,
      data_imersao_1_inicio: null,
      data_imersao_1_fim: null,
      data_imersao_2: null,
      data_imersao_3: null,
      observacoes: '',
    },
  });

  useEffect(() => {
    if (onboarding && open) {
      form.reset({
        etapa_atual: onboarding.etapa_atual,
        data_pre_onboarding: onboarding.data_pre_onboarding ? parseISO(onboarding.data_pre_onboarding) : null,
        data_imersao_1_inicio: onboarding.data_imersao_1_inicio ? parseISO(onboarding.data_imersao_1_inicio) : null,
        data_imersao_1_fim: onboarding.data_imersao_1_fim ? parseISO(onboarding.data_imersao_1_fim) : null,
        data_imersao_2: onboarding.data_imersao_2 ? parseISO(onboarding.data_imersao_2) : null,
        data_imersao_3: onboarding.data_imersao_3 ? parseISO(onboarding.data_imersao_3) : null,
        observacoes: onboarding.observacoes || '',
      });
    }
  }, [onboarding, open, form]);

  async function onSubmit(values: OnboardingFormValues) {
    try {
      await updateOnboarding.mutateAsync({
        id: onboarding.id,
        cliente_id: clienteId,
        etapa_atual: values.etapa_atual,
        data_pre_onboarding: values.data_pre_onboarding ? format(values.data_pre_onboarding, 'yyyy-MM-dd') : null,
        data_imersao_1_inicio: values.data_imersao_1_inicio ? format(values.data_imersao_1_inicio, 'yyyy-MM-dd') : null,
        data_imersao_1_fim: values.data_imersao_1_fim ? format(values.data_imersao_1_fim, 'yyyy-MM-dd') : null,
        data_imersao_2: values.data_imersao_2 ? format(values.data_imersao_2, 'yyyy-MM-dd') : null,
        data_imersao_3: values.data_imersao_3 ? format(values.data_imersao_3, 'yyyy-MM-dd') : null,
        observacoes: values.observacoes || null,
      });

      toast({ title: 'Onboarding atualizado com sucesso!' });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar onboarding',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  const etapasOptions = [
    { value: 'pre_onboarding', label: 'Pré-Onboarding' },
    { value: 'imersao_1', label: 'Imersão 1' },
    { value: 'imersao_2', label: 'Imersão 2' },
    { value: 'imersao_3', label: 'Imersão 3' },
    { value: 'concluido', label: 'Concluído' },
  ];

  const renderDateField = (name: keyof OnboardingFormValues, label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{label}</FormLabel>
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
                  {field.value ? format(field.value as Date, 'dd/MM/yyyy') : 'Selecione...'}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
              <Calendar
                mode="single"
                selected={field.value as Date | undefined}
                onSelect={field.onChange}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar Onboarding</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Etapa Atual */}
            <FormField
              control={form.control}
              name="etapa_atual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa Atual</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Selecione a etapa..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      {etapasOptions.map((etapa) => (
                        <SelectItem key={etapa.value} value={etapa.value}>
                          {etapa.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datas */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Datas das Etapas</h4>
              
              {renderDateField('data_pre_onboarding', 'Pré-Onboarding')}
              
              <div className="grid grid-cols-2 gap-4">
                {renderDateField('data_imersao_1_inicio', 'Imersão 1 - Início')}
                {renderDateField('data_imersao_1_fim', 'Imersão 1 - Fim')}
              </div>
              
              {renderDateField('data_imersao_2', 'Imersão 2')}
              {renderDateField('data_imersao_3', 'Imersão 3')}
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre o onboarding..."
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
              <Button type="submit" disabled={updateOnboarding.isPending}>
                {updateOnboarding.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
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
