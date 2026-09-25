// Inteligência de mercado da Agência: lê os feeds das fontes e guarda o que interessa.
// Leitor de feed copiado do CupolaOS (_shared/rss.ts); a triagem, que era Gemini lá,
// roda aqui pela chave única do gateway.
import { logAiUsage } from "../_shared/ai-usage.ts";
import { contextoAgencia, corsHeaders, ErroHttp, json, respostaDeErro } from "../_shared/agencia.ts";
import { buscarFeed } from "../_shared/rss.ts";

const MODELO = "openai/gpt-6-astra";
const POR_FONTE = 25;

/** Vocabulário fechado: tema livre vira sinônimo e a lista deixa de filtrar. */
const TEMAS = [
  "crédito imobiliário",
  "juros e economia",
  "lançamentos e incorporação",
  "locação",
  "preços e índices",
  "construção civil",
  "regulação e tributos",
  "comportamento do comprador",
  "mercado de luxo",
  "tecnologia e proptech",
];

const SISTEMA = [
  "Você separa, no meio do noticiário brasileiro, o que serve a uma agência de marketing",
  "que atende imobiliárias e incorporadoras.",
  "",
  "INTERESSA quando a matéria ajuda alguém a escrever, planejar ou argumentar sobre",
  "compra, venda, locação, financiamento, construção ou preço de imóvel — inclusive",
  "economia que mexe nisso: Selic, inflação, crédito, renda, emprego.",
  "",
  "NÃO INTERESSA o resto do noticiário, por mais importante que seja: loteria, esporte,",
  "política sem efeito no setor, tecnologia geral, celebridade, acidente, saúde.",
  "Na dúvida entre um assunto que toca o setor de longe e um que não toca, diga que não",
  "interessa: acervo com ruído deixa de ser consultado, e uma matéria a menos custa",
  "muito menos que dez a mais.",
  "",
  "REGIÃO: devolva `Nacional` quando o assunto vale para o país inteiro — é o caso",
  "da maioria. Devolva a sigla da UF (`PR`, `SC`, `SP`) só quando a matéria for",
  "especificamente daquela praça. Nunca as duas coisas juntas.",
  "",
  `TEMAS: escolha de um a dois desta lista, e de nenhuma outra: ${TEMAS.join("; ")}.`,
  "",
  "PORQUE: uma linha curta. Em português, direto, sem 'esta matéria'.",
].join("\n");

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["itens"],
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "interessa", "regioes", "temas", "porque"],
        properties: {
          n: { type: "integer" },
          interessa: { type: "boolean" },
          regioes: { type: "array", items: { type: "string" } },
          temas: { type: "array", items: { type: "string" } },
          porque: { type: "string" },
        },
      },
    },
  },
};

interface ItemFeed {
  titulo: string;
  link: string;
  resumo: string;
  publicadoEm: string;
  imagem: string;
  temas: string[];
}

interface Classificacao {
  interessa: boolean;
  regioes: string[];
  temas: string[];
  porque: string;
}

