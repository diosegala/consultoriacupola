import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshAccess(admin: any, row: any) {
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
  await admin
    .from("consultor_google_tokens")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("consultor_id", row.consultor_id);
  return { ...row, access_token: data.access_token, expires_at: newExpires };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;
    const { data: cu } = await admin
      .from("consultor_user").select("consultor_id").eq("user_id", userId).maybeSingle();
    if (!cu?.consultor_id) {
      return new Response(JSON.stringify({ error: "Usuário não está vinculado a um consultor" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row } = await admin
      .from("consultor_google_tokens").select("*").eq("consultor_id", cu.consultor_id).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({ error: "Conta Google não conectada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tk = await refreshAccess(admin, row);

    const folderFields = "files(id,name,webViewLink,owners(emailAddress))";
    async function findFolder(query: string) {
      const r = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) +
        "&fields=" + encodeURIComponent(folderFields),
        { headers: { Authorization: `Bearer ${tk.access_token}` } },
      );
      const d = await r.json();
      return (d.files || [])[0] || null;
    }
    let folder = await findFolder(
      "name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'me' in owners",
    );
    let owned = !!folder;
    if (!folder) {
      folder = await findFolder(
        "name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      );
    }
    if (!folder) {
      return new Response(JSON.stringify({ error: "Nenhuma pasta 'Meet Recordings' encontrada nesta conta." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await admin
      .from("consultor_google_tokens")
      .update({
        pasta_meet_id: folder.id,
        pasta_meet_nome: folder.name,
        pasta_meet_link: folder.webViewLink || null,
        pasta_meet_owner_email: folder.owners?.[0]?.emailAddress || null,
      })
      .eq("consultor_id", cu.consultor_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({
      success: true,
      pasta: {
        id: folder.id,
        nome: folder.name,
        link: folder.webViewLink || null,
        owner_email: folder.owners?.[0]?.emailAddress || null,
        owned,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});