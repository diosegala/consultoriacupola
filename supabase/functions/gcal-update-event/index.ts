import { authenticate, corsHeaders, getValidGoogleToken, gcalFetch, hasCalendarScope, jsonResponse } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { admin, consultorId } = auth;

    const tk = await getValidGoogleToken(admin, consultorId);
    if (!hasCalendarScope(tk.escopo)) {
      return jsonResponse({ error: "missing_scope", message: "Reconecte sua conta Google." }, 403);
    }

    const { calendarId = "primary", eventId, patch, sendUpdates = "all" } = await req.json();
    if (!eventId || !patch) return jsonResponse({ error: "eventId e patch obrigatórios" }, 400);

    const params = new URLSearchParams({ sendUpdates });
    const updated = await gcalFetch(
      tk.access_token,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?${params}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );

    return jsonResponse({ event: updated });
  } catch (e: any) {
    console.error(e);
    return jsonResponse({ error: e.message }, 500);
  }
});