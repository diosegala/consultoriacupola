import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
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

Além da análise, extraia os COMPROMISSOS assumidos na reunião — ações concretas que alguém ficou de executar. Para cada um: descricao (ação específica, não genérica), responsavel ("cliente" se quem executa é alguém da empresa cliente, "consultor" se é o consultor), prazo (data no formato YYYY-MM-DD se mencionada explicitamente; use null caso contrário — nunca invente datas). Ignore intenções vagas ("vamos pensar nisso") — só compromissos acionáveis.

Retorne a análise usando a função fornecida. Seja conciso nos textos.`;

    const consultorClaude = await callClaude({
      system: consultorSystemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4096,
      tools: [
        {
          name: "registrar_analise",
          description: "Registra a análise completa da reunião",
          input_schema: {
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
              compromissos: {
                type: "array",
                description: "Compromissos acionáveis assumidos na reunião. Deixe vazio se não houver.",
                items: {
                  type: "object",
                  properties: {
                    descricao: { type: "string", description: "Ação concreta, específica, sem generalidades." },
                    responsavel: { type: "string", enum: ["cliente", "consultor"], description: "Quem ficou de executar." },
                    prazo: { type: ["string", "null"], description: "Data no formato YYYY-MM-DD se mencionada; null caso contrário." },
                  },
                  required: ["descricao", "responsavel"],
                },
              },
            },
            required: ["resumo", "empatia", "clareza", "proatividade", "dominio_tecnico", "orientacao_resultados", "pontos_fortes", "pontos_melhoria"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "registrar_analise" },
    });

    if (!consultorClaude.ok) {
      const statusCode = consultorClaude.status;
      const errorMsg = consultorClaude.errorMessage || "Erro na análise IA";
      await logAiUsage({
        admin: supabase,
        agente_tipo: "analise_reuniao_consultor",
        user_id: user.id,
        cliente_id: reuniao.cliente_id ?? null,
        consultor_id: reuniao.consultor_id ?? null,
        status: "error",
        error_message: errorMsg,
      });
      await supabase.from("reunioes").update({ status_analise: "erro" }).eq("id", reuniao_id);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAiUsage({
      admin: supabase,
      agente_tipo: "analise_reuniao_consultor",
      user_id: user.id,
      cliente_id: reuniao.cliente_id ?? null,
      consultor_id: reuniao.consultor_id ?? null,
      usage: consultorClaude.usage,
    });

    if (!consultorClaude.toolInput && !consultorClaude.text) {
      await supabase.from("reunioes").update({ status_analise: "erro" }).eq("id", reuniao_id);
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let analise: any;
    try {
      analise = consultorClaude.toolInput
        ? consultorClaude.toolInput
        : parseAIResponse(consultorClaude.text || "");
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
    analise.compromissos = Array.isArray(analise.compromissos) ? analise.compromissos : [];

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

Além das notas, identifique ALERTAS DE SENTIMENTO NEGATIVO: sinais explícitos ou fortes de insatisfação, frustração, questionamento de valor da consultoria, cancelamento iminente, comparação negativa com concorrentes, ou reclamações recorrentes. Ignore ruído leve. Para cada alerta: trecho (frase curta parafraseada da transcrição), severidade ("alta"|"media"), motivo (breve explicação). Se não houver sinais claros, retorne array vazio.

Retorne a análise usando a função fornecida. Seja conciso nos textos.`;

      const clienteClaude = await callClaude({
        system: clienteSystemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 4096,
        tools: [
          {
            name: "registrar_analise_cliente",
            description: "Registra a análise de engajamento do cliente",
            input_schema: {
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
                alertas_sentimento: {
                  type: "array",
                  description: "Sinais fortes de insatisfação/risco. Vazio se não houver.",
                  items: {
                    type: "object",
                    properties: {
                      trecho: { type: "string" },
                      severidade: { type: "string", enum: ["alta","media"] },
                      motivo: { type: "string" },
                    },
                    required: ["trecho","severidade","motivo"],
                  },
                },
              },
              required: ["resumo", "participacao_ativa", "abertura_sugestoes", "comprometimento_acoes", "clareza_demandas", "engajamento_estrategico", "pontos_fortes", "pontos_melhoria"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "registrar_analise_cliente" },
      });

      if (clienteClaude.ok) {
        await logAiUsage({
          admin: supabase,
          agente_tipo: "analise_reuniao_cliente",
          user_id: user.id,
          cliente_id: reuniao.cliente_id ?? null,
          consultor_id: reuniao.consultor_id ?? null,
          usage: clienteClaude.usage,
        });
        if (clienteClaude.toolInput || clienteClaude.text) {
          analiseCliente = clienteClaude.toolInput ?? parseAIResponse(clienteClaude.text || "");
          analiseCliente.participacao_ativa = Number(analiseCliente.participacao_ativa) || 0;
          analiseCliente.abertura_sugestoes = Number(analiseCliente.abertura_sugestoes) || 0;
          analiseCliente.comprometimento_acoes = Number(analiseCliente.comprometimento_acoes) || 0;
          analiseCliente.clareza_demandas = Number(analiseCliente.clareza_demandas) || 0;
          analiseCliente.engajamento_estrategico = Number(analiseCliente.engajamento_estrategico) || 0;
          analiseCliente.pontos_fortes = Array.isArray(analiseCliente.pontos_fortes) ? analiseCliente.pontos_fortes : [];
          analiseCliente.pontos_melhoria = Array.isArray(analiseCliente.pontos_melhoria) ? analiseCliente.pontos_melhoria : [];
          analiseCliente.alertas_sentimento = Array.isArray(analiseCliente.alertas_sentimento) ? analiseCliente.alertas_sentimento : [];

          scoreCliente = Math.round(
            ((analiseCliente.participacao_ativa + analiseCliente.abertura_sugestoes +
              analiseCliente.comprometimento_acoes + analiseCliente.clareza_demandas +
              analiseCliente.engajamento_estrategico) / 5) * 10
          ) / 10;
        }
      } else {
        console.error("Erro na análise do cliente:", clienteClaude.status, clienteClaude.errorMessage);
        await logAiUsage({
          admin: supabase,
          agente_tipo: "analise_reuniao_cliente",
          user_id: user.id,
          cliente_id: reuniao.cliente_id ?? null,
          consultor_id: reuniao.consultor_id ?? null,
          status: "error",
          error_message: clienteClaude.errorMessage ?? null,
        });
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
        alertas_sentimento: analiseCliente.alertas_sentimento ?? [],
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

    // ===== 3. EXTRAIR E PERSISTIR COMPROMISSOS =====
    let compromissosInseridos = 0;
    try {
      const brutos = (analise.compromissos ?? []) as Array<any>;
      const validos = brutos
        .map((c) => ({
          descricao: typeof c?.descricao === "string" ? c.descricao.trim() : "",
          responsavel: c?.responsavel === "consultor" ? "consultor" : "cliente",
          prazo: typeof c?.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.prazo) ? c.prazo : null,
        }))
        .filter((c) => c.descricao.length >= 6);

      for (const comp of validos) {
        const prefixo = comp.descricao.slice(0, 50).replace(/[%_]/g, (m) => `\\${m}`);
        const { data: jaExiste } = await supabase
          .from("compromissos")
          .select("id")
          .eq("cliente_id", reuniao.cliente_id)
          .eq("status", "pendente")
          .ilike("descricao", `${prefixo}%`)
          .limit(1)
          .maybeSingle();
        if (jaExiste) continue;

        const { error: cErr } = await supabase.from("compromissos").insert({
          cliente_id: reuniao.cliente_id,
          reuniao_id,
          descricao: comp.descricao,
          responsavel: comp.responsavel,
          prazo: comp.prazo,
          origem: "ia",
          status: "pendente",
          created_by: user.id,
        });
        if (!cErr) compromissosInseridos++;
      }
    } catch (compErr) {
      console.error("[analisar-reuniao] erro ao persistir compromissos (não crítico):", compErr);
    }

    // ===== 4. NOTIFICAR DIRETORES SOBRE SENTIMENTO NEGATIVO =====
    try {
      const alertas = (analiseCliente?.alertas_sentimento ?? []) as Array<any>;
      if (alertas.length > 0) {
          // Contexto DISC da consultora (pode informar a leitura do sinal)
          let discDica = "";
          try {
            if (reuniao.consultor_id) {
              const { data: perfC } = await supabase
                .from("perfis_comportamentais").select("perfil_resumo")
                .eq("consultor_id", reuniao.consultor_id).maybeSingle();
              if (perfC?.perfil_resumo) {
                const p = perfC.perfil_resumo as any;
                discDica = `Possível tensão de estilo — considere discutir abordagem com ${reuniao.consultores?.nome ?? "a consultora"} dado o perfil ${p.perfil_primario}/${p.perfil_secundario} dela.`;
              }
            }
          } catch (dErr) { console.error("[disc dica]", dErr); }

        // Descobre user_ids de diretores/admins
        const { data: roles } = await supabase
          .from("user_roles").select("user_id, role").in("role", ["admin","director"]);
        const diretoresUserIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
        const clienteNome = reuniao.clientes?.nome ?? "Cliente";
        const consultoraNome = reuniao.consultores?.nome ?? "Consultora";
        const severidade = alertas.some((a) => a.severidade === "alta") ? "alta" : "media";
          let descricao = alertas
          .slice(0, 3)
          .map((a) => `• ${a.motivo}${a.trecho ? ` — "${a.trecho}"` : ""}`)
          .join("\n");
          if (discDica) descricao += `\n\n${discDica}`;

        for (const uid of diretoresUserIds) {
          // dedup: já há notificação não lida para a mesma reunião?
          const { data: exists } = await supabase
            .from("notificacoes")
            .select("id")
            .eq("user_id", uid)
            .eq("tipo", "sentimento_negativo_cliente")
            .eq("entidade_id", reuniao_id)
            .eq("lida", false)
            .maybeSingle();
          if (exists) continue;

          await supabase.from("notificacoes").insert({
            user_id: uid,
            tipo: "sentimento_negativo_cliente",
            titulo: `Sinal de alerta em reunião de ${clienteNome}`,
            descricao,
            link: `/reunioes?id=${reuniao_id}`,
            entidade_tipo: "reuniao",
            entidade_id: reuniao_id,
            metadata: {
              cliente_id: reuniao.cliente_id,
              cliente_nome: clienteNome,
              consultora_nome: consultoraNome,
              consultor_id: reuniao.consultor_id,
              reuniao_id,
              severidade,
              alertas,
            },
          });
        }
      }
    } catch (sentErr) {
      console.error("[analisar-reuniao] erro ao notificar sentimento (não crítico):", sentErr);
    }

    return new Response(
      JSON.stringify({ success: true, score: Math.round(scoreConsultor * 10) / 10, score_cliente: scoreCliente, compromissos: compromissosInseridos }),
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
