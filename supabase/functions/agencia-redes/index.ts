// Agente de conteúdo de redes sociais da Agência.
// Duas ações: "temas" (lista do mês) e "peca" (o texto de um tema).
// Regras transcritas do CupoCont/CupolaOS; a IA roda pela chave única do gateway.
import { logAiUsage } from "../_shared/ai-usage.ts";
import { contextoAgencia, corsHeaders, json, respostaDeErro } from "../_shared/agencia.ts";

const MODELO = "openai/gpt-6-astra";
const MODELO_IMAGEM = "openai/gpt-image-2.5-sunburst";

const TOTAL_DE_TEMAS = 20;
const LIMITE_DO_CARD = 150;
const LIMITE_DO_SLIDE = { capa: 150, interno: 250, cta: 100 };
const MAXIMO_DE_SLIDES = 10;
const TETO_POR_DOCUMENTO = 60_000;
const TETO_TOTAL = 240_000;

const VAZIO = "(vazio)";

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
];

const SISTEMA_DOS_TEMAS = `Você é um estrategista de conteúdo para redes sociais trabalhando para uma agência que atende o mercado imobiliário.
Sua tarefa é sugerir temas de posts para UM cliente específico, para o mês do briefing informado.

Regras obrigatórias:
- Siga RIGOROSAMENTE o "Contexto do cliente" (tom de voz, personas, termos permitidos e proibidos, histórico do que já foi publicado). Esse contexto tem prioridade sobre suposições genéricas sobre o nicho.
- Use as "Palavras-chave do período" como sinal de demanda real de busca, não como lista obrigatória.
- Respeite os objetivos, campanhas, datas e restrições do briefing.
- Não repita temas genéricos que ignorem o contexto do cliente.
- Se vier a seção "Temas já usados neste cliente", nenhum tema novo pode repetir aqueles assuntos.
- Se o briefing traz "Temas sugeridos pelo redator", eles são obrigatórios e vêm PRIMEIRO na lista, na ordem em que aparecem. Você pode reescrever o título para caber no tom de voz, mas não pode descartar nem fundir.
- Gere EXATAMENTE ${TOTAL_DE_TEMAS} temas distintos, contando os sugeridos pelo redator.

Cada "justificativa" tem 1 ou 2 frases explicando por que esse tema é relevante agora, conectando briefing, palavra-chave e/ou contexto do cliente.`;

const REGRAS_DO_TEXTO = `Você é redator de conteúdo para redes sociais de uma agência do mercado imobiliário, escrevendo em nome de UM cliente específico.

Regra mais importante: o texto final deve seguir RIGOROSAMENTE o tom de voz, a linguagem, as personas e os termos permitidos e proibidos descritos no "Contexto do cliente". Se o contexto do cliente conflitar com uma prática genérica de redação para redes sociais, o contexto do cliente vence.

Respeite também as restrições do briefing do mês (por exemplo: não mencionar concorrentes, não prometer resultado).

Nunca use markdown, asteriscos ou títulos. Texto puro, pronto para publicar.`;

const SISTEMA_DO_CARD = `${REGRAS_DO_TEXTO}

Esta peça é um CARD: uma imagem única com um texto curto na arte, mais a legenda do post.
- "legenda": a legenda completa do post, pronta para publicar.
- "textoImagem": o texto que vai DENTRO da arte. No máximo ${LIMITE_DO_CARD} caracteres. É uma manchete: precisa parar o rolar do dedo por si só.
- "cards": devolva lista vazia.`;

const SISTEMA_DO_CARROSSEL = `${REGRAS_DO_TEXTO}

Esta peça é um CARROSSEL: uma sequência de cards com texto na arte, mais a legenda do post.
Você decide quantos cards o tema pede, no mínimo 3 e no máximo ${MAXIMO_DE_SLIDES}, contando capa e CTA. Use só o necessário.
O PRIMEIRO card é a capa e o ÚLTIMO é o CTA.
Limites de caracteres, com folga: capa ${LIMITE_DO_SLIDE.capa}, interno ${LIMITE_DO_SLIDE.interno} cada, cta ${LIMITE_DO_SLIDE.cta}.
- "textoImagem": devolva string vazia.`;

const ESQUEMA_TEMAS = {
  type: "object",
  additionalProperties: false,
  required: ["temas"],
  properties: {
    temas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "justificativa"],
        properties: { titulo: { type: "string" }, justificativa: { type: "string" } },
      },
    },
  },
};

