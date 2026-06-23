import { authenticate, corsHeaders, getValidGoogleToken, gcalFetch, hasCalendarScope, jsonResponse } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { admin, consultorId } = auth;

    const tk = await getValidGoogleToken(admin, consultorId);
    if (!hasCalendarScope(tk.escopo)) {
      return jsonResponse({ error: "missing_scope" }, 403);
    }

    const { calendarId = "primary", eventId, response } = await req.json();
    // response: "accepted" | "declined" | "tentative" | "needsAction"
    if (!eventId || !response) return jsonResponse({ error: "eventId e response obrigatórios" }, 400);

    const myEmail = tk.email_google;
    // Fetch event, mutate attendees, PATCH
    const ev = await gcalFetch(tk.access_token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
    const attendees = (ev.attendees || []).map((a: any) =>
      a.email?.toLowerCase() === myEmail.toLowerCase() ? { ...a, responseStatus: response } : a
    );
    if (!attendees.some((a: any) => a.email?.toLowerCase() === myEmail.toLowerCase())) {
      attendees.push({ email: myEmail, responseStatus: response, self: true });
    }

    const updated = await gcalFetch(
      tk.access_token,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "PATCH", body: JSON.stringify({ attendees }) },
    );

    return jsonResponse({ event: updated });
  } catch (e: any) {
    console.error(e);
    return jsonResponse({ error: e.message }, 500);
  }
});