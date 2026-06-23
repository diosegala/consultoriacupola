import { authenticate, corsHeaders, getValidGoogleToken, gcalFetch, hasCalendarScope, jsonResponse } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { admin, consultorId } = auth;

    const tk = await getValidGoogleToken(admin, consultorId);
    if (!hasCalendarScope(tk.escopo)) {
      return jsonResponse({ error: "missing_scope", message: "Reconecte sua conta Google para habilitar o acesso ao Google Agenda." }, 403);
    }

    const { timeMin, timeMax, calendarIds } = await req.json();
    if (!timeMin || !timeMax) return jsonResponse({ error: "timeMin e timeMax obrigatórios" }, 400);

    // List calendars from CalendarList
    const calList = await gcalFetch(tk.access_token, "/users/me/calendarList?minAccessRole=reader");
    const allCalendars = (calList.items || []).map((c: any) => ({
      id: c.id,
      summary: c.summaryOverride || c.summary,
      primary: !!c.primary,
      backgroundColor: c.backgroundColor,
      foregroundColor: c.foregroundColor,
      selected: c.selected !== false,
      accessRole: c.accessRole,
    }));

    const wanted: string[] = Array.isArray(calendarIds) && calendarIds.length
      ? calendarIds
      : allCalendars.filter((c: any) => c.primary || c.selected).map((c: any) => c.id);

    const events: any[] = [];
    for (const calId of wanted) {
      const params = new URLSearchParams({
        timeMin, timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });
      try {
        const data = await gcalFetch(tk.access_token, `/calendars/${encodeURIComponent(calId)}/events?${params}`);
        for (const ev of (data.items || [])) {
          events.push({
            id: ev.id,
            calendarId: calId,
            summary: ev.summary || "(sem título)",
            description: ev.description || null,
            location: ev.location || null,
            start: ev.start,
            end: ev.end,
            htmlLink: ev.htmlLink,
            hangoutLink: ev.hangoutLink || null,
            conferenceData: ev.conferenceData || null,
            attendees: ev.attendees || [],
            organizer: ev.organizer || null,
            creator: ev.creator || null,
            status: ev.status,
            recurringEventId: ev.recurringEventId || null,
          });
        }
      } catch (e) {
        console.error("cal fetch failed", calId, e);
      }
    }

    return jsonResponse({ email: tk.email_google, calendars: allCalendars, events });
  } catch (e: any) {
    console.error(e);
    return jsonResponse({ error: e.message }, 500);
  }
});