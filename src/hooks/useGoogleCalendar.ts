import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GCalCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
  accessRole: string;
}

export interface GCalEvent {
  id: string;
  calendarId: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink: string;
  hangoutLink: string | null;
  conferenceData: any;
  attendees: Array<{ email: string; responseStatus?: string; self?: boolean; organizer?: boolean; displayName?: string }>;
  organizer: { email?: string; self?: boolean } | null;
  creator: { email?: string; self?: boolean } | null;
  status: string;
  recurringEventId: string | null;
}

export interface GCalListResponse {
  email: string;
  calendars: GCalCalendar[];
  events: GCalEvent[];
  missingScope?: boolean;
}

export function useGCalEvents(timeMin: string, timeMax: string, calendarIds?: string[]) {
  return useQuery({
    queryKey: ['gcal-events', timeMin, timeMax, calendarIds],
    queryFn: async (): Promise<GCalListResponse> => {
      const { data, error } = await supabase.functions.invoke('gcal-list-events', {
        body: { timeMin, timeMax, calendarIds },
      });
      if (error) {
        // try to parse missing scope from response context
        const msg = (error as any)?.context?.error || error.message;
        if (typeof msg === 'string' && msg.includes('missing_scope')) {
          return { email: '', calendars: [], events: [], missingScope: true };
        }
        throw error;
      }
      if (data?.error === 'missing_scope') return { email: '', calendars: [], events: [], missingScope: true };
      if (data?.error) throw new Error(data.error);
      return data as GCalListResponse;
    },
    refetchInterval: 60_000,
  });
}

export function useCreateGCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await supabase.functions.invoke('gcal-create-event', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gcal-events'] }),
  });
}

export function useUpdateGCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await supabase.functions.invoke('gcal-update-event', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gcal-events'] }),
  });
}

export function useDeleteGCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { calendarId?: string; eventId: string }) => {
      const { data, error } = await supabase.functions.invoke('gcal-delete-event', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gcal-events'] }),
  });
}

export function useRespondGCalInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { calendarId?: string; eventId: string; response: 'accepted' | 'declined' | 'tentative' }) => {
      const { data, error } = await supabase.functions.invoke('gcal-respond-invite', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gcal-events'] }),
  });
}