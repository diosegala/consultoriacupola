import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_PROMPTS: Record<string, string> = {
  diagnostico: "Você é um consultor sênior. Elabore um diagnóstico empresarial completo em markdown.",
  okrs: "Você é um especialista em OKRs. Crie OKRs para o próximo trimestre em markdown.",
  briefing_cliente_oculto: "Você é um especialista em cliente oculto. Elabore um briefing completo em markdown.",
};

const MAX_PROMPT_BASE_CHARS = 4_000;
const MAX_DOCUMENTO_MODELO_CHARS = 3_000;
const MAX_HISTORICO_DOC_CHARS = 1_500;
const MAX_HISTORICO_DOCS = 2;
const MAX_TRANSCRICAO_CHARS = 5_000;
const MAX_TRANSCRICOES = 2;
const MAX_QUESTIONARIO_CHARS = 4_000;
const MAX_CONTEXTO_USUARIO_CHARS = 2_500;
const MAX_ANOTACOES_CHARS = 3_000;

function limitarTexto(texto: unknown, limite: number) {
  if (typeof texto !== "string") return "";
  const limpo = texto.trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite)}\n\n[conteúdo truncado automaticamente para respeitar o limite de tokens da IA]`;
}

function conteudoInvalidoDeFonte(texto: unknown) {
  if (typeof texto !== "string") return false;
  const inicio = texto.trim().slice(0, 2_000).toLowerCase();
  return (
    inicio.startsWith("<!doctype html") ||
    inicio.startsWith("<html") ||
    inicio.includes("accounts.google.com") ||
    inicio.includes("service_login") ||
    inicio.includes("google accounts")
  );
}

function documentoGeradoPorFalhaDeAcesso(texto: unknown) {
  if (typeof texto !== "string") return false;
  const inicio = texto.trim().slice(0, 1_500).toLowerCase();
  return (
    inicio.includes("não consegui acessar") ||
    inicio.includes("não tenho acesso") ||
    inicio.includes("tela de login do google") ||
    inicio.includes("páginas de login do google") ||
    inicio.includes("html de páginas de login") ||
    inicio.includes("códigos html de páginas de login")
  );
}

function extrairMensagemErroAnthropic(status: number, body: string) {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message;
    if (typeof message === "string") {
      if (status === 429 && message.includes("input tokens per minute")) {
        return "O contexto enviado ao Claude ficou maior que o limite por minuto. Reduzi automaticamente o contexto; tente gerar novamente em alguns minutos.";
      }
      if (status === 429) {
        return "Limite de requisições da Anthropic atingido. Tente novamente em alguns minutos.";
      }
      return `Erro da Anthropic (${status}): ${message}`;
    }
  } catch (_) {
    // mantém mensagem genérica abaixo
  }
  return status === 429
    ? "Limite de requisições da Anthropic atingido. Tente novamente em alguns minutos."
    : `Erro da Anthropic (${status}).`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const {
      tipo,
      projeto_id,
      cliente_id: cliente_id_in,
      contexto_usuario,
      transcricoes_textos,
      questionario_data,
      anotacoes_consultor,
      trimestre,
      canais_atendimento,
      titulo_doc,
    }: {
      tipo: string;
      projeto_id?: string | null;
      cliente_id?: string | null;
      contexto_usuario?: string;
      transcricoes_textos?: Array<{ label?: string; conteudo: string }>;
      questionario_data?: Record<string, unknown> | null;
      anotacoes_consultor?: string;
      trimestre?: string;
      canais_atendimento?: string[];
      titulo_doc?: string;
    } = await req.json();

    if (!tipo || (!projeto_id && !cliente_id_in)) {
      return new Response(JSON.stringify({ error: "tipo e (projeto_id OU cliente_id) são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validTypes = ["diagnostico", "okrs", "briefing_cliente_oculto"];
    if (!validTypes.includes(tipo)) {
      return new Response(JSON.stringify({ error: "Tipo inválido. Use: diagnostico, okrs, briefing_cliente_oculto" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch prompt from database using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: promptData } = await serviceClient
      .from("agente_prompts")
      .select("prompt, documento_modelo, provedor")
      .eq("tipo", tipo)
      .single();

    const promptBase = limitarTexto(promptData?.prompt || FALLBACK_PROMPTS[tipo], MAX_PROMPT_BASE_CHARS);
    const documentoModelo = limitarTexto(promptData?.documento_modelo, MAX_DOCUMENTO_MODELO_CHARS);
    const provedorConfigurado = promptData?.provedor || "anthropic";
    // Gemini direto está sem cota no projeto; enquanto seguimos apenas com Claude,
    // qualquer configuração legada em "gemini" deve cair no Anthropic em vez de chamar Google.
    const provedor = provedorConfigurado === "openai" ? "openai" : "anthropic";

    // Resolver contexto: por projeto OU por cliente
    let projeto: any = null;
    let clienteId = cliente_id_in ?? null;
    let consultorIdContexto: string | null = null;

    if (projeto_id) {
      const { data: p, error: projetoError } = await supabase
        .from("projetos")
        .select("*, clientes(nome, cidade, uf, status, consultor_id), consultores(nome), contratos(tipo_consultoria_id, data_inicio, data_fim)")
        .eq("id", projeto_id)
        .single();
      if (projetoError || !p) {
        return new Response(JSON.stringify({ error: "Projeto não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      projeto = p;
      clienteId = p.cliente_id;
      consultorIdContexto = p.consultor_id ?? p.clientes?.consultor_id ?? null;
    } else {
      const { data: cli, error: cliErr } = await supabase
        .from("clientes")
        .select("id, nome, cidade, uf, status, consultor_id, consultores(nome)")
        .eq("id", clienteId!)
        .single();
      if (cliErr || !cli) {
        return new Response(JSON.stringify({ error: "Cliente não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      projeto = {
        cliente_id: cli.id,
        observacoes: null,
        clientes: cli,
        consultores: cli.consultores,
      };
      consultorIdContexto = cli.consultor_id;
    }

    // Histórico de documentos (últimos 5) — busca por projeto E por cliente
    const histQ = supabase
      .from("projeto_documentos")
      .select("tipo, conteudo, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    const { data: docsHistorico } = projeto_id
      ? await histQ.eq("projeto_id", projeto_id)
      : await histQ.eq("cliente_id", clienteId!);

    const relevanciaPorTipo: Record<string, string[]> = {
      okrs: ["diagnostico", "okrs"],
      briefing_cliente_oculto: ["diagnostico", "okrs"],
      diagnostico: ["diagnostico"],
    };
    const tiposRelevantes = relevanciaPorTipo[tipo] ?? [];
    const docsFiltrados = (docsHistorico ?? []).filter((d: any) =>
      tiposRelevantes.includes(d.tipo) && !documentoGeradoPorFalhaDeAcesso(d.conteudo),
    );

    const historicoSection = docsFiltrados.length
      ? `\n\nUse os documentos históricos abaixo como contexto para gerar o novo documento. Para OKRs, o diagnóstico mais recente é a referência principal. Para diagnósticos novos, compare com os anteriores e aponte evolução.\n\n=== HISTÓRICO DO PROJETO ===\n${docsFiltrados.slice(0, MAX_HISTORICO_DOCS).map((d: any) => `\n[${d.tipo} — ${new Date(d.created_at).toLocaleDateString("pt-BR")}]:\n${limitarTexto(d.conteudo, MAX_HISTORICO_DOC_CHARS)}`).join("\n\n")}\n========================`
      : "";

    const { data: reunioes } = await supabase
      .from("reunioes")
      .select("data_reuniao, duracao_minutos, resumo_ia, score_ia, analise_ia, score_cliente, analise_cliente")
      .eq("cliente_id", projeto.cliente_id)
      .eq("status_analise", "concluido")
      .order("data_reuniao", { ascending: false })
      .limit(10);

    const { data: checklist } = projeto_id
      ? await supabase
          .from("projeto_checklist")
          .select("titulo, concluido")
          .eq("projeto_id", projeto_id)
          .order("ordem")
      : { data: [] as any[] };

    const { data: onboarding } = await supabase
      .from("onboarding")
      .select("*")
      .eq("cliente_id", projeto.cliente_id)
      .limit(1);

    const contexto = `
