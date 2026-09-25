// Agente de blog da Agência — os seis passos em que a IA escreve.
// Regras editoriais vieram inteiras do CupolaOS (_shared/blog-regras.ts);
// a IA roda pela chave única do gateway, como o resto da casa.
import { logAiUsage } from "../_shared/ai-usage.ts";
import { contextoAgencia, corsHeaders, json, respostaDeErro } from "../_shared/agencia.ts";
import {
  ARQUITETURA_DA_INFORMACAO,
  ARQUITETURA_DE_CONTEUDO,
  ESTILO_EDITORIAL,
  MARCA_DA_VALIDACAO,
  MARCA_E_ESCOPO,
  ORDEM_DAS_PRIORIDADES,
  ORIGEM_DE_CADA_AFIRMACAO,
  PONTOS_PARA_VALIDACAO,
  PRECISAO_TECNICA,
  PROMESSAS_E_SUPERLATIVOS,
  REGRAS_DE_INTRODUCAO,
  SISTEMA_COMPARTILHADO,
  SO_O_QUE_FOI_FORNECIDO,
} from "../_shared/blog-regras.ts";

const MODELO = "openai/gpt-6-astra";
const VAZIO = "(vazio)";

const TETO_POR_PECA = 120_000;
const TETO_DO_MATERIAL = 300_000;
const TETO_DAS_AMOSTRAS = 40_000;

type Passo = "estrutura" | "introducao" | "desenvolvimento" | "faq" | "encerramento" | "seo";
const PASSOS: Passo[] = ["estrutura", "introducao", "desenvolvimento", "faq", "encerramento", "seo"];
const EM_JSON: Passo[] = ["estrutura", "faq", "seo"];
const ACEITAM_PENDENCIAS: Passo[] = ["introducao", "desenvolvimento", "encerramento"];

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

interface Doc { nome: string; texto: string }

interface Contexto {
  nome: string;
  campos: { rotulo: string; valor: string }[];
  anexos: Doc[];
  panorama: Doc[];
  amostras: Doc[];
  estiloDoRedator: string;
  briefing: {
    tema: string; objetivo: string; etapa: string; palavraChave: string;
    secundarias: string; obrigatorias: string; motivo: string; intencao: string;
  };
  h1?: string;
  titulos?: { nivel: number; texto: string }[];
  fontes?: string;
  promptsDeIa?: string;
  introducao?: string;
  desenvolvimento?: string;
}

/** Corta uma lista de documentos contra um orçamento comum, na ordem dada. */
function cortarLista(pecas: Doc[], sobrando: () => number, gastar: (n: number) => void, cortados: string[]): Doc[] {
  const cabem: Doc[] = [];
  for (const peca of pecas) {
    const sobra = sobrando();
    if (sobra <= 0) { cortados.push(peca.nome || "documento sem nome"); continue; }
    const limite = Math.min(TETO_POR_PECA, sobra);
    const texto = peca.texto.length > limite ? peca.texto.slice(0, limite) : peca.texto;
    if (texto.length < peca.texto.length) cortados.push(peca.nome || "documento sem nome");
    gastar(texto.length);
    cabem.push({ nome: peca.nome, texto });
  }
  return cabem;
}

/** O material cabe na janela do modelo — e o que não coube é dito em voz alta. */
function apararMaterial(c: Contexto): { contexto: Contexto; cortados: string[] } {
  const cortados: string[] = [];
  let gasto = 0;
  const sobrando = () => TETO_DO_MATERIAL - gasto;
  const gastar = (n: number) => { gasto += n; };

  // A ordem é a regra: primeiro o que alguém escreveu de propósito, por último o granel.
  const panorama = cortarLista(c.panorama.filter((p) => p.texto.trim()), sobrando, gastar, cortados);
  let gastoEmAmostras = 0;
  const amostras = cortarLista(
    c.amostras,
    () => Math.min(sobrando(), TETO_DAS_AMOSTRAS) - gastoEmAmostras,
    (n) => { gastoEmAmostras += n; gastar(n); },
    cortados,
  );
  const anexos = cortarLista(c.anexos, sobrando, gastar, cortados);

  const estilo = c.estiloDoRedator.length > TETO_POR_PECA ? c.estiloDoRedator.slice(0, TETO_POR_PECA) : c.estiloDoRedator;
  if (estilo.length < c.estiloDoRedator.length) cortados.push("Estilo do redator");

  if (!cortados.length) return { contexto: c, cortados };
  return { contexto: { ...c, panorama, amostras, anexos, estiloDoRedator: estilo }, cortados };
}

