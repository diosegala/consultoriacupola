// Conversa com os agentes da unidade Agência.
// Usa o gateway de IA da Lovable (chave única das duas unidades) e grava
// sessão, mensagens e consumo etiquetado por unidade/agente/cliente/pessoa.
//
// O prompt leva o contexto em camadas do CupolaOS (_shared/agencia-contexto.ts):
// a camada da CUPOLA, a conta (perfil, identidade, regras, situação, mercado e
// material) ou, sem conta, o funil que aponta a conta certa. Depois da resposta,
// a conferência procura termo vetado pelas regras da conta.
//
// Com `stream: true`, a resposta chega à tela aos pedaços (SSE):
//   {tipo:"sessao", sessao_id} → {tipo:"delta", texto}… → {tipo:"fim", …} | {tipo:"erro", error}
import { logAiUsage } from "../_shared/ai-usage.ts";
import { contextoAgencia, corsHeaders, ErroHttp, exigirCliente, json, respostaDeErro } from "../_shared/agencia.ts";
import {
  camadaDaCupola,
  conferir,
  MARCA_CONTA,
  montarConta,
  montarSistema,
  type ProjetoDoContexto,
} from "../_shared/agencia-contexto.ts";

const MODELO = "openai/gpt-6-astra";
/** Os dois modos mudam a profundidade do raciocínio, não o modelo. */
const ESFORCO = { rapido: "low", apurado: "high" } as const;
const novoId = () => crypto.randomUUID();

interface Corpo {
  agente_slug?: string;
  sessao_id?: string | null;
  cliente_id?: string | null;
  projeto_id?: string | null;
  mensagem?: string;
  modo?: "rapido" | "apurado";
  stream?: boolean;
}

type Uso = { input_tokens?: number; output_tokens?: number };

