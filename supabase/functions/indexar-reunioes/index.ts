import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMB_MODEL = "openai/text-embedding-3-small";
const EMB_DIMS = 1536;
const CHUNK_SIZE = 1200;
const OVERLAP = 150;
const EMB_BATCH = 16;
const CHAR_BUDGET = 250_000; // orçamento por invocação, evita timeout

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(inputs: string[], key: string): Promise<number[][]> {
  let ultimoErro = "";
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMB_MODEL, input: inputs, dimensions: EMB_DIMS }),
      });
      if (res.ok) {
        const j = await res.json();
        return (j.data as Array<{ index: number; embedding: number[] }>)
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
      }
      const txt = await res.text();
      ultimoErro = `Embeddings ${res.status}: ${txt.slice(0, 200)}`;
      if (res.status !== 429 && res.status < 500) throw new Error(ultimoErro);
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
      if (!/429|5\d\d|network|timed?\s*out|fetch/i.test(ultimoErro)) throw e;
    }
    await sleep(800 * Math.pow(2, tentativa));
  }
  throw new Error(ultimoErro || "Falha nos embeddings");
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
    const limit: number = Math.min(Number(body.limit ?? 5), 15);

    // IDs já indexados (paginado — o PostgREST limita a 1000 linhas por página)
    async function idsIndexados(): Promise<Set<string>> {
      const set = new Set<string>();
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await service
          .from("reunioes_chunks").select("reuniao_id").range(from, from + page - 1);
        if (error) throw new Error(error.message);
        for (const r of data || []) set.add((r as any).reuniao_id);
        if (!data || data.length < page) break;
      }
      return set;
    }

    if (action === "status") {
      if (!isAdminOrDirector) return json({ error: "forbidden" }, 403);
      const { count: total } = await service
        .from("reunioes").select("id", { count: "exact", head: true }).not("transcricao", "is", null);
      const indexadas = (await idsIndexados()).size;
      return json({
        total_com_transcricao: total ?? 0,
        indexadas,
        pendentes: Math.max((total ?? 0) - indexadas, 0),
      });
    }

    if (!isAdminOrDirector && !reuniaoId) return json({ error: "forbidden" }, 403);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    // Seleciona reuniões alvo
    let alvos: any[] = [];
    if (reuniaoId) {
      const { data: permitida } = await userClient.from("reunioes").select("id").eq("id", reuniaoId).maybeSingle();
      if (!permitida) return json({ error: "Reunião não encontrada" }, 404);
      const { data } = await service
        .from("reunioes")
        .select("id, cliente_id, consultor_id, data_reuniao, transcricao")
        .eq("id", reuniaoId)
        .maybeSingle();
      if (data?.transcricao) alvos = [data];
    } else {
      const indexSet = await idsIndexados();
      const { data } = await service
        .from("reunioes")
        .select("id, cliente_id, consultor_id, data_reuniao, transcricao")
        .not("transcricao", "is", null)
        .order("data_reuniao", { ascending: false })
        .limit(1000);
      const pendentes = (data || []).filter((r: any) => !indexSet.has(r.id) && (r.transcricao || "").length > 100);
      let orcamento = CHAR_BUDGET;
      for (const r of pendentes) {
        if (alvos.length >= limit) break;
        if (alvos.length > 0 && orcamento <= 0) break;
        alvos.push(r);
        orcamento -= (r.transcricao || "").length;
      }
    }

    let processadas = 0;
    let trechos = 0;
    const erros: string[] = [];

    for (const r of alvos) {
      try {
        const transcricao: string = r.transcricao || "";
        const hash = await hashText(transcricao);

        const { data: existentes } = await service
          .from("reunioes_chunks")
          .select("chunk_index, hash_transcricao")
          .eq("reuniao_id", r.id)
          .order("chunk_index", { ascending: false })
          .limit(1);
        const atual = existentes?.[0];
        const pedacos = chunkText(transcricao);

        let inicio = 0;
        if (atual) {
          if (atual.hash_transcricao === hash) {
            // retoma de onde parou (indexação parcial por timeout)
            inicio = (atual.chunk_index ?? -1) + 1;
            if (inicio >= pedacos.length) { processadas++; continue; }
          } else {
            await service.from("reunioes_chunks").delete().eq("reuniao_id", r.id);
          }
        }

        for (let i = inicio; i < pedacos.length; i += EMB_BATCH) {
          const lote = pedacos.slice(i, i + EMB_BATCH);
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
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[indexar-reunioes] erro reuniao", r.id, msg);
        erros.push(`${r.id}: ${msg}`);
      }
    }

    return json({ processadas, trechos, erros, alvos: alvos.length });
  } catch (e) {
    console.error("[indexar-reunioes]", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
