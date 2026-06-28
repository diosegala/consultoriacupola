import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface RelatorioPeriodo {
  from: Date;
  to: Date;
}

export interface RelatorioMesPonto {
  mes: string; // yyyy-MM
  label: string; // MMM/yy
  reunioes: number;
  score_medio: number | null;
}

export interface RelatorioDocPorTipo {
  tipo: string;
  label: string;
  total: number;
}

export interface RelatorioPortfolioItem {
  cliente_id: string;
  cliente_nome: string;
  status: string;
  etapa: string | null;
  ultima_reuniao: string | null;
  proxima_reuniao: string | null;
  score_cliente_medio: number | null;
  em_alerta: boolean;
}

export interface RelatorioConsultor {
  reunioes_total: number;
  score_medio: number | null;
  documentos_total: number;
  documentos_por_tipo: RelatorioDocPorTipo[];
  checklist_concluidos: number;
  checklist_total: number;
  checklist_taxa: number;
  clientes_ativos: number;
  clientes_encerrados_no_periodo: number;
  evolucao_mensal: RelatorioMesPonto[];
  portfolio: RelatorioPortfolioItem[];
}

const TIPO_LABEL: Record<string, string> = {
  diagnostico: "Diagnóstico",
  okrs: "OKRs",
  briefing_cliente_oculto: "Briefing Cliente Oculto",
};

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function monthsBetween(from: Date, to: Date): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    months.push({
      key: format(cur, "yyyy-MM"),
      label: format(cur, "MMM/yy"),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export function useRelatorioConsultor(consultorId: string | undefined, periodo: RelatorioPeriodo) {
  return useQuery<RelatorioConsultor>({
    queryKey: ["relatorio-consultor", consultorId, ymd(periodo.from), ymd(periodo.to)],
    enabled: !!consultorId,
    queryFn: async () => {
      const fromDate = ymd(periodo.from);
      const toDate = ymd(periodo.to);
      const toDateTime = `${toDate}T23:59:59`;

      const [reunioesRes, docsRes, checklistRes, clientesRes, atendimentosRes, projetosClienteRes, scoreClienteRes, encerramentosRes] = await Promise.all([
        // 1. Reuniões do período (com score_ia)
        supabase
          .from("reunioes")
          .select("id, data_reuniao, score_ia, status_analise, cliente_id")
          .eq("consultor_id", consultorId!)
          .gte("data_reuniao", fromDate)
          .lte("data_reuniao", toDate),

        // 2. Documentos gerados nos projetos do consultor no período
        supabase
          .from("projeto_documentos")
          .select("id, tipo, created_at, projetos!inner(consultor_id)")
          .eq("projetos.consultor_id", consultorId!)
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", toDateTime),

        // 3. Checklist de todos os projetos ativos do consultor
        supabase
          .from("projeto_checklist")
          .select("id, concluido, projetos!inner(consultor_id)")
          .eq("projetos.consultor_id", consultorId!),

        // 4. Clientes do consultor
        supabase
          .from("clientes")
          .select("id, nome, status, updated_at")
          .eq("consultor_id", consultorId!),

        // 5. Atendimentos para próxima/última reunião do portfólio
        supabase
          .from("atendimentos")
          .select("cliente_id, ultima_reuniao, proxima_reuniao"),

        // 6. Projetos ativos do consultor com etapa atual
        supabase
          .from("projetos")
          .select("cliente_id, projetos_etapas(nome)")
          .eq("consultor_id", consultorId!),

        // 7. Score cliente médio por cliente (reuniões com analise_cliente)
        supabase
          .from("reunioes")
          .select("cliente_id, score_cliente")
          .eq("consultor_id", consultorId!)
          .not("score_cliente", "is", null),

        // 8. Encerramentos no período (para contar clientes encerrados)
        supabase
          .from("encerramentos")
          .select("cliente_id, data_encerramento")
          .gte("data_encerramento", fromDate)
          .lte("data_encerramento", toDate),
      ]);

      if (reunioesRes.error) throw reunioesRes.error;
      if (docsRes.error) throw docsRes.error;
      if (checklistRes.error) throw checklistRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (atendimentosRes.error) throw atendimentosRes.error;
      if (projetosClienteRes.error) throw projetosClienteRes.error;
      if (scoreClienteRes.error) throw scoreClienteRes.error;
      if (encerramentosRes.error) throw encerramentosRes.error;

      const reunioes = reunioesRes.data || [];
      const docs = docsRes.data || [];
      const checklist = checklistRes.data || [];
      const clientes = clientesRes.data || [];
      const atendimentos = atendimentosRes.data || [];
      const projetosCli = (projetosClienteRes.data || []) as any[];
      const scoresCliente = scoreClienteRes.data || [];
      const encerrados = encerramentosRes.data || [];

      // Reuniões mensais
      const meses = monthsBetween(periodo.from, periodo.to);
      const evolucao: RelatorioMesPonto[] = meses.map((m) => {
        const doMes = reunioes.filter((r) => format(new Date(r.data_reuniao), "yyyy-MM") === m.key);
        const comScore = doMes.filter((r) => r.score_ia != null);
        const score = comScore.length > 0 ? comScore.reduce((s, r) => s + Number(r.score_ia), 0) / comScore.length : null;
        return {
          mes: m.key,
          label: m.label,
          reunioes: doMes.length,
          score_medio: score != null ? Math.round(score * 10) / 10 : null,
        };
      });

      // Score médio geral
      const comScoreAll = reunioes.filter((r) => r.score_ia != null);
      const scoreMedio = comScoreAll.length > 0
        ? Math.round((comScoreAll.reduce((s, r) => s + Number(r.score_ia), 0) / comScoreAll.length) * 10) / 10
        : null;

      // Documentos por tipo
      const docsByTipo = new Map<string, number>();
      docs.forEach((d: any) => {
        const t = d.tipo || "outro";
        docsByTipo.set(t, (docsByTipo.get(t) || 0) + 1);
      });
      const documentos_por_tipo: RelatorioDocPorTipo[] = Array.from(docsByTipo.entries()).map(([tipo, total]) => ({
        tipo,
        label: TIPO_LABEL[tipo] || tipo,
        total,
      }));

      // Checklist
      const checklist_total = checklist.length;
      const checklist_concluidos = checklist.filter((c) => c.concluido).length;
      const checklist_taxa = checklist_total > 0 ? Math.round((checklist_concluidos / checklist_total) * 100) : 0;

      // Portfólio
      const etapaByCliente = new Map<string, string>();
      projetosCli.forEach((p) => {
        if (p.cliente_id && p.projetos_etapas?.nome) etapaByCliente.set(p.cliente_id, p.projetos_etapas.nome);
      });
      const atByCliente = new Map<string, { ultima: string | null; proxima: string | null }>();
      atendimentos.forEach((a) => atByCliente.set(a.cliente_id, { ultima: a.ultima_reuniao, proxima: a.proxima_reuniao }));
      const scoreByCliente = new Map<string, number[]>();
      scoresCliente.forEach((s) => {
        const arr = scoreByCliente.get(s.cliente_id) || [];
        arr.push(Number(s.score_cliente));
        scoreByCliente.set(s.cliente_id, arr);
      });

      const hoje = new Date();
      const trintaDiasAtras = new Date(hoje);
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

      const portfolio: RelatorioPortfolioItem[] = clientes
        .filter((c) => c.status === "ativo" || c.status === "novo")
        .map((c) => {
          const at = atByCliente.get(c.id);
          const scores = scoreByCliente.get(c.id) || [];
          const scoreAvg = scores.length > 0 ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10 : null;
          const proxima = at?.proxima ? new Date(at.proxima) : null;
          const ultima = at?.ultima ? new Date(at.ultima) : null;
          const proximaVencida = proxima ? proxima < hoje : false;
          const semReuniaoRecente = !ultima || ultima < trintaDiasAtras;
          return {
            cliente_id: c.id,
            cliente_nome: c.nome,
            status: c.status,
            etapa: etapaByCliente.get(c.id) || null,
            ultima_reuniao: at?.ultima || null,
            proxima_reuniao: at?.proxima || null,
            score_cliente_medio: scoreAvg,
            em_alerta: proximaVencida || semReuniaoRecente,
          };
        })
        .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome));

      const clientesIdsConsultor = new Set(clientes.map((c) => c.id));
      const clientes_encerrados_no_periodo = encerrados.filter((e) => clientesIdsConsultor.has(e.cliente_id)).length;

      return {
        reunioes_total: reunioes.length,
        score_medio: scoreMedio,
        documentos_total: docs.length,
        documentos_por_tipo,
        checklist_concluidos,
        checklist_total,
        checklist_taxa,
        clientes_ativos: portfolio.length,
        clientes_encerrados_no_periodo,
        evolucao_mensal: evolucao,
        portfolio,
      };
    },
  });
}

// Hook leve para resumo inline na lista de consultores (mês atual)
export function useResumoMesAtual(consultorId: string | undefined) {
  return useQuery({
    queryKey: ["resumo-mes-consultor", consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      const { data, error } = await supabase
        .from("reunioes")
        .select("id, score_ia")
        .eq("consultor_id", consultorId!)
        .gte("data_reuniao", ymd(inicio))
        .lte("data_reuniao", ymd(fim));
      if (error) throw error;
      const total = data?.length || 0;
      const comScore = (data || []).filter((r) => r.score_ia != null);
      const score = comScore.length > 0
        ? Math.round((comScore.reduce((s, r) => s + Number(r.score_ia), 0) / comScore.length) * 10) / 10
        : null;
      return { total_mes: total, score_medio_mes: score };
    },
    staleTime: 60_000,
  });
}