## Dados do Cliente
- Nome: ${projeto.clientes?.nome ?? "N/A"}
- Cidade/UF: ${projeto.clientes?.cidade ?? "N/A"} / ${projeto.clientes?.uf ?? "N/A"}
- Status: ${projeto.clientes?.status ?? "N/A"}

## Observações do Projeto
${projeto.observacoes || "Sem observações registradas."}

## Checklist do Projeto
${checklist?.length ? checklist.map((c: any) => `- [${c.concluido ? "x" : " "}] ${c.titulo}`).join("\n") : "Sem itens no checklist."}

## Reuniões Analisadas (${reunioes?.length ?? 0})
${reunioes?.length ? reunioes.map((r: any) => `
### Reunião ${r.data_reuniao}${r.duracao_minutos ? ` (${r.duracao_minutos} min)` : ""}
- Score Consultor: ${r.score_ia ?? "N/A"}
- Score Cliente: ${r.score_cliente ?? "N/A"}
${r.resumo_ia ? `- Resumo: ${r.resumo_ia}` : ""}
`).join("\n") : "Nenhuma reunião analisada."}

## Onboarding
${onboarding?.[0] ? `- Etapa atual: ${onboarding[0].etapa_atual}\n- Observações: ${onboarding[0].observacoes ?? "N/A"}` : "Sem dados de onboarding."}
`.trim();

    // Novas seções vindas da aba Agentes (nível cliente)
    const questionarioSection = questionario_data && Object.keys(questionario_data).length
      ? `\n\n## Questionário de Pré-Onboarding (respostas do cliente)\n${limitarTexto(JSON.stringify(questionario_data, null, 2), MAX_QUESTIONARIO_CHARS)}`
      : '';

    const anotacoesSection = anotacoes_consultor
      ? `\n\n## Anotações do Consultor (visita, contexto in loco)\n${limitarTexto(anotacoes_consultor, MAX_ANOTACOES_CHARS)}`
      : '';

    const canaisSection = canais_atendimento && canais_atendimento.length
      ? `\n\n## Canais de atendimento a avaliar\n${canais_atendimento.join(', ')}`
      : '';

    const trimestreSection = trimestre
      ? `\n\n## Trimestre de referência\n${trimestre}`
      : '';

    const contextoUsuarioSection = contexto_usuario
      ? `\n\n## Contexto adicional do consultor\n${limitarTexto(contexto_usuario, MAX_CONTEXTO_USUARIO_CHARS)}`
      : '';

    const documentoModeloSection = documentoModelo
      ? `\n\n## Documento Modelo de Referência\n${documentoModelo}\n\nUse o documento acima como referência de estilo, tom e estrutura.`
      : '';

    const transcricoesValidas = (transcricoes_textos ?? []).filter((t) =>
      t?.conteudo && !conteudoInvalidoDeFonte(t.conteudo),
    );

    const transcricoesSectionLimitada = transcricoesValidas.length
      ? `\n\n## Transcrições das Entrevistas da Imersão\n${transcricoesValidas
          .slice(0, MAX_TRANSCRICOES)
          .map((t, i) => `\n### ${t.label || `Transcrição ${i + 1}`}\n${limitarTexto(t.conteudo, MAX_TRANSCRICAO_CHARS)}`)
          .join("\n")}`
      : '';

    if ((transcricoes_textos?.length ?? 0) > 0 && transcricoesValidas.length === 0 && !questionarioSection && !anotacoesSection && !contextoUsuarioSection) {
      return new Response(JSON.stringify({
        error: "As transcrições anexadas não puderam ser lidas corretamente. Reprocesse os links/arquivos antes de gerar o diagnóstico.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const promptCompleto = `${promptBase}${historicoSection}\n\n---\n\nINFORMAÇÕES DO CLIENTE:\n\n${contexto}${questionarioSection}${transcricoesSectionLimitada}${anotacoesSection}${trimestreSection}${canaisSection}${contextoUsuarioSection}${documentoModeloSection}`;

    let conteudo = "";
    let lastStatus = 500;
    let lastErrorMessage = "Erro na API de IA";

    if (provedor === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada. Adicione a chave nas configurações." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: `${promptBase}${historicoSection}` },
            { role: "user", content: `${contexto}${questionarioSection}${transcricoesSectionLimitada}${anotacoesSection}${trimestreSection}${canaisSection}${contextoUsuarioSection}${documentoModeloSection}` },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (openaiResponse.ok) {
        const openaiData = await openaiResponse.json();
        conteudo = openaiData.choices?.[0]?.message?.content ?? "";
      } else {
        const errText = await openaiResponse.text();
        console.error("OpenAI API error:", openaiResponse.status, errText);
        lastStatus = openaiResponse.status;
        lastErrorMessage = openaiResponse.status === 429
          ? "Limite de requisições da OpenAI atingido. Tente novamente em alguns minutos."
          : `Erro da OpenAI (${openaiResponse.status}).`;
      }
    } else if (provedor === "anthropic") {
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada. Adicione a chave nas configurações para usar Claude." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 3000,
          system: `${promptBase}${historicoSection}`,
          messages: [
            { role: "user", content: `${contexto}${questionarioSection}${transcricoesSectionLimitada}${anotacoesSection}${trimestreSection}${canaisSection}${contextoUsuarioSection}${documentoModeloSection}` },
          ],
        }),
      });
      if (anthropicResponse.ok) {
        const anthropicData = await anthropicResponse.json();
        conteudo = anthropicData.content?.[0]?.text ?? "";
      } else {
        const errText = await anthropicResponse.text();
        console.error("Anthropic API error:", anthropicResponse.status, errText);
        lastStatus = anthropicResponse.status;
        lastErrorMessage = extrairMensagemErroAnthropic(anthropicResponse.status, errText);
      }
    }

    if (!conteudo) {
      return new Response(JSON.stringify({ error: lastErrorMessage }), {
        status: lastStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tentar criar Google Doc (best-effort)
    let gdoc_url: string | null = null;
    if (consultorIdContexto) {
      try {
        const tituloLabel: Record<string, string> = {
          diagnostico: "Diagnóstico",
          okrs: "OKRs",
          briefing_cliente_oculto: "Briefing Cliente Oculto",
        };
        const tituloBase = titulo_doc
          || `${tituloLabel[tipo] ?? tipo} — ${projeto.clientes?.nome ?? ""} — ${new Date().toLocaleDateString("pt-BR")}`;
        const gdocRes = await supabase.functions.invoke("criar-gdoc", {
          body: { titulo: tituloBase, conteudo_markdown: conteudo },
        });
        if (!gdocRes.error && (gdocRes.data as any)?.url) {
          gdoc_url = (gdocRes.data as any).url;
        } else {
          console.warn("criar-gdoc falhou (best-effort):", gdocRes.error ?? gdocRes.data);
        }
      } catch (e) {
        console.warn("criar-gdoc threw:", e);
      }
    }

    const insertPayload: Record<string, unknown> = {
      tipo,
      conteudo,
      created_by: userId,
      gdoc_url,
    };
    if (projeto_id) insertPayload.projeto_id = projeto_id;
    else insertPayload.cliente_id = clienteId;

    const { data: docInserted, error: insertError } = await serviceClient
      .from("projeto_documentos")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) console.error("Insert error:", insertError);

    return new Response(JSON.stringify({ conteudo, gdoc_url, documento: docInserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agente-projeto error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
