import { authenticate, corsHeaders, getValidGoogleToken, hasCalendarScope, jsonResponse } from "../_shared/google.ts";

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

    const { calendarId = "primary", eventId, sendUpdates = "all" } = await req.json();
    if (!eventId) return jsonResponse({ error: "eventId obrigatório" }, 400);

    const params = new URLSearchParams({ sendUpdates });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?${params}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${tk.access_token}` } },
    );
    if (!res.ok && res.status !== 204 && res.status !== 410) {
      const t = await res.text();
      throw new Error(`Delete falhou (${res.status}): ${t}`);
    }
    return jsonResponse({ success: true });
  } catch (e: any) {
    console.error(e);
    return jsonResponse({ error: e.message }, 500);
  }
});