import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, string> = {
  diagnostico: `Você é um consultor sênior especializado em diagnóstico empresarial. Com base nas informações fornecidas sobre o cliente (observações de imersão, reuniões realizadas, checklist e dados gerais), elabore um diagnóstico completo e estruturado em markdown.

O diagnóstico deve conter:
1. **Resumo Executivo** — visão geral da situação do cliente
2. **Pontos Fortes Identificados** — o que o cliente faz bem
3. **Problemas e Gargalos** — principais dificuldades encontradas
4. **Oportunidades de Melhoria** — ações que podem ser implementadas
5. **Prioridades Recomendadas** — ranking das ações mais urgentes
6. **Próximos Passos** — sugestões de ações imediatas

Seja objetivo, use bullet points quando apropriado e mantenha um tom profissional.`,

  okrs: `Você é um especialista em planejamento estratégico e metodologia OKR (Objectives and Key Results). Com base nas informações fornecidas sobre o cliente (observações, reuniões, diagnóstico prévio), crie um conjunto de OKRs para o próximo trimestre.

Gere entre 3 e 5 Objetivos, cada um com 2 a 4 Resultados-Chave mensuráveis. Use o formato:

**Objetivo 1: [Descrição clara do objetivo]**
- KR1: [Resultado-chave mensurável com meta numérica]
- KR2: [Resultado-chave mensurável com meta numérica]
- KR3: [Resultado-chave mensurável com meta numérica]

Os OKRs devem ser:
- Alinhados com os problemas e oportunidades do cliente
- Mensuráveis e com prazo definido
- Ambiciosos mas alcançáveis
- Focados em resultados, não em tarefas`,

  briefing_cliente_oculto: `Você é um especialista em customer experience e cliente oculto. Com base nas informações fornecidas sobre o cliente (tipo de negócio, localização, observações da imersão, reuniões), elabore um briefing completo para a equipe de backoffice realizar a avaliação de cliente oculto.

O briefing deve conter em markdown:

1. **Dados do Estabelecimento** — nome, cidade, UF, segmento
2. **Objetivo da Avaliação** — o que queremos avaliar especificamente
3. **Pontos de Atenção Prioritários** — baseados nas observações e reuniões
4. **Critérios de Avaliação** — lista de itens a serem observados:
   - Atendimento (cordialidade, tempo de espera, proatividade)
   - Ambiente (limpeza, organização, sinalização)
   - Produto/Serviço (qualidade, apresentação, preço)
   - Processos (fluxo de atendimento, follow-up, pós-venda)
5. **Roteiro Sugerido** — passo a passo do que o cliente oculto deve fazer
6. **Perguntas-Chave** — questões que o avaliador deve tentar responder
7. **Observações Específicas** — qualquer particularidade a considerar

Seja detalhado e prático para que a equipe consiga executar sem dúvidas.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { tipo, projeto_id, contexto_usuario } = await req.json();

    if (!tipo || !projeto_id) {
      return new Response(JSON.stringify({ error: "tipo e projeto_id são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!PROMPTS[tipo]) {
      return new Response(JSON.stringify({ error: "Tipo inválido. Use: diagnostico, okrs, briefing_cliente_oculto" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch project context
    const { data: projeto, error: projetoError } = await supabase
      .from("projetos")
      .select("*, clientes(nome, cidade, uf, status), consultores(nome), contratos(tipo_consultoria_id, data_inicio, data_fim)")
      .eq("id", projeto_id)
      .single();

    if (projetoError || !projeto) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch reuniões do cliente
    const { data: reunioes } = await supabase
      .from("reunioes")
      .select("data_reuniao, duracao_minutos, resumo_ia, score_ia, analise_ia, score_cliente, analise_cliente")
      .eq("cliente_id", projeto.cliente_id)
      .eq("status_analise", "concluido")
      .order("data_reuniao", { ascending: false })
      .limit(10);

    // Fetch checklist
    const { data: checklist } = await supabase
      .from("projeto_checklist")
      .select("titulo, concluido")
      .eq("projeto_id", projeto_id)
      .order("ordem");

    // Fetch onboarding
    const { data: onboarding } = await supabase
      .from("onboarding")
      .select("*")
      .eq("cliente_id", projeto.cliente_id)
      .limit(1);

    // Build context
    const contexto = `
## Dados do Cliente
- Nome: ${projeto.clientes?.nome ?? "N/A"}
- Cidade/UF: ${projeto.clientes?.cidade ?? "N/A"} / ${projeto.clientes?.uf ?? "N/A"}
- Status: ${projeto.clientes?.status ?? "N/A"}

## Observações do Projeto
${projeto.observacoes || "Sem observações registradas."}

## Checklist do Projeto
${checklist?.length ? checklist.map((c: any) => `- [${c.concluido ? "x" : " "}] ${c.titulo}`).join("\n") : "Sem itens no checklist."}

## Reuniões Analisadas (${reunioes?.length ?? 0})
${reunioes?.length ? reunioes.map((r: any) => `
### Reunião ${r.data_reuniao}${r.duracao_minutos ? ` (${r.duracao_minutos} min)` : ""}
- Score Consultor: ${r.score_ia ?? "N/A"}
- Score Cliente: ${r.score_cliente ?? "N/A"}
${r.resumo_ia ? `- Resumo: ${r.resumo_ia}` : ""}
`).join("\n") : "Nenhuma reunião analisada."}

## Onboarding
${onboarding?.[0] ? `- Etapa atual: ${onboarding[0].etapa_atual}\n- Observações: ${onboarding[0].observacoes ?? "N/A"}` : "Sem dados de onboarding."}
`.trim();

    const promptCompleto = `${PROMPTS[tipo]}\n\n---\n\nINFORMAÇÕES DO CLIENTE:\n\n${contexto}`;
    const candidateModels = ["gemini-2.5-pro", "gemini-2.5-flash"];

    let conteudo = "";
    let lastStatus = 500;
    let lastErrorMessage = "Erro na API do Gemini";

    for (const model of candidateModels) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptCompleto }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        conteudo = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (conteudo) break;
        lastStatus = 500;
        lastErrorMessage = `O modelo ${model} não retornou conteúdo.`;
        continue;
      }

      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, model, errText);
      lastStatus = geminiResponse.status;

      if (geminiResponse.status === 429) {
        lastErrorMessage = model === "gemini-2.5-pro"
          ? "Sua chave do Google está sem cota disponível para Gemini Pro no momento. Tentando fallback automaticamente."
          : "Sua chave do Google está sem cota disponível no momento. Verifique billing e limites da API Gemini.";
        continue;
      }

      if (geminiResponse.status === 404) {
        lastErrorMessage = `O modelo ${model} não está disponível para esta chave/API version.`;
        continue;
      }

      lastErrorMessage = `Erro do Gemini (${geminiResponse.status}).`;
    }

    if (!conteudo) {
      return new Response(JSON.stringify({ error: lastErrorMessage }), {
        status: lastStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to projeto_documentos
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: insertError } = await serviceClient
      .from("projeto_documentos")
      .insert({
        projeto_id,
        tipo,
        conteudo,
        created_by: userId,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(JSON.stringify({ conteudo }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agente-projeto error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
