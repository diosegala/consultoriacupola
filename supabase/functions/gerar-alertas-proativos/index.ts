// Edge Function: gerar-alertas-proativos
// Roda 1x/dia via pg_cron. Varre o portfólio de cada consultor e cria notificações
// proativas na tabela `notificacoes` (com sugestão de ação em texto e, para
// reengajamento, um rascunho de mensagem gerado via Claude salvo em metadata).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERIOD_DAYS: Record<string, number> = {
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};
const TOLERANCIA_DIAS = 7;
const CHECKLIST_STALE_DIAS = 14;
const OKR_STALE_DIAS = 30;
const CONTRATO_JANELA_DIAS = 45;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary = {
    sem_contato: 0,
    checklist_parado: 0,
    okr_sem_progresso: 0,
    contrato_sem_renovacao: 0,
    resumo_diario: 0,
    ai_calls: 0,
  };

  try {
    const hoje = new Date();
    const hojeISO = hoje.toISOString().slice(0, 10);

    // Mapear consultor -> user_id
    const { data: cuMap } = await admin.from("consultor_user").select("consultor_id, user_id");
    const userByConsultor = new Map<string, string>(
      (cuMap ?? []).map((r: any) => [r.consultor_id, r.user_id]),
    );

    // --------- 1. Clientes sem contato ---------
    const { data: atendimentos } = await admin
      .from("atendimentos")
      .select("cliente_id, periodicidade, ultima_reuniao, clientes!inner(id, nome, consultor_id, status)")
      .eq("clientes.status", "ativo");

    for (const at of atendimentos ?? []) {
      const cli: any = (at as any).clientes;
      if (!cli?.consultor_id) continue;
      const userId = userByConsultor.get(cli.consultor_id);
      if (!userId) continue;

      const periodo = PERIOD_DAYS[(at as any).periodicidade] ?? 30;
      const limite = periodo + TOLERANCIA_DIAS;

      // Última reunião real
      const { data: ult } = await admin
        .from("reunioes")
        .select("data_reuniao")
        .eq("cliente_id", cli.id)
        .order("data_reuniao", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ultimaData = ult?.data_reuniao ?? (at as any).ultima_reuniao;
      if (!ultimaData) continue;

      const dias = daysBetween(hoje, new Date(ultimaData + "T00:00:00"));
      if (dias < limite) continue;

      // Dedup: já existe notificação não lida para este cliente/tipo?
      const { data: exists } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "sem_contato")
        .eq("entidade_id", cli.id)
        .eq("lida", false)
        .maybeSingle();
      if (exists) continue;

      // Buscar último item de checklist concluído como gancho
      const { data: gancho } = await admin
        .from("projeto_checklist")
        .select("titulo, projetos!inner(cliente_id)")
        .eq("projetos.cliente_id", cli.id)
        .eq("concluido", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Gerar mensagem via Claude
      let mensagem_sugerida = "";
      const prompt = `Gere uma mensagem breve, cordial e profissional (máx. 3 frases, tom brasileiro informal-corporativo) para reengajar um cliente de consultoria imobiliária chamado "${cli.nome}" que está há ${dias} dias sem contato com seu consultor.${
        gancho?.titulo ? ` Use como gancho a última etapa concluída: "${gancho.titulo}".` : ""
      } Não inclua saudação genérica tipo "Espero que esteja bem". Vá direto ao ponto e proponha um call rápido. Responda apenas com o texto da mensagem, sem aspas.`;

      const r = await callClaude({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      });
      summary.ai_calls++;
      if (r.ok && r.text) {
        mensagem_sugerida = r.text.trim();
      }
      await logAiUsage({
        admin,
        agente_tipo: "alerta_reengajamento",
        usage: r.usage,
        cliente_id: cli.id,
        consultor_id: cli.consultor_id,
        status: r.ok ? "success" : "error",
        error_message: r.errorMessage ?? null,
      });

      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "sem_contato",
        titulo: `${cli.nome} está há ${dias} dias sem contato`,
        descricao: `Periodicidade combinada: ${(at as any).periodicidade}. Sugestão: enviar mensagem de reengajamento e agendar próxima reunião.`,
        link: `/clientes/${cli.id}`,
        entidade_tipo: "cliente",
        entidade_id: cli.id,
        metadata: {
          dias_sem_contato: dias,
          ultima_reuniao: ultimaData,
          periodicidade: (at as any).periodicidade,
          gancho_checklist: gancho?.titulo ?? null,
          mensagem_sugerida,
        },
      });
      summary.sem_contato++;
    }

    // --------- 2. Checklist parado ---------
    const staleChecklist = new Date(hoje);
    staleChecklist.setDate(staleChecklist.getDate() - CHECKLIST_STALE_DIAS);
    const staleChecklistISO = staleChecklist.toISOString();

    const { data: projetosStale } = await admin
      .from("projetos")
      .select("id, cliente_id, consultor_id, updated_at, clientes(nome), projeto_checklist(id, concluido)")
      .lt("updated_at", staleChecklistISO);

    for (const p of projetosStale ?? []) {
      const items = ((p as any).projeto_checklist ?? []) as Array<{ concluido: boolean }>;
      if (!items.length) continue;
      if (items.every((i) => i.concluido)) continue;
      const userId = userByConsultor.get((p as any).consultor_id);
      if (!userId) continue;

      const { data: exists } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "checklist_parado")
        .eq("entidade_id", (p as any).id)
        .eq("lida", false)
        .maybeSingle();
      if (exists) continue;

      const dias = daysBetween(hoje, new Date((p as any).updated_at));
      const cliNome = (p as any).clientes?.nome ?? "projeto";
      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "checklist_parado",
        titulo: `Projeto de ${cliNome} sem movimentação há ${dias} dias`,
        descricao: "Sugestão: revisar o checklist, atualizar responsáveis ou marcar itens concluídos.",
        link: `/projetos`,
        entidade_tipo: "projeto",
        entidade_id: (p as any).id,
        metadata: { dias_sem_movimentacao: dias, cliente_nome: cliNome },
      });
      summary.checklist_parado++;
    }

    // --------- 3. OKRs sem progresso ---------
    // Aproximação: atendimento com trimestre_okrs definido cujo updated_at é > 30 dias
    // e sem reunião registrada nos últimos 30 dias.
    const staleOkr = new Date(hoje);
    staleOkr.setDate(staleOkr.getDate() - OKR_STALE_DIAS);
    const staleOkrISO = staleOkr.toISOString().slice(0, 10);

    const { data: okrs } = await admin
      .from("atendimentos")
      .select("cliente_id, trimestre_okrs, updated_at, clientes!inner(id, nome, consultor_id, status)")
      .not("trimestre_okrs", "is", null)
      .eq("clientes.status", "ativo");

    for (const at of okrs ?? []) {
      const cli: any = (at as any).clientes;
      if (!cli?.consultor_id) continue;
      const userId = userByConsultor.get(cli.consultor_id);
      if (!userId) continue;

      const { count } = await admin
        .from("reunioes")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cli.id)
        .gte("data_reuniao", staleOkrISO);
      if ((count ?? 0) > 0) continue;

      const { data: exists } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "okr_sem_progresso")
        .eq("entidade_id", cli.id)
        .eq("lida", false)
        .maybeSingle();
      if (exists) continue;

      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "okr_sem_progresso",
        titulo: `OKRs de ${cli.nome} sem progresso há +30 dias`,
        descricao: `Trimestre: ${(at as any).trimestre_okrs}. Sugestão: agendar checkpoint de OKRs.`,
        link: `/clientes/${cli.id}`,
        entidade_tipo: "cliente",
        entidade_id: cli.id,
        metadata: { trimestre: (at as any).trimestre_okrs },
      });
      summary.okr_sem_progresso++;
    }

    // --------- 4. Contratos vencendo em 45 dias sem renovação ---------
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + CONTRATO_JANELA_DIAS);
    const limiteISO = limite.toISOString().slice(0, 10);

    const { data: contratos } = await admin
      .from("contratos")
      .select("id, data_fim, cliente_id, clientes!inner(id, nome, consultor_id), projetos(tipo)")
      .eq("ativo", true)
      .is("encerrado_em", null)
      .gte("data_fim", hojeISO)
      .lte("data_fim", limiteISO);

    for (const c of contratos ?? []) {
      const cli: any = (c as any).clientes;
      if (!cli?.consultor_id) continue;
      const userId = userByConsultor.get(cli.consultor_id);
      if (!userId) continue;

      const jaTemRenov = ((c as any).projetos ?? []).some((p: any) => p.tipo === "renovacao");
      if (jaTemRenov) continue;

      const { data: exists } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "contrato_sem_renovacao")
        .eq("entidade_id", (c as any).id)
        .eq("lida", false)
        .maybeSingle();
      if (exists) continue;

      const dias = daysBetween(new Date((c as any).data_fim + "T00:00:00"), hoje);
      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "contrato_sem_renovacao",
        titulo: `Contrato de ${cli.nome} vence em ${dias} dias sem renovação iniciada`,
        descricao: "Sugestão: abrir card de renovação no Kanban e agendar reunião de balanço.",
        link: `/clientes/${cli.id}`,
        entidade_tipo: "contrato",
        entidade_id: (c as any).id,
        metadata: { dias_para_vencer: dias, data_fim: (c as any).data_fim },
      });
      summary.contrato_sem_renovacao++;
    }

    // --------- 5. Resumo diário ---------
    const { data: consultores } = await admin.from("consultor_user").select("user_id");
    const inicioDia = new Date(hoje);
    inicioDia.setHours(0, 0, 0, 0);
    for (const c of consultores ?? []) {
      const userId = (c as any).user_id as string;
      const { count } = await admin
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lida", false)
        .in("tipo", ["sem_contato", "checklist_parado", "okr_sem_progresso", "contrato_sem_renovacao"]);
      const total = count ?? 0;
      if (total === 0) continue;

      // dedup: já enviou resumo hoje?
      const { data: existsResumo } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "resumo_diario")
        .gte("created_at", inicioDia.toISOString())
        .maybeSingle();
      if (existsResumo) continue;

      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "resumo_diario",
        titulo: `Você tem ${total} ${total === 1 ? "ação sugerida" : "ações sugeridas"} hoje`,
        descricao: "Abra Meu Painel para ver os detalhes e agir com um clique.",
        link: "/meu-painel",
        entidade_tipo: null,
        entidade_id: null,
        metadata: { total_acoes: total },
      });
      summary.resumo_diario++;
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[gerar-alertas-proativos] erro", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err), summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});