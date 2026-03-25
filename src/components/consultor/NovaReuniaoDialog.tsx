import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useClientes } from '@/hooks/useClientes';
import { useCreateReuniao, useAnalisarReuniao } from '@/hooks/useReunioes';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface NovaReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultorId: string;
}

export function NovaReuniaoDialog({ open, onOpenChange, consultorId }: NovaReuniaoDialogProps) {
  const { toast } = useToast();
  const { data: clientes } = useClientes();
  const createReuniao = useCreateReuniao();
  const analisarReuniao = useAnalisarReuniao();

  const [formData, setFormData] = useState({
    cliente_id: '',
    data_reuniao: format(new Date(), 'yyyy-MM-dd'),
    duracao_minutos: '',
    google_meet_link: '',
    transcricao: '',
  });

  const handleSubmit = async () => {
    if (!formData.cliente_id || !formData.data_reuniao) {
      toast({ title: 'Erro', description: 'Cliente e data são obrigatórios', variant: 'destructive' });
      return;
    }
    if (!formData.transcricao.trim()) {
      toast({ title: 'Erro', description: 'A transcrição é obrigatória para análise', variant: 'destructive' });
      return;
    }

    try {
      const reuniao = await createReuniao.mutateAsync({
        consultor_id: consultorId,
        cliente_id: formData.cliente_id,
        data_reuniao: formData.data_reuniao,
        duracao_minutos: formData.duracao_minutos ? parseInt(formData.duracao_minutos) : null,
        google_meet_link: formData.google_meet_link || null,
        transcricao: formData.transcricao,
      });

      toast({ title: 'Reunião registrada', description: 'Iniciando análise por IA...' });
      onOpenChange(false);
      resetForm();

      // Fire and forget - analysis runs in background
      analisarReuniao.mutate(reuniao.id, {
        onSuccess: () => {
          toast({ title: 'Análise concluída', description: 'A IA finalizou a análise da reunião' });
        },
        onError: (err: any) => {
          toast({ title: 'Erro na análise', description: err.message, variant: 'destructive' });
        },
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      cliente_id: '',
      data_reuniao: format(new Date(), 'yyyy-MM-dd'),
      duracao_minutos: '',
      google_meet_link: '',
      transcricao: '',
    });
  };

  const clientesAtivos = clientes?.filter(c => c.status === 'ativo') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova Reunião</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Cliente *</Label>
              <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Data *</Label>
              <Input
                type="date"
                value={formData.data_reuniao}
                onChange={(e) => setFormData({ ...formData, data_reuniao: e.target.value })}
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Duração (min)</Label>
              <Input
                type="number"
                value={formData.duracao_minutos}
                onChange={(e) => setFormData({ ...formData, duracao_minutos: e.target.value })}
                placeholder="60"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Link Google Meet</Label>
              <Input
                value={formData.google_meet_link}
                onChange={(e) => setFormData({ ...formData, google_meet_link: e.target.value })}
                placeholder="https://meet.google.com/..."
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Transcrição *</Label>
            <Textarea
              value={formData.transcricao}
              onChange={(e) => setFormData({ ...formData, transcricao: e.target.value })}
              placeholder="Cole aqui a transcrição da reunião do Google Meet..."
              className="bg-input border-border min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Cole a transcrição gerada pelo Gemini no Google Meet. A análise por IA será feita automaticamente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createReuniao.isPending}
            className="bg-primary text-primary-foreground"
          >
            {createReuniao.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar e Analisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
