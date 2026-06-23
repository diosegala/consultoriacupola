import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, X } from 'lucide-react';
import { useCreateGCalEvent, useUpdateGCalEvent, GCalEvent } from '@/hooks/useGoogleCalendar';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<{
    summary: string;
    description: string;
    location: string;
    start: Date;
    end: Date;
    attendees: string[];
    addMeet: boolean;
  }>;
  event?: GCalEvent | null;
}

function toLocalInput(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function EventoFormDialog({ open, onOpenChange, initial, event }: Props) {
  const create = useCreateGCalEvent();
  const update = useUpdateGCalEvent();

  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');
  const [attendeesInput, setAttendeesInput] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [addMeet, setAddMeet] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setSummary(event.summary || '');
      setDescription(event.description || '');
      setLocation(event.location || '');
      const s = event.start.dateTime || event.start.date || '';
      const e = event.end.dateTime || event.end.date || '';
      setStartStr(s ? toLocalInput(new Date(s)) : '');
      setEndStr(e ? toLocalInput(new Date(e)) : '');
      setAttendees((event.attendees || []).map((a) => a.email).filter(Boolean));
      setAddMeet(!!event.hangoutLink);
    } else {
      const now = initial?.start || new Date(Math.ceil(Date.now() / 1800000) * 1800000);
      const end = initial?.end || new Date(now.getTime() + 60 * 60 * 1000);
      setSummary(initial?.summary || '');
      setDescription(initial?.description || '');
      setLocation(initial?.location || '');
      setStartStr(toLocalInput(now));
      setEndStr(toLocalInput(end));
      setAttendees(initial?.attendees || []);
      setAddMeet(initial?.addMeet ?? true);
    }
    setAttendeesInput('');
  }, [open, event, initial]);

  function addAttendee() {
    const e = attendeesInput.trim();
    if (!e) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      toast.error('E-mail inválido');
      return;
    }
    if (!attendees.includes(e)) setAttendees([...attendees, e]);
    setAttendeesInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary || !startStr || !endStr) {
      toast.error('Preencha título, início e fim');
      return;
    }
    const startISO = new Date(startStr).toISOString();
    const endISO = new Date(endStr).toISOString();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      if (event) {
        await update.mutateAsync({
          calendarId: event.calendarId,
          eventId: event.id,
          patch: {
            summary, description, location,
            start: { dateTime: startISO, timeZone: tz },
            end: { dateTime: endISO, timeZone: tz },
            attendees: attendees.map((email) => ({ email })),
          },
        });
        toast.success('Evento atualizado');
      } else {
        await create.mutateAsync({
          calendarId: 'primary',
          summary, description, location,
          start: { dateTime: startISO, timeZone: tz },
          end: { dateTime: endISO, timeZone: tz },
          attendees,
          addMeet,
        });
        toast.success('Evento criado');
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Novo evento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Início *</Label>
              <Input type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Fim *</Label>
              <Input type="datetime-local" value={endStr} onChange={(e) => setEndStr(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Local</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Convidados</Label>
            <div className="flex gap-2">
              <Input
                value={attendeesInput}
                onChange={(e) => setAttendeesInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
                placeholder="email@dominio.com"
              />
              <Button type="button" variant="outline" onClick={addAttendee}>Adicionar</Button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {attendees.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded">
                    {a}
                    <button type="button" onClick={() => setAttendees(attendees.filter((x) => x !== a))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {!event && (
            <div className="flex items-center justify-between">
              <Label htmlFor="meet">Criar link do Google Meet</Label>
              <Switch id="meet" checked={addMeet} onCheckedChange={setAddMeet} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {event ? 'Salvar' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}