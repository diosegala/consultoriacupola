import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function gerarEmbedding(texto: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texto.slice(0, 8000) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${t}`);
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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const body = await req.json().catch(() => ({}));
    const forceAll: boolean = !!body?.force;

    const { data: docs, error: docsErr } = await service
      .from("notion_documents")
      .select("notion_page_id, title, content, last_edited_time");
    if (docsErr) throw docsErr;

    let indexed = 0;
    let skipped = 0;
    let chunksTotal = 0;
    let errors = 0;

    for (const d of docs || []) {
      try {
        if (!d.content || !d.content.trim()) { skipped++; continue; }

        // Skip if already indexed and unchanged
        if (!forceAll) {
          const { data: existing } = await service
            .from("oraculo_knowledge")
            .select("id, last_edited_time")
            .eq("notion_page_id", d.notion_page_id)
            .limit(1)
            .maybeSingle();
          if (existing && existing.last_edited_time && d.last_edited_time
              && new Date(existing.last_edited_time).getTime() === new Date(d.last_edited_time).getTime()) {
            skipped++;
            continue;
          }
        }

        // Remove previous chunks for this page
        await service.from("oraculo_knowledge").delete().eq("notion_page_id", d.notion_page_id);

        const chunks = chunkText(d.content);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await gerarEmbedding(`${d.title}\n\n${chunk}`, openaiKey);
          const { error: insErr } = await service.from("oraculo_knowledge").insert({
            titulo: d.title || "(Sem título)",
            conteudo: chunk,
            categoria: "metodo_cupola",
            source: "notion",
            notion_page_id: d.notion_page_id,
            chunk_index: i,
            last_edited_time: d.last_edited_time,
            embedding: embedding as any,
          });
          if (insErr) throw insErr;
          chunksTotal++;
        }
        indexed++;
      } catch (e) {
        console.error("Erro indexando", d.notion_page_id, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, indexed, skipped, errors, chunks: chunksTotal, total: docs?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oraculo-indexar-notion error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});