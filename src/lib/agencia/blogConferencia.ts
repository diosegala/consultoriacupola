// Conferência mecânica do post — copiada do CupolaOS (servidor/blog-conferencia.ts).
// Roda no navegador, não chama IA: aponta onde o revisor precisa olhar.
/* ------------------------------------------------------------------ *
 * 1. Números sem lastro — a Prioridade 1 da Elaine
 * ------------------------------------------------------------------ */

/**
 * Todo número que o texto afirma.
 *
 * **O que fica de fora, e por quê.** Numeração de seção (`1.`, `2.`), item de
 * lista e número por extenso não são afirmação factual: são estrutura. Ano de
 * quatro dígitos, percentual, dinheiro e medida são — e é neles que a invenção
 * aparece.
 *
 * Números de 1 a 20 soltos também ficam de fora. "Três motivos", "5 bairros" e
 * "duas opções" são organização do próprio texto, não dado sobre o mundo; se
 * entrassem, o alarme dispararia em todo artigo e ninguém olharia mais para
 * ele. **Alarme que toca sempre é alarme desligado.**
 */
export function numerosDoTexto(texto: string): string[] {
  const achados = new Set<string>();

  // Percentual, dinheiro e medida entram sempre — inclusive os pequenos.
  for (const m of texto.matchAll(/(?:R\$\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?\s*(?:%|mil|milhões?|bilhões?|m²|km|km²|hab)/gi)) {
    achados.add(normalizar(m[0]));
  }
  for (const m of texto.matchAll(/R\$\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?/g)) {
    achados.add(normalizar(m[0]));
  }

  // Os demais: só o que é grande o bastante para ser afirmação sobre o mundo.
  for (const m of texto.matchAll(/\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b|\b\d{2,}(?:,\d+)?\b/g)) {
    const bruto = m[0];
    const numero = Number(bruto.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero)) continue;
    if (numero <= 20 && !bruto.includes(".") && !bruto.includes(",")) continue;
    // Numeração de seção — `2.` no começo de linha, `1. Mobilidade`.
    if (new RegExp(`(^|\\n)\\s*${bruto}[.)]\\s`).test(texto)) continue;
    achados.add(normalizar(bruto));
  }

  return [...achados];
}

