import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_PROMPTS: Record<string, string> = {
  diagnostico: "Você é um consultor sênior. Elabore um diagnóstico empresarial completo em markdown.",
  okrs: "Você é um especialista em OKRs. Crie OKRs para o próximo trimestre em markdown.",
  briefing_cliente_oculto: "Você é um especialista em cliente oculto. Elabore um briefing completo em markdown.",
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

    const validTypes = ["diagnostico", "okrs", "briefing_cliente_oculto"];
    if (!validTypes.includes(tipo)) {
      return new Response(JSON.stringify({ error: "Tipo inválido. Use: diagnostico, okrs, briefing_cliente_oculto" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch prompt from database using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: promptData } = await serviceClient
      .from("agente_prompts")
      .select("prompt, documento_modelo")
      .eq("tipo", tipo)
      .single();

    const promptBase = promptData?.prompt || FALLBACK_PROMPTS[tipo];
    const documentoModelo = promptData?.documento_modelo;

    // Fetch project context
    const { data: projeto, error: projetoError } = await supabase
      .from("projetos")
      .select("*, clientes(nome, cidade, uf, status), consultores(nome), contratos(tipo_consultoria_id, data_inicio, data_fim)")
      .eq("id", projeto_id)
      .single();

    if (projetoError || !projeto) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: reunioes } = await supabase
      .from("reunioes")
      .select("data_reuniao, duracao_minutos, resumo_ia, score_ia, analise_ia, score_cliente, analise_cliente")
      .eq("cliente_id", projeto.cliente_id)
      .eq("status_analise", "concluido")
      .order("data_reuniao", { ascending: false })
      .limit(10);

    const { data: checklist } = await supabase
      .from("projeto_checklist")
      .select("titulo, concluido")
      .eq("projeto_id", projeto_id)
      .order("ordem");

    const { data: onboarding } = await supabase
      .from("onboarding")
      .select("*")
      .eq("cliente_id", projeto.cliente_id)
      .limit(1);

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

    const contextoUsuarioSection = contexto_usuario
      ? `\n\n## Anotações e Transcrições do Consultor\n${contexto_usuario}`
      : '';

    const promptCompleto = `${promptBase}\n\n---\n\nINFORMAÇÕES DO CLIENTE:\n\n${contexto}${contextoUsuarioSection}`;
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
            contents: [{ parts: [{ text: promptCompleto }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        }
      );

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        conteudo = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (conteudo) break;
        lastErrorMessage = `O modelo ${model} não retornou conteúdo.`;
        continue;
      }

      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, model, errText);
      lastStatus = geminiResponse.status;

      if (geminiResponse.status === 429) {
        lastErrorMessage = model === "gemini-2.5-pro"
          ? "Cota indisponível para Gemini Pro. Tentando fallback."
          : "Cota indisponível. Verifique billing da API Gemini.";
        continue;
      }
      if (geminiResponse.status === 404) {
        lastErrorMessage = `Modelo ${model} não disponível.`;
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

    const { error: insertError } = await serviceClient
      .from("projeto_documentos")
      .insert({ projeto_id, tipo, conteudo, created_by: userId });

    if (insertError) console.error("Insert error:", insertError);

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