const ESQUEMA_PECA = {
  type: "object",
  additionalProperties: false,
  required: ["legenda", "textoImagem", "cards"],
  properties: {
    legenda: { type: "string" },
    textoImagem: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["texto"],
        properties: { texto: { type: "string" } },
      },
    },
  },
};

function aparar(materiais: { nome: string; texto: string }[]) {
  const usados: { nome: string; texto: string }[] = [];
  let gasto = 0;
  for (const m of materiais) {
    const sobra = TETO_TOTAL - gasto;
    if (sobra <= 0) break;
    const limite = Math.min(TETO_POR_DOCUMENTO, sobra);
    const texto = m.texto.length > limite ? m.texto.slice(0, limite) : m.texto;
    gasto += texto.length;
    usados.push({ nome: m.nome, texto });
  }
  return usados;
}

interface Mes {
  briefing?: string | null;
  datas?: string | null;
  sugeridos?: string | null;
  palavras?: unknown;
}

function blocoDeContexto(
  conta: Record<string, unknown>,
  materiais: { nome: string; texto: string }[],
  mes: string,
  briefing: Mes,
  jaUsados: string[],
): string {
  const perfil = CAMPOS_DA_FICHA
    .map(([id, rotulo]) => ({ rotulo, valor: String(conta[id] ?? "").trim() }))
    .filter((x) => x.valor)
    .map((x) => `- ${x.rotulo}: ${x.valor}`)
    .join("\n");

  const anexos = materiais.length
    ? materiais.map((m) => `--- ${m.nome} ---\n${m.texto}`).join("\n\n")
    : "(sem material com texto extraído)";

  const palavras = Array.isArray(briefing.palavras)
    ? (briefing.palavras as unknown[]).map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join("\n")
    : String(briefing.palavras ?? "");

  const partes = [
    `## Contexto do cliente\nCliente: ${conta.nome}\n${perfil || VAZIO}`,
    `## Base de conhecimento\n${anexos}`,
    [
      "## Briefing do mês",
      `- Período: ${mes}`,
      `- Objetivos: ${(briefing.briefing ?? "").toString().trim() || VAZIO}`,
      ...((briefing.datas ?? "").toString().trim() ? [`- Datas comemorativas: ${briefing.datas}`] : []),
      ...((briefing.sugeridos ?? "").toString().trim() ? [`- Temas sugeridos pelo redator: ${briefing.sugeridos}`] : []),
    ].join("\n"),
    `## Palavras-chave do período\n${palavras.trim() || "Nenhuma palavra-chave cadastrada para o período."}`,
  ];

  if (jaUsados.length) {
    partes.push(`## Temas já usados neste cliente (não repetir)\n${jaUsados.map((t) => `- ${t}`).join("\n")}`);
  }

  return partes.join("\n\n");
}

