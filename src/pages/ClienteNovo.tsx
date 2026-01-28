import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useCreateCliente } from '@/hooks/useClientes';
import { useConsultores } from '@/hooks/useConsultores';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  cidade: z.string().min(1, 'Cidade é obrigatória').max(100, 'Cidade muito longa'),
  uf: z.string().min(2, 'UF inválida').max(2, 'UF inválida'),
  consultor_id: z.string().nullable(),
  pipedrive_deal_id: z.string().nullable(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function ClienteNovo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: consultores } = useConsultores();
  const createCliente = useCreateCliente();

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: '',
      cidade: '',
      uf: '',
      consultor_id: null,
      pipedrive_deal_id: null,
    },
  });

  async function onSubmit(data: ClienteFormData) {
    try {
      const cliente = await createCliente.mutateAsync({
        nome: data.nome,
        cidade: data.cidade,
        uf: data.uf,
        consultor_id: data.consultor_id,
        pipedrive_deal_id: data.pipedrive_deal_id,
        status: 'novo',
      });
      
      toast({
        title: 'Cliente criado',
        description: 'O cliente foi cadastrado com sucesso. Complete os dados do contrato.',
      });
      
      // Redirecionar para a página de detalhe do cliente
      navigate(`/clientes/${cliente.id}`);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao cadastrar o cliente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Cliente</h1>
          <p className="text-muted-foreground">Cadastre um novo cliente manualmente</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Dados do Cliente</CardTitle>
          <CardDescription>
            Preencha os dados básicos do cliente. Após o cadastro, você poderá adicionar as informações do contrato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa/Cliente *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Construtora ABC"
                        className="bg-input border-border"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Curitiba"
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
                      <FormLabel>UF *</FormLabel>
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
                        <SelectItem value="none">Nenhum (atribuir depois)</SelectItem>
                        {consultores?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      O consultor pode ser atribuído posteriormente
                    </FormDescription>
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
                    <FormDescription>
                      Vincule este cliente a um deal do Pipedrive
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/clientes')}
                  disabled={createCliente.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCliente.isPending}>
                  {createCliente.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Cadastrar Cliente
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