/** `R$ 1.350,00`, `1350` e `1.350` viram a mesma coisa antes de comparar. */
function normalizar(bruto: string): string {
  return bruto
    .replace(/R\$\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Só os dígitos, para comparar `1.350` com `1350` e `1 350`. */
const soDigitos = (s: string) => s.replace(/[^\d]/g, "");

/**
 * Os números que o texto afirma e o material não sustenta.
 *
 * A comparação é pelos dígitos, não pela escrita: o material pode trazer
 * `112.54m2` e o texto escrever `112 m²` — é o mesmo número, e acusar isso
 * seria ruído. Já `2022` contra `2023` são coisas diferentes, e aparecem.
 *
 * **Falso positivo é aceitável aqui; falso negativo não.** Um número legítimo
 * apontado custa dez segundos de conferência. Um número inventado que passa
 * vira publicação com dado falso no nome do cliente.
 */
export function numerosSemLastro(texto: string, material: string): string[] {
  const doMaterial = new Set<string>();
  for (const m of material.matchAll(/\d[\d.,\s]*/g)) {
    const d = soDigitos(m[0]);
    if (d) doMaterial.add(d);
    // `112.54` também sustenta `112` — o texto arredonda, e arredondar não é
    // inventar. O contrário não vale: o material não ganha dígito que não tem.
    const inteiro = soDigitos(m[0].split(/[.,]/)[0]);
    if (inteiro) doMaterial.add(inteiro);
  }

  return numerosDoTexto(texto).filter((n) => {
    const d = soDigitos(n);
    if (!d) return false;
    if (doMaterial.has(d)) return false;
    // Ano escrito no material como parte de uma data mais longa.
    return ![...doMaterial].some((m) => m.includes(d) && d.length >= 4);
  });
}

/* ------------------------------------------------------------------ *
 * 2. A forma que a Elaine pediu na Prioridade 2
 * ------------------------------------------------------------------ */

export interface Cabecalho {
  nivel: 2 | 3 | 4;
  texto: string;
}

/** Os cabeçalhos do markdown, em ordem. */
export function cabecalhosDoTexto(texto: string): Cabecalho[] {
  const saida: Cabecalho[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (m) saida.push({ nivel: m[1].length as 2 | 3 | 4, texto: m[2].replace(/\*\*/g, "").trim() });
  }
  return saida;
}

/** H2 que não é pergunta. Regra 2.1. */
export function h2SemPergunta(texto: string): string[] {
  return cabecalhosDoTexto(texto)
    .filter((c) => c.nivel === 2 && !c.texto.trim().endsWith("?"))
    .map((c) => c.texto);
}

/**
 * O sumário promete o que o texto entrega? Regra 2.3.
 *
 * Devolve o que está prometido e não existe, e o que existe e não foi
 * prometido. Comparar por igualdade exata seria frágil — o sumário costuma
 * perder um acento ou um travessão —, então a comparação é pelo texto
 * normalizado.
 */
export function sumarioDivergente(texto: string): { prometidoSemSecao: string[]; secaoSemPromessa: string[] } {
  const marca = texto.match(/Neste conteúdo,? você (?:entenderá|vai entender)[:\s]*([\s\S]*?)(?=\n#{2,4}\s|\n\n#{2,4}\s|$)/i);
  const h2 = cabecalhosDoTexto(texto).filter((c) => c.nivel === 2).map((c) => c.texto);
  if (!marca) return { prometidoSemSecao: [], secaoSemPromessa: h2 };

  const prometidos = marca[1]
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);

  const chave = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nasSecoes = new Set(h2.map(chave));
  const noSumario = new Set(prometidos.map(chave));

  return {
    prometidoSemSecao: prometidos.filter((p) => !nasSecoes.has(chave(p))),
    secaoSemPromessa: h2.filter((s) => !noSumario.has(chave(s))),
  };
}

/**
 * H2 que anuncia uma quantidade e não a cumpre. Regra 2.4.
 *
 * "Quais são os 5 motivos" com quatro H3 embaixo é o erro que o revisor pega
 * contando na mão, e é o mais fácil de contar por máquina.
 */
export function enumeracaoQuebrada(texto: string): { h2: string; prometido: number; achou: number }[] {
  const cabecalhos = cabecalhosDoTexto(texto);
  const saida: { h2: string; prometido: number; achou: number }[] = [];

  cabecalhos.forEach((c, i) => {
    if (c.nivel !== 2) return;
    const quantos = c.texto.match(/\b(\d{1,2})\b/);
    if (!quantos) return;
    const prometido = Number(quantos[1]);
    if (prometido < 2 || prometido > 30) return;

    let achou = 0;
    for (let k = i + 1; k < cabecalhos.length && cabecalhos[k].nivel !== 2; k++) {
      if (cabecalhos[k].nivel === 3) achou += 1;
    }
    // H2 com quantidade e nenhum H3 pode estar enumerando em lista, dentro do
    // corpo. Contar isso como erro acusaria texto correto.
    if (achou > 0 && achou !== prometido) saida.push({ h2: c.texto, prometido, achou });
  });

  return saida;
}

/* ------------------------------------------------------------------ *
 * 3. O fechamento da Prioridade 4
 * ------------------------------------------------------------------ */

/** Verbo no imperativo que abre um CTA da lista da Elaine. Regra 4.2. */
const IMPERATIVOS =
  /^(confira|conheça|fale|veja|acesse|descubra|agende|solicite|baixe|cadastre|entre|clique|saiba|peça|marque|visite|aproveite|garanta|compare|escolha|comece)\b/i;

/** As aberturas que a Elaine listou como passivas. */
const PASSIVOS = /\b(você pode|se quiser|uma opção é|talvez seja|que tal|caso deseje|se você|fique à vontade)\b/i;

export function ctaFraco(cta: string): string | null {
  const primeira = cta.trim().split(/\n/).find((l) => l.trim()) ?? "";
  const limpa = primeira.replace(/^[#*\-\s]+/, "").trim();
  if (!limpa) return null;
  if (PASSIVOS.test(limpa)) return limpa;
  if (!IMPERATIVOS.test(limpa)) return limpa;
  return null;
}

/**
 * A FAQ repete os H2? Regra 4.3.
 *
 * Compara pelas palavras que carregam sentido, e não pela frase inteira: "Como
 * é a qualidade de vida em Criciúma?" e "Qual a qualidade de vida em
 * Criciúma?" são a mesma pergunta com outra roupa, e é isso que a Elaine não
 * quer ver duas vezes.
 */
export function faqRepetida(corpo: string, faq: string): string[] {
  const vazias = new Set([
    "como", "qual", "quais", "por", "que", "quanto", "quando", "onde", "e", "o", "a", "os", "as",
    "de", "do", "da", "dos", "das", "em", "no", "na", "um", "uma", "para", "com", "e", "sao", "e",
    "ser", "vale", "pena", "melhor", "melhores",
  ]);
  const nucleo = (s: string) =>
    new Set(
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
        .filter((p) => p.length > 2 && !vazias.has(p)),
    );

  const doCorpo = cabecalhosDoTexto(corpo).filter((c) => c.nivel === 2).map((c) => nucleo(c.texto));
  const perguntas = cabecalhosDoTexto(faq).filter((c) => c.nivel >= 3).map((c) => c.texto);
  const soltas = faq.split("\n").filter((l) => /\?\s*$/.test(l) && !/^#{2,4}\s/.test(l)).map((l) => l.replace(/^[-*\s]+/, "").trim());

  return [...perguntas, ...soltas].filter((p) => {
    const n = nucleo(p);
    if (n.size === 0) return false;
    return doCorpo.some((h) => {
      const comuns = [...n].filter((x) => h.has(x)).length;
      // Dois terços das palavras de sentido em comum: é a mesma pergunta.
      return comuns >= Math.ceil(Math.min(n.size, h.size) * 0.66) && comuns >= 2;
    });
  });
}

/* ------------------------------------------------------------------ *
 * O laudo
 * ------------------------------------------------------------------ */

export interface Ressalva {
  regra: string;
  o_que: string;
  onde: string[];
}

/**
 * Confere o que dá para conferir, e devolve o que o revisor precisa olhar.
 *
 * `material` é tudo que foi fornecido: ficha do cliente, base de conhecimento,
 * anexos, briefing, dados e fontes. É contra ele que os números são medidos.
 */
/* ------------------------------------------------------------------ *
 * 3b. As considerações da Elainy de 15/09/2026
 * ------------------------------------------------------------------ */

/**
 * Tabela que não compara nada.
 *
 * A consideração dela: "use tabelas apenas quando houver ganho real de
 * comparação ou organização. Não transforme informações narrativas em tabela
 * apenas para variar o formato ou aumentar a escaneabilidade."
 *
 * Duas formas de a tabela não comparar, e as duas se medem:
 *
 * **Célula narrativa.** A regra já dizia "no máximo ~10 palavras por célula".
 * Célula com frase inteira é parágrafo dentro de uma grade — o formato mudou,
 * a informação não. O corte fica em 14 palavras para não acusar uma célula
 * legítima que passou um pouco.
 *
 * **Uma linha só.** Comparação precisa de pelo menos dois lados. Tabela com
 * uma linha de dados é uma ficha, e ficha cabe em lista.
 *
 * O que NÃO é apontado: tabela com muitas colunas, tabela longa, tabela de
 * números. Essas são o caso em que ela é a ferramenta certa.
 */
export function tabelaSemComparacao(texto: string): string[] {
  const achados: string[] = [];
  const linhas = texto.split(/\n/);
  let atual: string[] = [];

  const fechar = () => {
    if (atual.length >= 2) {
      // Cabeçalho, separador e o que vier depois são as linhas de dados.
      const dados = atual.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l)).slice(1);
      const titulo = celulas(atual[0]).join(" · ").slice(0, 70);
      if (dados.length < 2) {
        achados.push(`${titulo} — só uma linha de dados, não há o que comparar`);
      } else {
        const longa = dados
          .flatMap(celulas)
          .find((c) => c.trim().split(/\s+/).length > 14);
        if (longa) achados.push(`${titulo} — célula com texto corrido: "${longa.slice(0, 60)}…"`);
      }
    }
    atual = [];
  };

  for (const linha of linhas) {
    if (/^\s*\|.*\|\s*$/.test(linha)) atual.push(linha);
    else fechar();
  }
  fechar();
  return achados;
}

/** As células de uma linha de tabela markdown, sem as bordas. */
function celulas(linha: string): string[] {
  return linha.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean);
}

/**
 * A virada comercial que não sai do assunto.
 *
 * "Ao conectar o conteúdo editorial a um produto, serviço ou empreendimento,
 * faça a transição a partir de uma relação concreta com o assunto tratado.
 * Evite frases comerciais genéricas ou mudanças bruscas de tom."
 *
 * As frases aqui são as emendas prontas — as que servem para qualquer artigo
 * sobre qualquer coisa, e que por isso não saem de nada do que foi dito. É o
 * ponto onde o leitor sente a costura e passa a desconfiar do resto.
 */
const EMENDAS_COMERCIAIS =
  /\b(pensando nisso|é aí que entra|é nesse contexto que|foi pensando (?:nisso|assim)|se você (?:procura|busca|deseja|sonha)|se esse é o seu caso|não perca tempo|a escolha certa|venha conhecer|nós temos a solução)\b/gi;

export function emendaComercial(texto: string): string[] {
  return [...new Set([...texto.matchAll(EMENDAS_COMERCIAIS)].map((m) => m[0]))];
}

/**
 * CTA vago: diz para agir, mas não diz o que há do outro lado.
 *
 * "Evite CTAs vagos como 'saiba mais', 'confira' ou 'entre em contato' sem
 * contexto."
 *
 * A régua anterior (`ctaFraco`) exige um verbo de ação, e **aceita justamente
 * estes três** — "confira", "saiba" e "entre" estão na lista de imperativos.
 * Ou seja: "Confira." passava. O que falta não é o verbo, é o complemento.
 *
 * Por isso a medida é o tamanho do que vem depois do verbo: até três palavras,
 * não há o que encontrar do outro lado. "Entre em contato" tem três e não diz
 * nada; "Confira as plantas de 2 e 3 dormitórios do Aurora" tem nove e diz.
 */
const CTA_VAGO = /^(saiba mais|confira|veja|acesse|descubra|entre em contato|fale conosco|clique aqui|saiba)\b/i;

export function ctaVago(cta: string): string | null {
  const primeira = cta.trim().split(/\n/).find((l) => l.trim()) ?? "";
  const limpa = primeira.replace(/^[#*\-\s]+/, "").replace(/[.!]+$/, "").trim();
  const abertura = CTA_VAGO.exec(limpa);
  if (!abertura) return null;
  const resto = limpa.slice(abertura[0].length).trim();
  const palavras = resto ? resto.split(/\s+/).length : 0;
  return palavras <= 3 ? limpa : null;
}

export function conferir(partes: {
  material: string;
  introducao?: string;
  desenvolvimento?: string;
  faq?: string;
  encerramento?: string;
}): Ressalva[] {
  const corpo = [partes.introducao, partes.desenvolvimento].filter(Boolean).join("\n\n");
  const tudo = [corpo, partes.faq, partes.encerramento].filter(Boolean).join("\n\n");
  const saida: Ressalva[] = [];
  const juntar = (regra: string, o_que: string, onde: string[]) => {
    if (onde.length) saida.push({ regra, o_que, onde });
  };

  juntar(
    "1.1",
    "Números que o texto afirma e o material não sustenta. Confira a fonte antes de publicar.",
    numerosSemLastro(tudo, partes.material),
  );
  juntar("2.1", "H2 que não é pergunta.", h2SemPergunta(corpo));

  const sumario = sumarioDivergente(corpo);
  juntar("2.3", "O sumário promete seções que o texto não tem.", sumario.prometidoSemSecao);
  juntar("2.3", "Seções do texto que o sumário não anuncia.", sumario.secaoSemPromessa);

  juntar(
    "2.4",
    "H2 anuncia uma quantidade que os H3 não cumprem.",
    enumeracaoQuebrada(corpo).map((e) => `${e.h2} — promete ${e.prometido}, tem ${e.achou}`),
  );

  const cta = partes.encerramento ? ctaFraco(partes.encerramento) : null;
  juntar("4.2", "O CTA não começa com um verbo de ação.", cta ? [cta] : []);
  // E-4, E-5 e E-6 são os números da lista que a Elainy passou em 15/09/2026,
  // na ordem em que ela escreveu: 4 tabelas, 5 transições comerciais, 6 CTA.
  // Os códigos numéricos acima vêm do documento de prioridades anterior, dela
  // também — manter a origem no código é o que deixa a pessoa que lê a
  // ressalva na tela saber de qual conversa aquela regra saiu.
  const vago = partes.encerramento ? ctaVago(partes.encerramento) : null;
  juntar(
    "E-6",
    "CTA vago: diz para agir, mas não diz o que o leitor vai encontrar.",
    vago ? [vago] : [],
  );
  juntar(
    "E-4",
    "Tabela que não compara: informação narrativa posta numa grade.",
    tabelaSemComparacao(tudo),
  );
  juntar(
    "E-5",
    "Transição comercial genérica: a frase serviria em qualquer artigo.",
    emendaComercial(tudo),
  );
  juntar("4.3", "Perguntas da FAQ que repetem um H2 do corpo.", partes.faq ? faqRepetida(corpo, partes.faq) : []);

  return saida;
}
