// Ficha automática das contas da Agência.
// Lê o material já enviado da conta e PROPÕE o preenchimento dos campos,
// sempre com a origem do trecho. Nada entra na conta sem aprovação campo a campo.
import { logAiUsage } from "../_shared/ai-usage.ts";
import { contextoAgencia, corsHeaders, ErroHttp, json, respostaDeErro } from "../_shared/agencia.ts";

const MODELO = "openai/gpt-6-astra";

const TETO_POR_DOCUMENTO = 150_000;
const TETO_TOTAL = 450_000;

const CAMPOS = [
  ["resumo", "Contexto", "Cinco a oito frases sobre quem é a conta, o porte, a operação e o momento em que está. Texto corrido, sem títulos nem listas. É o único campo com teto de tamanho."],
  ["setor_descricao", "Setor", "Uma frase dizendo em que setor a empresa atua e como se posiciona dentro dele. Diga se é generalista ou especializada."],
  ["publico_alvo", "Público-alvo", "Para quem O CLIENTE vende. Escreva TODOS os públicos que o material descrever, cada um com o que o material diz dele. Não é o público da agência."],
  ["tom_de_voz", "Tom de voz", "Como a marca fala: formal ou próxima, técnica ou didática, o que ela evita dizer."],
  ["produtos_servicos", "Produtos e serviços", "O que O CLIENTE vende ou oferece, item por item, todos os que o material nomear. Não é o que a Cupola entrega para ele."],
  ["posicionamento", "Posicionamento", "O lugar que a marca quer ocupar na cabeça de quem compra, em uma ou duas frases."],
  ["diferenciais", "Diferenciais", "O que esta empresa tem e o concorrente não tem. Concreto e verificável. Se o material só trouxer adjetivo, deixe vazio."],
  ["concorrencia", "Concorrência", "Contra quem esta empresa disputa. TODOS os nomes que o material der. Listas de 'concorrentes a evitar citar' são a resposta deste campo. Não invente concorrente pelo setor ou pela cidade."],
  ["palavras_chave", "Palavras-chave", "Todas as palavras que a própria marca usa para se descrever, separadas por vírgula."],
] as const;

type CampoId = (typeof CAMPOS)[number][0];
const CAMPOS_VALIDOS = new Set<string>(CAMPOS.map((c) => c[0]));

