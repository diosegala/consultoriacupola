import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { CANAL_LABEL, CanalInteracao, useCreateInteracaoCliente } from '@/hooks/useInteracoesCliente';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  consultorId?: string | null;
  defaultCanal?: CanalInteracao;
}

export function RegistrarInteracaoDialog({ open, onOpenChange, clienteId, consultorId, defaultCanal = 'whatsapp' }: Props) {
  const create = useCreateInteracaoCliente();
  const [canal, setCanal] = useState<CanalInteracao>(defaultCanal);
  const [dataInteracao, setDataInteracao] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [resumo, setResumo] = useState('');
  const [conteudo, setConteudo] = useState('');

  useEffect(() => {
    if (open) {
      setCanal(defaultCanal);
      setDataInteracao(format(new Date(), 'yyyy-MM-dd'));
      setResumo('');
      setConteudo('');
    }
  }, [open, defaultCanal]);

  const handleSubmit = async () => {
    const resumoTrim = resumo.trim();
    if (!resumoTrim) {
      toast.error('Descreva brevemente o contato no campo resumo.');
      return;
    }
    if (resumoTrim.length > 300) {
      toast.error('O resumo deve ter no máximo 300 caracteres.');
      return;
    }
    if (conteudo.length > 20000) {
      toast.error('O conteúdo detalhado excede o limite de 20.000 caracteres.');
      return;
    }
    try {
      await create.mutateAsync({
        cliente_id: clienteId,
        consultor_id: consultorId ?? null,
        canal,
        data_interacao: dataInteracao,
        resumo: resumoTrim,
        conteudo: conteudo.trim() || null,
      });
      toast.success('Interação registrada.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao registrar interação: ' + (e?.message ?? 'desconhecido'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar interação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as CanalInteracao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CANAL_LABEL) as CanalInteracao[]).map((k) => (
                    <SelectItem key={k} value={k}>{CANAL_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={dataInteracao} onChange={(e) => setDataInteracao(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Resumo *</Label>
            <Input
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Ex.: Alinhamento sobre entrega da imersão 2"
              maxLength={300}
            />
          </div>
          <div className="space-y-2">
            <Label>Conteúdo / mensagens (opcional)</Label>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Cole aqui as mensagens do WhatsApp, notas da ligação, texto do e-mail…"
              rows={8}
              maxLength={20000}
            />
            <p className="text-[11px] text-muted-foreground">{conteudo.length}/20.000 caracteres</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}