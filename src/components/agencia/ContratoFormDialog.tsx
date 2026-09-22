import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/design-system/design-system-hub-ba3841';
import { useSalvarContrato } from '@/hooks/agencia/useAgenciaEdicao';
import type { AgenciaContrato } from '@/hooks/agencia/useAgencia';

const STATUS = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'renovacao', rotulo: 'Em renovação' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
];

interface Form {
  status: string;
  modalidade: string;
  inicio: string;
  renovacao: string;
  horas_mes: string;
  horas_usadas: string;
  valor_mensal: string;
  responsavel: string;
  escopo: string;
}

interface Props {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  clienteId: string;
  contrato?: AgenciaContrato | null;
}

export function ContratoFormDialog({ aberto, onOpenChange, clienteId, contrato }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Form>({
    status: 'ativo',
    modalidade: '',
    inicio: hoje,
    renovacao: hoje,
    horas_mes: '',
    horas_usadas: '',
    valor_mensal: '',
    responsavel: '',
    escopo: '',
  });
  const salvar = useSalvarContrato();

  useEffect(() => {
    if (!aberto) return;
    setForm({
      status: contrato?.status ?? 'ativo',
      modalidade: contrato?.modalidade ?? '',
      inicio: contrato?.inicio ?? hoje,
      renovacao: contrato?.renovacao ?? hoje,
      horas_mes: contrato?.horas_mes != null ? String(contrato.horas_mes) : '',
      horas_usadas: contrato?.horas_usadas != null ? String(contrato.horas_usadas) : '',
      valor_mensal: contrato?.valor_mensal != null ? String(contrato.valor_mensal) : '',
      responsavel: contrato?.responsavel ?? '',
      escopo: (contrato?.escopo ?? []).join(', '),
    });
  }, [aberto, contrato, hoje]);

  const set = (campo: keyof Form, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const enviar = () => {
    salvar.mutate(
      {
        clienteId,
        contrato,
        dados: {
          status: form.status,
          modalidade: form.modalidade,
          inicio: form.inicio || hoje,
          renovacao: form.renovacao || hoje,
          horas_mes: form.horas_mes ? Number(form.horas_mes) : null,
          horas_usadas: form.horas_usadas ? Number(form.horas_usadas) : null,
          valor_mensal: form.valor_mensal ? Number(form.valor_mensal) : null,
          responsavel: form.responsavel,
          escopo: form.escopo
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contrato ? 'Editar contrato' : 'Cadastrar contrato'}</DialogTitle>
          <DialogDescription>
            Situação, valores e responsável do contrato desta conta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-modalidade">Modalidade</Label>
              <Input
                id="ct-modalidade"
                value={form.modalidade}
                onChange={(e) => set('modalidade', e.target.value)}
                placeholder="Ex.: Retainer mensal"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ct-inicio">Início</Label>
              <Input
                id="ct-inicio"
                type="date"
                value={form.inicio}
                onChange={(e) => set('inicio', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-renovacao">Renovação</Label>
              <Input
                id="ct-renovacao"
                type="date"
                value={form.renovacao}
                onChange={(e) => set('renovacao', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="ct-horas">Horas no mês</Label>
              <Input
                id="ct-horas"
                type="number"
                min="0"
                value={form.horas_mes}
                onChange={(e) => set('horas_mes', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-usadas">Horas usadas</Label>
              <Input
                id="ct-usadas"
                type="number"
                min="0"
                value={form.horas_usadas}
                onChange={(e) => set('horas_usadas', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-valor">Valor mensal (R$)</Label>
              <Input
                id="ct-valor"
                type="number"
                min="0"
                step="0.01"
                value={form.valor_mensal}
                onChange={(e) => set('valor_mensal', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ct-responsavel">Responsável</Label>
            <Input
              id="ct-responsavel"
              value={form.responsavel}
              onChange={(e) => set('responsavel', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ct-escopo">Escopo (separe por vírgula)</Label>
            <Input
              id="ct-escopo"
              value={form.escopo}
              onChange={(e) => set('escopo', e.target.value)}
              placeholder="Ex.: Redes sociais, Blog, Sites"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={salvar.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
