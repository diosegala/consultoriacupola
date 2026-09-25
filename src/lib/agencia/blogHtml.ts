import { Marked, type Token, type Tokens } from "marked";

export const TITULO_DO_SUMARIO = "Nesta página você irá encontrar:";
const marcador = new Marked({ gfm: true, async: false });
const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const titulosDeSumario = new Set([
  TITULO_DO_SUMARIO, "Neste conteúdo, você entenderá:", "Neste artigo, você encontrará:",
]);

/** Remove apenas o bloco de navegação reconhecido, nunca listas do artigo. */
function semSumario(texto: string): string {
  let limpo = texto.replace(/\r\n?/g, "\n");
  const tokens = marcador.lexer(limpo);
  tokens.forEach((t, i) => {
    if (t.type !== "paragraph" && t.type !== "heading") return;
    const rotulo = t.text.replace(/\*\*/g, "").trim();
    if (!titulosDeSumario.has(rotulo)) return;
    let j = i + 1;
    while (tokens[j]?.type === "space") j++;
    if (tokens[j]?.type === "list") {
      while (tokens[j + 1]?.type === "space") j++;
      const bloco = tokens.slice(i, j + 1).map(t => t.raw).join("");
      limpo = limpo.replace(bloco, "");
    }
  });
  return limpo.trim();
}

export function h2DoTexto(texto: string): string[] {
  return marcador.lexer(semSumario(texto))
    .filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2)
    .map(t => t.text);
}

/** Na revisão, o próprio artigo manda nos títulos. Não reaproveita estrutura antiga. */
export function comSumario(texto: string, titulos?: string[]): string {
  const limpo = semSumario(texto);
  const tokens = marcador.lexer(limpo);
  const h2 = titulos ?? tokens.filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2).map(t => t.text);
  if (!h2.length) return limpo;
  const sumario = `**${TITULO_DO_SUMARIO}**\n\n${h2.map(t => `- ${t}`).join("\n")}\n\n`;
  const primeiro = tokens.findIndex(t => t.type === "heading" && t.depth === 2);
  if (primeiro < 0) return `${limpo}\n\n${sumario}`.trim();
  let posicao = 0;
  for (let i = 0; i <= primeiro; i++) {
    const inicio = limpo.indexOf(tokens[i].raw, posicao);
    if (i === primeiro) return `${limpo.slice(0, inicio)}${sumario}${limpo.slice(inicio)}`.trim();
    posicao = inicio + tokens[i].raw.length;
  }
  return limpo;
}

function textoPlano(tokens: Token[]): string {
  return tokens.map(t => "tokens" in t && Array.isArray(t.tokens)
    ? textoPlano(t.tokens) : "text" in t ? String(t.text) : t.raw).join("");
}

function destinoSeguro(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(href) && !/[\u0000-\u0020\\]/.test(href);
}

/** Sem IA: somente o texto revisado, com HTML embutido escapado e URLs controladas. */
export function htmlDoRevisado(textoRevisado: string): string {
  if (!textoRevisado.trim()) throw new Error("Revise e salve o texto na etapa 9 antes de gerar o HTML.");
  const texto = semSumario(textoRevisado);
  const tokens = marcador.lexer(texto);
  const titulos = tokens.filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2);
  if (!titulos.length) throw new Error("Marque os títulos principais com ## na revisão para gerar o sumário e as âncoras.");
  if (tokens.filter(t => t.type === "heading" && t.depth === 1).length > 1) {
    throw new Error("Mantenha apenas um H1 (#) no texto revisado.");
  }
  const faq = titulos.findIndex(t => /^(perguntas frequentes|faq)\b/i.test(textoPlano(t.tokens)));
  if (faq >= 0 && faq !== titulos.length - 1) {
    throw new Error("Mova a FAQ para depois do encerramento/CTA no texto revisado. Ela deve ser a última seção.");
  }
  const usados = new Set<string>();
  const itens = titulos.map(t => {
    const rotulo = textoPlano(t.tokens);
    const base = rotulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "secao";
    let id = base;
    for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
    usados.add(id);
    return { id, rotulo };
  });
  const porTitulo = new Map(titulos.map((t, i) => [t, itens[i]]));
  let inseriuSumario = false;
  const nav = `<nav aria-label="Sumário do artigo">\n<p><strong>${TITULO_DO_SUMARIO}</strong></p>\n<ul>\n${itens.map(i => `<li><a href="#${i.id}">${escapar(i.rotulo)}</a></li>`).join("\n")}\n</ul>\n</nav>\n`;
  const conversor = new Marked({ gfm: true, async: false, renderer: {
    table(token) {
      const cabecalho = token.header.map(cell => this.tablecell({ ...cell, header: true })).join("");
      const linhas = token.rows.map(row => `<tr>${row.map(cell => this.tablecell({ ...cell, header: false })).join("")}</tr>`).join("\n");
      return `<div role="region" aria-label="Tabela do artigo" tabindex="0" style="max-width:100%;overflow-x:auto;margin:24px 0;"><table style="border-collapse:collapse;width:100%;font-size:inherit;line-height:1.5;color:#263c3a;border:1px solid #b7c4bd;"><thead><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table></div>\n`;
    },
    tablecell(token) {
      const tag = token.header ? "th" : "td";
      const alinhamento = token.align === "center" || token.align === "right" ? token.align : "left";
      return `<${tag}${token.header ? ' scope="col"' : ''} style="border:1px solid #b7c4bd;padding:12px 16px;text-align:${alinhamento};vertical-align:top;min-width:140px;${token.header ? 'font-weight:700;background:#edf1eb;' : 'background:#ffffff;'}">${this.parser.parseInline(token.tokens)}</${tag}>`;
    },
    html({ text }) { return escapar(text); },
    link({ href, title, tokens }) {
      const conteudo = this.parser.parseInline(tokens);
      if (!destinoSeguro(href)) return conteudo;
      return `<a href="${escapar(href)}"${title ? ` title="${escapar(title)}"` : ""}>${conteudo}</a>`;
    },
    image({ href, title, text }) {
      if (!/^https?:\/\//i.test(href) || !destinoSeguro(href)) return escapar(text);
      return `<img src="${escapar(href)}" alt="${escapar(text)}"${title ? ` title="${escapar(title)}"` : ""}>`;
    },
    heading(token) {
      const { depth, tokens } = token;
      const conteudo = this.parser.parseInline(tokens);
      if (depth !== 2) return `<h${depth}>${conteudo}</h${depth}>\n`;
      const item = porTitulo.get(token);
      // Títulos em citações/listas não fazem parte do sumário principal.
      if (!item) return `<h2>${conteudo}</h2>\n`;
      const prefixo = inseriuSumario ? "" : nav;
      inseriuSumario = true;
      return `${prefixo}<h2 id="${item.id}">${conteudo}</h2>\n`;
    },
  }});
  return conversor.parser(tokens);
}

export function htmlAtual(p: { textoRevisado: string; htmlFinal?: string; htmlFonte?: string }): string {
  return p.htmlFonte === p.textoRevisado ? p.htmlFinal ?? "" : "";
}
