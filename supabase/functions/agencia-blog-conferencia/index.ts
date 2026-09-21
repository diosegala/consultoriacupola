// Conferência de fatos do post da Agência.
// A parte mecânica roda no navegador (src/lib/agencia/blogConferencia.ts).
// Aqui é a leitura: o que o texto afirma e o material não sustenta.
// Prompt copiado do CupolaOS (servidor/blog-conferencia.ts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELO = "openai/gpt-6-astra";
const TETO_DO_MATERIAL = 300_000;

const CAMPOS_DA_FICHA: [string, string][] = [
  ["resumo", "Contexto"],
  ["setor_descricao", "Setor"],
  ["publico_alvo", "Público-alvo"],
  ["tom_de_voz", "Tom de voz"],
  ["produtos_servicos", "Produtos e serviços"],
  ["posicionamento", "Posicionamento"],
  ["diferenciais", "Diferenciais"],
  ["concorrencia", "Concorrência"],
  ["palavras_chave", "Palavras-chave"],
  ["cidade", "Cidade"],
];

const SISTEMA = `Você confere se um texto se sustenta no material que foi fornecido para escrevê-lo.

Vai receber dois blocos: o MATERIAL (tudo que o redator forneceu) e o TEXTO (o que a IA escreveu).

## Sua tarefa

Aponte as afirmações do TEXTO que o MATERIAL não sustenta. Interessam especialmente:

- características de bairros, cidades ou regiões;
- características de produtos, serviços ou empreendimentos;
- diferenciais e benefícios;
- números, datas, fontes, preços, prazos;
- informações institucionais sobre a empresa;
- relações de causa e efeito apresentadas como certas;
- promessas ou resultados.

## O que NÃO apontar

- Ligação, transição e organização do texto.
- Explicação de um conceito geral que não afirma nada sobre o cliente, o produto ou o lugar.
- Reformulação do que o material já diz, mesmo com outras palavras.
- Possibilidade escrita como possibilidade ("pode contribuir para", "costuma ser").

Uma afirmação está sustentada se o material a diz, mesmo com outras palavras. Na dúvida entre apontar e não apontar, **aponte** — quem lê decide, e apontar de mais custa dez segundos enquanto deixar passar vira publicação com informação falsa.

## A resposta

Só um array JSON. Cada item é um objeto com "trecho" (as palavras exatas do TEXTO, curtas — no máximo quinze) e "porque" (uma frase curta dizendo o que falta no material). Nada antes, nada depois, sem markdown.

Se tudo estiver sustentado, responda [].`;

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["afirmacoes"],
  properties: {
    afirmacoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["trecho", "porque"],
        properties: { trecho: { type: "string" }, porque: { type: "string" } },
      },
    },
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

    const { data: pessoa } = await ag.from("pessoas").select("id, ativa").eq("auth_id", user.id).maybeSingle();
    if (!pessoa || pessoa.ativa === false) return json({ error: "Você não tem acesso à Agência." }, 403);

    const body = (await req.json().catch(() => ({}))) as { post_id?: string };
    const postId = (body.post_id ?? "").trim();
    if (!postId) return json({ error: "Informe o post." }, 400);

    const { data: post } = await ag.from("blog_posts").select("*").eq("id", postId).maybeSingle();
    if (!post) return json({ error: "Post não encontrado." }, 404);

    const { data: conta } = await ag
      .from("clientes")
      .select("id, nome, resumo, setor_descricao, publico_alvo, tom_de_voz, produtos_servicos, posicionamento, diferenciais, concorrencia, palavras_chave, cidade")
      .eq("id", post.cliente_id)
      .maybeSingle();
    if (!conta) return json({ error: "Conta não encontrada." }, 404);

    const { data: ajustes } = await ag
      .from("blog_ajustes").select("panorama").eq("cliente_id", post.cliente_id).maybeSingle();

    const { data: anexos } = await ag
      .from("cliente_conhecimento").select("nome, texto")
      .eq("cliente_id", post.cliente_id).order("enviado_em", { ascending: false }).limit(20);

    const panorama = Array.isArray(ajustes?.panorama)
      ? (ajustes!.panorama as { nome?: string; texto?: string }[])
        .filter((p) => String(p?.texto ?? "").trim())
        .map((p) => `--- ${p.nome ?? "panorama"} ---\n${p.texto}`)
      : [];

    const material = [
      `# PERFIL DO CLIENTE\nCliente: ${conta.nome}`,
      CAMPOS_DA_FICHA
        .map(([id, rotulo]) => [rotulo, String((conta as Record<string, unknown>)[id] ?? "").trim()])
        .filter(([, v]) => v)
        .map(([r, v]) => `${r}: ${v}`)
        .join("\n"),
      ...(panorama.length ? [`# PANORAMA DA CONTA\n${panorama.join("\n\n")}`] : []),
      ...((anexos ?? []).filter((a: { texto?: string | null }) => (a.texto ?? "").trim().length > 40).length
        ? [`# ANEXOS\n${(anexos ?? []).map((a: { nome: string; texto: string }) => `--- ${a.nome} ---\n${a.texto}`).join("\n\n")}`]
        : []),
      `# BRIEFING\nTema: ${post.tema ?? ""}\nObjetivo: ${post.objetivo ?? ""}\nInformações obrigatórias: ${post.obrigatorias ?? ""}`,
      `# DADOS E FONTES\n${post.fontes ?? "(sem dados/fontes)"}`,
    ].filter(Boolean).join("\n\n").slice(0, TETO_DO_MATERIAL);

    const faq = Array.isArray(post.faq)
      ? (post.faq as { pergunta?: string; resposta?: string }[])
        .map((p) => `### ${p.pergunta ?? ""}\n${p.resposta ?? ""}`).join("\n\n")
      : "";

    const texto = [post.introducao, post.desenvolvimento, faq, post.encerramento]
      .map((t) => String(t ?? "").trim()).filter(Boolean).join("\n\n");

    if (!texto) return json({ error: "Escreva o texto antes de conferir." }, 400);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODELO,
        instructions: SISTEMA,
        input: [{
          role: "user",
          content: [{ type: "input_text", text: `# MATERIAL FORNECIDO\n\n${material || "(vazio)"}\n\n# TEXTO ESCRITO\n\n${texto}` }],
        }],
        store: false,
        reasoning: { effort: "medium" },
        text: { format: { type: "json_schema", name: "conferencia", strict: true, schema: ESQUEMA } },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[agencia-blog-conferencia] gateway", res.status, t.slice(0, 600));
      await logAiUsage({
        admin, provider: "lovable", model: MODELO, agente_tipo: "blog-conferencia", unidade: "agencia",
        agente_slug: "criador-de-post-news", agencia_cliente_id: post.cliente_id, agencia_pessoa_id: pessoa.id,
        user_id: user.id, status: "error", error_message: `gateway ${res.status}`,
      });
      if (res.status === 429) return json({ error: "Muitas chamadas de IA agora. Tente em alguns minutos." }, 429);
      if (res.status === 402) return json({ error: "Os créditos de IA do workspace acabaram." }, 402);
      return json({ error: "A IA não respondeu agora." }, res.status || 500);
    }

    const data = await res.json();
    const bruto: string = data.output_text
      ?? (data.output ?? [])
        .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
        .map((c: { text?: string }) => c.text ?? "").join("");

    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: "blog-conferencia", unidade: "agencia",
      agente_slug: "criador-de-post-news", agencia_cliente_id: post.cliente_id, agencia_pessoa_id: pessoa.id,
      user_id: user.id, status: "success",
      usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens },
    });

    let afirmacoes: { trecho: string; porque: string }[] = [];
    try {
      const lido = JSON.parse(bruto) as { afirmacoes?: unknown };
      afirmacoes = (Array.isArray(lido.afirmacoes) ? lido.afirmacoes : [])
        .map((x) => {
          const o = (x ?? {}) as { trecho?: unknown; porque?: unknown };
          return { trecho: String(o.trecho ?? "").trim(), porque: String(o.porque ?? "").trim() };
        })
        .filter((a) => a.trecho);
    } catch {
      // Conferência que falha não pode virar "está tudo certo".
      console.error("[agencia-blog-conferencia] formato:", String(bruto).slice(0, 400));
      return json({ error: "A conferência voltou num formato que não consegui ler." }, 502);
    }

    return json({ ok: true, afirmacoes, material });
  } catch (e) {
    console.error("agencia-blog-conferencia error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});
