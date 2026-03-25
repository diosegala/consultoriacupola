import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useClientes } from '@/hooks/useClientes';
import { useConsultores } from '@/hooks/useConsultores';
import { useProjetosEtapas, useProjetos, useCreateProjeto } from '@/hooks/useProjetos';
import { useMyConsultorId } from '@/hooks/useConsultorUser';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoProjetoDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { isAdmin, isConsultor } = useAuth();

  const { data: clientes } = useClientes();
  const { data: consultores } = useConsultores();
  const { data: etapas } = useProjetosEtapas();
  const { data: projetos } = useProjetos();
  const { data: myConsultorId } = useMyConsultorId();
  const createProjeto = useCreateProjeto();

  const [clienteId, setClienteId] = useState('');
  const [consultorId, setConsultorId] = useState('');
  const [etapaId, setEtapaId] = useState('');

  // Clients that already have a project
  const clientesComProjeto = useMemo(
    () => new Set((projetos ?? []).map((p) => p.cliente_id)),
    [projetos]
  );

  // Available clients: active, without existing project, filtered by consultant if applicable
  const clientesDisponiveis = useMemo(() => {
    return (clientes ?? []).filter((c) => {
      if (c.status !== 'ativo') return false;
      if (clientesComProjeto.has(c.id)) return false;
      if (isConsultor && myConsultorId && c.consultor_id !== myConsultorId) return false;
      return true;
    });
  }, [clientes, clientesComProjeto, isConsultor, myConsultorId]);

  const handleSubmit = async () => {
    const finalConsultorId = isConsultor ? myConsultorId : consultorId;
    if (!clienteId || !finalConsultorId || !etapaId) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    // Find active contract for the client
    const cliente = clientes?.find((c) => c.id === clienteId);
    try {
      await createProjeto.mutateAsync({
        cliente_id: clienteId,
        consultor_id: finalConsultorId,
        etapa_id: etapaId,
      });
      toast({ title: 'Sucesso', description: 'Projeto criado com sucesso' });
      setClienteId('');
      setConsultorId('');
      setEtapaId('');
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientesDisponiveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.cidade}/{c.uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isConsultor && (
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o consultor" />
                </SelectTrigger>
                <SelectContent>
                  {consultores?.filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Etapa inicial</Label>
            <Select value={etapaId} onValueChange={setEtapaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createProjeto.isPending}>
            {createProjeto.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
