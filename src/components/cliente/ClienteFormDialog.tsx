import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateCliente, useUpdateCliente, Cliente } from '@/hooks/useClientes';
import { useConsultores } from '@/hooks/useConsultores';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Plus } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { useClienteAliases, useCreateAlias, useDeleteAlias } from '@/hooks/useGoogleDrive';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

type StatusCliente = Database['public']['Enums']['status_cliente'];

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  cidade: z.string().min(1, 'Cidade é obrigatória').max(100, 'Cidade muito longa'),
  uf: z.string().min(2, 'UF inválida').max(2, 'UF inválida'),
  consultor_id: z.string().nullable(),
  status: z.enum(['novo', 'ativo', 'aguardando_renovacao', 'encerrado']),
  pipedrive_deal_id: z.string().nullable(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

interface ClienteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
  onSuccess?: () => void;
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const STATUS_OPTIONS: { value: StatusCliente; label: string }[] = [
  { value: 'novo', label: 'Novo' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'aguardando_renovacao', label: 'Aguardando Renovação' },
  { value: 'encerrado', label: 'Encerrado' },
];

export function ClienteFormDialog({ open, onOpenChange, cliente, onSuccess }: ClienteFormDialogProps) {
  const { toast } = useToast();
  const { data: consultores } = useConsultores();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const { data: aliases } = useClienteAliases(cliente?.id);
  const createAlias = useCreateAlias();
  const deleteAlias = useDeleteAlias();
  const [newAlias, setNewAlias] = useState('');
  
  const isEditing = !!cliente;
  const isLoading = createCliente.isPending || updateCliente.isPending;

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: '',
      cidade: '',
      uf: '',
      consultor_id: null,
      status: 'novo',
      pipedrive_deal_id: null,
    },
  });

  useEffect(() => {
    if (cliente) {
      form.reset({
        nome: cliente.nome,
        cidade: cliente.cidade,
        uf: cliente.uf,
        consultor_id: cliente.consultor_id,
        status: cliente.status,
        pipedrive_deal_id: cliente.pipedrive_deal_id,
      });
    } else {
      form.reset({
        nome: '',
        cidade: '',
        uf: '',
        consultor_id: null,
        status: 'novo',
        pipedrive_deal_id: null,
      });
    }
  }, [cliente, form]);

  async function onSubmit(data: ClienteFormData) {
    try {
      if (isEditing && cliente) {
        await updateCliente.mutateAsync({
          id: cliente.id,
          nome: data.nome,
          cidade: data.cidade,
          uf: data.uf,
          consultor_id: data.consultor_id,
          status: data.status,
          pipedrive_deal_id: data.pipedrive_deal_id,
        });
        toast({
          title: 'Cliente atualizado',
          description: 'Os dados do cliente foram atualizados com sucesso.',
        });
      } else {
        await createCliente.mutateAsync({
          nome: data.nome,
          cidade: data.cidade,
          uf: data.uf,
          consultor_id: data.consultor_id,
          status: data.status,
          pipedrive_deal_id: data.pipedrive_deal_id,
        });
        toast({
          title: 'Cliente criado',
          description: 'O cliente foi cadastrado com sucesso.',
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao salvar o cliente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nome do cliente/empresa"
                      className="bg-input border-border"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Cidade"
                        className="bg-input border-border"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border z-50">
                        {UF_OPTIONS.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="consultor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Consultor Responsável</FormLabel>
                  <Select 
                    value={field.value || 'none'} 
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Selecione um consultor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {consultores?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border z-50">
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pipedrive_deal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID do Pipedrive (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="ID do deal no Pipedrive"
                      className="bg-input border-border"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEditing && cliente && (
              <div className="space-y-2 pt-2 border-t border-border">
                <FormLabel>Apelidos / Iniciais (para matching automático do Google Drive)</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Cadastre variações do nome do cliente (ex.: "ACME", "ACM"). Usadas para casar transcrições do Google Meet automaticamente.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Ex: ACME"
                    className="bg-input border-border"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAlias.trim()) {
                        e.preventDefault();
                        createAlias.mutate(
                          { cliente_id: cliente.id, alias: newAlias.trim() },
                          {
                            onSuccess: () => setNewAlias(''),
                            onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
                          }
                        );
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border"
                    disabled={!newAlias.trim() || createAlias.isPending}
                    onClick={() => {
                      createAlias.mutate(
                        { cliente_id: cliente.id, alias: newAlias.trim() },
                        {
                          onSuccess: () => setNewAlias(''),
                          onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
                        }
                      );
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(aliases || []).map((a) => (
                    <Badge key={a.id} variant="secondary" className="gap-1">
                      {a.alias}
                      <button
                        type="button"
                        onClick={() => deleteAlias.mutate(a.id)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
