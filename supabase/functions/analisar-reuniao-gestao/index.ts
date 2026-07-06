// Edge Function: analisar-reuniao-gestao
// Analisa a transcrição de uma reunião de gestão (1:1 ou de equipe) do diretor
// em 5 dimensões (clareza de direção, delegação, escuta ativa, feedback
// construtivo, desenvolvimento). Salva análise estruturada + resumo em
// reunioes_gestao.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Autoriza tanto chamadas de usuário (admin/director) quanto internas
    // (cron/sync), quando não houver Authorization user JWT usamos service role.
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      userId = user?.id ?? null;
    }

    const { reuniao_gestao_id } = await req.json();
    if (!reuniao_gestao_id) {
      return new Response(JSON.stringify({ error: "reuniao_gestao_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reuniao, error: reErr } = await admin
      .from("reunioes_gestao")
      .select("*, consultores!reunioes_gestao_diretor_id_fkey(nome)")
      .eq("id", reuniao_gestao_id)
      .single();

    if (reErr || !reuniao) {
      return new Response(JSON.stringify({ error: "Reunião não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!reuniao.transcricao) {
      return new Response(JSON.stringify({ error: "Reunião sem transcrição" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("reunioes_gestao")
      .update({ status_analise: "analisando" }).eq("id", reuniao_gestao_id);

    // Higieniza transcrição (HTML → texto)
    let transcricao = reuniao.transcricao as string;
    if (/<\s*(html|head|body|div|p|span)\b/i.test(transcricao)) {
      transcricao = transcricao
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    if (transcricao.length > 30000) {
      transcricao = transcricao.slice(0, 30000) + "\n\n[Transcrição truncada]";
    }

    const tipoLabel = reuniao.tipo === "individual" ? "1:1" : "reunião de equipe";
    const participantes = (reuniao.participantes ?? []).join(", ");

    const systemPrompt = `Você é um analista de qualidade de gestão de equipes de consultoria.
Analise a transcrição de uma ${tipoLabel} conduzida pelo diretor de consultoria com sua equipe. Foque no COMPORTAMENTO DE LIDERANÇA do diretor.

Avalie estas 5 dimensões (nota 0-10 cada):
1. Clareza de direção — deixa expectativas, prioridades e critérios de sucesso explícitos?
2. Delegação — passa responsabilidade com autonomia (não microgerencia, mas também não abandona)?
3. Escuta ativa — dá espaço, faz perguntas, valida entendimento antes de responder?
4. Feedback construtivo — reconhece pontos fortes e aponta melhorias de forma específica e acionável?
5. Desenvolvimento — investe em crescimento (perguntas de reflexão, sugestões de repertório, coaching)?

Extraia também: pontos fortes (3-5), 1 sugestão principal de melhoria, e ações combinadas (com responsável e prazo se explícitos).
Retorne via a função fornecida. Seja específico, sem generalidades.`;

    const userPrompt = `Diretor: ${reuniao.consultores?.nome ?? "—"}
Tipo: ${tipoLabel}
Participantes: ${participantes || "—"}
Data: ${reuniao.data_reuniao}

TRANSCRIÇÃO:
${transcricao}`;

    const claude = await callClaude({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 3000,
      tools: [{
        name: "registrar_analise_gestao",
        description: "Registra a análise da reunião de gestão",
        input_schema: {
          type: "object",
          properties: {
            resumo: { type: "string" },
            scores: {
              type: "object",
              properties: {
                clareza_direcao: { type: "number" },
                delegacao: { type: "number" },
                escuta_ativa: { type: "number" },
                feedback_construtivo: { type: "number" },
                desenvolvimento: { type: "number" },
              },
              required: ["clareza_direcao","delegacao","escuta_ativa","feedback_construtivo","desenvolvimento"],
            },
            pontos_fortes: { type: "array", items: { type: "string" } },
            sugestao_melhoria: { type: "string" },
            acoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  responsavel: { type: "string" },
                  descricao: { type: "string" },
                  prazo: { type: ["string","null"] },
                },
                required: ["responsavel","descricao"],
              },
            },
          },
          required: ["resumo","scores","pontos_fortes","sugestao_melhoria","acoes"],
        },
      }],
      tool_choice: { type: "tool", name: "registrar_analise_gestao" },
    });

    if (!claude.ok || !claude.toolInput) {
      await admin.from("reunioes_gestao")
        .update({ status_analise: "erro" }).eq("id", reuniao_gestao_id);
      await logAiUsage({
        admin, agente_tipo: "analise_reuniao_gestao", user_id: userId,
        consultor_id: reuniao.diretor_id, status: "error",
        error_message: claude.errorMessage ?? "sem toolInput",
      });
      return new Response(JSON.stringify({ error: claude.errorMessage ?? "Falha IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAiUsage({
      admin, agente_tipo: "analise_reuniao_gestao", user_id: userId,
      consultor_id: reuniao.diretor_id, usage: claude.usage,
    });

    const out = claude.toolInput as any;
    await admin.from("reunioes_gestao").update({
      resumo_ia: out.resumo ?? "",
      analise_ia: out,
      status_analise: "concluido",
    }).eq("id", reuniao_gestao_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[analisar-reuniao-gestao]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});