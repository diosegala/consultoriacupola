// @ts-nocheck
// Leitor de RSS/Atom — copiado do CupolaOS (servidor/ler-rss.js).
/**
 * Ler um feed RSS ou Atom.
 *
 * ## O que é isto, em uma frase
 *
 * Quase todo site de notícia publica, num endereço fixo, um arquivo em XML com
 * as últimas matérias — título, resumo, link, data. Chama-se **feed**. Não é
 * uma API, não pede cadastro e não tem chave: é um arquivo público que o site
 * reescreve sozinho a cada publicação. Ler mercado por RSS é pegar esse arquivo
 * de tempos em tempos e guardar o que ainda não temos.
 *
 * ## Por que o parser é escrito à mão
 *
 * Porque **feed no mundo real não é XML bem-comportado**. Os dois formatos
 * convivem (RSS 2.0 usa `<item>`, Atom usa `<entry>`), a data vem em três
 * padrões diferentes, o resumo às vezes é `<description>` e às vezes
 * `<summary>`, e a imagem se esconde em quatro lugares possíveis. Um parser de
 * XML genérico devolveria a árvore e deixaria toda essa decisão para cá de
 * qualquer jeito — e traria uma dependência nova para o worker, que roda com
 * orçamento apertado.
 *
 * O que este arquivo faz é justamente essa tradução: de "arquivo do site" para
 * "leitura de mercado".
 */

const NOMEADAS = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#8217": "'",
  aacute: "á", agrave: "à", atilde: "ã", acirc: "â", ccedil: "ç",
  eacute: "é", ecirc: "ê", iacute: "í", oacute: "ó", otilde: "õ", ocirc: "ô",
  uacute: "ú", uuml: "ü", ntilde: "ñ", hellip: "…", ldquo: '"', rdquo: '"',
  mdash: "—", ndash: "–", laquo: "«", raquo: "»",
};

function semEntidades(t) {
  return String(t)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (todo, nome) => NOMEADAS[nome.toLowerCase()] ?? todo);
}

/**
 * Tira CDATA, marcação e espaço repetido — o resumo vira texto puro.
 *
 * **Passa duas vezes pelas marcações, e isso não é excesso.** Uns feeds mandam
 * o HTML como HTML; a Folha manda **escapado**, como `&lt;a href=…&gt;`. Tirar
 * as marcações antes de desfazer as entidades limpava o primeiro caso e deixava
 * o segundo passar inteiro — o resumo chegava ao acervo com o link cru no meio
 * da frase. A segunda passada pega o que a decodificação acabou de revelar.
 */
