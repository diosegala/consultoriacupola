// Lógica pura de detecção de risco de churn a partir do score de engajamento
// do cliente (reunioes.score_cliente). Compartilhada entre o painel do diretor
// e a edge function de alertas proativos (que replica estas constantes).

export const RISCO_SCORE_CRITICO = 6.0;
export const RISCO_MEDIA_CRITICA = 6.5;
export const RISCO_QUEDA_MINIMA = 1.5;
export const RISCO_MIN_REUNIOES = 2;
export const RISCO_JANELA_DIAS = 180;

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
 * Recebe as reuniões com score do cliente (qualquer ordem) e devolve a
 * avaliação de risco, ou null quando não há sinal de alerta.
 */
export function avaliarRiscoEngajamento(
  reunioes: ReuniaoScore[],
  opts: { contratoVenceEmDias?: number | null } = {},
): AvaliacaoRisco | null {
  const desc = [...reunioes]
    .filter((r) => r.score_cliente != null && !Number.isNaN(Number(r.score_cliente)))
    .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao));

  if (desc.length < RISCO_MIN_REUNIOES) return null;

  const scores = desc.map((r) => Number(r.score_cliente));
  const scoreAtual = scores[0];
  const recentes = scores.slice(0, 3);
  const anteriores = scores.slice(3, 6);
  const mediaRecente = media(recentes);
  const mediaAnterior = anteriores.length >= 2 ? media(anteriores) : null;
  const variacao = mediaAnterior != null ? mediaRecente - mediaAnterior : null;

  const motivos: string[] = [];
  let severidade: SeveridadeRisco | null = null;

  if (scoreAtual < RISCO_SCORE_CRITICO) {
    severidade = 'critico';
    motivos.push(`Última reunião com score ${scoreAtual.toFixed(1)} (abaixo de ${RISCO_SCORE_CRITICO.toFixed(1)})`);
  }
  if (recentes.length >= 2 && mediaRecente < RISCO_MEDIA_CRITICA) {
    severidade = 'critico';
    motivos.push(`Média das últimas ${recentes.length} reuniões em ${mediaRecente.toFixed(1)}`);
  }
  if (variacao != null && variacao <= -RISCO_QUEDA_MINIMA) {
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
  if (venceEm != null && venceEm >= 0 && venceEm <= 90) {
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
