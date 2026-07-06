// Edge Function: gerar-analise-cruzamento-disc
// Recebe { diretor_id, consultor_id } — gera análise da dinâmica DISC
// entre um diretor e uma consultora, e faz upsert em cruzamentos_disc.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { diretor_id, consultor_id } = await req.json();
    if (!diretor_id || !consultor_id) {
      return new Response(JSON.stringify({ error: "diretor_id e consultor_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: perfis } = await admin
      .from("perfis_comportamentais")
      .select("consultor_id, perfil_resumo, consultores(nome)")
      .in("consultor_id", [diretor_id, consultor_id]);

    const dir = (perfis ?? []).find((p: any) => p.consultor_id === diretor_id);
    const con = (perfis ?? []).find((p: any) => p.consultor_id === consultor_id);
    if (!dir || !con) {
      return new Response(JSON.stringify({ error: "Perfil DISC ausente para diretor ou consultora" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claude = await callClaude({
      system: "Você é um analista de dinâmica interpessoal aplicada a liderança, com forte base em DISC. Seja específico, prático e evite generalidades.",
      messages: [{
        role: "user",
        content: `Você recebeu os perfis DISC de um diretor e de uma consultora que ele gerencia. Analise o cruzamento.\n\nDIRETOR (${(dir as any).consultores?.nome ?? "-"}):\n${JSON.stringify((dir as any).perfil_resumo, null, 2)}\n\nCONSULTORA (${(con as any).consultores?.nome ?? "-"}):\n${JSON.stringify((con as any).perfil_resumo, null, 2)}`,
      }],
      max_tokens: 2200,
      tools: [{
        name: "registrar_cruzamento_disc",
        description: "Registra análise de dinâmica DISC diretor x consultora",
        input_schema: {
          type: "object",
          properties: {
            compatibilidade_geral: { type: "string" },
            pontos_de_sinergia: { type: "array", items: { type: "string" } },
            pontos_de_tensao: { type: "array", items: { type: "string" } },
            recomendacoes_comunicacao: { type: "array", items: { type: "string" } },
            recomendacoes_delegacao: { type: "array", items: { type: "string" } },
            sinais_de_alerta: { type: "array", items: { type: "string" } },
            como_dar_feedback: { type: "string" },
          },
          required: [
            "compatibilidade_geral","pontos_de_sinergia","pontos_de_tensao",
            "recomendacoes_comunicacao","recomendacoes_delegacao",
            "sinais_de_alerta","como_dar_feedback",
          ],
        },
      }],
      tool_choice: { type: "tool", name: "registrar_cruzamento_disc" },
    });

    if (!claude.ok || !claude.toolInput) {
      await logAiUsage({
        admin, agente_tipo: "cruzamento_disc", consultor_id,
        status: "error", error_message: claude.errorMessage,
      });
      throw new Error(claude.errorMessage ?? "Falha IA");
    }
    await logAiUsage({
      admin, agente_tipo: "cruzamento_disc", consultor_id, usage: claude.usage,
    });

    const analise = claude.toolInput as any;
    const { error: upErr } = await admin
      .from("cruzamentos_disc")
      .upsert({ diretor_id, consultor_id, analise, gerado_em: new Date().toISOString() },
              { onConflict: "diretor_id,consultor_id" });
    if (upErr) throw new Error(`Falha ao salvar cruzamento: ${upErr.message}`);

    return new Response(JSON.stringify({ ok: true, analise }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[gerar-analise-cruzamento-disc]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});