/** O bloco de contexto que abre todo passo. O passo 2 recebe versão curta. */
function blocoDeContexto(c: Contexto, curto: boolean): string {
  const perfil = c.campos.filter((x) => x.valor.trim()).map((x) => `${x.rotulo}: ${x.valor.trim()}`).join("\n");
  const anexos = c.anexos.length
    ? c.anexos.map((a) => `--- ${a.nome} ---\n${a.texto}`).join("\n\n")
    : "(sem anexos com texto)";

  const partes = [`# PERFIL DO CLIENTE\nCliente: ${c.nome}\n${perfil || VAZIO}`, `# ANEXOS EXTRAÍDOS\n${anexos}`];

  if (c.panorama.length) {
    partes.push(
      `# PANORAMA DA CONTA (contexto geral da agência, vale para todos os posts)\n${c.panorama
        .map((p) => `--- ${p.nome || "panorama"} ---\n${p.texto.trim()}`)
        .join("\n\n")}`,
    );
  }

  if (!curto) {
    partes.push(
      `# ESTILO DE ESCRITA DO REDATOR (características descritas)\n${c.estiloDoRedator.trim() || "(não descrito)"}`,
      `# AMOSTRAS DE TEXTO DO REDATOR (para capturar e replicar o padrão)\n${
        c.amostras.length ? c.amostras.map((a) => `--- ${a.nome} ---\n${a.texto}`).join("\n\n") : "(sem amostras enviadas)"
      }`,
    );
  }

  const b = c.briefing;
  partes.push([
    "# BRIEFING DESTE POST",
    `- Tema: ${b.tema || VAZIO}`,
    `- Objetivo: ${b.objetivo || VAZIO}`,
    `- Etapa da jornada: ${b.etapa}`,
    `- Palavra-chave principal: ${b.palavraChave || VAZIO}`,
    `- Palavras-chave secundárias: ${b.secundarias || VAZIO}`,
    `- Informações obrigatórias: ${b.obrigatorias || VAZIO}`,
    ...(b.motivo.trim() ? [`- Motivo de produção: ${b.motivo.trim()}`] : []),
    ...(b.intencao.trim() ? [`- Intenção de busca: ${b.intencao.trim()}`] : []),
  ].join("\n"));

  if (!curto) {
    const estrutura = (c.titulos ?? []).map((t) => `${"#".repeat(t.nivel)} ${t.texto}`).join("\n");
    partes.push(
      `# ESTRUTURA DO POST\n${c.h1 ? `# ${c.h1}\n` : ""}${estrutura || "(sem estrutura definida)"}`,
      `# DADOS E FONTES\n${c.fontes?.trim() || "(sem dados/fontes específicos)"}`,
    );
  }

  partes.push(
    `# PROMPTS DE IA (perguntas reais coletadas em ferramentas como ChatGPT/Gemini)\n${
      c.promptsDeIa?.trim() || "(nenhum prompt coletado)"
    }`,
  );

  return partes.join("\n\n");
}

