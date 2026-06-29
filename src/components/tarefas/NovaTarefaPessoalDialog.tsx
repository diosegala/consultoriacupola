import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCreateTodoPessoal } from '@/hooks/useTodoPessoal';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const SEM_CLIENTE = '__none__';

export function NovaTarefaPessoalDialog({ open, onOpenChange }: Props) {
  const [titulo, setTitulo] = useState('');
  const [clienteId, setClienteId] = useState<string>(SEM_CLIENTE);
  const [prazo, setPrazo] = useState<Date | undefined>();
  const create = useCreateTodoPessoal();
  const { data: consultorId } = useMyConsultorId();

  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['nova-tarefa-clientes', consultorId ?? 'all'],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from('clientes').select('id, nome').neq('status', 'encerrado').order('nome');
      if (consultorId) q = q.eq('consultor_id', consultorId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  function reset() {
    setTitulo('');
    setClienteId(SEM_CLIENTE);
    setPrazo(undefined);
  }

  async function handleSave() {
    if (!titulo.trim()) return;
    let projeto_id: string | null = null;
    const cliente_id = clienteId === SEM_CLIENTE ? null : clienteId;
    // Se houver cliente, tenta vincular a um projeto existente do consultor para esse cliente
    if (cliente_id && consultorId) {
      const { data: proj } = await supabase
        .from('projetos')
        .select('id')
        .eq('cliente_id', cliente_id)
        .eq('consultor_id', consultorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      projeto_id = proj?.id ?? null;
    }
    create.mutate(
      {
        titulo: titulo.trim(),
        cliente_id,
        projeto_id,
        due_date: prazo ? format(prazo, 'yyyy-MM-dd') : null,
      },
      {
        onSuccess: () => {
          toast.success('Tarefa criada');
          reset();
          onOpenChange(false);
        },
        onError: (e: any) => toast.error(e?.message ?? 'Erro ao criar tarefa'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova tarefa pessoal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Tarefa</Label>
            <Input
              id="titulo"
              autoFocus
              placeholder="O que precisa ser feito?"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && titulo.trim()) handleSave(); }}
            />
          </div>
          <div className="space-y-2">
            <Label>Cliente (opcional)</Label>
            <Select value={clienteId} onValueChange={setClienteId} disabled={loadingClientes}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClientes ? 'Carregando…' : 'Selecionar cliente'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_CLIENTE}>Sem cliente vinculado</SelectItem>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prazo (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {prazo ? format(prazo, 'dd/MM/yyyy') : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={prazo} onSelect={setPrazo} className="p-3 pointer-events-auto" initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim() || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}