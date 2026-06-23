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

    const body = await req.json();
    const {
      calendarId = "primary",
      summary, description, location,
      start, end,
      attendees = [],
      addMeet = false,
      sendUpdates = "all",
    } = body;

    if (!summary || !start || !end) {
      return jsonResponse({ error: "summary, start, end obrigatórios" }, 400);
    }

    const eventBody: any = {
      summary, description, location,
      start, end,
      attendees: (attendees as string[]).filter(Boolean).map((email) => ({ email })),
    };

    if (addMeet) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `cupola-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const params = new URLSearchParams({
      sendUpdates,
      ...(addMeet ? { conferenceDataVersion: "1" } : {}),
    });

    const created = await gcalFetch(
      tk.access_token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { method: "POST", body: JSON.stringify(eventBody) },
    );

    return jsonResponse({ event: created });
  } catch (e: any) {
    console.error(e);
    return jsonResponse({ error: e.message }, 500);
  }
});