function escritoAteAgora(c: Contexto, comDesenvolvimento: boolean, corte?: number): string {
  const partes: string[] = [];
  if (c.introducao?.trim()) partes.push(`# INTRODUÇÃO JÁ ESCRITA\n${c.introducao.trim()}`);
  if (comDesenvolvimento && c.desenvolvimento?.trim()) {
    const corpo = corte ? c.desenvolvimento.trim().slice(0, corte) : c.desenvolvimento.trim();
    partes.push(`# DESENVOLVIMENTO JÁ ESCRITO\n${corpo}`);
  }
  return partes.join("\n\n");
}

const SISTEMA_ESTRUTURA = [
  ORDEM_DAS_PRIORIDADES,
  SO_O_QUE_FOI_FORNECIDO,
  `Você é um estrategista de conteúdo SEO em português do Brasil, trabalhando para a agência CUPOLA.
Sua tarefa é propor a arquitetura de títulos (H2, H3, H4) de um blogpost otimizado para uma palavra-chave.
Cubra a intenção de busca de forma completa, sem redundâncias. Não escreva o conteúdo, apenas os títulos.

REGRAS EDITORIAIS: o campo 'Objetivo' do briefing é lei — **dentro do que o material fornecido sustenta**. Se o objetivo é valorizar/promover algo, os H2/H3/H4 devem sustentar esse ângulo (benefícios, diferenciais, para quem é indicado, como decidir) usando SOMENTE os benefícios e diferenciais que estão no contexto. Se o material não trouxer diferencial nenhum, proponha menos títulos — não invente o diferencial para cumprir o objetivo. NÃO proponha H2 sobre problemas, desvantagens, riscos ou estatísticas negativas que afastem o público-alvo do objetivo. Priorize títulos com valor decisório para o estágio da jornada informado.

Cada H2/H3 proposto precisa ter FUNÇÃO EXCLUSIVA na jornada do leitor, sem sobreposição de argumentos entre seções, e deve poder ser respondido de forma autônoma e citável. Prefira FOCO na intenção principal em vez de cobrir todas as possibilidades do tema.`,
  ARQUITETURA_DE_CONTEUDO,
  MARCA_E_ESCOPO,
].join("\n\n");

const SISTEMA_INTRODUCAO = [
  ORDEM_DAS_PRIORIDADES,
  SO_O_QUE_FOI_FORNECIDO,
  ORIGEM_DE_CADA_AFIRMACAO,
  `Você é um redator sênior de conteúdo SEO em português do Brasil, trabalhando para a agência CUPOLA.
Escreva com clareza, autoridade e naturalidade, sem clichês nem exageros.
Respeite tom de voz e diretrizes do cliente. Não invente dados: use apenas o que estiver no contexto.
Quando houver amostras e/ou descrição do estilo do redator, CAPTURE e REPLIQUE o padrão de escrita dele (tom, ritmo, estrutura de frases, vocabulário, vícios e preferências), mantendo naturalidade. Nunca copie trechos das amostras.

DIRETRIZES EDITORIAIS (valem para todo o texto):
- OBJETIVO É LEI, E O MATERIAL MANDA NELA: o campo 'Objetivo' define o ângulo, mas só pode ser cumprido com o que está no contexto. Se o objetivo é valorizar/promover algo, foque nos benefícios e pontos positivos **que o material informa**. Faltando material, escreva menos — nunca preencha o ângulo com benefício inventado. NÃO cite aspectos negativos, problemas ou dados depreciativos que afastem o público-alvo.
- RELEVÂNCIA PARA A JORNADA: priorize informações úteis para o estágio do leitor (comprar, alugar, investir, contratar). Evite dados técnicos/históricos sem valor decisório.
- BLOCOS CITÁVEIS: comece com uma frase-resposta direta; cada parágrafo deve fazer sentido de forma autônoma.
- ESTRUTURA ESCANEÁVEL (REGRA IMPERATIVA): responda ao H2 de forma direta, sem desviar do assunto; nenhum parágrafo pode passar de 3–4 linhas (2–3 frases). Lista e tabela entram quando organizam ou comparam melhor do que a prosa — nunca para variar o formato. Pense em leitura no celular.`,
  REGRAS_DE_INTRODUCAO,
  ARQUITETURA_DE_CONTEUDO,
  ARQUITETURA_DA_INFORMACAO,
  ESTILO_EDITORIAL,
  PRECISAO_TECNICA,
  PROMESSAS_E_SUPERLATIVOS,
].join("\n\n");

