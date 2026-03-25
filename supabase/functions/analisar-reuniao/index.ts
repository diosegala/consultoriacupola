import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is authorized
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check authorization
    const { data: isAuthorized } = await supabase.rpc("is_authorized_user", { _user_id: user.id });
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reuniao_id } = await req.json();
    if (!reuniao_id) {
      return new Response(JSON.stringify({ error: "reuniao_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch reunião with related data
    const { data: reuniao, error: reuniaoError } = await supabase
      .from("reunioes")
      .select("*, consultores(nome), clientes(nome)")
      .eq("id", reuniao_id)
      .single();

    if (reuniaoError || !reuniao) {
      return new Response(JSON.stringify({ error: "Reunião não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reuniao.transcricao) {
      return new Response(JSON.stringify({ error: "Reunião sem transcrição" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to analyzing
    await supabase
      .from("reunioes")
      .update({ status_analise: "analisando" })
      .eq("id", reuniao_id);

    // Truncate transcription to avoid token limits (keep ~30k chars)
    const maxTranscricaoLength = 30000;
    let transcricaoLimpa = reuniao.transcricao;
    // Strip any residual HTML tags
    if (/<\s*(html|head|body|div|p|span)\b/i.test(transcricaoLimpa)) {
      transcricaoLimpa = transcricaoLimpa
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    if (transcricaoLimpa.length > maxTranscricaoLength) {
      transcricaoLimpa = transcricaoLimpa.substring(0, maxTranscricaoLength) + '\n\n[Transcrição truncada por limite de tamanho]';
    }

    const systemPrompt = `Você é um analista especializado em qualidade de atendimento de consultoria empresarial. 
Analise a transcrição de uma reunião entre um consultor e um cliente.

Avalie nos seguintes critérios (nota de 0 a 10 cada):
1. Empatia e escuta ativa - O consultor demonstra interesse genuíno pelo cliente?
2. Clareza na comunicação - Explica conceitos de forma acessível?
3. Proatividade - Traz sugestões e antecipa problemas?
4. Domínio técnico - Demonstra conhecimento da área?
5. Orientação para resultados - Foca em ações concretas e próximos passos?

Retorne a análise usando a função fornecida. Seja conciso nos textos.`;

    const userPrompt = `Consultor: ${reuniao.consultores?.nome || "Desconhecido"}
Cliente: ${reuniao.clientes?.nome || "Desconhecido"}
Data: ${reuniao.data_reuniao}
Duração: ${reuniao.duracao_minutos || "N/A"} minutos

TRANSCRIÇÃO:
${transcricaoLimpa}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8192,
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_analise",
              description: "Registra a análise completa da reunião",
              parameters: {
                type: "object",
                properties: {
                  resumo: {
                    type: "string",
                    description: "Resumo conciso da reunião (3-5 frases)",
                  },
                  empatia: { type: "number", description: "Nota 0-10 para empatia e escuta ativa" },
                  clareza: { type: "number", description: "Nota 0-10 para clareza na comunicação" },
                  proatividade: { type: "number", description: "Nota 0-10 para proatividade" },
                  dominio_tecnico: { type: "number", description: "Nota 0-10 para domínio técnico" },
                  orientacao_resultados: { type: "number", description: "Nota 0-10 para orientação para resultados" },
                  pontos_fortes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de 3-5 pontos fortes identificados (frases curtas)",
                  },
                  pontos_melhoria: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de 3-5 pontos de melhoria (frases curtas)",
                  },
                },
                required: [
                  "resumo", "empatia", "clareza", "proatividade",
                  "dominio_tecnico", "orientacao_resultados",
                  "pontos_fortes", "pontos_melhoria",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_analise" } },
      }),
    });

    if (!aiResponse.ok) {
      const statusCode = aiResponse.status;
      let errorMsg = "Erro na análise IA";
      if (statusCode === 429) errorMsg = "Limite de requisições excedido, tente novamente mais tarde";
      if (statusCode === 402) errorMsg = "Créditos de IA esgotados";

      await supabase
        .from("reunioes")
        .update({ status_analise: "erro" })
        .eq("id", reuniao_id);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      await supabase.from("reunioes").update({ status_analise: "erro" }).eq("id", reuniao_id);
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analise = JSON.parse(toolCall.function.arguments);
    const scoreMedia =
      (analise.empatia + analise.clareza + analise.proatividade +
        analise.dominio_tecnico + analise.orientacao_resultados) / 5;

    const { error: updateError } = await supabase
      .from("reunioes")
      .update({
        resumo_ia: analise.resumo,
        score_ia: Math.round(scoreMedia * 10) / 10,
        analise_ia: {
          empatia: analise.empatia,
          clareza: analise.clareza,
          proatividade: analise.proatividade,
          dominio_tecnico: analise.dominio_tecnico,
          orientacao_resultados: analise.orientacao_resultados,
          pontos_fortes: analise.pontos_fortes,
          pontos_melhoria: analise.pontos_melhoria,
        },
        status_analise: "concluido",
      })
      .eq("id", reuniao_id);

    if (updateError) {
      console.error("Erro ao salvar análise:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao salvar análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, score: Math.round(scoreMedia * 10) / 10 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
