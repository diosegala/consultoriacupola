import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMB_MODEL = "openai/text-embedding-3-small";
const EMB_DIMS = 1536;

interface ChatMessage { role: "user" | "assistant"; content: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function embedQuery(texto: string, key: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMB_MODEL, input: texto.slice(0, 4000), dimensions: EMB_DIMS }),
    });
    if (!res.ok) {
      console.error("Embeddings error", res.status, await res.text());
      return null;
    }
    const j = await res.json();
    return j.data[0].embedding as number[];
  } catch (e) {
    console.error("Embeddings exception", e);
    return null;
  }
}

const SYSTEM = `Você é o analista de reuniões da Cupola Consultoria (mercado imobiliário).
Sua função é responder perguntas do diretor/consultor sobre o que os CLIENTES efetivamente disseram nas reuniões, usando somente as evidências fornecidas.

REGRAS OBRIGATÓRIAS:
- Baseie cada afirmação nos TRECHOS DE TRANSCRIÇÃO e no PANORAMA DAS REUNIÕES fornecidos.
- Sempre cite a fonte no formato (Cliente — DD/MM/AAAA) logo após a afirmação.
- Quando houver mais de um cliente, agrupe por cliente.
- Se as evidências forem insuficientes, diga isso explicitamente e sugira refinar a busca (cliente, período).
- NUNCA invente falas, números ou clientes que não estejam nas evidências.

FORMATO:
- Resposta direta em até 5 parágrafos curtos ou bullets.
- Use markdown simples (bullets, negrito). Sem introduções como "Com base em...".
- Quando fizer sentido, inclua citação curta entre aspas do que o cliente disse.`;

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

    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    const filtros = body.filtros || {};
    let conversaId: string | undefined = body.conversa_id;

    if (!Array.isArray(messages) || messages.length === 0) return json({ error: "Mensagens inválidas" }, 400);
    for (const m of messages) {
      if (!["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 10000) {
        return json({ error: "Mensagem inválida" }, 400);
      }
    }

    const service = createClient(supabaseUrl, serviceKey);
    const pergunta = messages[messages.length - 1].content;

    // Conversa (reaproveita histórico do Oráculo, com origem marcada)
    if (!conversaId) {
      const { data: nova } = await service.from("oraculo_conversas").insert({
        user_id: user.id,
        titulo: pergunta.slice(0, 80),
        contexto_origem: { tipo: "pesquisa_reunioes", filtros },
      }).select("id").single();
      conversaId = nova?.id;
    } else {
      const { data: conv } = await service.from("oraculo_conversas")
        .select("id").eq("id", conversaId).eq("user_id", user.id).maybeSingle();
      if (!conv) return json({ error: "Conversa não encontrada" }, 404);
      await service.from("oraculo_conversas").update({ updated_at: new Date().toISOString() }).eq("id", conversaId);
    }
    if (conversaId) {
      await service.from("oraculo_mensagens").insert({ conversa_id: conversaId, role: "user", content: pergunta });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const emb = await embedQuery(pergunta, LOVABLE_API_KEY);
    if (!emb) return json({ error: "Não foi possível processar a pergunta (embeddings)." }, 500);

    // Busca com RLS do usuário (escopo por carteira aplicado no banco)
    const { data: trechos, error: rpcErr } = await userClient.rpc("buscar_trechos_reunioes", {
      query_embedding: emb as any,
      match_count: 14,
      p_cliente_id: filtros.cliente_id ?? null,
      p_consultor_id: filtros.consultor_id ?? null,
      p_data_inicio: filtros.data_inicio ?? null,
      p_data_fim: filtros.data_fim ?? null,
    });
    if (rpcErr) console.error("buscar_trechos_reunioes:", rpcErr);

    const relevantes = (trechos || []).filter((t: any) => (t.similarity ?? 0) > 0.15);
    const reuniaoIds = [...new Set(relevantes.map((t: any) => t.reuniao_id))];
    const clienteIds = [...new Set(relevantes.map((t: any) => t.cliente_id))];

    const nomeCliente = new Map<string, string>();
    if (clienteIds.length) {
      const { data: cls } = await service.from("clientes").select("id, nome").in("id", clienteIds);
      for (const c of cls || []) nomeCliente.set(c.id, c.nome);
    }

    // Panorama agregado das reuniões envolvidas
    let panorama = "";
    if (reuniaoIds.length) {
      const { data: reus } = await service
        .from("reunioes")
        .select("id, cliente_id, data_reuniao, resumo_ia, score_cliente, analise_cliente")
        .in("id", reuniaoIds);
      const { data: comps } = await service
        .from("compromissos")
        .select("cliente_id, descricao, responsavel, prazo, status")
        .in("cliente_id", clienteIds)
        .limit(60);
      panorama = "\n\n=== PANORAMA DAS REUNIÕES ENVOLVIDAS ===\n";
      for (const r of reus || []) {
        panorama += `\n[${nomeCliente.get(r.cliente_id) || "Cliente"} — ${r.data_reuniao}]\n`;
        if (r.score_cliente != null) panorama += `Score de engajamento do cliente: ${r.score_cliente}\n`;
        if (r.analise_cliente) panorama += `Dimensões: ${JSON.stringify(r.analise_cliente).slice(0, 800)}\n`;
        if (r.resumo_ia) panorama += `Resumo: ${String(r.resumo_ia).slice(0, 1200)}\n`;
      }
      if ((comps || []).length) {
        panorama += "\nCOMPROMISSOS REGISTRADOS:\n";
        for (const c of comps!) {
          panorama += `- (${nomeCliente.get(c.cliente_id) || "Cliente"}) ${c.descricao} | resp: ${c.responsavel} | prazo: ${c.prazo ?? "-"} | ${c.status}\n`;
        }
      }
    }

    let evidencias = "";
    if (relevantes.length) {
      evidencias = "\n\n=== TRECHOS DE TRANSCRIÇÃO (fala real das reuniões) ===\n";
      relevantes.forEach((t: any, i: number) => {
        evidencias += `\n#${i + 1} [${nomeCliente.get(t.cliente_id) || "Cliente"} — ${t.data_reuniao}]\n${t.conteudo}\n`;
      });
    } else {
      evidencias = "\n\n(Nenhum trecho de transcrição relevante foi encontrado para esta pergunta e filtros.)";
    }

    const fontes = relevantes.slice(0, 8).map((t: any) => ({
      reuniao_id: t.reuniao_id,
      cliente_id: t.cliente_id,
      cliente_nome: nomeCliente.get(t.cliente_id) || "Cliente",
      data_reuniao: t.data_reuniao,
      trecho: String(t.conteudo).slice(0, 400),
      similaridade: Number(t.similarity ?? 0),
    }));

    const historico = messages.slice(-6, -1).map((m) => ({ role: m.role, content: m.content }));
    const claude = await callClaude({
      system: SYSTEM,
      messages: [
        ...historico,
        { role: "user", content: `PERGUNTA: ${pergunta}\n${evidencias}${panorama}` },
      ],
      max_tokens: 2500,
    });

    if (!claude.ok) {
      await logAiUsage({
        admin: service, agente_tipo: "pesquisa_reunioes", user_id: user.id,
        status: "error", error_message: claude.errorMessage ?? null,
      });
      return json({ error: claude.errorMessage || `Erro Claude (${claude.status})` }, claude.status);
    }

    await logAiUsage({ admin: service, agente_tipo: "pesquisa_reunioes", user_id: user.id, usage: claude.usage });

    const texto = claude.text || "Não consegui gerar uma resposta. Tente reformular a pergunta.";
    if (conversaId && texto.trim()) {
      await service.from("oraculo_mensagens").insert({ conversa_id: conversaId, role: "assistant", content: texto });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: conversa\ndata: ${JSON.stringify({ conversa_id: conversaId })}\n\n`));
        controller.enqueue(encoder.encode(`event: fontes\ndata: ${JSON.stringify({ fontes })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: texto } }] })}\n\n`));
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    console.error("[pesquisa-reunioes]", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});