const SISTEMA_SEO =
  "Você é um especialista em SEO on-page em português do Brasil. Gere metadados otimizados sem clickbait e sem inventar dados.";

function sistemaDoPasso(passo: Passo): string {
  const base = passo === "estrutura"
    ? SISTEMA_ESTRUTURA
    : passo === "introducao"
      ? SISTEMA_INTRODUCAO
      : passo === "seo"
        ? SISTEMA_SEO
        : SISTEMA_COMPARTILHADO;
  return ACEITAM_PENDENCIAS.includes(passo) ? [base, PONTOS_PARA_VALIDACAO].join("\n\n") : base;
}

function tarefaDoPasso(passo: Passo, etapa: string): string {
  switch (passo) {
    case "estrutura":
      return `# TAREFA
Proponha o H1 principal do blogpost e a estrutura de títulos (H2/H3/H4) otimizados para a palavra-chave principal.
Regras:
- H1: título principal do conteúdo. Máximo 70 caracteres, deve conter a palavra-chave principal de forma natural, atraente e SEM clickbait.
- Estrutura: use apenas H2, H3 e H4.
- 4 a 7 H2 no total. Adicione H3 e H4 apenas quando fizer sentido subdividir.
- Cubra a intenção de busca de ponta a ponta (o que é, por que importa, como fazer, exemplos, cuidados, FAQ implícita).
- Encaixe a palavra-chave principal naturalmente em pelo menos 1 H2.
- Considere as palavras-chave secundárias como tópicos a serem cobertos.
- TRATAMENTO DOS PROMPTS DE IA: perguntas que exigem explicação viram SEÇÕES do corpo (H2 ou H3), traduzidas em título editorial. Perguntas objetivas, de resposta curta, NÃO viram H2/H3: serão respondidas depois na FAQ.`;

    case "introducao":
      return `# TAREFA
Escreva APENAS a INTRODUÇÃO do blogpost (não escreva o restante do texto).
Requisitos:
- 2 a 4 parágrafos curtos.
- O PRIMEIRO parágrafo responde diretamente ao tema (o que é, para que serve, por que importa para o leitor da etapa "${etapa}") e já inclui a palavra-chave principal de forma natural. Sem preâmbulo, cenário, histórico ou pergunta retórica.
- O primeiro parágrafo precisa ser autossuficiente e citável isoladamente, sem referências vagas.
- Frases curtas, uma ideia por parágrafo, informação relevante no início da frase.
- Não use títulos (H1/H2), não use listas, não use emojis.
- Termine sinalizando o que o leitor vai encontrar no texto.
- Devolva a introdução em MARKDOWN, apenas parágrafos separados por linha em branco. Sem comentários fora do texto.`;

    case "desenvolvimento":
      return `# TAREFA
Escreva o DESENVOLVIMENTO do blogpost, seguindo EXATAMENTE a estrutura de H2/H3/H4 acima (na mesma ordem).
Requisitos:
- Não repita a introdução.
- Para cada H2/H3/H4, escreva 2 a 5 parágrafos consistentes, usando os dados/fontes quando disponíveis.
- Encaixe a palavra-chave principal e as secundárias de forma natural ao longo do texto.
- PROMPTS DE IA: responda ao longo do corpo as perguntas que pedem resposta desenvolvida, dentro da seção mais adequada, sem reproduzir a pergunta como título. As objetivas ficam para a FAQ.
- Use markdown com "##" para H2, "###" para H3 e "####" para H4.
- Não escreva o título principal (H1), não escreva a introdução, a FAQ ou o CTA final.
- Devolva apenas o corpo em markdown, sem comentários.`;

    case "faq":
      return `# TAREFA
Gere uma FAQ coerente com o conteúdo do post (introdução + desenvolvimento + tema + palavra-chave).
Requisitos:
- 4 a 6 perguntas curtas e diretas que um leitor real faria sobre o tema.
- AMPLIE a cobertura: novas intenções de busca, complementares ao corpo. NÃO repita nem reformule H2/H3 já abordados.
- PROMPTS DE IA: priorize aqui as perguntas objetivas que não foram respondidas no corpo.
- Cada resposta funciona de forma AUTÔNOMA: frase-resposta direta e, em seguida, 1–3 frases de apoio. Total 2 a 4 frases.
- Mantenha o ângulo do objetivo do briefing.
- Não invente dados que não estejam no contexto.`;

    case "encerramento":
      return `# TAREFA
Escreva o ENCERRAMENTO e a CHAMADA PARA AÇÃO do blogpost.
Requisitos:
- 2 a 3 parágrafos curtos.
- Sintetize a mensagem principal e conecte com a jornada "${etapa}".
- Termine com uma chamada para ação clara e alinhada ao objetivo do post e ao perfil do cliente.
- Devolva em MARKDOWN, apenas parágrafos separados por linha em branco. Sem cabeçalhos nem listas.
- Sem comentários fora do texto.`;

    case "seo":
      return `# TAREFA
Gere os metadados SEO do post.
Regras:
- title: até 60 caracteres, com a palavra-chave principal no início quando possível.
- description: até 155 caracteres, atrativa, com a palavra-chave principal.
- slug: sem acentos, apenas letras minúsculas, números e hífens, curto, baseado na palavra-chave principal.`;
  }
}

