// Recado falado vira registro escrito na conta da Agência.
// O áudio é ouvido, o texto é gravado como material da conta e o áudio some —
// nada de gravação de conversa com cliente guardada em lugar nenhum.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELO = "openai/gpt-6-astra";
const MODELOS_ESCUTA = ["google/gemini-3.5-transcribe", "openai/gpt-4o-mini-transcribe"];
/** 14 MB: o teto de uma escuta. Acima disso, gravar em pedaços. */
const TETO_DO_AUDIO = 14 * 1024 * 1024;

const ACEITOS = new Set([
  "audio/webm", "audio/ogg", "audio/wav", "audio/mp3", "audio/mpeg",
  "audio/m4a", "audio/aac", "audio/flac", "audio/aiff", "audio/opus",
]);

function tipoAceito(bruto: string): string | null {
  const limpo = (bruto || "").split(";")[0].trim().toLowerCase();
  if (ACEITOS.has(limpo)) return limpo;
  if (limpo === "audio/mp4" || limpo === "audio/x-m4a") return "audio/m4a";
  if (limpo === "audio/vorbis") return "audio/ogg";
  if (limpo === "audio/x-wav" || limpo === "audio/wave") return "audio/wav";
  return null;
}

const EXTENSAO: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp3": "mp3",
  "audio/mpeg": "mp3", "audio/m4a": "m4a", "audio/aac": "aac", "audio/flac": "flac",
  "audio/aiff": "aiff", "audio/opus": "opus",
};

