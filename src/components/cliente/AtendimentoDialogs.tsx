import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, addWeeks, addMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useRegistrarReuniao, useUpdateAtendimento, type Atendimento } from '@/hooks/useAtendimentos';
import { useGoogleConnection } from '@/hooks/useGoogleDrive';
import { useCreateGCalEvent } from '@/hooks/useGoogleCalendar';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useCliente } from '@/hooks/useClientes';
import { toast } from '@/hooks/use-toast';

type Periodicidade = 'semanal' | 'quinzenal' | 'mensal';

function calcularProxima(data: string, periodicidade: Periodicidade): Date {
  const d = parseISO(data);
  if (periodicidade === 'semanal') return addWeeks(d, 1);
  if (periodicidade === 'quinzenal') return addWeeks(d, 2);
  return addMonths(d, 1);
}

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atendimento: Atendimento;
  clienteId: string;
}

export function AtendimentoFormDialog({ open, onOpenChange, atendimento, clienteId }: BaseProps) {
  const update = useUpdateAtendimento();
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(atendimento?.periodicidade ?? 'quinzenal');
  const [proxima, setProxima] = useState<string>(atendimento?.proxima_reuniao ?? '');
  const [link, setLink] = useState<string>(atendimento?.link_controle ?? '');
  const [trimestre, setTrimestre] = useState<string>(atendimento?.trimestre_okrs ?? '');

  useEffect(() => {
    if (open) {
      setPeriodicidade(atendimento?.periodicidade ?? 'quinzenal');
      setProxima(atendimento?.proxima_reuniao ?? '');
      setLink(atendimento?.link_controle ?? '');
      setTrimestre(atendimento?.trimestre_okrs ?? '');
    }
  }, [open, atendimento]);

  async function handleSave() {
    try {
      await update.mutateAsync({
        id: atendimento.id,
        cliente_id: clienteId,
        periodicidade,
        proxima_reuniao: proxima || null,
        link_controle: link || null,
        trimestre_okrs: trimestre || null,
      });
      toast({ title: 'Atendimento atualizado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Atendimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Periodicidade</Label>
            <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Periodicidade)}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Próxima Reunião</Label>
            <Input type="date" value={proxima || ''} onChange={(e) => setProxima(e.target.value)} className="bg-background" />
          </div>
          <div>
            <Label>Link da planilha de controle</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} className="bg-background" placeholder="https://..." />
          </div>
          <div>
            <Label>Trimestre OKRs</Label>
            <Input value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className="bg-background" placeholder="Ex: Q3 2026" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrarReuniaoDialog({ open, onOpenChange, atendimento, clienteId }: BaseProps) {
  const registrar = useRegistrarReuniao();
  const createEvent = useCreateGCalEvent();
  const { data: consultorId } = useMyConsultorId();
  const { data: conn } = useGoogleConnection(consultorId ?? undefined);
  const { data: cliente } = useCliente(clienteId);

  const isConnected = !!conn?.ativo;

  const [dataReuniao, setDataReuniao] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(atendimento?.periodicidade ?? 'quinzenal');
  const [criarEvento, setCriarEvento] = useState(true);
  const [horaProxima, setHoraProxima] = useState('10:00');
  const [emailCliente, setEmailCliente] = useState('');

  useEffect(() => {
    if (open) {
      setDataReuniao(format(new Date(), 'yyyy-MM-dd'));
      setPeriodicidade(atendimento?.periodicidade ?? 'quinzenal');
      setCriarEvento(true);
      setHoraProxima('10:00');
      setEmailCliente('');
    }
  }, [open, atendimento]);

  const proximaDate = useMemo(() => calcularProxima(dataReuniao, periodicidade), [dataReuniao, periodicidade]);

  async function handleSubmit() {
    try {
      await registrar.mutateAsync({
        atendimentoId: atendimento.id,
        clienteId,
        dataReuniao,
        periodicidade,
      });

      if (isConnected && criarEvento) {
        try {
          const [h, m] = horaProxima.split(':').map(Number);
          const start = new Date(proximaDate);
          start.setHours(h || 10, m || 0, 0, 0);
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
          const attendees = emailCliente.trim() ? [emailCliente.trim()] : [];
          await createEvent.mutateAsync({
            summary: `Reunião de Acompanhamento — ${cliente?.nome ?? 'Cliente'}`,
            start: { dateTime: start.toISOString(), timeZone: tz },
            end: { dateTime: end.toISOString(), timeZone: tz },
            attendees,
            addMeet: true,
            sendUpdates: attendees.length ? 'all' : 'none',
          });
          toast({ title: 'Reunião registrada e convite criado no Google Agenda' });
        } catch (e: any) {
          toast({
            title: 'Reunião registrada',
            description: `Convite não pôde ser criado: ${e.message}`,
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Reunião registrada' });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao registrar', description: e.message, variant: 'destructive' });
    }
  }

  const pending = registrar.isPending || createEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Registrar Reunião</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data da reunião realizada</Label>
              <Input type="date" value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)} className="bg-background" />
            </div>
            <div>
              <Label>Periodicidade</Label>
              <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Periodicidade)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              Próxima reunião calculada:{' '}
              <span className="text-foreground font-medium">{format(proximaDate, 'dd/MM/yyyy')}</span>
            </div>
          </div>

          {isConnected ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={criarEvento} onCheckedChange={(v) => setCriarEvento(!!v)} className="mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Criar convite para próxima reunião no Google Agenda</p>
                  <p className="text-xs text-muted-foreground">
                    Será criado um evento de 1h com link do Google Meet em {format(proximaDate, 'dd/MM/yyyy')}.
                  </p>
                </div>
              </label>
              {criarEvento && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <Label className="text-xs">Horário</Label>
                    <Input type="time" value={horaProxima} onChange={(e) => setHoraProxima(e.target.value)} className="bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail do cliente (opcional)</Label>
                    <Input type="email" placeholder="contato@cliente.com" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} className="bg-background" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Conecte sua conta Google em Minhas Integrações para criar convites automaticamente.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}