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
    briefing_pre_reuniao: 0,
    compromisso_vencido: 0,
    lembrete_gestao: 0,
    briefing_1x1: 0,
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
        metadata: {
          dias_para_vencer: dias,
          data_fim: (c as any).data_fim,
          cliente_id: cli.id,
          link_balanco: `/agentes?agente=balanco_periodo&cliente=${cli.id}`,
        },
      });
      summary.contrato_sem_renovacao++;
    }

    // --------- 4b. Briefing pré-reunião (1 a 2 dias antes) ---------
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const depoisAmanha = new Date(hoje);
    depoisAmanha.setDate(depoisAmanha.getDate() + 2);
    const amanhaISO = amanha.toISOString().slice(0, 10);
    const depoisAmanhaISO = depoisAmanha.toISOString().slice(0, 10);

    const { data: proximas } = await admin
      .from("atendimentos")
      .select("cliente_id, proxima_reuniao, clientes!inner(id, nome, consultor_id, status)")
      .not("proxima_reuniao", "is", null)
      .gte("proxima_reuniao", amanhaISO)
      .lte("proxima_reuniao", depoisAmanhaISO)
      .eq("clientes.status", "ativo");

    for (const at of proximas ?? []) {
      const cli: any = (at as any).clientes;
      if (!cli?.consultor_id) continue;
      const userId = userByConsultor.get(cli.consultor_id);
      if (!userId) continue;

      // dedup por cliente/tipo/reuniao (usa data como entidade auxiliar em metadata)
      const { data: exists } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "briefing_pre_reuniao")
        .eq("entidade_id", cli.id)
        .eq("lida", false)
        .maybeSingle();
      if (exists) continue;

      // Compromissos em aberto do cliente
      const { data: comps } = await admin
        .from("compromissos")
        .select("descricao, responsavel, prazo, status")
        .eq("cliente_id", cli.id)
        .in("status", ["pendente", "adiado"])
        .order("prazo", { ascending: true, nullsFirst: false });

      const doCliente = (comps ?? []).filter((c: any) => c.responsavel === "cliente");
      const doConsultor = (comps ?? []).filter((c: any) => c.responsavel === "consultor");

      const fmt = (list: any[]) =>
        list.length
          ? list
              .map((c: any) => {
                const vencido = c.prazo && c.prazo < hojeISO ? " [VENCIDO]" : "";
                const prazo = c.prazo ? ` (prazo: ${c.prazo})` : "";
                return `• ${c.descricao}${prazo}${vencido}`;
              })
              .join("\n")
          : "(nenhum)";

      // Se havia compromissos anteriores e todos os do cliente estão concluídos
      const { count: totalHistorico } = await admin
        .from("compromissos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cli.id)
        .eq("responsavel", "cliente");
      const clienteZerado = (totalHistorico ?? 0) > 0 && doCliente.length === 0;

      const linhas: string[] = [
        `Reunião com ${cli.nome} em ${(at as any).proxima_reuniao}.`,
        "",
        "Compromissos em aberto desde a última reunião:",
        "",
        "DO CLIENTE:",
        fmt(doCliente),
        "",
        "DO CONSULTOR:",
        fmt(doConsultor),
      ];
      if (clienteZerado) {
        linhas.push("", "✓ O cliente concluiu todos os compromissos anteriores — vale reconhecer isso na abertura.");
      }
      linhas.push("", "Sugestão: abra a reunião revisando o status destes itens antes da pauta nova.");

      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "briefing_pre_reuniao",
        titulo: `Briefing pré-reunião — ${cli.nome}`,
        descricao: linhas.join("\n"),
        link: `/clientes/${cli.id}?tab=compromissos`,
        entidade_tipo: "cliente",
        entidade_id: cli.id,
        metadata: {
          data_reuniao: (at as any).proxima_reuniao,
          compromissos_cliente: doCliente.length,
          compromissos_consultor: doConsultor.length,
          cliente_zerado: clienteZerado,
        },
      });
      summary.briefing_pre_reuniao++;
    }

    // --------- 4c. Compromisso do cliente vencido há +3 dias ---------
    const limiteVenc = new Date(hoje);
    limiteVenc.setDate(limiteVenc.getDate() - 3);
    const limiteVencISO = limiteVenc.toISOString().slice(0, 10);

    const { data: vencidos } = await admin
      .from("compromissos")
      .select("id, cliente_id, descricao, prazo, clientes!inner(id, nome, consultor_id, status)")
      .eq("status", "pendente")
      .eq("responsavel", "cliente")
      .lt("prazo", limiteVencISO)
      .eq("clientes.status", "ativo");

    for (const comp of vencidos ?? []) {
      const cli: any = (comp as any).clientes;
      if (!cli?.consultor_id) continue;
      const userId = userByConsultor.get(cli.consultor_id);
      if (!userId) continue;

      const { data: exists } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", userId)
        .eq("tipo", "compromisso_vencido")
        .eq("entidade_id", (comp as any).id)
        .eq("lida", false)
        .maybeSingle();
      if (exists) continue;

      await admin.from("notificacoes").insert({
        user_id: userId,
        tipo: "compromisso_vencido",
        titulo: `Compromisso vencido — ${cli.nome}`,
        descricao: `O cliente ${cli.nome} tem compromisso vencido: ${(comp as any).descricao}. Considere um contato leve de acompanhamento antes da próxima reunião.`,
        link: `/clientes/${cli.id}?tab=compromissos`,
        entidade_tipo: "compromisso",
        entidade_id: (comp as any).id,
        metadata: { prazo: (comp as any).prazo, descricao: (comp as any).descricao },
      });
      summary.compromisso_vencido++;
    }

    // --------- 4d. Cadência de gestão (1:1 / equipe) + briefings 1:1 ---------
    try {
      // Descobre diretores/admins ativos
      const { data: rolesDir } = await admin
        .from("user_roles").select("user_id, role").in("role", ["admin","director"]);
      const diretorUserIds = Array.from(new Set((rolesDir ?? []).map((r: any) => r.user_id)));
      const { data: cuAll } = await admin.from("consultor_user").select("consultor_id, user_id");
      const consultorByUser = new Map<string, string>(
        (cuAll ?? []).map((r: any) => [r.user_id, r.consultor_id]),
      );
      const diretorConsultorIds = new Set(
        diretorUserIds.map((uid) => consultorByUser.get(uid)).filter(Boolean) as string[],
      );
      const { data: consAtivos } = await admin
        .from("consultores").select("id, nome").eq("ativo", true);
      const consultorNome = new Map<string, string>(
        (consAtivos ?? []).map((c: any) => [c.id, c.nome as string]),
      );

      const D14 = 14, D21 = 21;
      for (const diretorUserId of diretorUserIds) {
        const diretorConsultorId = consultorByUser.get(diretorUserId);
        if (!diretorConsultorId) continue;

        // Consultoras da equipe = ativos, exceto o próprio diretor
        const equipe = (consAtivos ?? []).filter((c: any) => c.id !== diretorConsultorId);

        // --- 1:1 sem acontecer há mais de 14 dias por consultora ---
        for (const c of equipe) {
          const { data: ult } = await admin
            .from("reunioes_gestao")
            .select("data_reuniao, participantes")
            .eq("diretor_id", diretorConsultorId)
            .eq("tipo", "individual")
            .contains("participantes", [(c.nome ?? "").split(/\s+/)[0]])
            .order("data_reuniao", { ascending: false })
            .limit(1).maybeSingle();
          const ultDate = ult?.data_reuniao ?? null;
          const dias = ultDate ? daysBetween(hoje, new Date(ultDate + "T00:00:00")) : 999;
          if (dias < D14) continue;

          const { data: exists } = await admin
            .from("notificacoes").select("id")
            .eq("user_id", diretorUserId)
            .eq("tipo", "lembrete_gestao")
            .eq("entidade_id", c.id)
            .eq("lida", false).maybeSingle();
          if (exists) continue;

          await admin.from("notificacoes").insert({
            user_id: diretorUserId,
            tipo: "lembrete_gestao",
            titulo: `1:1 com ${c.nome} está atrasado`,
            descricao: ultDate
              ? `Última reunião individual há ${dias} dias (${ultDate}). Considere agendar um 1:1.`
              : "Nenhuma reunião 1:1 registrada. Considere agendar um encontro.",
            link: `/meu-painel`,
            entidade_tipo: "consultor",
            entidade_id: c.id,
            metadata: { escopo: "individual", consultor_id: c.id, consultor_nome: c.nome, dias },
          });
          summary.lembrete_gestao++;
        }

        // --- Reunião de equipe > 21 dias ---
        const { data: ultEq } = await admin
          .from("reunioes_gestao")
          .select("data_reuniao")
          .eq("diretor_id", diretorConsultorId)
          .eq("tipo", "equipe")
          .order("data_reuniao", { ascending: false })
          .limit(1).maybeSingle();
        const ultEqDate = ultEq?.data_reuniao ?? null;
        const diasEq = ultEqDate ? daysBetween(hoje, new Date(ultEqDate + "T00:00:00")) : 999;
        if (diasEq >= D21) {
          const { data: exists } = await admin
            .from("notificacoes").select("id")
            .eq("user_id", diretorUserId)
            .eq("tipo", "lembrete_gestao")
            .eq("entidade_id", diretorConsultorId)
            .eq("lida", false).maybeSingle();
          if (!exists) {
            await admin.from("notificacoes").insert({
              user_id: diretorUserId,
              tipo: "lembrete_gestao",
              titulo: `Reunião de equipe atrasada`,
              descricao: ultEqDate
                ? `Última reunião de equipe há ${diasEq} dias (${ultEqDate}).`
                : "Nenhuma reunião de equipe registrada.",
              link: `/meu-painel`,
              entidade_tipo: "consultor",
              entidade_id: diretorConsultorId,
              metadata: { escopo: "equipe", dias: diasEq },
            });
            summary.lembrete_gestao++;
          }
        }

        // --- Briefings 1:1 nos próximos 2 dias (via compromissos.google_calendar?) ---
        // Aproximação leve: se houver reuniao_gestao futura em <=2 dias (data), gerar briefing.
        const amanhaISO = (() => { const d = new Date(hoje); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
        const em2ISO = (() => { const d = new Date(hoje); d.setDate(d.getDate()+2); return d.toISOString().slice(0,10); })();

        const { data: proximos } = await admin
          .from("reunioes_gestao")
          .select("id, tipo, participantes, data_reuniao")
          .eq("diretor_id", diretorConsultorId)
          .eq("tipo", "individual")
          .gte("data_reuniao", amanhaISO)
          .lte("data_reuniao", em2ISO);

        for (const pr of proximos ?? []) {
          const { data: exists } = await admin
            .from("notificacoes").select("id")
            .eq("user_id", diretorUserId)
            .eq("tipo", "briefing_1x1")
            .eq("entidade_id", (pr as any).id)
            .eq("lida", false).maybeSingle();
          if (exists) continue;

          const primeiro = ((pr as any).participantes ?? [])[0] ?? "consultora";
          // Tenta identificar a consultora pelo primeiro nome
          const cMatch = (consAtivos ?? []).find((c: any) =>
            (c.nome ?? "").toLowerCase().startsWith(String(primeiro).toLowerCase())
          );
          const cId: string | null = cMatch?.id ?? null;

          // Portfólio ativo
          let portfolio = 0;
          if (cId) {
            const { count } = await admin
              .from("clientes").select("id", { count: "exact", head: true })
              .eq("consultor_id", cId).eq("status", "ativo");
            portfolio = count ?? 0;
          }
          // Últimos 5 scores
          let scoreMedio: number | null = null;
          if (cId) {
            const { data: reunis } = await admin
              .from("reunioes").select("score_ia")
              .eq("consultor_id", cId).eq("status_analise", "concluido")
              .not("score_ia", "is", null)
              .order("data_reuniao", { ascending: false }).limit(5);
            const arr = (reunis ?? []).map((r: any) => Number(r.score_ia)).filter((n) => !isNaN(n));
            if (arr.length) scoreMedio = Math.round((arr.reduce((s,x)=>s+x,0)/arr.length)*10)/10;
          }
          // Alertas pendentes que envolvem clientes dessa consultora
          let alertasPend = 0;
          if (cId) {
            const { data: cliIds } = await admin
              .from("clientes").select("id").eq("consultor_id", cId).eq("status", "ativo");
            const ids = (cliIds ?? []).map((c: any) => c.id);
            if (ids.length) {
              const { count } = await admin
                .from("notificacoes").select("id", { count: "exact", head: true })
                .eq("user_id", diretorUserId)
                .eq("lida", false)
                .in("entidade_id", ids);
              alertasPend = count ?? 0;
            }
          }

          // Lembrete DISC do cruzamento
          let discLembrete = "";
          if (cId) {
            const { data: perfC } = await admin
              .from("perfis_comportamentais").select("perfil_resumo")
              .eq("consultor_id", cId).maybeSingle();
            const { data: cruz } = await admin
              .from("cruzamentos_disc").select("analise")
              .eq("diretor_id", diretorConsultorId).eq("consultor_id", cId).maybeSingle();
            if (perfC?.perfil_resumo) {
              const p = perfC.perfil_resumo as any;
              const partes = [
                `Lembrete de perfil: ${primeiro} é ${p.perfil_primario}/${p.perfil_secundario}.`,
              ];
              if (cruz?.analise) {
                const a = cruz.analise as any;
                if (a.recomendacoes_comunicacao?.length)
                  partes.push(`Comunicação: ${a.recomendacoes_comunicacao.slice(0,2).join("; ")}.`);
                if (a.sinais_de_alerta?.length)
                  partes.push(`Atenção a: ${a.sinais_de_alerta.slice(0,2).join("; ")}.`);
              }
              discLembrete = partes.join(" ");
            }
          }

          const linhas = [
            `Briefing para 1:1 com ${primeiro} em ${(pr as any).data_reuniao}.`,
            "",
            `• Portfólio ativo: ${portfolio} cliente(s)`,
            `• Score médio (últimas 5 reuniões): ${scoreMedio ?? "—"}`,
            `• Alertas pendentes envolvendo clientes dela: ${alertasPend}`,
            "",
            "Sugestão de pauta:",
            "1. Como estão os clientes com alertas abertos?",
            "2. Prioridades da semana e apoio necessário.",
            "3. Um ponto de desenvolvimento pessoal.",
          ];
          if (discLembrete) {
            linhas.push("", discLembrete);
          }

          await admin.from("notificacoes").insert({
            user_id: diretorUserId,
            tipo: "briefing_1x1",
            titulo: `Prepare-se para o 1:1 com ${primeiro}`,
            descricao: linhas.join("\n"),
            link: `/meu-painel`,
            entidade_tipo: "reuniao_gestao",
            entidade_id: (pr as any).id,
            metadata: {
              consultora_nome: primeiro, consultor_id: cId,
              portfolio, score_medio: scoreMedio, alertas_pendentes: alertasPend,
              data_reuniao: (pr as any).data_reuniao,
              disc_lembrete: discLembrete || null,
            },
          });
          summary.briefing_1x1++;
        }
      }
    } catch (gestErr) {
      console.error("[gerar-alertas-proativos] erro bloco gestão:", gestErr);
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
        .in("tipo", ["sem_contato", "checklist_parado", "okr_sem_progresso", "contrato_sem_renovacao", "briefing_pre_reuniao", "compromisso_vencido", "lembrete_gestao", "briefing_1x1", "sentimento_negativo_cliente"]);
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