/** Triagem em lote: uma chamada paga a instrução uma vez só. */
async function classificar(
  itens: ItemFeed[],
  chave: string,
): Promise<{ mapa: Map<number, Classificacao>; usage?: { input_tokens?: number; output_tokens?: number } }> {
  const lista = itens
    .map((i, n) => `${n + 1}. TÍTULO: ${i.titulo}\n   RESUMO: ${i.resumo.slice(0, 300)}`)
    .join("\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": chave, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODELO,
      instructions: SISTEMA,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: `# MATÉRIAS\n${lista}\n\nUm objeto por matéria, na ordem acima, todas presentes.` }],
      }],
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "triagem", strict: true, schema: ESQUEMA } },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[agencia-mercado-ler] gateway", res.status, t.slice(0, 400));
    throw new Error(res.status === 402 ? "Os créditos de IA do workspace acabaram." : "A IA não respondeu na triagem.");
  }

  const data = await res.json();
  const bruto: string = data.output_text
    ?? (data.output ?? []).flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "").join("");

  const mapa = new Map<number, Classificacao>();
  const validos = new Set(TEMAS);
  try {
    const lido = JSON.parse(bruto) as { itens?: Record<string, unknown>[] };
    for (const r of lido.itens ?? []) {
      const i = Number(r.n) - 1;
      if (!Number.isInteger(i) || !itens[i]) continue;
      mapa.set(i, {
        interessa: r.interessa === true,
        regioes: (Array.isArray(r.regioes) ? r.regioes : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3),
        temas: (Array.isArray(r.temas) ? r.temas : [])
          .map((x) => String(x).trim().toLowerCase()).filter((t) => validos.has(t)).slice(0, 2),
        porque: String(r.porque ?? "").trim().slice(0, 160),
      });
    }
  } catch {
    throw new Error("A triagem voltou num formato que não consegui ler.");
  }
  // Matéria que o modelo esqueceu fica de fora — omissão não pode virar "entra tudo".
  return { mapa, usage: data.usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    // Fala com o banco como a pessoa: as regras (RLS) do schema agencia valem aqui também.
    const { user, pessoa, db: ag, admin } = await contextoAgencia(req);

    // Mesma trava de agencia_app.anotar_leitura_da_fonte: precisa abrir a inteligência de mercado.
    const { data: acesso } = await ag
      .from("acessos_funcionalidade").select("nivel")
      .eq("pessoa_id", pessoa.id).eq("funcionalidade", "mercado").maybeSingle();
    if (!["leitura", "escrita", "admin"].includes(acesso?.nivel ?? "")) {
      throw new ErroHttp(403, "Você não tem acesso à inteligência de mercado.");
    }
    // Situação da leitura da fonte (última leitura/erro) é anotação do sistema, como na RPC original.
    const fontesSistema = () => admin.schema("agencia").from("fontes_mercado");

    const body = (await req.json().catch(() => ({}))) as { fonte_id?: string };

    let q = ag.from("fontes_mercado").select("*").not("feed", "is", null);
    if (body.fonte_id) q = q.eq("id", body.fonte_id);
    else q = q.eq("automatica", true);
    const { data: fontes, error: fErr } = await q;
    if (fErr) throw fErr;
    if (!fontes?.length) return json({ error: "Nenhuma fonte com feed para ler." }, 400);

    const resumo: { fonte: string; novas: number; erro?: string }[] = [];

    for (const fonte of fontes) {
      try {
        const feed = await buscarFeed(fonte.feed as string) as { itens: ItemFeed[] };
        const itens = (feed.itens ?? []).slice(0, POR_FONTE);

        const links = itens.map((i) => i.link);
        const { data: jaTem } = await ag.from("leituras").select("link").in("link", links.length ? links : ["-"]);
        const conhecidos = new Set((jaTem ?? []).map((l: { link: string }) => l.link));
        const novos = itens.filter((i) => !conhecidos.has(i.link));

        let classificacoes = new Map<number, Classificacao>();
        if (novos.length && fonte.classificar) {
          if (!lovableKey) throw new Error("A chave de IA não está configurada.");
          const r = await classificar(novos, lovableKey);
          classificacoes = r.mapa;
          await logAiUsage({
            admin, provider: "lovable", model: MODELO, agente_tipo: "mercado-triagem", unidade: "agencia",
            agente_slug: "inteligencia-de-mercado", agencia_pessoa_id: pessoa.id, user_id: user.id,
            status: "success", usage: r.usage,
          });
        }

        const linhas = novos
          .map((item, i) => {
            const c = fonte.classificar ? classificacoes.get(i) : undefined;
            if (fonte.classificar && (!c || !c.interessa)) return null;
            return {
              id: crypto.randomUUID(),
              titulo: item.titulo,
              resumo: item.resumo,
              fonte_id: fonte.id,
              publicado_em: item.publicadoEm,
              regioes: c?.regioes?.length ? c.regioes : (fonte.regioes_padrao ?? []),
              temas: c?.temas?.length ? c.temas : (fonte.temas_padrao ?? []),
              aplica_a: [],
              link: item.link,
              imagem: item.imagem || null,
              porque: c?.porque ?? null,
            };
          })
          .filter(Boolean) as Record<string, unknown>[];

        if (linhas.length) {
          const { error } = await ag.from("leituras").insert(linhas);
          if (error) throw error;
        }

        await fontesSistema()
          .update({ ultima_leitura: new Date().toISOString(), ultimo_erro: null })
          .eq("id", fonte.id);
        resumo.push({ fonte: fonte.nome, novas: linhas.length });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não consegui ler o feed.";
        console.error("[agencia-mercado-ler]", fonte.id, msg);
        await fontesSistema().update({ ultimo_erro: msg }).eq("id", fonte.id);
        resumo.push({ fonte: fonte.nome, novas: 0, erro: msg });
      }
    }

    return json({ ok: true, resumo });
  } catch (e) {
    return respostaDeErro("agencia-mercado-ler", e);
  }
});
