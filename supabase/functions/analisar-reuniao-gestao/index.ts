// Edge Function: analisar-reuniao-gestao
// Analisa a transcrição de uma reunião de gestão (1:1 ou de equipe) do diretor
// em 5 dimensões (clareza de direção, delegação, escuta ativa, feedback
// construtivo, desenvolvimento). Salva análise estruturada + resumo em
// reunioes_gestao.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Autoriza tanto chamadas de usuário (admin/director) quanto internas
    // (cron/sync), quando não houver Authorization user JWT usamos service role.
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      userId = user?.id ?? null;
    }

    const { reuniao_gestao_id } = await req.json();
    if (!reuniao_gestao_id) {
      return new Response(JSON.stringify({ error: "reuniao_gestao_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reuniao, error: reErr } = await admin
      .from("reunioes_gestao")
      .select("*, consultores!reunioes_gestao_diretor_id_fkey(nome)")
      .eq("id", reuniao_gestao_id)
      .single();

    if (reErr || !reuniao) {
      return new Response(JSON.stringify({ error: "Reunião não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!reuniao.transcricao) {
      return new Response(JSON.stringify({ error: "Reunião sem transcrição" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("reunioes_gestao")
      .update({ status_analise: "analisando" }).eq("id", reuniao_gestao_id);

    // Higieniza transcrição (HTML → texto)
    let transcricao = reuniao.transcricao as string;
    if (/<\s*(html|head|body|div|p|span)\b/i.test(transcricao)) {
      transcricao = transcricao
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    if (transcricao.length > 30000) {
      transcricao = transcricao.slice(0, 30000) + "\n\n[Transcrição truncada]";
    }

    const tipo = reuniao.tipo === "individual" ? "1on1" : (reuniao.tipo as string);
    const tipoLabel =
      tipo === "1on1" ? "1:1"
      : tipo === "weekly" ? "Weekly (alinhamento de execução da semana)"
      : "reunião de equipe";
    const participantes = (reuniao.participantes ?? []).join(", ");

    // --- Contexto DISC (diretor + participantes) ---
    let contextoDisc = "";
    try {
      const diretorId = reuniao.diretor_id as string;
      const { data: perfilDir } = await admin
        .from("perfis_comportamentais")
        .select("perfil_resumo").eq("consultor_id", diretorId).maybeSingle();

      // Mapeia participantes (primeiro nome) → consultor
      const { data: consAtivos } = await admin
        .from("consultores").select("id, nome").eq("ativo", true);
      const consMatched = (reuniao.participantes ?? [])
        .map((p: string) => {
          const first = (p ?? "").trim().split(/\s+/)[0].toLowerCase();
          return (consAtivos ?? []).find((c: any) =>
            (c.nome ?? "").toLowerCase().startsWith(first));
        })
        .filter(Boolean) as Array<{ id: string; nome: string }>;

      const partes: string[] = [];
      if (perfilDir?.perfil_resumo) {
        const p = perfilDir.perfil_resumo as any;
        partes.push(`Perfil DISC do diretor: ${p.perfil_primario}/${p.perfil_secundario} — ${p.estilo_comunicacao ?? ""}. Pontos de atenção: ${(p.pontos_de_atencao ?? []).join("; ")}.`);
      }
      for (const c of consMatched) {
        const { data: perfC } = await admin
          .from("perfis_comportamentais").select("perfil_resumo").eq("consultor_id", c.id).maybeSingle();
        if (perfC?.perfil_resumo) {
          const p = perfC.perfil_resumo as any;
          partes.push(`Perfil DISC de ${c.nome.split(/\s+/)[0]}: ${p.perfil_primario}/${p.perfil_secundario} — ${p.estilo_comunicacao ?? ""}. Necessidades: ${(p.necessidades_do_ambiente ?? []).join("; ")}.`);
        }
        const { data: cruz } = await admin
          .from("cruzamentos_disc").select("analise")
          .eq("diretor_id", diretorId).eq("consultor_id", c.id).maybeSingle();
        if (cruz?.analise) {
          const a = cruz.analise as any;
          partes.push(`Dinâmica ${c.nome.split(/\s+/)[0]} × diretor — pontos de tensão: ${(a.pontos_de_tensao ?? []).join("; ")}. Recomendações: ${(a.recomendacoes_comunicacao ?? []).join("; ")}.`);
        }
      }
      if (partes.length) {
        contextoDisc = `\n\nCONTEXTO DISC (use para contextualizar a análise — por exemplo, se o diretor é D alto e a consultora é S alto, avalie se ele deu espaço para ela se posicionar e se ela conseguiu expressar discordância):\n${partes.join("\n")}\n`;
      }
    } catch (discErr) {
      console.error("[analisar-reuniao-gestao] DISC contexto falhou:", discErr);
    }

    // --- Prompt e schema variam por tipo de reunião ---
    let systemPrompt = "";
    let toolSchema: any = null;

    const acoesSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          responsavel: { type: "string" },
          descricao: { type: "string" },
          prazo: { type: ["string", "null"] },
        },
        required: ["responsavel", "descricao"],
      },
    };

    if (tipo === "1on1") {
      systemPrompt = `Você é um analista de qualidade de reuniões 1:1 (individuais de desenvolvimento) em consultoria.
Foco: como o diretor apoia o desenvolvimento, dá feedback e escuta. Ignore alinhamentos operacionais de tarefas — isso é assunto de Weekly.

Seja OBJETIVO e ENXUTO. Resuma em no máximo 4 linhas.

Avalie 3 dimensões (nota 0-10):
1. Escuta ativa — deu espaço, fez perguntas, validou entendimento?
2. Feedback construtivo — reconheceu pontos fortes e apontou melhorias de forma específica?
3. Desenvolvimento — provocou reflexão, sugeriu leituras/repertório, apoiou crescimento?

Extraia: 1 ponto forte, 1 sugestão principal de melhoria (2-3 frases), até 3 ações combinadas.
Se houver contexto DISC abaixo, personalize a sugestão de melhoria.${contextoDisc}`;

      toolSchema = {
        type: "object",
        properties: {
          resumo: { type: "string", description: "Até 4 linhas, direto ao ponto." },
          scores: {
            type: "object",
            properties: {
              escuta_ativa: { type: "number" },
              feedback_construtivo: { type: "number" },
              desenvolvimento: { type: "number" },
            },
            required: ["escuta_ativa", "feedback_construtivo", "desenvolvimento"],
          },
          pontos_fortes: { type: "array", items: { type: "string" }, description: "Exatamente 1 item." },
          sugestao_melhoria: { type: "string" },
          acoes: acoesSchema,
        },
        required: ["resumo", "scores", "pontos_fortes", "sugestao_melhoria", "acoes"],
      };
    } else if (tipo === "weekly") {
      systemPrompt = `Você é um analista de reuniões Weekly em consultoria — alinhamento operacional de execução da semana entre diretor e consultora.
Foco: prioridades da semana, bloqueios e follow-up de tarefas anteriores. NÃO avalie desenvolvimento pessoal (isso é assunto de 1:1).

Seja ENXUTO. Resumo em no máximo 3 linhas. Sem seção de "pontos fortes".

Avalie 3 dimensões (nota 0-10):
1. Clareza de prioridades — a consultora sai da reunião sabendo o que fazer nesta semana?
2. Identificação de bloqueios — dependências e riscos foram levantados e endereçados?
3. Follow-up — houve verificação do que ficou combinado na semana anterior?

Extraia: lista de compromissos da semana (tarefa · responsável · prazo), lista de bloqueios identificados, 1 sugestão principal de melhoria (2 frases).
Se houver contexto DISC abaixo, considere-o ao sugerir melhorias.${contextoDisc}`;

      toolSchema = {
        type: "object",
        properties: {
          resumo: { type: "string", description: "Até 3 linhas." },
          scores: {
            type: "object",
            properties: {
              clareza_prioridades: { type: "number" },
              identificacao_bloqueios: { type: "number" },
              follow_up: { type: "number" },
            },
            required: ["clareza_prioridades", "identificacao_bloqueios", "follow_up"],
          },
          bloqueios: { type: "array", items: { type: "string" } },
          sugestao_melhoria: { type: "string" },
          acoes: acoesSchema,
        },
        required: ["resumo", "scores", "bloqueios", "sugestao_melhoria", "acoes"],
      };
    } else {
      // equipe
      systemPrompt = `Você é um analista de qualidade de reuniões de equipe em consultoria.
Foco: como o diretor conduz o grupo — clareza, delegação, escuta, feedback e desenvolvimento coletivo.

Seja ENXUTO. Resumo em no máximo 5 bullets (frases curtas).

Avalie 5 dimensões (nota 0-10): clareza_direcao, delegacao, escuta_ativa, feedback_construtivo, desenvolvimento.
Extraia: 2-3 pontos fortes, 1 sugestão principal de melhoria, ações combinadas (com responsável e prazo se explícitos).
Se houver contexto DISC abaixo, personalize a sugestão de melhoria.${contextoDisc}`;

      toolSchema = {
        type: "object",
        properties: {
          resumo: { type: "string", description: "Até 5 bullets curtos, separados por '\\n- '." },
          scores: {
            type: "object",
            properties: {
              clareza_direcao: { type: "number" },
              delegacao: { type: "number" },
              escuta_ativa: { type: "number" },
              feedback_construtivo: { type: "number" },
              desenvolvimento: { type: "number" },
            },
            required: ["clareza_direcao","delegacao","escuta_ativa","feedback_construtivo","desenvolvimento"],
          },
          pontos_fortes: { type: "array", items: { type: "string" } },
          sugestao_melhoria: { type: "string" },
          acoes: acoesSchema,
        },
        required: ["resumo", "scores", "pontos_fortes", "sugestao_melhoria", "acoes"],
      };
    }

    const userPrompt = `Diretor: ${reuniao.consultores?.nome ?? "—"}
Tipo: ${tipoLabel}
Participantes: ${participantes || "—"}
Data: ${reuniao.data_reuniao}

TRANSCRIÇÃO:
${transcricao}`;

    const claude = await callClaude({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 2000,
      tools: [{
        name: "registrar_analise_gestao",
        description: "Registra a análise da reunião de gestão",
        input_schema: toolSchema,
      }],
      tool_choice: { type: "tool", name: "registrar_analise_gestao" },
    });

    if (!claude.ok || !claude.toolInput) {
      await admin.from("reunioes_gestao")
        .update({ status_analise: "erro" }).eq("id", reuniao_gestao_id);
      await logAiUsage({
        admin, agente_tipo: "analise_reuniao_gestao", user_id: userId,
        consultor_id: reuniao.diretor_id, status: "error",
        error_message: claude.errorMessage ?? "sem toolInput",
      });
      return new Response(JSON.stringify({ error: claude.errorMessage ?? "Falha IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAiUsage({
      admin, agente_tipo: "analise_reuniao_gestao", user_id: userId,
      consultor_id: reuniao.diretor_id, usage: claude.usage,
    });

    const out = claude.toolInput as any;
    await admin.from("reunioes_gestao").update({
      resumo_ia: out.resumo ?? "",
      analise_ia: { ...out, tipo },
      status_analise: "concluido",
    }).eq("id", reuniao_gestao_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[analisar-reuniao-gestao]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});