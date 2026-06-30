import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const { tipo, cliente_id, projeto_id, gdrive_url } = await req.json();
    if (!tipo || (!cliente_id && !projeto_id) || !gdrive_url) {
      return json({ error: "tipo, gdrive_url e (cliente_id ou projeto_id) são obrigatórios" }, 400);
    }
    if (!["diagnostico", "okrs", "briefing_cliente_oculto"].includes(tipo)) {
      return json({ error: "Tipo inválido" }, 400);
    }

    // Extrai conteúdo via parse-documento (usa o token do consultor)
    const parseRes = await supabase.functions.invoke("parse-documento", {
      body: { gdrive_url },
    });
    if (parseRes.error || !parseRes.data?.texto) {
      const msg = (parseRes.data as any)?.error
        || parseRes.error?.message
        || "Não foi possível ler o documento do Google Drive.";
      return json({ error: msg }, 422);
    }
    const conteudo = parseRes.data.texto as string;

    const insertPayload: Record<string, unknown> = {
      tipo,
      conteudo,
      created_by: userId,
      gdoc_url: gdrive_url,
    };
    if (projeto_id) insertPayload.projeto_id = projeto_id;
    else insertPayload.cliente_id = cliente_id;

    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: doc, error: insertErr } = await service
      .from("projeto_documentos")
      .insert(insertPayload)
      .select()
      .single();
    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ documento: doc, gdoc_url: gdrive_url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});