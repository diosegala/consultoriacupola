// Etapa 10 do blog, opcional: refinar com o prompt reverso.
// Isolada de propósito: só este arquivo lê as regras do refino.
// Grava a proposta em texto_refinado; só vira texto_revisado quando alguém clica em "Usar".
import { logAiUsage } from "../_shared/ai-usage.ts";
import { contextoAgencia, corsHeaders, exigirCliente, json, respostaDeErro } from "../_shared/agencia.ts";
import { MARCA_DA_VALIDACAO } from "../_shared/blog-regras.ts";
import { PAPEL, REGRAS_ADICIONAIS_DO_REFINO, REGRAS_DO_REFINO } from "./regras.ts";

const MODELO = "openai/gpt-6-astra";

function separarValidacao(bruto: string) {
  const corte = bruto.indexOf(MARCA_DA_VALIDACAO);
  if (corte < 0) return { texto: bruto.trim(), validar: [] as { ponto: string; motivo: string }[] };
  const validar = bruto.slice(corte + MARCA_DA_VALIDACAO.length).split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean)
    .map((l) => {
      const b = l.indexOf("|");
      return b < 0 ? { ponto: l, motivo: "" } : { ponto: l.slice(0, b).trim(), motivo: l.slice(b + 1).trim() };
    });
  return { texto: bruto.slice(0, corte).trim(), validar };
}

function titulos(texto: string): string[] {
  return texto.split("\n").map((l) => /^(#{2,3})\s+(.+?)\s*$/.exec(l)).filter(Boolean)
    .map((m) => `${m![1]} ${m![2].replace(/\*\*/g, "").trim().toLowerCase()}`);
}

/** Chama o gateway em streaming e junta o texto final. */
async function perguntar(chave: string, sistema: string, pedido: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": chave, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODELO, instructions: sistema, stream: true, store: false,
      reasoning: { effort: "medium" },
      input: [{ role: "user", content: [{ type: "input_text", text: pedido }] }],
    }),
  });
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    console.error("[agencia-blog-refino] gateway", res.status, txt.slice(0, 600));
    const erro = res.status === 429 ? "Muitas chamadas de IA agora. Tente em alguns minutos."
      : res.status === 402 ? "Os créditos de IA do workspace acabaram." : "A IA não respondeu agora.";
    return { ok: false as const, status: res.status || 500, erro };
  }
  const leitor = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", texto = "";
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const linha = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!linha.startsWith("data:")) continue;
      const d = linha.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") texto += ev.delta ?? "";
        if (ev.type === "response.completed") usage = ev.response?.usage;
        if (ev.type === "response.failed" || ev.type === "error") {
          return { ok: false as const, status: 502, erro: "A IA interrompeu o refino." };
        }
      } catch { /* linha parcial */ }
    }
  }
  return { ok: true as const, texto, usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const chave = Deno.env.get("LOVABLE_API_KEY");
    if (!chave) return json({ error: "A chave de IA não está configurada." }, 500);

    // Fala com o banco como a pessoa: as regras (RLS) do schema agencia valem aqui também.
    const { user, pessoa, db: ag, admin } = await contextoAgencia(req);

    const body = await req.json().catch(() => ({})) as { post_id?: string };
    const postId = String(body.post_id ?? "").trim();
    if (!postId || postId.length > 100) return json({ error: "Informe o post." }, 400);
    const { data: post } = await ag.from("blog_posts").select("*").eq("id", postId).maybeSingle();
    if (!post) return json({ error: "Post não encontrado." }, 404);
    await exigirCliente(ag, post.cliente_id);

    const texto = String(post.texto_revisado ?? "").trim();
    if (!texto) return json({ error: "O texto final ainda está vazio: preencha a revisão antes de refinar." }, 400);
    if (texto.length > 120_000) return json({ error: "O texto passa de 120 mil caracteres. Reduza antes de refinar." }, 400);

    const sistema = `${PAPEL}\n\n# REGRAS\n\n${REGRAS_DO_REFINO}\n\n${REGRAS_ADICIONAIS_DO_REFINO}`;
    const pedido = [
      `# BRIEFING\nPalavra-chave principal: ${post.palavra_chave || "(não informada)"}\nEtapa do funil: ${post.etapa || "(não informada)"}\nLink do CTA: nenhum além dos que já estão no texto — não invente link`,
      `# DADOS E FONTES FORNECIDOS — os únicos dados e links que podem aparecer\n${String(post.fontes ?? "").trim() || "(nenhum)"}`,
      `# ARTIGO A REFINAR\n${texto}`,
      "# TAREFA\nReescreva o artigo acima aplicando as REGRAS e as REGRAS ADICIONAIS. Preserve a estrutura aprovada (os mesmos H2 e H3, na mesma ordem), os dados, as fontes e os links que já estão no texto. Não acrescente conteúdo que não esteja no artigo ou nos DADOS E FONTES. Devolva o artigo em Markdown e, se houver, os pontos a conferir depois da marca.",
    ].join("\n\n");

    const r = await perguntar(chave, sistema, pedido);
    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: "blog-refino", unidade: "agencia",
      agente_slug: "criador-de-post-news", agencia_cliente_id: post.cliente_id, agencia_pessoa_id: pessoa.id,
      user_id: user.id, status: r.ok ? "success" : "error", error_message: r.ok ? undefined : r.erro,
      usage: r.ok ? { input_tokens: r.usage?.input_tokens, output_tokens: r.usage?.output_tokens } : undefined,
    });
    if (!r.ok) return json({ error: r.erro }, r.status);

    const { texto: bruto, validar } = separarValidacao(r.texto.trim());
    const refinado = bruto.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/, "").trim();
    if (!refinado) return json({ error: "A IA não devolveu texto no refino. Tente de novo." }, 502);
    const aviso = JSON.stringify(titulos(texto)) !== JSON.stringify(titulos(refinado))
      ? "O refino mudou os títulos (H2/H3) da estrutura aprovada. Confira antes de usar." : undefined;

    const { error: upErr } = await ag.from("blog_posts").update({
      texto_refinado: refinado, atualizado_em: new Date().toISOString(), atualizado_por: pessoa.id,
      passo_atual: Math.max(Number(post.passo_atual ?? 0), 10),
    }).eq("id", postId);
    if (upErr) throw upErr;

    return json({ ok: true, texto: refinado, aviso, conferir: validar });
  } catch (e) {
    return respostaDeErro("agencia-blog-refino", e);
  }
});