function sistema(): string {
  return [
    "Você lê o material de uma empresa e preenche a ficha dela para uma agência de marketing.",
    "",
    "REGRA QUE VALE MAIS QUE TODAS: você só escreve o que está no material.",
    "Não complete com o que costuma ser verdade em empresas parecidas. Não deduza pelo nome, setor ou cidade.",
    "Se o material não responde a um campo, devolva esse campo com valor vazio — é resposta correta e esperada.",
    "",
    "OS DOCUMENTOS SE COMPLETAM: quando fontes diferentes responderem partes do mesmo campo, escreva UM valor só que use todas e cite todas em `fontes`.",
    "Se duas fontes se contradisserem, use a mais recente ou específica e cite as duas assim mesmo.",
    "",
    "COMPLETO, NÃO RESUMIDO. Se o material nomear cinco públicos, escreva os cinco. Nada de 'entre outros', 'etc.' ou 'principalmente'.",
    "Enxugar é sobre palavra, nunca sobre fato: corte adjetivo de vendedor, mantenha toda informação concreta.",
    "",
    "Cada campo vem com `valor` (português do Brasil) e `fontes` — uma entrada por documento que contribuiu, com `origem` (nome exato do documento) e `trecho` (até 200 caracteres copiados literalmente). Lista vazia quando o valor for vazio.",
    "",
    "VOCÊ TAMBÉM PROPÕE AS REGRAS DA CONTA. Regra é o que invalida a entrega se for violada; preferência de tom não é regra.",
    "Tipos: `veto` (não pode sair), `obrigatorio` (tem que estar lá), `posicionamento` (quando violar desmente a marca).",
    "Em `veto`, preencha `termos` com as palavras literais que a conferência vai procurar, só quando o material der essas palavras.",
    "Em `porque`, o motivo em uma linha. No máximo 8 regras, e prefira menos. Lista vazia é resposta.",
  ].join("\n");
}

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sugestoes", "regras"],
  properties: {
    sugestoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["campo", "valor", "fontes"],
        properties: {
          campo: { type: "string", enum: CAMPOS.map((c) => c[0]) },
          valor: { type: "string" },
          fontes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["origem", "trecho"],
              properties: { origem: { type: "string" }, trecho: { type: "string" } },
            },
          },
        },
      },
    },
    regras: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "texto", "porque", "termos"],
        properties: {
          tipo: { type: "string", enum: ["veto", "obrigatorio", "posicionamento"] },
          texto: { type: "string" },
          porque: { type: "string" },
          termos: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

function aparar(materiais: { nome: string; texto: string }[]) {
  const cortados: string[] = [];
  const usados: { nome: string; texto: string }[] = [];
  let gasto = 0;
  for (const m of materiais) {
    const sobra = TETO_TOTAL - gasto;
    if (sobra <= 0) { cortados.push(m.nome); continue; }
    const limite = Math.min(TETO_POR_DOCUMENTO, sobra);
    const texto = m.texto.length > limite ? m.texto.slice(0, limite) : m.texto;
    if (texto.length < m.texto.length) cortados.push(m.nome);
    gasto += texto.length;
    usados.push({ nome: m.nome, texto });
  }
  return { usados, cortados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "A chave de IA não está configurada." }, 500);

    // Fala com o banco como a pessoa: as regras (RLS) do schema agencia valem aqui também.
    const { user, pessoa, db: ag, admin } = await contextoAgencia(req);

    const body = (await req.json().catch(() => ({}))) as {
      acao?: "ler" | "aplicar";
      cliente_id?: string;
      campos?: Record<string, string>;
      regras?: { tipo: string; texto: string; porque?: string; termos?: string[] }[];
    };
    const clienteId = (body.cliente_id ?? "").trim();
    if (!clienteId) return json({ error: "Informe a conta." }, 400);

    const { data: conta } = await ag
      .from("clientes")
      .select("id, nome, tipo, cidade, resumo, setor_descricao, publico_alvo, tom_de_voz, produtos_servicos, posicionamento, diferenciais, concorrencia, palavras_chave")
      .eq("id", clienteId)
      .maybeSingle();
    // A conta é lida pela RLS: sem acesso a ela, a linha não volta.
    if (!conta) return json({ error: "Você não tem acesso a esta conta." }, 403);

    // ---------- aplicar: grava só o que a pessoa aprovou ----------
    if (body.acao === "aplicar") {
      const campos = body.campos ?? {};
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (CAMPOS_VALIDOS.has(k) && typeof v === "string" && v.trim()) update[k] = v.trim();
      }
      if (Object.keys(update).length) {
        update.atualizado_em = new Date().toISOString();
        update.atualizado_por = pessoa.id;
        // Sem `pode_escrever_cliente`, a RLS não deixa a linha mudar (e não dá erro).
        const { data: gravada, error } = await ag.from("clientes").update(update).eq("id", clienteId).select("id");
        if (error) throw error;
        if (!gravada?.length) throw new ErroHttp(403, "Você não pode editar esta conta.");
      }

      const regras = (body.regras ?? []).filter(
        (r) => ["veto", "obrigatorio", "posicionamento"].includes(r.tipo) && (r.texto ?? "").trim(),
      );
      if (regras.length) {
        const { error } = await ag.from("regras").insert(
          regras.slice(0, 8).map((r) => ({
            id: crypto.randomUUID(),
            cliente_id: clienteId,
            tipo: r.tipo,
            texto: r.texto.trim(),
            porque: (r.porque ?? "").trim() || null,
            termos: Array.isArray(r.termos) ? r.termos.filter(Boolean).slice(0, 20) : [],
            desde: new Date().toISOString().slice(0, 10),
          })),
        );
        if (error) throw error;
      }
      return json({ ok: true, campos: Object.keys(update).length, regras: regras.length });
    }

    // ---------- ler: propõe a partir do material ----------
    const { data: material } = await ag
      .from("cliente_conhecimento")
      .select("nome, texto")
      .eq("cliente_id", clienteId)
      .order("enviado_em", { ascending: false })
      .limit(40);

    const materiais = (material ?? [])
      .filter((m: { texto?: string | null }) => (m.texto ?? "").trim().length > 40)
      .map((m: { nome: string; texto: string }) => ({ nome: m.nome, texto: m.texto }));

    if (!materiais.length) {
      return json({ error: "Esta conta ainda não tem material com texto para ler." }, 422);
    }

    const { usados, cortados } = aparar(materiais);

    const jaPreenchido = CAMPOS
      .map(([id]) => ({ campo: id, valor: String((conta as Record<string, unknown>)[id] ?? "") }))
      .filter((c) => c.valor.trim());

    const pedido = [
      `# A CONTA\nNome: ${conta.nome}\nTipo cadastrado: ${conta.tipo ?? "—"}\nCidade: ${conta.cidade ?? "—"}`,
      `# MATERIAL RECEBIDO\n${usados.map((m) => `--- DOCUMENTO: ${m.nome} ---\n${m.texto}`).join("\n\n")}`,
      `# OS CAMPOS\n${CAMPOS.map(([id, nome, pede]) => `- \`${id}\` (${nome}): ${pede}`).join("\n")}`,
      jaPreenchido.length
        ? `# O QUE JÁ ESTÁ NA FICHA — NÃO REESCREVA\n${jaPreenchido.map((c) => `## ${c.campo}\n${c.valor}`).join("\n\n")}\n\n# ESTA LEITURA É DE ACRÉSCIMO\nEm \`valor\`, devolva SOMENTE o que o material ACRESCENTA a cada campo. Não repita nem reescreva o que já está lá. Campo vazio é a resposta mais comum aqui.\nSe o material CONTRADIZ a ficha, devolva o campo vazio e mande a divergência como regra do tipo \`posicionamento\`.`
        : "",
      "Devolva um item por campo, todos presentes mesmo quando vazios.",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODELO,
        instructions: sistema(),
        input: [{ role: "user", content: [{ type: "input_text", text: pedido }] }],
        store: false,
        reasoning: { effort: "medium" },
        text: { format: { type: "json_schema", name: "ficha", strict: true, schema: ESQUEMA } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[agencia-ficha] gateway", res.status, txt.slice(0, 600));
      await logAiUsage({
        admin, provider: "lovable", model: MODELO, agente_tipo: "ficha", unidade: "agencia",
        agente_slug: "ficha", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
        user_id: user.id, status: "error", error_message: `status ${res.status}`,
      });
      if (res.status === 429) return json({ error: "Muitas chamadas de IA agora. Tente em alguns minutos." }, 429);
      if (res.status === 402) return json({ error: "Os créditos de IA do workspace acabaram." }, 402);
      return json({ error: "A IA não respondeu agora." }, res.status || 500);
    }

    const data = await res.json();
    const texto: string = data.output_text
      ?? (data.output ?? [])
        .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
        .map((c: { text?: string }) => c.text ?? "")
        .join("");

    let lido: { sugestoes?: unknown[]; regras?: unknown[] } = {};
    try {
      lido = JSON.parse(texto);
    } catch {
      console.error("[agencia-ficha] resposta fora do formato:", String(texto).slice(0, 400));
      return json({ error: "A IA não devolveu a ficha no formato esperado." }, 502);
    }

    await logAiUsage({
      admin, provider: "lovable", model: MODELO, agente_tipo: "ficha", unidade: "agencia",
      agente_slug: "ficha", agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
      user_id: user.id, status: "success",
      usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens },
    });

    return json({
      ok: true,
      sugestoes: (lido.sugestoes ?? []).filter((s) => CAMPOS_VALIDOS.has((s as { campo: string }).campo)),
      regras: lido.regras ?? [],
      documentos: usados.map((m) => m.nome),
      cortados,
      acrescimo: jaPreenchido.length > 0,
    });
  } catch (e) {
    return respostaDeErro("agencia-ficha", e);
  }
});
