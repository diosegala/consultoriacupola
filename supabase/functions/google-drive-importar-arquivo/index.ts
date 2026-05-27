import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getValidToken(admin: any, consultorId: string) {
  const { data: row } = await admin
    .from("consultor_google_tokens").select("*")
    .eq("consultor_id", consultorId).maybeSingle();
  if (!row) throw new Error("Consultor não conectado ao Google Drive");
  const expired = new Date(row.expires_at).getTime() < Date.now();
  if (!expired) return row;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: row.refresh_token, grant_type: "refresh_token",
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
      { global: { headers: { Authorization: authHeader } } }
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

    const { data: cu } = await admin
      .from("consultor_user").select("consultor_id").eq("user_id", claims.claims.sub).maybeSingle();
    if (!cu?.consultor_id) {
      return new Response(JSON.stringify({ error: "Usuário não vinculado a consultor" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_id, file_name, cliente_id, data_reuniao } = await req.json();
    if (!file_id || !cliente_id) {
      return new Response(JSON.stringify({ error: "file_id e cliente_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check not already imported
    const { data: existing } = await admin
      .from("reunioes_importadas_log").select("reuniao_id").eq("google_file_id", file_id).maybeSingle();
    if (existing?.reuniao_id) {
      return new Response(JSON.stringify({ error: "Arquivo já importado", reuniao_id: existing.reuniao_id }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tk = await getValidToken(admin, cu.consultor_id);

    // Export Google Doc as text/plain
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file_id}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${tk.access_token}` } }
    );
    if (!exportRes.ok) {
      const err = await exportRes.text();
      throw new Error(`Falha ao baixar transcrição: ${err}`);
    }
    const transcricao = await exportRes.text();

    // Create reuniao
    const dataReuniao = data_reuniao || new Date().toISOString().slice(0, 10);
    const { data: reuniao, error: rErr } = await admin
      .from("reunioes").insert({
        consultor_id: cu.consultor_id,
        cliente_id,
        data_reuniao: dataReuniao,
        transcricao,
        status_analise: "pendente",
      }).select().single();
    if (rErr) throw rErr;

    await admin.from("reunioes_importadas_log").insert({
      google_file_id: file_id,
      consultor_id: cu.consultor_id,
      cliente_id,
      reuniao_id: reuniao.id,
      nome_arquivo: file_name || null,
      status: "importado",
    });

    return new Response(JSON.stringify({ success: true, reuniao_id: reuniao.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});