function limpar(bruto) {
  const semTags = (t) => t.replace(/<[^>]+>/g, " ");
  return semTags(
    semEntidades(
      semTags(String(bruto ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** O conteúdo de uma etiqueta, com ou sem prefixo de namespace. */
function etiqueta(xml, nome) {
  const achado = xml.match(
    new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, "i"),
  );
  return achado ? achado[1] : "";
}

/** Um atributo de uma etiqueta que se fecha em si mesma. */
function atributo(xml, nome, attr) {
  const achado = xml.match(new RegExp(`<(?:\\w+:)?${nome}\\b[^>]*\\b${attr}=["']([^"']+)["']`, "i"));
  return achado ? achado[1] : "";
}

/**
 * A data, nos três padrões que aparecem na prática.
 *
 * RFC 822 (`Thu, 27 Aug 2026 23:01:00 -0000`) no RSS, ISO no Atom, e feed
 * malfeito sem data nenhuma. **Sem data válida a leitura não entra**: ela
 * apareceria como a mais nova ou a mais velha do acervo, e a idade é metade do
 * valor de uma leitura de mercado.
 */
function comoData(bruto) {
  const t = limpar(bruto);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * A imagem da matéria, nos quatro lugares onde ela costuma estar.
 *
 * A ordem não é aleatória: `media:content` e `enclosure` são declarações
 * explícitas do site; a imagem dentro do resumo é achado, e por isso vem por
 * último.
 */
function imagemDe(item) {
  const mediaConteudo = atributo(item, "media:content", "url") || atributo(item, "content", "url");
  if (mediaConteudo) return mediaConteudo;
  const miniatura = atributo(item, "media:thumbnail", "url") || atributo(item, "thumbnail", "url");
  if (miniatura) return miniatura;
  const anexo = atributo(item, "enclosure", "url");
  if (anexo && /\.(jpe?g|png|webp|gif)/i.test(anexo)) return anexo;
  const noTexto = (etiqueta(item, "description") + etiqueta(item, "content")).match(
    /<img[^>]+src=["']([^"']+)["']/i,
  );
  return noTexto ? semEntidades(noTexto[1]) : "";
}

/** Um item do feed, já traduzido para o que uma leitura precisa. */
function itemDoFeed(bruto) {
  const titulo = limpar(etiqueta(bruto, "title"));
  // `link` no Atom é atributo, não conteúdo — e o `guid` serve de reserva
  // porque em muitos feeds ele é o próprio endereço da matéria.
  const link =
    limpar(etiqueta(bruto, "link")) ||
    atributo(bruto, "link", "href") ||
    limpar(etiqueta(bruto, "guid"));
  const resumo = limpar(
    etiqueta(bruto, "subtitle") ||
      etiqueta(bruto, "summary") ||
      etiqueta(bruto, "description") ||
      etiqueta(bruto, "encoded") ||
      etiqueta(bruto, "content"),
  );
  const publicadoEm = comoData(
    etiqueta(bruto, "pubDate") || etiqueta(bruto, "published") || etiqueta(bruto, "updated"),
  );
  const temas = [...bruto.matchAll(/<(?:\w+:)?category(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?category>/gi)]
    .map((m) => limpar(m[1]))
    .filter(Boolean)
    .slice(0, 4);

  return {
    titulo,
    link,
    // Duzentos e quarenta caracteres: o suficiente para saber se a matéria
    // interessa, e pouco o bastante para caber no cartão sem cortar no meio.
    resumo: resumo.length > 240 ? resumo.slice(0, 237).trimEnd() + "…" : resumo,
    publicadoEm,
    imagem: imagemDe(bruto),
    temas,
  };
}

/**
 * Decodifica os bytes do feed na codificação certa.
 *
 * **Nem todo feed é UTF-8, e nem todo servidor avisa.** A Folha publica em
 * ISO-8859-1 e não declara no cabeçalho HTTP — só dentro do próprio XML, na
 * primeira linha. Lido como UTF-8, o resultado é "aprova��o r�pida": não
 * quebra nada, não dá erro, e chega ao acervo assim.
 *
 * A ordem de consulta é a ordem da confiança: o cabeçalho HTTP é a declaração
 * do servidor, e a linha do XML é a do autor do arquivo. Quando as duas faltam,
 * UTF-8 — que é o caso da grande maioria.
 */
function decodificar(bytes, tipoDeConteudo) {
  const doCabecalho = /charset=["']?([\w-]+)/i.exec(tipoDeConteudo)?.[1];
  // O começo do arquivo é ASCII em qualquer codificação de byte único, então
  // ler a declaração como UTF-8 é seguro mesmo quando ela diz outra coisa.
  const inicio = new TextDecoder("utf-8").decode(bytes.slice(0, 200));
  const doXml = /encoding=["']([\w-]+)["']/i.exec(inicio)?.[1];
  const nome = (doCabecalho || doXml || "utf-8").toLowerCase();
  try {
    return new TextDecoder(nome).decode(bytes);
  } catch {
    // Codificação que o navegador não conhece: melhor o texto imperfeito que
    // nenhuma leitura.
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/**
 * O texto está em português?
 *
 * **Existe porque um feed pode ser bilíngue.** O Portal Loft publica em
 * português e, de vez em quando, em inglês — e o item em inglês entrava no
 * acervo igual aos outros. Ninguém escreve peça de cliente a partir dele, e ele
 * ainda ocupa a lista de quem está procurando outra coisa.
 *
 * A conta é grosseira de propósito. Acento é a prova quase definitiva: título
 * com `ã`, `ç` ou `é` é português e passa sem mais perguntas. Sem acento
 * nenhum, valem as palavras de ligação — as que aparecem em qualquer frase e
 * quase nunca cruzam de língua.
 *
 * **Na dúvida, fica.** Descartar por engano some com notícia de verdade e
 * ninguém descobre; deixar passar por engano põe uma linha estranha na lista,
 * que qualquer um vê. O erro barato é o segundo.
 */
function emPortugues(texto) {
  const t = " " + texto.toLowerCase() + " ";
  if (/[ãõçáéíóúâêôà]/.test(t)) return true;

  const conta = (palavras) =>
    palavras.reduce((n, p) => n + (t.includes(` ${p} `) ? 1 : 0), 0);
  const pt = conta(["de", "da", "do", "que", "para", "com", "em", "os", "as", "uma", "um", "no", "na", "por", "sobre"]);
  const en = conta(["the", "that", "and", "for", "with", "from", "this", "more", "than", "your", "how", "what", "of", "to", "is"]);

  // Só descarta quando o inglês ganha com folga. Empate, pouco sinal ou texto
  // curto demais continuam entrando.
  return !(en >= 3 && en > pt + 1);
}

/**
 * Lê o feed e devolve os itens aproveitáveis.
 *
 * Item sem título, sem link ou sem data cai fora, e o total de descartados
 * volta junto: feed que muda de formato costuma continuar respondendo 200, e
 * sem esse número a falha apareceria como "hoje não saiu nada".
 */
export function lerFeed(xml) {
  const blocos = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  const itens = [];
  let descartados = 0;
  let emOutraLingua = 0;
  for (const b of blocos) {
    const item = itemDoFeed(b);
    if (!item.titulo || !item.link || !item.publicadoEm) {
      descartados += 1;
      continue;
    }
    // Contado à parte de propósito: item malformado é sinal de feed quebrado,
    // item em outra língua é o feed funcionando e publicando outra coisa.
    if (!emPortugues(`${item.titulo} ${item.resumo}`)) {
      emOutraLingua += 1;
      continue;
    }
    itens.push(item);
  }
  return {
    titulo: limpar(etiqueta(xml.split("<item")[0], "title")),
    itens,
    descartados,
    emOutraLingua,
  };
}

/** Busca o feed e lê. Peça de servidor: o navegador não alcança outro site. */
export async function buscarFeed(url) {
  const resposta = await fetch(url, {
    headers: {
      // Alguns feeds recusam cliente sem cara de navegador, e o accept evita
      // que o site devolva a página HTML no lugar do XML.
      "user-agent": "Mozilla/5.0 (compatible; CupolaOS/1.0; +https://cupola-os.pages.dev)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });
  if (!resposta.ok) {
    const e = new Error(`O feed respondeu ${resposta.status}.`);
    e.status = resposta.status === 404 ? 404 : 502;
    throw e;
  }
  const texto = decodificar(
    await resposta.arrayBuffer(),
    resposta.headers.get("content-type") ?? "",
  );
  if (!/<(rss|feed|rdf:RDF)\b/i.test(texto)) {
    const e = new Error("Este endereço não devolveu um feed — veio página comum.");
    e.status = 422;
    throw e;
  }
  return lerFeed(texto);
}
