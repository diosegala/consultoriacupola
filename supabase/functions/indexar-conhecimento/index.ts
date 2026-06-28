import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function gerarEmbedding(texto: string, model: string, dimensions: number): Promise<number[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const body: Record<string, unknown> = { model, input: texto.slice(0, 8000) };
  if (model.startsWith("openai/")) body.dimensions = dimensions;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lovable embeddings ${res.status}: ${t}`);
  }
  const json = await res.json();
  return json.data[0].embedding as number[];
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await service
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const titulo = (body.titulo || "").toString().trim();
    const conteudo = (body.conteudo || "").toString().trim();
    const categoria = body.categoria ? body.categoria.toString().trim() : null;
    if (!titulo || !conteudo) {
      return new Response(JSON.stringify({ error: "titulo e conteudo são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await service
      .from("oraculo_settings").select("embedding_model, embedding_dimensions").eq("id", true).maybeSingle();
    const embModel = settings?.embedding_model || "openai/text-embedding-3-small";
    const embDims = settings?.embedding_dimensions || 1536;
    const embedding = await gerarEmbedding(`${titulo}\n\n${conteudo}`, embModel, embDims);
    const { data, error } = await service
      .from("oraculo_knowledge")
      .insert({ titulo, conteudo, categoria, embedding: embedding as any })
      .select("id, titulo, categoria, created_at")
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, documento: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("indexar-conhecimento error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});