/** Lê o stream do gateway (Responses API), repassando cada pedaço de texto. */
async function lerResposta(res: Response, aoPedaco: (t: string) => void): Promise<{ texto: string; usage: Uso }> {
  let texto = "";
  let usage: Uso = {};
  const reader = res.body!.getReader();
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
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
          texto += ev.delta;
          aoPedaco(ev.delta);
        }
        if (ev.type === "response.completed" && ev.response?.usage) {
          usage = { input_tokens: ev.response.usage.input_tokens, output_tokens: ev.response.usage.output_tokens };
        }
      } catch (_) { /* evento parcial */ }
    }
  }
  return { texto, usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "A chave de IA não está configurada." }, 500);

    // Só quem tem ficha ativa na agência conversa com os agentes dela.
    // `ag` fala com o banco como a pessoa: agente (espaço/beta), sessão e conta passam pela RLS.
    const { user, pessoa, db: ag, admin } = await contextoAgencia(req);

    const body = (await req.json().catch(() => ({}))) as Corpo;
    const slug = (body.agente_slug ?? "").trim();
    const pergunta = (body.mensagem ?? "").trim();
    const modo = body.modo === "apurado" ? "apurado" : "rapido";
    if (!slug) return json({ error: "Informe o agente." }, 400);
    if (!pergunta) return json({ error: "Escreva uma mensagem." }, 400);
    if (pergunta.length > 20000) return json({ error: "Mensagem muito longa." }, 400);

    const { data: agente } = await ag
      .from("agentes").select("id, slug, nome, resumo, descricao, espaco_id, espacos(nome)").eq("slug", slug).maybeSingle();
    if (!agente) return json({ error: "Agente não encontrado." }, 404);

    // Sessão: reaproveita a informada (só se for da própria pessoa) ou cria uma nova.
    let sessaoId = body.sessao_id?.trim() || null;
    let clienteId = body.cliente_id?.trim() || null;
    let projetoId = body.projeto_id?.trim() || null;
    if (sessaoId) {
      const { data: sessao } = await ag
        .from("sessoes").select("id, pessoa_id, agente_id, cliente_id, projeto_id").eq("id", sessaoId).maybeSingle();
      if (!sessao || sessao.pessoa_id !== pessoa.id) throw new ErroHttp(403, "Esta conversa não é sua.");
      if (sessao.agente_id !== agente.id) throw new ErroHttp(400, "Esta conversa é de outro agente.");
      // A tela pode trocar a conta no meio da conversa; sem conta no pedido, vale a da sessão.
      clienteId = clienteId ?? sessao.cliente_id ?? null;
      projetoId = projetoId ?? sessao.projeto_id ?? null;
    }

    // Projeto (pela RLS): a conversa dentro dele leva as regras e o contexto do projeto.
    let projeto: ProjetoDoContexto | null = null;
    if (projetoId) {
      const { data: pj } = await ag
        .from("projetos").select("id, nome, status, contexto, cliente_id").eq("id", projetoId).maybeSingle();
      if (!pj) throw new ErroHttp(403, "Você não tem acesso a este projeto.");
      projeto = { id: pj.id, nome: pj.nome, status: pj.status, contexto: pj.contexto ?? "" };
      clienteId = clienteId ?? pj.cliente_id ?? null;
    }
    if (clienteId) await exigirCliente(ag, clienteId);

    if (!sessaoId) {
      sessaoId = novoId();
      const { error: sErr } = await ag.from("sessoes").insert({
        id: sessaoId,
        agente_id: agente.id,
        pessoa_id: pessoa.id,
        espaco_id: agente.espaco_id ?? null,
        cliente_id: clienteId,
        projeto_id: projetoId,
        titulo: pergunta.slice(0, 80),
        atualizada_em: new Date().toISOString(),
      });
      if (sErr) throw sErr;
    }

    // Contexto em camadas + histórico (as 30 mensagens mais recentes, em ordem).
    const [organizacao, conta, contasDoFunil, historicoDesc] = await Promise.all([
      camadaDaCupola(ag),
      clienteId ? montarConta(ag, clienteId, projeto) : Promise.resolve(null),
      clienteId
        ? Promise.resolve({ data: [] as { id: string; nome: string }[] })
        : ag.from("clientes").select("id, nome").eq("arquivado", false).order("nome").limit(200),
      ag.from("mensagens").select("papel, conteudo").eq("sessao_id", sessaoId).in("papel", ["pessoa", "agente"])
        .order("criada_em", { ascending: false }).limit(30),
    ]);
    const historico = [...(historicoDesc.data ?? [])].reverse();
    const contas = (contasDoFunil.data ?? []) as { id: string; nome: string }[];

    const espaco = agente.espacos as { nome?: string } | { nome?: string }[] | null;
    const area = Array.isArray(espaco) ? espaco[0]?.nome : espaco?.nome;
    const instrucoes = montarSistema({
      agente,
      area: area ?? null,
      pessoa,
      organizacao,
      conta,
      contas,
    });

    const input = [
      ...historico.map((m: { papel: string; conteudo: string }) => ({
        role: m.papel === "agente" ? "assistant" : "user",
        content: [{ type: m.papel === "agente" ? "output_text" : "input_text", text: m.conteudo }],
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
        instructions: instrucoes,
        input,
        stream: true,
        store: false,
        reasoning: { effort: ESFORCO[modo], summary: "auto" },
      }),
    });

    const etiqueta = {
      admin, provider: "lovable", model: MODELO, agente_tipo: agente.slug, unidade: "agencia" as const,
      agente_slug: agente.slug, agencia_cliente_id: clienteId, agencia_pessoa_id: pessoa.id,
      sessao_id: sessaoId, user_id: user.id,
    };

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      console.error("[agencia-conversar] gateway", res.status, txt.slice(0, 500));
      await logAiUsage({ ...etiqueta, status: "error", error_message: `status ${res.status}` });
      if (res.status === 429) return json({ error: "Muitas chamadas de IA agora. Tente em alguns minutos." }, 429);
      if (res.status === 402) return json({ error: "Os créditos de IA do workspace acabaram." }, 402);
      return json({ error: "A IA não respondeu agora." }, res.status || 500);
    }

    /** Grava a volta, confere as regras e devolve o fechamento. */
    const fechar = async (bruto: string, usage: Uso) => {
      // A marca de conta some do texto; vira botão na tela (só se for conta que a pessoa vê).
      const marca = bruto.match(MARCA_CONTA)?.[1] ?? null;
      const contaSugerida = marca && contas.some((c) => c.id === marca) ? marca : null;
      const resposta = bruto.replace(MARCA_CONTA, "").trim();
      const conferencia = conta ? conferir(resposta, conta.regras) : [];

      const agora = Date.now();
      const mensagemId = novoId();
      const { error: mErr } = await ag.from("mensagens").insert([
        { id: novoId(), sessao_id: sessaoId, papel: "pessoa", conteudo: pergunta, criada_em: new Date(agora).toISOString() },
        {
          id: mensagemId, sessao_id: sessaoId, papel: "agente", conteudo: resposta,
          criada_em: new Date(agora + 1).toISOString(), conta_sugerida: contaSugerida,
        },
      ]);
      if (mErr) console.error("[agencia-conversar] gravar mensagens", mErr);
      await ag.from("sessoes").update({ atualizada_em: new Date(agora).toISOString() }).eq("id", sessaoId);
      await logAiUsage({ ...etiqueta, usage, status: "success" });

      return { ok: true, sessao_id: sessaoId, mensagem_id: mensagemId, resposta, conferencia, conta_sugerida: contaSugerida };
    };

    if (!body.stream) {
      const { texto, usage } = await lerResposta(res, () => {});
      return json(await fechar(texto, usage));
    }

    const codificar = new TextEncoder();
    const fluxo = new ReadableStream({
      async start(controller) {
        const enviar = (ev: unknown) => controller.enqueue(codificar.encode(`data: ${JSON.stringify(ev)}\n\n`));
        try {
          enviar({ tipo: "sessao", sessao_id: sessaoId });
          const { texto, usage } = await lerResposta(res, (t) => enviar({ tipo: "delta", texto: t }));
          enviar({ tipo: "fim", ...(await fechar(texto, usage)) });
        } catch (e) {
          console.error("[agencia-conversar] stream", e);
          await logAiUsage({ ...etiqueta, status: "error", error_message: e instanceof Error ? e.message : "stream" });
          enviar({ tipo: "erro", error: "A resposta foi interrompida. Tente de novo." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(fluxo, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    return respostaDeErro("agencia-conversar", e);
  }
});
