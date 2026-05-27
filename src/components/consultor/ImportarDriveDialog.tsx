import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { useListDriveArquivos, useImportarDriveArquivo } from '@/hooks/useGoogleDrive';
import { useClientes } from '@/hooks/useClientes';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function ImportarDriveDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const list = useListDriveArquivos();
  const importar = useImportarDriveArquivo();
  const { data: clientes } = useClientes();
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const carregar = async () => {
    try {
      const { arquivos } = await list.mutateAsync();
      setArquivos(arquivos);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (open) carregar();
  }, [open]);

  const importarArquivo = async (file: any) => {
    const cliente_id = overrides[file.id] || file.cliente_sugerido;
    if (!cliente_id) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' });
      return;
    }
    try {
      await importar.mutateAsync({
        file_id: file.id,
        file_name: file.name,
        cliente_id,
        data_reuniao: file.createdTime ? file.createdTime.slice(0, 10) : undefined,
      });
      toast({ title: 'Importado', description: file.name });
      onImported?.();
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center justify-between">
            Importar do Google Drive
            <Button variant="ghost" size="sm" onClick={carregar} disabled={list.isPending}>
              {list.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {list.isPending && arquivos.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando arquivos...
            </div>
          )}
          {!list.isPending && arquivos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma transcrição encontrada na pasta "Meet Recordings".
            </p>
          )}
          {arquivos.map((f) => {
            const clienteId = overrides[f.id] || f.cliente_sugerido || '';
            return (
              <div key={f.id} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.createdTime && format(new Date(f.createdTime), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  {f.ja_importado && (
                    <Badge className="bg-green-600/20 text-green-500 border-green-600/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Importado
                    </Badge>
                  )}
                </div>
                {!f.ja_importado && (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={clienteId}
                      onValueChange={(v) => setOverrides((p) => ({ ...p, [f.id]: v }))}
                    >
                      <SelectTrigger className="bg-input border-border flex-1">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {(clientes || []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => importarArquivo(f)}
                      disabled={!clienteId || importar.isPending}
                      className="bg-primary text-primary-foreground"
                    >
                      <Download className="h-4 w-4 mr-1" /> Importar
                    </Button>
                  </div>
                )}
                {!f.ja_importado && !f.cliente_sugerido && (
                  <p className="text-xs text-muted-foreground">
                    Cliente não identificado automaticamente — selecione manualmente.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}