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

export function isPreenchida(p: Pergunta, v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== '';
}

export function calcularProgresso(estrutura: Estrutura, respostas: Record<string, unknown>) {
  const perguntas = estrutura.secoes.flatMap((s) => s.perguntas);
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
  if (!s.perguntas.length) return { pct: 0, preenchidas: 0, total: 0 };
  const preenchidas = s.perguntas.filter((p) => isPreenchida(p, respostas[p.id])).length;
  return { pct: Math.round((preenchidas / s.perguntas.length) * 100), preenchidas, total: s.perguntas.length };
}