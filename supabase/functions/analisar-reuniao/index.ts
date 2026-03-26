import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseAIResponse(rawArgs: string): any {
  let cleaned = rawArgs.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleaned.search(/[\{\[]/);
  const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, '');
    return JSON.parse(cleaned);
  }
}

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

    await supabase
      .from("reunioes")
      .update({ status_analise: "analisando" })
      .eq("id", reuniao_id);

    const maxTranscricaoLength = 30000;
    let transcricaoLimpa = reuniao.transcricao;
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

    const userPrompt = `Consultor: ${reuniao.consultores?.nome || "Desconhecido"}
Cliente: ${reuniao.clientes?.nome || "Desconhecido"}
Data: ${reuniao.data_reuniao}
Duração: ${reuniao.duracao_minutos || "N/A"} minutos

TRANSCRIÇÃO:
${transcricaoLimpa}`;

    // ===== 1. ANÁLISE DO CONSULTOR =====
    const consultorSystemPrompt = `Você é um analista especializado em qualidade de atendimento de consultoria empresarial. 
Analise a transcrição de uma reunião entre um consultor e um cliente.

Avalie nos seguintes critérios (nota de 0 a 10 cada):
1. Empatia e escuta ativa - O consultor demonstra interesse genuíno pelo cliente?
2. Clareza na comunicação - Explica conceitos de forma acessível?
3. Proatividade - Traz sugestões e antecipa problemas?
4. Domínio técnico - Demonstra conhecimento da área?
5. Orientação para resultados - Foca em ações concretas e próximos passos?

Retorne a análise usando a função fornecida. Seja conciso nos textos.`;

    const consultorAIResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: consultorSystemPrompt },
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
                  resumo: { type: "string", description: "Resumo conciso da reunião (3-5 frases)" },
                  empatia: { type: "number", description: "Nota 0-10 para empatia e escuta ativa" },
                  clareza: { type: "number", description: "Nota 0-10 para clareza na comunicação" },
                  proatividade: { type: "number", description: "Nota 0-10 para proatividade" },
                  dominio_tecnico: { type: "number", description: "Nota 0-10 para domínio técnico" },
                  orientacao_resultados: { type: "number", description: "Nota 0-10 para orientação para resultados" },
                  pontos_fortes: { type: "array", items: { type: "string" }, description: "Lista de 3-5 pontos fortes (frases curtas)" },
                  pontos_melhoria: { type: "array", items: { type: "string" }, description: "Lista de 3-5 pontos de melhoria (frases curtas)" },
                },
                required: ["resumo", "empatia", "clareza", "proatividade", "dominio_tecnico", "orientacao_resultados", "pontos_fortes", "pontos_melhoria"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_analise" } },
      }),
    });

    if (!consultorAIResponse.ok) {
      const statusCode = consultorAIResponse.status;
      let errorMsg = "Erro na análise IA";
      if (statusCode === 429) errorMsg = "Limite de requisições excedido, tente novamente mais tarde";
      if (statusCode === 402) errorMsg = "Créditos de IA esgotados";
      await supabase.from("reunioes").update({ status_analise: "erro" }).eq("id", reuniao_id);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consultorAIData = await consultorAIResponse.json();
    const consultorToolCall = consultorAIData.choices?.[0]?.message?.tool_calls?.[0];

    if (!consultorToolCall && !consultorAIData.choices?.[0]?.message?.content) {
      await supabase.from("reunioes").update({ status_analise: "erro" }).eq("id", reuniao_id);
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let analise: any;
    try {
      const rawArgs = consultorToolCall ? consultorToolCall.function.arguments : consultorAIData.choices[0].message.content;
      analise = parseAIResponse(rawArgs);
    } catch (parseErr) {
      console.error("Erro ao parsear resposta da IA (consultor):", parseErr);
      await supabase.from("reunioes").update({ status_analise: "erro" }).eq("id", reuniao_id);
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    analise.empatia = Number(analise.empatia) || 0;
    analise.clareza = Number(analise.clareza) || 0;
    analise.proatividade = Number(analise.proatividade) || 0;
    analise.dominio_tecnico = Number(analise.dominio_tecnico) || 0;
    analise.orientacao_resultados = Number(analise.orientacao_resultados) || 0;
    analise.pontos_fortes = Array.isArray(analise.pontos_fortes) ? analise.pontos_fortes : [];
    analise.pontos_melhoria = Array.isArray(analise.pontos_melhoria) ? analise.pontos_melhoria : [];

    const scoreConsultor =
      (analise.empatia + analise.clareza + analise.proatividade +
        analise.dominio_tecnico + analise.orientacao_resultados) / 5;

    // ===== 2. ANÁLISE DO CLIENTE =====
    let analiseCliente: any = null;
    let scoreCliente: number | null = null;

    try {
      const clienteSystemPrompt = `Você é um analista especializado em avaliar o engajamento e participação de clientes em reuniões de consultoria empresarial.
Analise a transcrição focando exclusivamente no COMPORTAMENTO DO CLIENTE (não do consultor).

Avalie nos seguintes critérios (nota de 0 a 10 cada):
1. Participação ativa - O cliente faz perguntas, compartilha informações e contribui para a conversa?
2. Abertura a sugestões - Demonstra receptividade a novas ideias e propostas do consultor?
3. Comprometimento com ações - Assume responsabilidades, define prazos e se compromete com próximos passos?
4. Clareza nas demandas - Comunica necessidades, problemas e expectativas de forma clara?
5. Engajamento estratégico - Demonstra visão de longo prazo e interesse em resultados sustentáveis?

Retorne a análise usando a função fornecida. Seja conciso nos textos.`;

      const clienteAIResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: clienteSystemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 8192,
          tools: [
            {
              type: "function",
              function: {
                name: "registrar_analise_cliente",
                description: "Registra a análise de engajamento do cliente",
                parameters: {
                  type: "object",
                  properties: {
                    resumo: { type: "string", description: "Resumo conciso do engajamento do cliente (2-3 frases)" },
                    participacao_ativa: { type: "number", description: "Nota 0-10 para participação ativa" },
                    abertura_sugestoes: { type: "number", description: "Nota 0-10 para abertura a sugestões" },
                    comprometimento_acoes: { type: "number", description: "Nota 0-10 para comprometimento com ações" },
                    clareza_demandas: { type: "number", description: "Nota 0-10 para clareza nas demandas" },
                    engajamento_estrategico: { type: "number", description: "Nota 0-10 para engajamento estratégico" },
                    pontos_fortes: { type: "array", items: { type: "string" }, description: "Lista de 3-5 pontos fortes do cliente (frases curtas)" },
                    pontos_melhoria: { type: "array", items: { type: "string" }, description: "Lista de 3-5 pontos de melhoria do cliente (frases curtas)" },
                  },
                  required: ["resumo", "participacao_ativa", "abertura_sugestoes", "comprometimento_acoes", "clareza_demandas", "engajamento_estrategico", "pontos_fortes", "pontos_melhoria"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "registrar_analise_cliente" } },
        }),
      });

      if (clienteAIResponse.ok) {
        const clienteAIData = await clienteAIResponse.json();
        const clienteToolCall = clienteAIData.choices?.[0]?.message?.tool_calls?.[0];
        const rawArgs = clienteToolCall ? clienteToolCall.function.arguments : clienteAIData.choices?.[0]?.message?.content;
        
        if (rawArgs) {
          analiseCliente = parseAIResponse(rawArgs);
          analiseCliente.participacao_ativa = Number(analiseCliente.participacao_ativa) || 0;
          analiseCliente.abertura_sugestoes = Number(analiseCliente.abertura_sugestoes) || 0;
          analiseCliente.comprometimento_acoes = Number(analiseCliente.comprometimento_acoes) || 0;
          analiseCliente.clareza_demandas = Number(analiseCliente.clareza_demandas) || 0;
          analiseCliente.engajamento_estrategico = Number(analiseCliente.engajamento_estrategico) || 0;
          analiseCliente.pontos_fortes = Array.isArray(analiseCliente.pontos_fortes) ? analiseCliente.pontos_fortes : [];
          analiseCliente.pontos_melhoria = Array.isArray(analiseCliente.pontos_melhoria) ? analiseCliente.pontos_melhoria : [];

          scoreCliente = Math.round(
            ((analiseCliente.participacao_ativa + analiseCliente.abertura_sugestoes +
              analiseCliente.comprometimento_acoes + analiseCliente.clareza_demandas +
              analiseCliente.engajamento_estrategico) / 5) * 10
          ) / 10;
        }
      } else {
        console.error("Erro na análise do cliente:", clienteAIResponse.status);
      }
    } catch (clienteErr) {
      console.error("Erro na análise do cliente (não crítico):", clienteErr);
    }

    // ===== SALVAR TUDO =====
    const updateData: any = {
      resumo_ia: analise.resumo || '',
      score_ia: Math.round(scoreConsultor * 10) / 10,
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
    };

    if (analiseCliente && scoreCliente !== null) {
      updateData.score_cliente = scoreCliente;
      updateData.analise_cliente = {
        resumo: analiseCliente.resumo || '',
        participacao_ativa: analiseCliente.participacao_ativa,
        abertura_sugestoes: analiseCliente.abertura_sugestoes,
        comprometimento_acoes: analiseCliente.comprometimento_acoes,
        clareza_demandas: analiseCliente.clareza_demandas,
        engajamento_estrategico: analiseCliente.engajamento_estrategico,
        pontos_fortes: analiseCliente.pontos_fortes,
        pontos_melhoria: analiseCliente.pontos_melhoria,
      };
    }

    const { error: updateError } = await supabase
      .from("reunioes")
      .update(updateData)
      .eq("id", reuniao_id);

    if (updateError) {
      console.error("Erro ao salvar análise:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao salvar análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, score: Math.round(scoreConsultor * 10) / 10, score_cliente: scoreCliente }),
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
