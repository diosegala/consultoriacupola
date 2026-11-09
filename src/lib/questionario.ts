export interface Pergunta {
  id: string;
  tipo:
    | 'texto_curto'
    | 'texto_longo'
    | 'numero'
    | 'data'
    | 'escolha_unica'
    | 'escolha_multipla'
    | 'sim_nao'
    | 'escala_1_10';
  label: string;
  obrigatorio?: boolean;
  opcoes?: string[];
  sufixo?: string;
  /** Número da pergunta na planilha original (ex.: "1.10"). */
  codigo?: string;
  /** Orientação para o consultor/cliente, exibida sob a pergunta. */
  dica?: string;
  /** `false` = inativa (não aparece no preenchimento). Ausente = ativa. */
  ativo?: boolean;
  /** Por que a pergunta foi alterada ou inativada na revisão. */
  nota_revisao?: string;
}

export interface Secao {
  id: string;
  titulo: string;
  descricao?: string;
  perguntas: Pergunta[];
}

export interface Estrutura {
  secoes: Secao[];
}

export const isAtiva = (p: Pergunta) => p.ativo !== false;

/** Estrutura só com as perguntas ativas (seções vazias somem). */
export function estruturaAtiva(e: Estrutura): Estrutura {
  return {
    secoes: (e.secoes ?? [])
      .map((s) => ({ ...s, perguntas: s.perguntas.filter(isAtiva) }))
      .filter((s) => s.perguntas.length > 0),
  };
}

/** Respostas com o texto da pergunta como chave, para alimentar os agentes de IA. */
export function respostasComRotulos(
  e: Estrutura | null | undefined,
  respostas: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!e || !respostas) return out;
  for (const s of e.secoes ?? []) {
    for (const p of s.perguntas) {
      const v = respostas[p.id];
      if (!isPreenchida(p, v)) continue;
      out[`${s.titulo} › ${p.codigo ? p.codigo + ' ' : ''}${p.label}`] = v;
    }
  }
  return out;
}

export function isPreenchida(p: Pergunta, v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== '';
}

export function calcularProgresso(estrutura: Estrutura, respostas: Record<string, unknown>) {
  const perguntas = estrutura.secoes.flatMap((s) => s.perguntas).filter(isAtiva);
  if (!perguntas.length) return { pct: 0, faltam: [] as string[] };
  let preenchidas = 0;
  const faltam: string[] = [];
  for (const p of perguntas) {
    if (isPreenchida(p, respostas[p.id])) preenchidas++;
    else if (p.obrigatorio) faltam.push(p.id);
  }
  return { pct: Math.round((preenchidas / perguntas.length) * 100), faltam };
}

export function progressoSecao(s: Secao, respostas: Record<string, unknown>) {
  const ativas = s.perguntas.filter(isAtiva);
  if (!ativas.length) return { pct: 0, preenchidas: 0, total: 0 };
  const preenchidas = ativas.filter((p) => isPreenchida(p, respostas[p.id])).length;
  return { pct: Math.round((preenchidas / ativas.length) * 100), preenchidas, total: ativas.length };
}
export const SEGMENTOS_QUESTIONARIO = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'locacao', label: 'Locação' },
] as const;
export type SegmentoQuestionario = (typeof SEGMENTOS_QUESTIONARIO)[number]['id'];