async function chamarIA(opts: {
  chave: string;
  sistema: string;
  pedido: string;
  esquema: Record<string, unknown>;
  nome: string;
}): Promise<{ ok: true; dados: any; usage: any } | { ok: false; status: number; erro: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.chave,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODELO,
      instructions: opts.sistema,
      input: [{ role: "user", content: [{ type: "input_text", text: opts.pedido }] }],
      store: false,
      reasoning: { effort: "medium" },
      text: { format: { type: "json_schema", name: opts.nome, strict: true, schema: opts.esquema } },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[agencia-redes] gateway", res.status, txt.slice(0, 600));
    if (res.status === 429) return { ok: false, status: 429, erro: "Muitas chamadas de IA agora. Tente em alguns minutos." };
    if (res.status === 402) return { ok: false, status: 402, erro: "Os créditos de IA do workspace acabaram." };
    return { ok: false, status: res.status || 500, erro: "A IA não respondeu agora." };
  }

  const data = await res.json();
  const texto: string = data.output_text
    ?? (data.output ?? [])
      .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");
  try {
    return { ok: true, dados: JSON.parse(texto), usage: data.usage };
  } catch {
    console.error("[agencia-redes] resposta fora do formato:", String(texto).slice(0, 400));
    return { ok: false, status: 502, erro: "A IA não devolveu o conteúdo no formato esperado." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "A chave de IA não está configurada." }, 500);

    // Fala com o banco como a pessoa: as regras (RLS) do schema agencia valem aqui também.
    const { user, pessoa, db: ag, admin } = await contextoAgencia(req);

    const body = (await req.json().catch(() => ({}))) as {
      acao?: "temas" | "peca" | "arte";
      cliente_id?: string;
      mes?: string;
      tema_id?: string;
      formato?: "card" | "carrossel";
      instrucoes?: string;
      formato_arte?: "feed_4_5" | "quadrado_1_1" | "stories_9_16";
      instrucoes_arte?: string;
      stream?: boolean;
    };

    const clienteId = (body.cliente_id ?? "").trim();
    const mes = (body.mes ?? "").trim();
    if (!clienteId || !mes) return json({ error: "Informe a conta e o mês." }, 400);

    const { data: conta } = await ag
      .from("clientes")
      .select("id, nome, resumo, setor_descricao, publico_alvo, tom_de_voz, produtos_servicos, posicionamento, diferenciais, concorrencia, palavras_chave")
      .eq("id", clienteId)
      .maybeSingle();
    // A conta é lida pela RLS: sem acesso a ela, a linha não volta.
    if (!conta) return json({ error: "Você não tem acesso a esta conta." }, 403);

    // ---------------- imagem-base de uma arte ----------------
    if (body.acao === "arte") {
      const temaId = (body.tema_id ?? "").trim();
      if (!temaId) return json({ error: "Informe o tema." }, 400);
      const { data: tema } = await ag
        .from("redes_conteudo_temas")
        .select("id, titulo, justificativa, formato, texto_imagem, slides")
        .eq("id", temaId)
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (!tema) return json({ error: "Tema não encontrado." }, 404);

      const { data: identidade } = await ag
        .from("cliente_identidade")
        .select("cores, tipografia, guia")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      const formatoArte = body.formato_arte === "quadrado_1_1" || body.formato_arte === "stories_9_16"
        ? body.formato_arte
        : "feed_4_5";
      const tamanho = formatoArte === "quadrado_1_1" ? "1024x1024" : formatoArte === "stories_9_16" ? "1024x1824" : "1024x1280";
      const textos = tema.formato === "carrossel" && Array.isArray(tema.slides)
        ? tema.slides.map((slide: { texto?: string }) => slide.texto).filter(Boolean).join(" | ")
        : tema.texto_imagem ?? "";
      const prompt = [
        `Crie uma fotografia ou ilustração editorial sofisticada para uma peça de rede social da marca ${conta.nome}.`,
        `Assunto: ${tema.titulo}. ${tema.justificativa ?? ""}`,
        `Contexto da marca: ${conta.resumo ?? ""} ${conta.posicionamento ?? ""} ${conta.publico_alvo ?? ""}`,
        `Identidade visual: cores ${JSON.stringify(identidade?.cores ?? [])}; orientações ${identidade?.guia ?? "não informadas"}.`,
        `A composição precisa reservar uma área visual limpa e com contraste para o editor aplicar depois este conteúdo: ${textos}.`,
        `Formato final: ${formatoArte}. Não inclua letras, palavras, logotipos, marcas d'água, molduras ou texto dentro da imagem.`,
        (body.instrucoes_arte ?? "").trim() ? `Direção adicional: ${body.instrucoes_arte!.trim()}` : "",
      ].filter(Boolean).join("\n");

      const chamarImagem = () => fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({ model: MODELO_IMAGEM, prompt, size: tamanho, quality: "high", stream: body.stream !== false, ...(body.stream !== false ? { partial_images: 1 } : {}) }),
      });
      let imagem = await chamarImagem();
      if ((imagem.status === 429 || imagem.status >= 500) && body.stream === false) {
        const espera = Number(imagem.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, Math.min(espera, 5)) * 1000));
        imagem = await chamarImagem();
      }
      if (!imagem.ok) {
        const falha = await imagem.json().catch(() => ({}));
        const mensagem = falha?.error?.message ?? falha?.message ?? "Não foi possível gerar a imagem.";
        await logAiUsage({
          admin, provider: "lovable", model: MODELO_IMAGEM, agente_tipo: "redes-arte", unidade: "agencia",
          agente_slug: "redes-conteudo", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
          user_id: user.id, status: "error", error_message: mensagem,
        });
        return json({ error: mensagem }, imagem.status);
      }

      if (body.stream === false) {
        const resultado = await imagem.json();
        await logAiUsage({
          admin, provider: "lovable", model: MODELO_IMAGEM, agente_tipo: "redes-arte", unidade: "agencia",
          agente_slug: "redes-conteudo", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
          user_id: user.id, status: "success",
          usage: { input_tokens: resultado.usage?.input_tokens, output_tokens: resultado.usage?.output_tokens },
        });
        return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!imagem.body) return json({ error: "A IA não abriu o fluxo da imagem." }, 502);
      let buffer = "";
      let terminou = false;
      let erroFluxo = "";
      let uso: { input_tokens?: number; output_tokens?: number } | undefined;
      const transform = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          buffer += new TextDecoder().decode(chunk, { stream: true });
          const eventos = buffer.split("\n\n");
          buffer = eventos.pop() ?? "";
          for (const evento of eventos) {
            const linha = evento.split("\n").find((item) => item.startsWith("data:"));
            if (!linha) continue;
            try {
              const payload = JSON.parse(linha.slice(5).trim());
              if (payload.type === "image_generation.completed") {
                terminou = true;
                uso = payload.usage;
              }
              if (payload.type === "error") erroFluxo = payload.error?.message ?? "A geração da imagem falhou.";
            } catch { /* evento parcial */ }
          }
        },
        async flush() {
          await logAiUsage({
            admin, provider: "lovable", model: MODELO_IMAGEM, agente_tipo: "redes-arte", unidade: "agencia",
            agente_slug: "redes-conteudo", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
            user_id: user.id, status: terminou ? "success" : "error", error_message: terminou ? undefined : erroFluxo || "Fluxo encerrado sem imagem final.",
            usage: uso,
          });
        },
      });
      return new Response(imagem.body.pipeThrough(transform), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    const { data: briefing } = await ag
      .from("redes_conteudo_meses")
      .select("briefing, datas, sugeridos, palavras")
      .eq("cliente_id", clienteId)
      .eq("mes", mes)
      .maybeSingle();

    const { data: material } = await ag
      .from("cliente_conhecimento")
      .select("nome, texto")
      .eq("cliente_id", clienteId)
      .order("enviado_em", { ascending: false })
      .limit(20);

    const materiais = aparar(
      (material ?? [])
        .filter((m: { texto?: string | null }) => (m.texto ?? "").trim().length > 40)
        .map((m: { nome: string; texto: string }) => ({ nome: m.nome, texto: m.texto })),
    );

    // ---------------- temas do mês ----------------
    if (body.acao !== "peca") {
      const { data: antigos } = await ag
        .from("redes_conteudo_temas")
        .select("titulo, mes")
        .eq("cliente_id", clienteId)
        .neq("mes", mes)
        .limit(200);

      const contexto = blocoDeContexto(
        conta as Record<string, unknown>,
        materiais,
        mes,
        (briefing ?? {}) as Mes,
        (antigos ?? []).map((t: { titulo: string }) => t.titulo).filter(Boolean),
      );

      const r = await chamarIA({
        chave: lovableKey,
        sistema: SISTEMA_DOS_TEMAS,
        pedido: `${contexto}\n\nGere agora a lista de temas, seguindo as regras.`,
        esquema: ESQUEMA_TEMAS,
        nome: "temas",
      });

      await logAiUsage({
        admin, provider: "lovable", model: MODELO, agente_tipo: "redes-temas", unidade: "agencia",
        agente_slug: "redes-conteudo", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
        user_id: user.id, status: r.ok ? "success" : "error",
        error_message: r.ok ? undefined : r.erro,
        usage: r.ok ? { input_tokens: r.usage?.input_tokens, output_tokens: r.usage?.output_tokens } : undefined,
      });

      if (!r.ok) return json({ error: r.erro }, r.status);

      const temas = ((r.dados?.temas ?? []) as { titulo?: string; justificativa?: string }[])
        .map((t) => ({ titulo: String(t.titulo ?? "").trim(), justificativa: String(t.justificativa ?? "").trim() }))
        .filter((t) => t.titulo)
        .slice(0, TOTAL_DE_TEMAS);

      if (!temas.length) return json({ error: "A IA não trouxe temas desta vez." }, 502);

      // Substitui apenas as sugestões ainda não escritas deste mês.
      await ag.from("redes_conteudo_temas").delete().eq("cliente_id", clienteId).eq("mes", mes).eq("estado", "sugerido");

      const agora = new Date().toISOString();
      const linhas = temas.map((t, i) => ({
        id: crypto.randomUUID(),
        cliente_id: clienteId,
        mes,
        titulo: t.titulo,
        justificativa: t.justificativa,
        estado: "sugerido",
        ordem: i + 1,
        criado_em: agora,
        atualizado_em: agora,
      }));
      const { error: insErr } = await ag.from("redes_conteudo_temas").insert(linhas);
      if (insErr) throw insErr;

      await ag.from("redes_conteudo_meses").upsert(
        { cliente_id: clienteId, mes, atualizado_em: agora, atualizado_por: pessoa.id },
        { onConflict: "cliente_id,mes" },
      );

      return json({ ok: true, temas: linhas, documentos: materiais.map((m) => m.nome) });
    }

    // ---------------- o texto de um tema ----------------
    const temaId = (body.tema_id ?? "").trim();
    if (!temaId) return json({ error: "Informe o tema." }, 400);

    const { data: tema } = await ag
      .from("redes_conteudo_temas")
      .select("id, titulo, justificativa, legenda, texto_imagem, slides")
      .eq("id", temaId)
      .maybeSingle();
    if (!tema) return json({ error: "Tema não encontrado." }, 404);

    const formato = body.formato === "carrossel" ? "carrossel" : "card";
    const contexto = blocoDeContexto(conta as Record<string, unknown>, materiais, mes, (briefing ?? {}) as Mes, []);

    const anterior = formato === "card"
      ? [tema.texto_imagem, tema.legenda].filter(Boolean).join("\n\n")
      : [(Array.isArray(tema.slides) ? tema.slides.map((s: { texto?: string }) => s?.texto).filter(Boolean).join("\n") : ""), tema.legenda]
        .filter(Boolean).join("\n\n");

    const partes = [
      contexto,
      `## Tema selecionado\nTítulo: ${tema.titulo}\nJustificativa: ${tema.justificativa ?? ""}`,
    ];
    if (anterior.trim()) partes.push(`## Versão anterior (para refinar, não repetir igual)\n${anterior.trim()}`);
    if ((body.instrucoes ?? "").trim()) partes.push(`## Instruções adicionais do redator\n${body.instrucoes!.trim()}`);
    partes.push("Escreva agora a peça para este tema.");

    const r = await chamarIA({
      chave: lovableKey,
      sistema: formato === "card" ? SISTEMA_DO_CARD : SISTEMA_DO_CARROSSEL,
      pedido: partes.join("\n\n"),
      esquema: ESQUEMA_PECA,
      nome: "peca",
    });

    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: "redes-peca", unidade: "agencia",
      agente_slug: "redes-conteudo", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
      user_id: user.id, status: r.ok ? "success" : "error",
      error_message: r.ok ? undefined : r.erro,
      usage: r.ok ? { input_tokens: r.usage?.input_tokens, output_tokens: r.usage?.output_tokens } : undefined,
    });

    if (!r.ok) return json({ error: r.erro }, r.status);

    const legenda = String(r.dados?.legenda ?? "").trim();
    let textoImagem = "";
    let slides: { papel: string; texto: string }[] = [];

    if (formato === "card") {
      textoImagem = String(r.dados?.textoImagem ?? "").trim();
    } else {
      const cards = Array.isArray(r.dados?.cards) ? r.dados.cards : [];
      slides = cards
        .map((c: { texto?: string }) => String(c?.texto ?? "").trim())
        .filter((t: string) => t)
        .slice(0, MAXIMO_DE_SLIDES)
        .map((texto: string, i: number, arr: string[]) => ({
          papel: i === 0 ? "capa" : i === arr.length - 1 && arr.length > 1 ? "cta" : "interno",
          texto,
        }));
    }

    const stories = slides.length ? slides.map((s) => s.texto) : textoImagem ? [textoImagem] : [];

    const { error: upErr } = await ag
      .from("redes_conteudo_temas")
      .update({
        formato,
        instrucoes: (body.instrucoes ?? "").trim() || null,
        legenda,
        texto_imagem: textoImagem || null,
        slides,
        stories,
        estado: "escolhido",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", temaId);
    if (upErr) throw upErr;

    return json({ ok: true, peca: { legenda, textoImagem, slides, stories, formato } });
  } catch (e) {
    return respostaDeErro("agencia-redes", e);
  }
});
