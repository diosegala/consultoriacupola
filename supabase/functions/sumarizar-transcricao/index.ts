import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";

const BLOCK_SIZE = 80_000;
const BLOCK_OVERLAP = 2_000;
const SPLIT_THRESHOLD = 100_000;

const SUMARIO_SYSTEM = `Você recebeu a transcrição de uma entrevista de imersão de consultoria. Produza um SUMÁRIO DENSO que preserve o máximo de informação útil para um diagnóstico posterior:
(1) Perfil e papel do entrevistado (inferido da fala)
(2) Principais afirmações sobre a operação, com todos os números citados (valores, quantidades, percentuais, prazos) preservados exatamente
(3) Dores e problemas mencionados, com citações verbatim curtas das falas mais representativas
(4) O que o entrevistado defende ou valoriza
(5) Contradições internas ou hesitações perceptíveis
(6) Menções a pessoas, sistemas, processos e concorrentes
Não interprete além do dito. Não omita números. Seja denso, não resumido.`;

const CONSOLIDACAO_SYSTEM = `Você recebeu vários sumários parciais de uma MESMA entrevista de imersão (a transcrição foi dividida em blocos). Consolide em um único sumário denso e sem redundância, mantendo a mesma estrutura de 6 itens (perfil e papel; afirmações com números; dores com verbatim; o que defende/valoriza; contradições; menções a pessoas/sistemas/processos/concorrentes). Preserve TODOS os números e todas as citações verbatim curtas. Não interprete além do dito.`;

async function sha256Hex(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function dividirEmBlocos(texto: string): string[] {
  if (texto.length <= SPLIT_THRESHOLD) return [texto];
  const blocos: string[] = [];
  let start = 0;
  while (start < texto.length) {
    const end = Math.min(texto.length, start + BLOCK_SIZE);
    blocos.push(texto.slice(start, end));
    if (end === texto.length) break;
    start = end - BLOCK_OVERLAP;
  }
  return blocos;
}

async function callClaudeComRetry(opts: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 3000,
    temperature: 0.3,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };

  let lastErr = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      const texto: string = json?.content?.[0]?.text ?? "";
      return texto;
    }
    const txt = await res.text();
    lastErr = `Claude ${res.status}: ${txt.slice(0, 400)}`;
    console.error("[sumarizar-transcricao]", lastErr);
    if (res.status === 429 && tentativa < 3) {
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    throw new Error(lastErr);
  }
  throw new Error(lastErr || "Falha ao chamar Claude após retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const cliente_id: string | undefined = body.cliente_id;
    const label: string = (body.label ?? "").toString().trim() || "Entrevista";
    const papel: string | undefined = body.papel ? String(body.papel) : undefined;
    const data_entrevista: string | null = body.data_entrevista ?? null;
    const conteudo: string = (body.conteudo ?? "").toString();

    if (!cliente_id || !conteudo || conteudo.trim().length < 200) {
      return new Response(
        JSON.stringify({ error: "cliente_id e conteudo (mín. 200 chars) são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hash = await sha256Hex(conteudo);

    // Deduplicação
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existente } = await serviceClient
      .from("transcricoes_sumarios")
      .select("id, sumario")
      .eq("cliente_id", cliente_id)
      .eq("hash_conteudo", hash)
      .maybeSingle();
    if (existente) {
      return new Response(
        JSON.stringify({ sumario_id: existente.id, sumario: existente.sumario, deduplicado: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sumarizar (map + reduce quando necessário)
    let sumarioFinal = "";
    const blocos = dividirEmBlocos(conteudo);
    if (blocos.length === 1) {
      sumarioFinal = await callClaudeComRetry({
        apiKey,
        system: SUMARIO_SYSTEM,
        user: `Fonte: ${label}${papel ? ` (${papel})` : ""}${data_entrevista ? ` — ${data_entrevista}` : ""}\n\nTRANSCRIÇÃO:\n${conteudo}`,
      });
    } else {
      const parciais: string[] = [];
      for (let i = 0; i < blocos.length; i++) {
        const parcial = await callClaudeComRetry({
          apiKey,
          system: SUMARIO_SYSTEM,
          user: `Fonte: ${label} — bloco ${i + 1}/${blocos.length}\n\nTRECHO DA TRANSCRIÇÃO:\n${blocos[i]}`,
        });
        parciais.push(`### Bloco ${i + 1}/${blocos.length}\n${parcial}`);
      }
      sumarioFinal = await callClaudeComRetry({
        apiKey,
        system: CONSOLIDACAO_SYSTEM,
        user: `Fonte: ${label}${papel ? ` (${papel})` : ""}${data_entrevista ? ` — ${data_entrevista}` : ""}\n\nSUMÁRIOS PARCIAIS:\n\n${parciais.join("\n\n")}`,
        maxTokens: 4000,
      });
    }

    const { data: inserted, error: insErr } = await serviceClient
      .from("transcricoes_sumarios")
      .insert({
        cliente_id,
        label,
        papel: papel ?? null,
        data_entrevista,
        sumario: sumarioFinal,
        num_chars_original: conteudo.length,
        hash_conteudo: hash,
        created_by: userId,
      })
      .select("id, sumario")
      .single();
    if (insErr) throw new Error(insErr.message);

    return new Response(
      JSON.stringify({ sumario_id: inserted.id, sumario: inserted.sumario, deduplicado: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sumarizar-transcricao error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});