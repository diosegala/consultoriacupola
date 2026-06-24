import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage { role: "user" | "assistant"; content: string }

function buildSystemPrompt(context: string, contextoPagina?: string) {
  const contextoBloco = contextoPagina
    ? `\n\nCONTEXTO DA CONSULTA ATUAL (use para personalizar a resposta):\n${contextoPagina}\n`
    : "";
  return `Você é o Oráculo da Cupola, um especialista em mercado imobiliário, vendas, gestão e melhores práticas do setor.

COMO RESPONDER (OBRIGATÓRIO):
- SINTETIZE e REFORMULE todas as informações com suas próprias palavras
- Crie respostas CONCISAS: máximo 3-4 parágrafos curtos ou 5-7 bullet points
- JAMAIS copie frases ou parágrafos inteiros das informações de referência
- Extraia apenas os CONCEITOS-CHAVE e explique-os de forma original
- Use exemplos práticos quando possível

FORMATO:
- Comece direto com a resposta
- Use títulos (##) apenas se houver múltiplos tópicos
- Prefira bullet points (-) para listas
- Parágrafos curtos (2-3 frases)

PROIBIDO:
- Copiar textos literalmente
- Mencionar "contexto", "base de conhecimento" ou "documentos"
- Introduções como "Com base em..." ou "De acordo com..."
- Respostas com mais de 400 palavras
- Promover treinamentos ou produtos comerciais
${contextoBloco}${context}`;
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
    const userId = userData.user.id;

    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    const contextoPagina: string | undefined = body.contexto_pagina;
    let conversaId: string | undefined = body.conversa_id;
    const contextoOrigem = body.contexto_origem ?? null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const m of messages) {
      if (!["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 10000) {
        return new Response(JSON.stringify({ error: "Mensagem inválida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const service = createClient(supabaseUrl, serviceKey);

    // Cria/garante conversa
    if (!conversaId) {
      const titulo = messages[0]?.content.slice(0, 80) || "Nova conversa";
      const { data: nova, error: convErr } = await service
        .from("oraculo_conversas")
        .insert({ user_id: userId, titulo, contexto_origem: contextoOrigem })
        .select("id").single();
      if (convErr || !nova) {
        console.error("Erro criando conversa:", convErr);
        return new Response(JSON.stringify({ error: "Erro criando conversa" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversaId = nova.id;
    } else {
      // Garante que a conversa é do usuário
      const { data: conv } = await service
        .from("oraculo_conversas").select("id").eq("id", conversaId).eq("user_id", userId).maybeSingle();
      if (!conv) {
        return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await service.from("oraculo_conversas").update({ updated_at: new Date().toISOString() }).eq("id", conversaId);
    }

    // Persiste a última mensagem do usuário
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await service.from("oraculo_mensagens").insert({
        conversa_id: conversaId, role: "user", content: lastUser.content,
      });
    }

    // Busca documentos relevantes
    const lastMessage = messages[messages.length - 1];
    const keywords = lastMessage.content.toLowerCase()
      .replace(/[^\w\sÀ-ÿ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4);

    let relevantDocs: Array<{ title: string; content: string }> = [];
    if (keywords.length > 0) {
      const conditions = keywords.map((k) => `content.ilike.%${k}%,title.ilike.%${k}%`).join(",");
      const { data } = await service
        .from("notion_documents")
        .select("title, content")
        .or(conditions)
        .limit(3);
      relevantDocs = data || [];
    }
    if (relevantDocs.length === 0) {
      const { data } = await service.from("notion_documents").select("title, content").limit(2);
      relevantDocs = data || [];
    }

    let context = "";
    if (relevantDocs.length > 0) {
      context = "\n\nINFORMAÇÕES DE REFERÊNCIA (use como base, NÃO copie):\n\n";
      relevantDocs.forEach((d) => {
        const trunc = d.content && d.content.length > 1500 ? d.content.slice(0, 1500) + "..." : d.content;
        context += `[${d.title}]\n${trunc}\n\n`;
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt(context, contextoPagina) },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, txt);
      const msg = aiRes.status === 429
        ? "Limite de requisições. Tente novamente em instantes."
        : aiRes.status === 402
          ? "Créditos esgotados. Adicione créditos ao workspace."
          : "Erro ao consultar o Oráculo";
      return new Response(JSON.stringify({ error: msg }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream + capture full assistant content para persistir
    const reader = aiRes.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let assistantFull = "";

    const stream = new ReadableStream({
      async start(controller) {
        // emite conversa_id como evento inicial
        controller.enqueue(encoder.encode(`event: conversa\ndata: ${JSON.stringify({ conversa_id: conversaId })}\n\n`));
        let buffer = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            controller.enqueue(value);
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta?.content;
                if (delta) assistantFull += delta;
              } catch { /* ignora linhas parciais */ }
            }
          }
        } finally {
          if (assistantFull.trim()) {
            await service.from("oraculo_mensagens").insert({
              conversa_id: conversaId, role: "assistant", content: assistantFull,
            });
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("oraculo-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});