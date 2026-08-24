import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await service
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const tipoAgente = (body?.tipo_agente ?? "").toString().trim();
    if (!tipoAgente) return json({ error: "tipo_agente é obrigatório" }, 400);

    const { data: feedbacks } = await service
      .from("agente_feedbacks")
      .select("id, nota, marcadores, comentario, created_at")
      .eq("tipo_agente", tipoAgente)
      .is("consolidado_em", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!feedbacks?.length) {
      return json({ error: "Não há feedbacks novos para consolidar neste agente." }, 422);
    }

    const { data: diretrizesAtuais } = await service
      .from("agente_diretrizes")
      .select("conteudo")
      .eq("tipo_agente", tipoAgente)
      .eq("status", "ativa");

    const resumoFeedbacks = feedbacks
      .map((f: any) => `- Nota ${f.nota}/5${f.marcadores?.length ? ` | marcadores: ${f.marcadores.join(", ")}` : ""}${f.comentario ? ` | comentário: ${f.comentario}` : ""}`)
      .join("\n");

    const atuais = (diretrizesAtuais ?? []).map((d: any, i: number) => `${i + 1}. ${d.conteudo}`).join("\n") || "(nenhuma)";

    const resposta = await callClaude({
      system:
        "Você melhora prompts de agentes de IA de uma consultoria. A partir dos feedbacks dos consultores, escreva diretrizes objetivas, acionáveis e curtas que o agente deve seguir nas próximas gerações. Nunca cite clientes específicos. Não repita diretrizes já ativas — proponha apenas o que é novo ou uma versão melhorada. Responda APENAS com uma lista markdown de no máximo 8 itens, uma diretriz por linha, começando com '- '.",
      messages: [{
        role: "user",
        content: `Agente: ${tipoAgente}\n\nDiretrizes já ativas:\n${atuais}\n\nFeedbacks recentes (${feedbacks.length}):\n${resumoFeedbacks}`,
      }],
      max_tokens: 1500,
      temperature: 0.3,
    });

    if (!resposta.ok) return json({ error: resposta.errorMessage ?? "Erro na IA" }, resposta.status);

    const linhas = (resposta.text ?? "")
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.]+\s*/, "").trim())
      .filter((l) => l.length > 10)
      .slice(0, 8);

    if (!linhas.length) return json({ error: "A IA não retornou diretrizes utilizáveis." }, 422);

    const { data: maxVersao } = await service
      .from("agente_diretrizes")
      .select("versao")
      .eq("tipo_agente", tipoAgente)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versao = (maxVersao?.versao ?? 0) + 1;

    const { data: inseridas, error: insErr } = await service
      .from("agente_diretrizes")
      .insert(linhas.map((conteudo) => ({
        tipo_agente: tipoAgente,
        conteudo,
        status: "rascunho",
        versao,
        origem: "ia",
        feedbacks_considerados: feedbacks.length,
      })))
      .select();
    if (insErr) throw insErr;

    await service
      .from("agente_feedbacks")
      .update({ consolidado_em: new Date().toISOString() })
      .in("id", feedbacks.map((f: any) => f.id));

    return json({ ok: true, diretrizes: inseridas, feedbacks_considerados: feedbacks.length });
  } catch (e) {
    console.error("consolidar-feedback-agentes error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