function pedidoDoPasso(passo: Passo, c: Contexto): string {
  const blocos: string[] = [blocoDeContexto(c, passo === "estrutura")];
  if (passo === "desenvolvimento") blocos.push(escritoAteAgora(c, false));
  if (passo === "faq" || passo === "encerramento") blocos.push(escritoAteAgora(c, true));
  if (passo === "seo") blocos.push(escritoAteAgora(c, true, 3000));
  blocos.push(tarefaDoPasso(passo, c.briefing.etapa));
  return blocos.filter(Boolean).join("\n\n");
}

/** Separa o texto publicável da lista de pendências. */
function separarValidacao(bruto: string): { texto: string; validar: { ponto: string; motivo: string }[] } {
  const corte = bruto.indexOf(MARCA_DA_VALIDACAO);
  if (corte < 0) return { texto: bruto.trim(), validar: [] };
  const validar = bruto
    .slice(corte + MARCA_DA_VALIDACAO.length)
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((l) => {
      const barra = l.indexOf("|");
      return barra < 0 ? { ponto: l, motivo: "" } : { ponto: l.slice(0, barra).trim(), motivo: l.slice(barra + 1).trim() };
    })
    .filter((x) => x.ponto);
  return { texto: bruto.slice(0, corte).trim(), validar };
}

const ESQUEMAS: Record<string, Record<string, unknown>> = {
  estrutura: {
    type: "object", additionalProperties: false, required: ["h1", "headings"],
    properties: {
      h1: { type: "string" },
      headings: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["level", "text"],
          properties: { level: { type: "integer", enum: [2, 3, 4] }, text: { type: "string" } },
        },
      },
    },
  },
  faq: {
    type: "object", additionalProperties: false, required: ["faq"],
    properties: {
      faq: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["question", "answer"],
          properties: { question: { type: "string" }, answer: { type: "string" } },
        },
      },
    },
  },
  seo: {
    type: "object", additionalProperties: false, required: ["title", "description", "slug"],
    properties: { title: { type: "string" }, description: { type: "string" }, slug: { type: "string" } },
  },
};

