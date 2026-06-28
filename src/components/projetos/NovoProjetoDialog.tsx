import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useClientes } from '@/hooks/useClientes';
import { useConsultores } from '@/hooks/useConsultores';
import { useProjetosEtapas, useProjetos, useCreateProjeto } from '@/hooks/useProjetos';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useContratoAtivo } from '@/hooks/useContratos';
import { useChecklistTemplates } from '@/hooks/useChecklistTemplates';
import { supabase } from '@/integrations/supabase/client';

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
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: contratoAtivo } = useContratoAtivo(clienteId || undefined);
  const tipoConsultoriaId = contratoAtivo?.tipo_consultoria_id ?? undefined;
  const { data: templates } = useChecklistTemplates(tipoConsultoriaId);

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

    try {
      const novoProjeto = await createProjeto.mutateAsync({
        cliente_id: clienteId,
        consultor_id: finalConsultorId,
        etapa_id: etapaId,
      });

      // Inserir checklist padrão a partir dos templates do tipo de consultoria
      if (templates && templates.length > 0 && (novoProjeto as any)?.id) {
        const rows = templates.map((t) => ({
          projeto_id: (novoProjeto as any).id,
          titulo: t.titulo,
          ordem: t.ordem,
        }));
        const { error: errChk } = await supabase.from('projeto_checklist').insert(rows);
        if (errChk) {
          console.error('Erro ao inserir checklist padrão:', errChk);
        }
      }

      toast({
        title: 'Sucesso',
        description: templates && templates.length > 0
          ? `Projeto criado com ${templates.length} item(ns) de checklist padrão`
          : 'Projeto criado com sucesso',
      });
      setClienteId('');
      setConsultorId('');
      setEtapaId('');
      setPreviewOpen(false);
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

          {clienteId && templates && templates.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30">
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Checklist padrão incluído ({templates.length} {templates.length === 1 ? 'item' : 'itens'})
                </span>
                {previewOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {previewOpen && (
                <ol className="px-4 pb-3 pt-1 space-y-1 text-xs text-muted-foreground list-decimal list-inside max-h-60 overflow-y-auto">
                  {templates.map((t) => (
                    <li key={t.id}>{t.titulo}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {clienteId && !tipoConsultoriaId && (
            <p className="text-xs text-muted-foreground">
              Sem contrato ativo ou tipo de consultoria — o projeto será criado sem checklist padrão.
            </p>
          )}
          {clienteId && tipoConsultoriaId && templates && templates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum template de checklist cadastrado para este tipo de consultoria.
            </p>
          )}
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
