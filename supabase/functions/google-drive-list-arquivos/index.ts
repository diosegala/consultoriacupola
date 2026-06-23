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

    const tk = await getValidToken(admin, cu.consultor_id);
    if (!tk.pasta_meet_id) {
      return new Response(JSON.stringify({ error: "Pasta 'Meet Recordings' não localizada na sua conta Google" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List files in folder, excluding already-imported
    const q = `'${tk.pasta_meet_id}' in parents and trashed=false`;
    const filesRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?" +
      "q=" + encodeURIComponent(q) +
      "&fields=files(id,name,mimeType,createdTime,modifiedTime)" +
      "&orderBy=createdTime desc&pageSize=100",
      { headers: { Authorization: `Bearer ${tk.access_token}` } }
    );
    const filesData = await filesRes.json();
    if (!filesRes.ok) throw new Error(`Drive list falhou: ${JSON.stringify(filesData)}`);

    // Filter to Google Docs (transcripts) - skip video files
    const docs = (filesData.files || []).filter((f: any) =>
      f.mimeType === "application/vnd.google-apps.document"
    );

    // Mark already-imported
    const ids = docs.map((d: any) => d.id);
    const { data: imported } = await admin
      .from("reunioes_importadas_log")
      .select("google_file_id, cliente_id, reuniao_id, status")
      .in("google_file_id", ids.length ? ids : ["__none__"]);
    // Only count as "already imported" entries that actually produced a reunião.
    const importedMap = new Map(
      (imported || [])
        .filter((i: any) => i.status === "importado")
        .map((i: any) => [i.google_file_id, i])
    );

    // Match clients
    const { data: clientes } = await admin.from("clientes").select("id, nome");
    const { data: aliases } = await admin.from("cliente_aliases").select("cliente_id, alias");

    const matchCliente = (nome: string) => {
      const lower = nome.toLowerCase();
      // Try bracket extraction first
      const bracket = nome.match(/\[([^\]]+)\]/);
      const candidates: { cliente_id: string; key: string }[] = [];
      (clientes || []).forEach((c: any) => candidates.push({ cliente_id: c.id, key: c.nome.toLowerCase() }));
      (aliases || []).forEach((a: any) => candidates.push({ cliente_id: a.cliente_id, key: a.alias.toLowerCase() }));

      if (bracket) {
        const b = bracket[1].toLowerCase().trim();
        const exact = candidates.filter(c => c.key === b);
        if (exact.length === 1) return exact[0].cliente_id;
      }
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = new Set(
        candidates
          .filter(c => {
            const k = c.key.trim();
            if (!k) return false;
            return new RegExp(`(^|[^a-z0-9])${escape(k)}([^a-z0-9]|$)`, "i").test(lower);
          })
          .map(c => c.cliente_id)
      );
      return matches.size === 1 ? Array.from(matches)[0] : null;
    };

    const result = docs.map((d: any) => ({
      ...d,
      ja_importado: importedMap.has(d.id),
      reuniao_id: importedMap.get(d.id)?.reuniao_id || null,
      cliente_sugerido: matchCliente(d.name),
    }));

    return new Response(JSON.stringify({ arquivos: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});