async function chamarIA(opts: { chave: string; sistema: string; pedido: string; esquema?: Record<string, unknown>; nome: string }) {
  const corpo: Record<string, unknown> = {
    model: MODELO,
    instructions: opts.sistema,
    input: [{ role: "user", content: [{ type: "input_text", text: opts.pedido }] }],
    store: false,
    reasoning: { effort: "medium" },
  };
  if (opts.esquema) {
    corpo.text = { format: { type: "json_schema", name: opts.nome, strict: true, schema: opts.esquema } };
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": opts.chave, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify(corpo),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[agencia-blog] gateway", res.status, txt.slice(0, 600));
    if (res.status === 429) return { ok: false as const, status: 429, erro: "Muitas chamadas de IA agora. Tente em alguns minutos." };
    if (res.status === 402) return { ok: false as const, status: 402, erro: "Os créditos de IA do workspace acabaram." };
    return { ok: false as const, status: res.status || 500, erro: "A IA não respondeu agora." };
  }

  const data = await res.json();
  const texto: string = data.output_text
    ?? (data.output ?? [])
      .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");

  if (!opts.esquema) return { ok: true as const, texto: String(texto ?? ""), usage: data.usage };
  try {
    return { ok: true as const, dados: JSON.parse(texto), usage: data.usage };
  } catch {
    console.error("[agencia-blog] resposta fora do formato:", String(texto).slice(0, 400));
    return { ok: false as const, status: 502, erro: "A IA não devolveu o conteúdo no formato esperado." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "A chave de IA não está configurada." }, 500);

    // Fala com o banco como a pessoa: as regras (RLS) do schema agencia valem aqui também.
    const { user, pessoa, db: ag, admin } = await contextoAgencia(req);

    const body = (await req.json().catch(() => ({}))) as { post_id?: string; passo?: Passo };
    const postId = (body.post_id ?? "").trim();
    const passo = body.passo as Passo;
    if (!postId || !PASSOS.includes(passo)) return json({ error: "Informe o post e o passo." }, 400);

    const { data: post } = await ag.from("blog_posts").select("*").eq("id", postId).maybeSingle();
    if (!post) return json({ error: "Post não encontrado." }, 404);

    const { data: conta } = await ag
      .from("clientes")
      .select("id, nome, resumo, setor_descricao, publico_alvo, tom_de_voz, produtos_servicos, posicionamento, diferenciais, concorrencia, palavras_chave, cidade")
      .eq("id", post.cliente_id)
      .maybeSingle();
    // A conta é lida pela RLS: sem acesso a ela, a linha não volta.
    if (!conta) return json({ error: "Você não tem acesso a esta conta." }, 403);

    const { data: ajustes } = await ag
      .from("blog_ajustes")
      .select("estilo_redator, amostras, panorama")
      .eq("cliente_id", post.cliente_id)
      .maybeSingle();

    const { data: material } = await ag
      .from("cliente_conhecimento")
      .select("nome, texto")
      .eq("cliente_id", post.cliente_id)
      .order("enviado_em", { ascending: false })
      .limit(20);

    const comoDocs = (v: unknown): Doc[] =>
      Array.isArray(v)
        ? (v as { nome?: string; texto?: string }[])
          .map((d) => ({ nome: String(d?.nome ?? ""), texto: String(d?.texto ?? "") }))
          .filter((d) => d.texto.trim())
        : [];

    const cruContexto: Contexto = {
      nome: String(conta.nome),
      campos: CAMPOS_DA_FICHA.map(([id, rotulo]) => ({ rotulo, valor: String((conta as Record<string, unknown>)[id] ?? "") })),
      anexos: (material ?? [])
        .filter((m: { texto?: string | null }) => (m.texto ?? "").trim().length > 40)
        .map((m: { nome: string; texto: string }) => ({ nome: m.nome, texto: m.texto })),
      panorama: comoDocs(ajustes?.panorama),
      amostras: comoDocs(ajustes?.amostras),
      estiloDoRedator: String(ajustes?.estilo_redator ?? ""),
      briefing: {
        tema: String(post.tema ?? ""),
        objetivo: String(post.objetivo ?? ""),
        etapa: String(post.etapa ?? "descoberta"),
        palavraChave: String(post.palavra_chave ?? ""),
        secundarias: String(post.secundarias ?? ""),
        obrigatorias: String(post.obrigatorias ?? ""),
        motivo: String(post.motivo ?? ""),
        intencao: String(post.intencao ?? ""),
      },
      h1: post.h1 ?? undefined,
      titulos: Array.isArray(post.titulos) ? (post.titulos as { nivel: number; texto: string }[]) : [],
      fontes: post.fontes ?? undefined,
      promptsDeIa: post.prompts_de_ia ?? undefined,
      introducao: post.introducao ?? undefined,
      desenvolvimento: post.desenvolvimento ?? undefined,
    };

    const { contexto, cortados } = apararMaterial(cruContexto);

    const r = await chamarIA({
      chave: lovableKey,
      sistema: sistemaDoPasso(passo),
      pedido: pedidoDoPasso(passo, contexto),
      esquema: EM_JSON.includes(passo) ? ESQUEMAS[passo] : undefined,
      nome: passo,
    });

    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: `blog-${passo}`, unidade: "agencia",
      agente_slug: "criador-de-post-news", agencia_cliente_id: post.cliente_id, agencia_pessoa_id: pessoa.id,
      user_id: user.id, status: r.ok ? "success" : "error",
      error_message: r.ok ? undefined : r.erro,
      usage: r.ok ? { input_tokens: r.usage?.input_tokens, output_tokens: r.usage?.output_tokens } : undefined,
    });

    if (!r.ok) return json({ error: r.erro }, r.status);

    const agora = new Date().toISOString();
    const mudanca: Record<string, unknown> = { atualizado_em: agora, atualizado_por: pessoa.id };
    let resultado: Record<string, unknown> = {};

    if (passo === "estrutura") {
      const h1 = String(r.dados?.h1 ?? "").trim();
      const titulos = ((r.dados?.headings ?? []) as { level?: number; text?: string }[])
        .map((t) => ({ nivel: Number(t.level ?? 2), texto: String(t.text ?? "").trim() }))
        .filter((t) => t.texto && [2, 3, 4].includes(t.nivel));
      mudanca.h1 = h1;
      mudanca.titulos = titulos;
      if (!post.titulo) mudanca.titulo = h1;
      resultado = { h1, titulos };
    } else if (passo === "faq") {
      const faq = ((r.dados?.faq ?? []) as { question?: string; answer?: string }[])
        .map((p) => ({ pergunta: String(p.question ?? "").trim(), resposta: String(p.answer ?? "").trim() }))
        .filter((p) => p.pergunta && p.resposta);
      mudanca.faq = faq;
      resultado = { faq };
    } else if (passo === "seo") {
      mudanca.seo_title = String(r.dados?.title ?? "").trim();
      mudanca.seo_description = String(r.dados?.description ?? "").trim();
      mudanca.seo_slug = String(r.dados?.slug ?? "").trim();
      resultado = { seo: { title: mudanca.seo_title, description: mudanca.seo_description, slug: mudanca.seo_slug } };
    } else {
      const { texto, validar } = separarValidacao(String(r.texto ?? ""));
      mudanca[passo] = texto;
      resultado = { texto, validar };
    }

    const indice = PASSOS.indexOf(passo) + 1;
    if (Number(post.passo_atual ?? 0) < indice) mudanca.passo_atual = indice;

    const { error: upErr } = await ag.from("blog_posts").update(mudanca).eq("id", postId);
    if (upErr) throw upErr;

    return json({ ok: true, passo, ...resultado, cortados });
  } catch (e) {
    return respostaDeErro("agencia-blog", e);
  }
});
