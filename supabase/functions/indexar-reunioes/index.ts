import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMB_MODEL = "openai/text-embedding-3-small";
const EMB_DIMS = 1536;
const CHUNK_SIZE = 1200;
const OVERLAP = 150;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\u0000/g, "").replace(/\r/g, "");
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    const piece = clean.slice(i, end).trim();
    if (piece.length > 40) chunks.push(piece);
    if (end >= clean.length) break;
    i = end - OVERLAP;
  }
  return chunks;
}

async function hashText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function embedBatch(inputs: string[], key: string): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMB_MODEL, input: inputs, dimensions: EMB_DIMS }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Embeddings ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.data as Array<{ index: number; embedding: number[] }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", user.id);
    const isAdminOrDirector = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "index";
    const reuniaoId: string | undefined = body.reuniao_id;
    const limit: number = Math.min(Number(body.limit ?? 10), 25);

    if (action === "status") {
      if (!isAdminOrDirector) return json({ error: "forbidden" }, 403);
      const { count: total } = await service
        .from("reunioes").select("id", { count: "exact", head: true }).not("transcricao", "is", null);
      // contagem de reuniões distintas já indexadas
      const { data: rows } = await service.from("reunioes_chunks").select("reuniao_id");
      const distintas = new Set((rows || []).map((r: any) => r.reuniao_id)).size;
      return json({ total_com_transcricao: total ?? 0, indexadas: distintas, pendentes: Math.max((total ?? 0) - distintas, 0) });
    }

    if (!isAdminOrDirector && !reuniaoId) return json({ error: "forbidden" }, 403);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    // Seleciona reuniões alvo
    let alvos: any[] = [];
    if (reuniaoId) {
      // valida acesso do usuário à reunião via RLS
      const { data: permitida } = await userClient.from("reunioes").select("id").eq("id", reuniaoId).maybeSingle();
      if (!permitida) return json({ error: "Reunião não encontrada" }, 404);
      const { data } = await service
        .from("reunioes")
        .select("id, cliente_id, consultor_id, data_reuniao, transcricao")
        .eq("id", reuniaoId)
        .maybeSingle();
      if (data?.transcricao) alvos = [data];
    } else {
      const { data: jaIndexadas } = await service.from("reunioes_chunks").select("reuniao_id");
      const indexSet = new Set((jaIndexadas || []).map((r: any) => r.reuniao_id));
      const { data } = await service
        .from("reunioes")
        .select("id, cliente_id, consultor_id, data_reuniao, transcricao")
        .not("transcricao", "is", null)
        .order("data_reuniao", { ascending: false })
        .limit(500);
      alvos = (data || []).filter((r: any) => !indexSet.has(r.id) && (r.transcricao || "").length > 100).slice(0, limit);
    }

    let processadas = 0;
    let trechos = 0;
    const erros: string[] = [];

    for (const r of alvos) {
      try {
        const transcricao: string = r.transcricao || "";
        const hash = await hashText(transcricao);
        const { data: existente } = await service
          .from("reunioes_chunks").select("hash_transcricao").eq("reuniao_id", r.id).limit(1).maybeSingle();
        if (existente?.hash_transcricao === hash) continue;

        await service.from("reunioes_chunks").delete().eq("reuniao_id", r.id);
        const pedacos = chunkText(transcricao);
        for (let i = 0; i < pedacos.length; i += 50) {
          const lote = pedacos.slice(i, i + 50);
          const vetores = await embedBatch(lote, LOVABLE_API_KEY);
          const rows = lote.map((conteudo, idx) => ({
            reuniao_id: r.id,
            cliente_id: r.cliente_id,
            consultor_id: r.consultor_id,
            data_reuniao: r.data_reuniao,
            chunk_index: i + idx,
            conteudo,
            embedding: vetores[idx] as any,
            hash_transcricao: hash,
          }));
          const { error: insErr } = await service.from("reunioes_chunks").insert(rows);
          if (insErr) throw new Error(insErr.message);
          trechos += rows.length;
        }
        processadas++;
      } catch (e) {
        console.error("[indexar-reunioes] erro reuniao", r.id, e);
        erros.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return json({ processadas, trechos, erros, restantes_no_lote: alvos.length - processadas });
  } catch (e) {
    console.error("[indexar-reunioes]", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});