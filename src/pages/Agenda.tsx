import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addDays, addWeeks, endOfDay, endOfWeek, format, isSameDay, startOfDay, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronLeft, ChevronRight, Loader2, Plus, ExternalLink, Check, X, HelpCircle, Video, Pencil, Trash2, AlertTriangle, Link2 } from 'lucide-react';
import { useMyConsultorId } from '@/hooks/useConsultorUser';
import { useGoogleConnection, useStartGoogleOAuth } from '@/hooks/useGoogleDrive';
import { GCalEvent, useDeleteGCalEvent, useGCalEvents, useRespondGCalInvite } from '@/hooks/useGoogleCalendar';
import { EventoFormDialog } from '@/components/agenda/EventoFormDialog';
import { toast } from 'sonner';

type View = 'week' | 'day' | 'list';

function eventStart(ev: GCalEvent) {
  return new Date(ev.start.dateTime || ev.start.date || '');
}
function eventEnd(ev: GCalEvent) {
  return new Date(ev.end.dateTime || ev.end.date || '');
}
function myResponse(ev: GCalEvent): string | null {
  const me = ev.attendees?.find((a) => a.self);
  return me?.responseStatus || null;
}

export default function Agenda() {
  const [params] = useSearchParams();
  const { data: consultorId } = useMyConsultorId();
  const { data: conn, isLoading: connLoading } = useGoogleConnection(consultorId ?? undefined);
  const startOAuth = useStartGoogleOAuth();

  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<GCalEvent | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<GCalEvent | null>(null);
  const [initialEvent, setInitialEvent] = useState<any>(null);

  // Open dialog with attendees from query param (e.g. ?attendee=cliente@x.com)
  useEffect(() => {
    const at = params.get('attendee');
    const title = params.get('title');
    if (at || title) {
      setInitialEvent({ attendees: at ? [at] : [], summary: title || '' });
      setEditEvent(null);
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { timeMin, timeMax, days } = useMemo(() => {
    if (view === 'day') {
      return { timeMin: startOfDay(anchor).toISOString(), timeMax: endOfDay(anchor).toISOString(), days: [anchor] };
    }
    if (view === 'list') {
      return { timeMin: startOfDay(anchor).toISOString(), timeMax: endOfDay(addDays(anchor, 30)).toISOString(), days: [] };
    }
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    const ds = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return { timeMin: start.toISOString(), timeMax: end.toISOString(), days: ds };
  }, [anchor, view]);

  const isConnected = !!conn?.ativo;
  const { data, isLoading, refetch, isFetching } = useGCalEvents(timeMin, timeMax);
  const events = data?.events || [];
  const missingScope = data?.missingScope;

  const respond = useRespondGCalInvite();
  const del = useDeleteGCalEvent();

  async function handleReconnect() {
    const redirectUri = `${window.location.origin}/google-callback`;
    try {
      const { url } = await startOAuth.mutateAsync(redirectUri);
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function shift(dir: 1 | -1) {
    if (view === 'day') setAnchor(addDays(anchor, dir));
    else if (view === 'week') setAnchor(dir === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1));
    else setAnchor(addDays(anchor, dir * 7));
  }

  function openNew(slotStart?: Date) {
    setEditEvent(null);
    setInitialEvent(slotStart ? { start: slotStart, end: new Date(slotStart.getTime() + 60 * 60 * 1000) } : null);
    setShowForm(true);
  }

  if (!consultorId) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
          <CardDescription>
            Seu usuário ainda não está vinculado a um consultor. Acesse{' '}
            <Link to="/configuracoes" className="text-primary underline">Configurações</Link> para vincular.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (connLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!isConnected || missingScope) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {isConnected ? 'Reconecte sua conta Google' : 'Conecte sua conta Google'}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? 'Sua conexão atual não inclui acesso ao Google Agenda. Reconecte para liberar a visualização e o envio de convites.'
              : 'Para usar a agenda dentro da plataforma, conecte sua conta Google Cupola.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleReconnect} disabled={startOAuth.isPending}>
            {startOAuth.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Link2 className="h-4 w-4 mr-2" />
            {isConnected ? 'Reconectar Google' : 'Conectar Google'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Conectado como <span className="text-foreground">{conn?.email_google}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="list">Lista</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => openNew()} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground ml-2">
            {view === 'day' && format(anchor, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}
            {view === 'week' && (() => {
              const s = startOfWeek(anchor, { weekStartsOn: 1 });
              const e = endOfWeek(anchor, { weekStartsOn: 1 });
              return `${format(s, 'd MMM', { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`;
            })()}
            {view === 'list' && `Próximos 30 dias a partir de ${format(anchor, 'd MMM yyyy', { locale: ptBR })}`}
          </span>
        </div>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : view === 'list' ? (
        <ListaEventos events={events} onEdit={(e) => { setEditEvent(e); setInitialEvent(null); setShowForm(true); }}
          onDelete={(e) => setDeleteEvent(e)} onRespond={(e, r) => respond.mutate({ calendarId: e.calendarId, eventId: e.id, response: r })} />
      ) : (
        <SemanaGrid days={days} events={events} onSlot={openNew}
          onClickEvent={(e) => { setEditEvent(e); setInitialEvent(null); setShowForm(true); }} />
      )}

      <EventoFormDialog open={showForm} onOpenChange={setShowForm} event={editEvent} initial={initialEvent} />

      <AlertDialog open={!!deleteEvent} onOpenChange={(o) => !o && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Os participantes serão notificados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                if (!deleteEvent) return;
                try {
                  await del.mutateAsync({ calendarId: deleteEvent.calendarId, eventId: deleteEvent.id });
                  toast.success('Evento excluído');
                } catch (e: any) { toast.error(e.message); }
                setDeleteEvent(null);
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SemanaGrid({ days, events, onSlot, onClickEvent }: {
  days: Date[]; events: GCalEvent[]; onSlot: (d: Date) => void; onClickEvent: (e: GCalEvent) => void;
}) {
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i); // 6h-22h
  const today = new Date();
  const HOUR_PX = 64;
  const START_HOUR = 6;
  const totalHeight = hours.length * HOUR_PX;

  return (
    <div className="border border-border rounded-lg overflow-auto bg-card">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(140px, 1fr))` }}>
        <div className="bg-muted/30 border-b border-r border-border" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`text-center py-2 border-b border-r border-border ${isSameDay(d, today) ? 'bg-primary/10' : 'bg-muted/30'}`}>
            <div className="text-xs text-muted-foreground uppercase">{format(d, 'EEE', { locale: ptBR })}</div>
            <div className={`text-lg font-semibold ${isSameDay(d, today) ? 'text-primary' : 'text-foreground'}`}>{format(d, 'd')}</div>
          </div>
        ))}

        {/* Hours gutter + day columns body */}
        <div className="relative border-r border-border" style={{ height: totalHeight }}>
          {hours.map((h) => (
            <div key={`hg-${h}`} className="text-[10px] text-muted-foreground text-right pr-1 pt-1 border-b border-border" style={{ height: HOUR_PX }}>
              {`${String(h).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayEvents = events
            .filter((ev) => isSameDay(eventStart(ev), d))
            .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime());
          const laidOut = layoutDayEvents(dayEvents);
          return (
            <div key={`col-${d.toISOString()}`} className="relative border-r border-border" style={{ height: totalHeight }}>
              {/* Background hour slots (click-to-create) */}
              {hours.map((h) => {
                const slotStart = new Date(d); slotStart.setHours(h, 0, 0, 0);
                return (
                  <div key={`slot-${h}`}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer"
                    style={{ height: HOUR_PX }}
                    onClick={() => onSlot(slotStart)} />
                );
              })}
              {/* Events overlay */}
              {laidOut.map(({ ev, col, cols }) => {
                const s = eventStart(ev), e = eventEnd(ev);
                const startMin = (s.getHours() - START_HOUR) * 60 + s.getMinutes();
                const endMin = Math.min(hours.length * 60, (e.getHours() - START_HOUR) * 60 + e.getMinutes());
                const top = (startMin / 60) * HOUR_PX;
                const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX - 2);
                const widthPct = 100 / cols;
                const leftPct = col * widthPct;
                const resp = myResponse(ev);
                const declined = resp === 'declined';
                const tentative = resp === 'tentative' || resp === 'needsAction';
                return (
                  <div key={ev.id}
                    onClick={(evt) => { evt.stopPropagation(); onClickEvent(ev); }}
                    style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, zIndex: 2 }}
                    className={`absolute rounded px-1 py-0.5 text-[11px] overflow-hidden cursor-pointer border ${
                      declined ? 'bg-muted/40 text-muted-foreground line-through border-border' :
                      tentative ? 'bg-yellow-600/20 text-yellow-200 border-yellow-600/40' :
                      'bg-primary/20 text-foreground border-primary/40 hover:bg-primary/30'
                    }`}>
                    <div className="font-medium truncate leading-tight">{ev.summary}</div>
                    <div className="opacity-70 leading-tight">{format(s, 'HH:mm')}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Greedy column layout for overlapping events within a single day. */
function layoutDayEvents(evs: GCalEvent[]): Array<{ ev: GCalEvent; col: number; cols: number }> {
  const result: Array<{ ev: GCalEvent; col: number; cols: number; start: number; end: number }> = [];
  let cluster: typeof result = [];
  let clusterEnd = 0;

  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => (c.cols = cols));
    cluster = [];
  };

  for (const ev of evs) {
    const start = eventStart(ev).getTime();
    const end = eventEnd(ev).getTime();
    if (cluster.length && start >= clusterEnd) flush();
    // find first free column in cluster
    const used = new Set(cluster.filter((c) => c.end > start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    const item = { ev, col, cols: 1, start, end };
    cluster.push(item);
    result.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result.map(({ ev, col, cols }) => ({ ev, col, cols }));
}

function ListaEventos({ events, onEdit, onDelete, onRespond }: {
  events: GCalEvent[];
  onEdit: (e: GCalEvent) => void;
  onDelete: (e: GCalEvent) => void;
  onRespond: (e: GCalEvent, r: 'accepted' | 'declined' | 'tentative') => void;
}) {
  if (!events.length) {
    return <Card className="bg-card border-border border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Nenhum evento no período</CardContent></Card>;
  }
  const grouped = events.reduce<Record<string, GCalEvent[]>>((acc, ev) => {
    const k = format(eventStart(ev), 'yyyy-MM-dd');
    (acc[k] ||= []).push(ev);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, evs]) => (
        <div key={day}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            {format(new Date(day + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <div className="space-y-2">
            {evs.map((ev) => (
              <EventoCard key={ev.id} event={ev} onEdit={onEdit} onDelete={onDelete} onRespond={onRespond} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventoCard({ event, onEdit, onDelete, onRespond }: {
  event: GCalEvent;
  onEdit: (e: GCalEvent) => void;
  onDelete: (e: GCalEvent) => void;
  onRespond: (e: GCalEvent, r: 'accepted' | 'declined' | 'tentative') => void;
}) {
  const s = eventStart(event);
  const e = eventEnd(event);
  const resp = myResponse(event);
  const isOrganizer = event.organizer?.self || event.creator?.self;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-foreground">{event.summary}</p>
              {resp === 'accepted' && <Badge className="bg-green-600/20 text-green-500 border-green-600/30"><Check className="h-3 w-3 mr-1" />Confirmado</Badge>}
              {resp === 'declined' && <Badge className="bg-red-600/20 text-red-500 border-red-600/30"><X className="h-3 w-3 mr-1" />Recusado</Badge>}
              {resp === 'tentative' && <Badge className="bg-yellow-600/20 text-yellow-500 border-yellow-600/30"><HelpCircle className="h-3 w-3 mr-1" />Talvez</Badge>}
              {resp === 'needsAction' && <Badge variant="outline" className="text-muted-foreground">Sem resposta</Badge>}
              {isOrganizer && <Badge variant="outline" className="text-xs">Organizador</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {format(s, 'HH:mm')} – {format(e, 'HH:mm')}
              {event.location && ` • ${event.location}`}
            </p>
            {event.attendees && event.attendees.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {event.attendees.length} convidado(s)
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {event.hangoutLink && (
                <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Video className="h-3 w-3" /> Entrar no Meet
                </a>
              )}
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Abrir no Google
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {!isOrganizer && event.attendees?.some((a) => a.self) && (
              <div className="flex gap-1">
                <Button size="sm" variant={resp === 'accepted' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => onRespond(event, 'accepted')}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant={resp === 'tentative' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => onRespond(event, 'tentative')}><HelpCircle className="h-3 w-3" /></Button>
                <Button size="sm" variant={resp === 'declined' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => onRespond(event, 'declined')}><X className="h-3 w-3" /></Button>
              </div>
            )}
            {isOrganizer && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onEdit(event)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => onDelete(event)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}