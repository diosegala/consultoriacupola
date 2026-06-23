import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const userId = claims.claims.sub as string;

  const { data: cu } = await admin
    .from("consultor_user").select("consultor_id").eq("user_id", userId).maybeSingle();
  if (!cu?.consultor_id) {
    return { error: jsonResponse({ error: "Usuário não vinculado a consultor" }, 400) };
  }

  return { admin, userId, consultorId: cu.consultor_id as string };
}

export async function getValidGoogleToken(admin: any, consultorId: string) {
  const { data: row } = await admin
    .from("consultor_google_tokens").select("*")
    .eq("consultor_id", consultorId).maybeSingle();
  if (!row) throw new Error("Consultor não conectado ao Google");

  const expired = new Date(row.expires_at).getTime() < Date.now();
  if (!expired) return row;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Refresh falhou: ${JSON.stringify(data)}`);
  const newExpires = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await admin.from("consultor_google_tokens")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("consultor_id", consultorId);
  return { ...row, access_token: data.access_token, expires_at: newExpires };
}

export function hasCalendarScope(escopo: string | null | undefined) {
  if (!escopo) return false;
  return escopo.includes("calendar.events") || escopo.includes("calendar.readonly") || escopo.includes("auth/calendar");
}

export async function gcalFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const url = path.startsWith("http")
    ? path
    : `https://www.googleapis.com/calendar/v3${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.error?.message || `Google Calendar API error (${res.status})`;
    throw new Error(msg);
  }
  return body;
}