// Lógica pura de detecção de risco de churn a partir do score de engajamento
// do cliente (reunioes.score_cliente). Os limiares vêm da tabela
// `politicas_decisao` (tipo = 'risco_churn'); as constantes abaixo servem
// apenas como fallback/valores default.

export interface ParametrosRiscoChurn {
  score_critico: number;
  media_critica: number;
  queda_minima: number;
  min_reunioes: number;
  janela_dias: number;
  contrato_vence_em_dias: number;
}

export const PARAMETROS_RISCO_CHURN_DEFAULT: ParametrosRiscoChurn = {
  score_critico: 6.0,
  media_critica: 6.5,
  queda_minima: 1.5,
  min_reunioes: 2,
  janela_dias: 180,
  contrato_vence_em_dias: 90,
};

/** @deprecated use PARAMETROS_RISCO_CHURN_DEFAULT */
export const RISCO_SCORE_CRITICO = PARAMETROS_RISCO_CHURN_DEFAULT.score_critico;
/** @deprecated use PARAMETROS_RISCO_CHURN_DEFAULT */
export const RISCO_MEDIA_CRITICA = PARAMETROS_RISCO_CHURN_DEFAULT.media_critica;
/** @deprecated use PARAMETROS_RISCO_CHURN_DEFAULT */
export const RISCO_QUEDA_MINIMA = PARAMETROS_RISCO_CHURN_DEFAULT.queda_minima;
/** @deprecated use PARAMETROS_RISCO_CHURN_DEFAULT */
export const RISCO_MIN_REUNIOES = PARAMETROS_RISCO_CHURN_DEFAULT.min_reunioes;
/** @deprecated use PARAMETROS_RISCO_CHURN_DEFAULT */
export const RISCO_JANELA_DIAS = PARAMETROS_RISCO_CHURN_DEFAULT.janela_dias;

export function normalizarParametrosRiscoChurn(raw: unknown): ParametrosRiscoChurn {
  const p = (raw ?? {}) as Partial<Record<keyof ParametrosRiscoChurn, unknown>>;
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    score_critico: num(p.score_critico, PARAMETROS_RISCO_CHURN_DEFAULT.score_critico),
    media_critica: num(p.media_critica, PARAMETROS_RISCO_CHURN_DEFAULT.media_critica),
    queda_minima: num(p.queda_minima, PARAMETROS_RISCO_CHURN_DEFAULT.queda_minima),
    min_reunioes: num(p.min_reunioes, PARAMETROS_RISCO_CHURN_DEFAULT.min_reunioes),
    janela_dias: num(p.janela_dias, PARAMETROS_RISCO_CHURN_DEFAULT.janela_dias),
    contrato_vence_em_dias: num(
      p.contrato_vence_em_dias,
      PARAMETROS_RISCO_CHURN_DEFAULT.contrato_vence_em_dias,
    ),
  };
}

export type SeveridadeRisco = 'critico' | 'atencao';

export interface ReuniaoScore {
  data_reuniao: string;
  score_cliente: number;
}

export interface AvaliacaoRisco {
  severidade: SeveridadeRisco;
  motivos: string[];
  scoreAtual: number;
  mediaRecente: number;
  mediaAnterior: number | null;
  variacao: number | null;
  serie: number[]; // ordem cronológica (mais antigo -> mais recente)
  ultimaData: string;
  totalAvaliadas: number;
}

function media(arr: number[]): number {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

/**
 * Recebe as reuniões com score do cliente (qualquer ordem) e os parâmetros de
 * política vigentes, e devolve a avaliação de risco ou null quando não há
 * sinal de alerta.
 */
export function avaliarRiscoEngajamento(
  reunioes: ReuniaoScore[],
  parametros: ParametrosRiscoChurn = PARAMETROS_RISCO_CHURN_DEFAULT,
  opts: { contratoVenceEmDias?: number | null } = {},
): AvaliacaoRisco | null {
  const p = parametros;
  const desc = [...reunioes]
    .filter((r) => r.score_cliente != null && !Number.isNaN(Number(r.score_cliente)))
    .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao));

  if (desc.length < p.min_reunioes) return null;

  const scores = desc.map((r) => Number(r.score_cliente));
  const scoreAtual = scores[0];
  const recentes = scores.slice(0, 3);
  const anteriores = scores.slice(3, 6);
  const mediaRecente = media(recentes);
  const mediaAnterior = anteriores.length >= 2 ? media(anteriores) : null;
  const variacao = mediaAnterior != null ? mediaRecente - mediaAnterior : null;

  const motivos: string[] = [];
  let severidade: SeveridadeRisco | null = null;

  if (scoreAtual < p.score_critico) {
    severidade = 'critico';
    motivos.push(`Última reunião com score ${scoreAtual.toFixed(1)} (abaixo de ${p.score_critico.toFixed(1)})`);
  }
  if (recentes.length >= 2 && mediaRecente < p.media_critica) {
    severidade = 'critico';
    motivos.push(`Média das últimas ${recentes.length} reuniões em ${mediaRecente.toFixed(1)}`);
  }
  if (variacao != null && variacao <= -p.queda_minima) {
    severidade = severidade ?? 'atencao';
    motivos.push(
      `Queda de ${Math.abs(variacao).toFixed(1)} ponto(s): ${mediaAnterior!.toFixed(1)} → ${mediaRecente.toFixed(1)}`,
    );
  }
  if (scores.length >= 3 && scores[0] < scores[1] && scores[1] < scores[2]) {
    severidade = severidade ?? 'atencao';
    motivos.push('Três reuniões seguidas em queda contínua');
  }

  if (!severidade) return null;

  const venceEm = opts.contratoVenceEmDias;
  if (venceEm != null && venceEm >= 0 && venceEm <= p.contrato_vence_em_dias) {
    motivos.push(`Contrato vence em ${venceEm} dia(s) — risco direto de não renovação`);
    severidade = 'critico';
  }

  return {
    severidade,
    motivos,
    scoreAtual,
    mediaRecente: Math.round(mediaRecente * 10) / 10,
    mediaAnterior: mediaAnterior != null ? Math.round(mediaAnterior * 10) / 10 : null,
    variacao: variacao != null ? Math.round(variacao * 10) / 10 : null,
    serie: scores.slice(0, 8).reverse(),
    ultimaData: desc[0].data_reuniao,
    totalAvaliadas: desc.length,
  };
}