function sistema(): string {
  return [
    "Você lê o que alguém do atendimento de uma agência de marketing falou sobre uma conta de cliente.",
    "Essa pessoa acabou de sair de uma reunião, ou de desligar o telefone, e está contando o que ficou.",
    "",
    "REGRA QUE VALE MAIS QUE TODAS: só entra o que foi dito.",
    "Não complete, não deduza, não suavize, não conclua e não organize em conclusões que ninguém tirou.",
    "Este texto vira o contexto que a IA lê antes de escrever no nome do cliente — o que você inventar aqui",
    "passa a valer como fato sobre uma empresa real, e ninguém vai conferir.",
    "",
    "O que fazer com a fala:",
    "- Tire o 'é...', o 'então, ó', a repetição e a frase abandonada no meio. Isso é ruído da fala, não conteúdo.",
    "- Mantenha nome de gente, número, prazo, valor e data exatamente como foram ditos.",
    "- Onde a fala for uma regra, mantenha a palavra literal: 'não falar em valorização' fica assim,",
    "  e não vira 'evitar promessas de retorno' — a palavra é que vai ser procurada depois.",
    "- Mais de um assunto vira tópicos curtos, um por linha, começando com '- '. Um assunto só vira texto corrido.",
    "- Ordem, proibição ou exigência vira uma linha própria começando com 'Regra: '.",
    "- Combinado com prazo ou responsável vira uma linha própria começando com 'Combinado: '.",
    "- O que estiver inaudível vira '[não entendi]' no lugar exato. Não chute a palavra que faltou.",
    "",
    "Não escreva introdução nem fecho. Nada de 'Neste áudio, o interlocutor relata…'.",
    "Comece pelo conteúdo e termine quando ele acabar.",
    "",
    "O `titulo` tem até 60 caracteres e diz de que é o registro, não o que ele conclui.",
    "Bom: 'Reunião com a Lago — lançamentos e regra do jurídico'. Ruim: 'Resumo de áudio'.",
    "",
    "Se a fala não disser nada de aproveitável, devolva `titulo` e `texto` vazios.",
  ].join("\n");
}

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "texto"],
  properties: {
    titulo: { type: "string" },
    texto: { type: "string" },
  },
};

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

    const { data: pessoa } = await ag.from("pessoas").select("id, nome, ativa").eq("auth_id", user.id).maybeSingle();
    if (!pessoa || pessoa.ativa === false) return json({ error: "Você não tem acesso à Agência." }, 403);

    const body = (await req.json().catch(() => ({}))) as {
      cliente_id?: string;
      mime?: string;
      base64?: string;
    };
    const clienteId = (body.cliente_id ?? "").trim();
    if (!clienteId) return json({ error: "Informe a conta." }, 400);

    const mime = tipoAceito(body.mime ?? "");
    if (!mime) return json({ error: `Não sei ouvir um arquivo do tipo "${body.mime}".` }, 400);
    const base64 = (body.base64 ?? "").trim();
    if (!base64) return json({ error: "O áudio chegou vazio." }, 400);

    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes > TETO_DO_AUDIO) {
      return json(
        { error: `O áudio tem ${(bytes / 1024 / 1024).toFixed(1)} MB e o limite de uma escuta é 14 MB. Grave em pedaços.` },
        413,
      );
    }

    const { data: conta } = await ag.from("clientes").select("id, nome").eq("id", clienteId).maybeSingle();
    if (!conta) return json({ error: "Conta não encontrada." }, 404);

    // ---------- 1. ouvir ----------
    const binario = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    let transcricao = "";
    let ultimoErro = "";

    for (const modelo of MODELOS_ESCUTA) {
      const fd = new FormData();
      fd.append("file", new Blob([binario], { type: mime }), `recado.${EXTENSAO[mime] ?? "webm"}`);
      fd.append("model", modelo);
      fd.append("language", "pt");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        transcricao = String(data.text ?? "").trim();
        if (transcricao) break;
        ultimoErro = "a escuta não devolveu texto";
        continue;
      }
      const corpo = await res.text();
      console.error(`[agencia-audio] escuta ${modelo} falhou [${res.status}]: ${corpo.slice(0, 300)}`);
      ultimoErro = `status ${res.status}`;
      if (res.status === 402) return json({ error: "Os créditos de IA do workspace acabaram." }, 402);
    }

    if (!transcricao) {
      await logAiUsage({
        admin, provider: "lovable", model: MODELOS_ESCUTA[0], agente_tipo: "audio", unidade: "agencia",
        agente_slug: "audio", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
        user_id: user.id, status: "error", error_message: ultimoErro,
      });
      return json({ error: "Não consegui ouvir esse áudio. Tente gravar de novo." }, 502);
    }

    // ---------- 2. transformar a fala em registro ----------
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODELO,
        store: false,
        reasoning: { effort: "low" },
        instructions: sistema(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `O áudio é sobre a conta ${conta.nome}. Faça o registro do que foi falado.\n\n--- FALA ---\n${transcricao}`,
              },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "registro", strict: true, schema: ESQUEMA } },
      }),
    });

    if (!res.ok) {
      const corpo = await res.text();
      console.error(`[agencia-audio] registro falhou [${res.status}]: ${corpo.slice(0, 400)}`);
      await logAiUsage({
        admin, provider: "lovable", model: MODELO, agente_tipo: "audio", unidade: "agencia",
        agente_slug: "audio", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
        user_id: user.id, status: "error", error_message: `status ${res.status}`,
      });
      if (res.status === 429) return json({ error: "Muitas chamadas de IA agora. Tente em alguns minutos." }, 429);
      if (res.status === 402) return json({ error: "Os créditos de IA do workspace acabaram." }, 402);
      return json({ error: "A IA não respondeu agora." }, res.status || 500);
    }

    const data = await res.json();
    const saida: string = data.output_text
      ?? (data.output ?? [])
        .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
        .map((c: { text?: string }) => c.text ?? "")
        .join("");

    let lido: { titulo?: string; texto?: string } = {};
    try {
      lido = JSON.parse(saida);
    } catch {
      console.error("[agencia-audio] resposta fora do formato:", String(saida).slice(0, 400));
      return json({ error: "A IA não devolveu o registro no formato esperado." }, 502);
    }

    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: "audio", unidade: "agencia",
      agente_slug: "audio", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
      user_id: user.id, status: "success",
      usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens },
    });

    const texto = (lido.texto ?? "").trim();
    if (!texto) {
      return json({ ok: true, vazio: true, transcricao });
    }

    const titulo = ((lido.titulo ?? "").trim() || `Recado de ${pessoa.nome}`).slice(0, 80);
    const id = crypto.randomUUID();
    const { error } = await ag.from("cliente_conhecimento").insert({
      id,
      cliente_id: clienteId,
      nome: titulo,
      origem: "texto",
      texto,
      enviado_por: pessoa.id,
      enviado_em: new Date().toISOString(),
    });
    if (error) throw error;

    return json({ ok: true, id, titulo, texto });
  } catch (e) {
    console.error("agencia-audio error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});
