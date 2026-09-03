import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X } from 'lucide-react';
import { useClienteAliases, useCreateAlias, useDeleteAlias } from '@/hooks/useGoogleDrive';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AliasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | undefined;
  clienteNome: string | undefined;
}

export function AliasesDialog({ open, onOpenChange, clienteId, clienteNome }: AliasesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: aliases, isLoading } = useClienteAliases(open ? clienteId : undefined);
  const createAlias = useCreateAlias();
  const deleteAlias = useDeleteAlias();
  const [newAlias, setNewAlias] = useState('');

  const handleAdd = async () => {
    const value = newAlias.trim();
    if (!value || !clienteId) return;
    if ((aliases ?? []).some(a => a.alias.toLowerCase() === value.toLowerCase())) {
      toast({ title: 'Apelido já existe', variant: 'destructive' });
      return;
    }
    try {
      await createAlias.mutateAsync({ cliente_id: clienteId, alias: value });
      queryClient.invalidateQueries({ queryKey: ['cliente-aliases'] });
      setNewAlias('');
    } catch (e: any) {
      toast({ title: 'Erro ao adicionar apelido', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Apelidos — {clienteNome}</DialogTitle>
          <DialogDescription>
            Apelidos ajudam a reconhecer o cliente nos arquivos e reuniões importadas do Google Drive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={newAlias}
              placeholder="Novo apelido..."
              className="bg-input border-border"
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button onClick={handleAdd} disabled={!newAlias.trim() || createAlias.isPending}>
              {createAlias.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (aliases ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum apelido cadastrado ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {aliases!.map(a => (
                <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                  {a.alias}
                  <button
                    type="button"
                    aria-label={`Remover apelido ${a.alias}`}
                    className="rounded-sm hover:text-destructive"
                    onClick={() =>
                      deleteAlias.mutate(a.id, {
                        onSuccess: () =>
                          queryClient.invalidateQueries({ queryKey: ['cliente-aliases'] }),
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
