import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Plane, Trash2, Pencil, X, Check, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

import {
  useViagensContrato,
  useCreateViagem,
  useUpdateViagem,
  useDeleteViagem,
  Viagem,
} from '@/hooks/useViagens';

const viagemSchema = z.object({
  data_viagem: z.string().min(1, 'Data obrigatória'),
  valor: z.coerce.number().min(0, 'Valor deve ser positivo'),
  descricao: z.string().optional(),
});

type ViagemFormValues = z.infer<typeof viagemSchema>;

interface ViagensContratoProps {
  contratoId: string;
  clienteId: string;
  receitaTotal: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function ViagensContrato({ contratoId, clienteId, receitaTotal }: ViagensContratoProps) {
  const { data: viagens, isLoading } = useViagensContrato(contratoId);
  const createViagem = useCreateViagem();
  const updateViagem = useUpdateViagem();
  const deleteViagem = useDeleteViagem();

  const [showForm, setShowForm] = useState(false);
  const [editingViagem, setEditingViagem] = useState<Viagem | null>(null);
  const [deletingViagem, setDeletingViagem] = useState<Viagem | null>(null);

  const form = useForm<ViagemFormValues>({
    resolver: zodResolver(viagemSchema),
    defaultValues: {
      data_viagem: '',
      valor: 0,
      descricao: '',
    },
  });

  const totalDespesas = viagens?.reduce((sum, v) => sum + Number(v.valor), 0) || 0;
  const resultado = receitaTotal - totalDespesas;

  const handleOpenForm = (viagem?: Viagem) => {
    if (viagem) {
      setEditingViagem(viagem);
      form.reset({
        data_viagem: viagem.data_viagem,
        valor: Number(viagem.valor),
        descricao: viagem.descricao || '',
      });
    } else {
      setEditingViagem(null);
      form.reset({
        data_viagem: '',
        valor: 0,
        descricao: '',
      });
    }
    setShowForm(true);
  };

  const handleSubmit = (values: ViagemFormValues) => {
    if (editingViagem) {
      updateViagem.mutate(
        {
          id: editingViagem.id,
          contrato_id: contratoId,
          ...values,
        },
        {
          onSuccess: () => {
            toast.success('Viagem atualizada');
            setShowForm(false);
            form.reset();
          },
          onError: (error) => {
            toast.error('Erro ao atualizar viagem: ' + error.message);
          },
        }
      );
    } else {
      createViagem.mutate(
        {
          contrato_id: contratoId,
          cliente_id: clienteId,
          data_viagem: values.data_viagem,
          valor: values.valor,
          descricao: values.descricao,
        },
        {
          onSuccess: () => {
            toast.success('Viagem registrada');
            setShowForm(false);
            form.reset();
          },
          onError: (error) => {
            toast.error('Erro ao registrar viagem: ' + error.message);
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deletingViagem) return;

    deleteViagem.mutate(
      { viagemId: deletingViagem.id, contratoId },
      {
        onSuccess: () => {
          toast.success('Viagem excluída');
          setDeletingViagem(null);
        },
        onError: (error) => {
          toast.error('Erro ao excluir viagem: ' + error.message);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Resumo Financeiro */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Receita Total</p>
          <p className="font-bold text-lg text-primary">{formatCurrency(receitaTotal)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Despesas Viagens</p>
          <p className="font-bold text-lg text-destructive">{formatCurrency(totalDespesas)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Resultado</p>
          <p className={`font-bold text-lg ${resultado >= 0 ? 'text-[#b0f90a]' : 'text-destructive'}`}>
            {formatCurrency(resultado)}
          </p>
        </div>
      </div>

      <Separator />

      {/* Header com botão adicionar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Viagens ({viagens?.length || 0})</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => handleOpenForm()}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Viagem
        </Button>
      </div>

      {/* Lista de Viagens */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : viagens && viagens.length > 0 ? (
        <div className="space-y-2">
          {viagens.map((viagem) => (
            <div
              key={viagem.id}
              className="flex items-center justify-between p-3 bg-card border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {format(parseISO(viagem.data_viagem), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                  <span className="text-sm font-bold text-destructive">
                    {formatCurrency(Number(viagem.valor))}
                  </span>
                </div>
                {viagem.descricao && (
                  <p className="text-xs text-muted-foreground mt-1">{viagem.descricao}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenForm(viagem)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeletingViagem(viagem)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Nenhuma viagem registrada
        </div>
      )}

      {/* Dialog Formulário */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingViagem ? 'Editar Viagem' : 'Registrar Viagem'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data_viagem">Data da Viagem *</Label>
              <Input
                id="data_viagem"
                type="date"
                {...form.register('data_viagem')}
              />
              {form.formState.errors.data_viagem && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.data_viagem.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                {...form.register('valor')}
              />
              {form.formState.errors.valor && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.valor.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Detalhes da viagem..."
                rows={2}
                {...form.register('descricao')}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createViagem.isPending || updateViagem.isPending}
              >
                {createViagem.isPending || updateViagem.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingViagem ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmação Exclusão */}
      <AlertDialog open={!!deletingViagem} onOpenChange={() => setDeletingViagem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir viagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteViagem.isPending}
            >
              {deleteViagem.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
