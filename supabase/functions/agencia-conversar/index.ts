// Conversa com os agentes da unidade Agência.
// Usa o gateway de IA da Lovable (chave única das duas unidades) e grava
// sessão, mensagens e consumo etiquetado por unidade/agente/cliente/pessoa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELO = "openai/gpt-6-astra";
const novoId = () => crypto.randomUUID();

interface Corpo {
  agente_slug?: string;
  sessao_id?: string | null;
  cliente_id?: string | null;
  mensagem?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "A chave de IA não está configurada." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const ag = createClient(supabaseUrl, serviceKey, { db: { schema: "agencia" } });

    // Só quem tem ficha ativa na agência conversa com os agentes dela.
    const { data: pessoa } = await ag
      .from("pessoas").select("id, nome, ativa").eq("auth_id", user.id).maybeSingle();
    if (!pessoa || pessoa.ativa === false) return json({ error: "Você não tem acesso à Agência." }, 403);

    const body = (await req.json().catch(() => ({}))) as Corpo;
    const slug = (body.agente_slug ?? "").trim();
    const pergunta = (body.mensagem ?? "").trim();
    if (!slug) return json({ error: "Informe o agente." }, 400);
    if (!pergunta) return json({ error: "Escreva uma mensagem." }, 400);
    if (pergunta.length > 20000) return json({ error: "Mensagem muito longa." }, 400);

    const { data: agente } = await ag
      .from("agentes").select("id, slug, nome, resumo, descricao, espaco_id").eq("slug", slug).maybeSingle();
    if (!agente) return json({ error: "Agente não encontrado." }, 404);

    // Sessão: reaproveita a informada ou cria uma nova.
    let sessaoId = body.sessao_id?.trim() || null;
    const clienteId = body.cliente_id?.trim() || null;
    if (!sessaoId) {
      sessaoId = novoId();
      const { error: sErr } = await ag.from("sessoes").insert({
        id: sessaoId,
        agente_id: agente.id,
        pessoa_id: pessoa.id,
        espaco_id: agente.espaco_id ?? null,
        cliente_id: clienteId,
        titulo: pergunta.slice(0, 80),
        atualizada_em: new Date().toISOString(),
      });
      if (sErr) throw sErr;
    }

    // Histórico da sessão (últimas 30 mensagens).
    const { data: historico } = await ag
      .from("mensagens").select("papel, conteudo").eq("sessao_id", sessaoId)
      .order("criada_em", { ascending: true }).limit(30);

    // Contexto do cliente, quando a conversa é por conta.
    let contextoCliente = "";
    if (clienteId) {
      const { data: cli } = await ag
        .from("clientes")
        .select("nome, resumo, setor_descricao, publico_alvo, tom_de_voz, posicionamento, diferenciais, palavras_chave")
        .eq("id", clienteId).maybeSingle();
      if (cli) {
        contextoCliente = `\n\nCONTA ATENDIDA:\n${Object.entries(cli)
          .filter(([, v]) => v)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`;
      }
    }

    const system = [
      `Você é ${agente.nome}, um agente da agência de marketing da CUPOLA.`,
      agente.resumo ? `Resumo: ${agente.resumo}` : "",
      agente.descricao ?? "",
      "Responda em português do Brasil, de forma direta e aplicável. Nunca invente dados do cliente.",
      contextoCliente,
    ].filter(Boolean).join("\n\n");

    const input = [
      ...(historico ?? []).map((m: { papel: string; conteudo: string }) => ({
        role: m.papel === "assistente" || m.papel === "assistant" ? "assistant" : "user",
        content: [{
          type: m.papel === "assistente" || m.papel === "assistant" ? "output_text" : "input_text",
          text: m.conteudo,
        }],
      })),
      { role: "user", content: [{ type: "input_text", text: pergunta }] },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODELO,
        instructions: system,
        input,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      console.error("[agencia-conversar] gateway", res.status, txt.slice(0, 500));
      await logAiUsage({
        admin, provider: "lovable", model: MODELO, agente_tipo: agente.slug, unidade: "agencia",
        agente_slug: agente.slug, agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
        sessao_id: sessaoId, user_id: user.id, status: "error", error_message: `status ${res.status}`,
      });
      if (res.status === 429) return json({ error: "Muitas chamadas de IA agora. Tente em alguns minutos." }, 429);
      if (res.status === 402) return json({ error: "Os créditos de IA do workspace acabaram." }, 402);
      return json({ error: "A IA não respondeu agora." }, res.status || 500);
    }

    // Consome o stream no servidor: a resposta volta inteira para a tela.
    let texto = "";
    let usage: { input_tokens?: number; output_tokens?: number } = {};
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split("\n");
      buffer = linhas.pop() ?? "";
      for (const linha of linhas) {
        if (!linha.startsWith("data:")) continue;
        const bruto = linha.slice(5).trim();
        if (!bruto || bruto === "[DONE]") continue;
        try {
          const ev = JSON.parse(bruto);
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") texto += ev.delta;
          if (ev.type === "response.completed" && ev.response?.usage) {
            usage = {
              input_tokens: ev.response.usage.input_tokens,
              output_tokens: ev.response.usage.output_tokens,
            };
          }
        } catch (_) { /* evento parcial */ }
      }
    }

    const agora = new Date().toISOString();
    await ag.from("mensagens").insert([
      { id: novoId(), sessao_id: sessaoId, papel: "pessoa", conteudo: pergunta, criada_em: agora },
      { id: novoId(), sessao_id: sessaoId, papel: "assistente", conteudo: texto, criada_em: new Date(Date.now() + 1).toISOString() },
    ]);
    await ag.from("sessoes").update({ atualizada_em: agora }).eq("id", sessaoId);

    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: agente.slug, unidade: "agencia",
      agente_slug: agente.slug, agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
      sessao_id: sessaoId, user_id: user.id, usage, status: "success",
    });

    return json({ ok: true, sessao_id: sessaoId, resposta: texto });
  } catch (e) {
    console.error("agencia-conversar error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});
