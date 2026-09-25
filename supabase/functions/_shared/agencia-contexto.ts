// O contexto em camadas da Agência — porte de `src/dados/contexto.ts` e de
// `montarSistema` (servidor/conversar.ts) do CupolaOS.
//
// A divisão é por modo de falhar (docs/knowledge/08-contexto-em-camadas.md):
//   1. regras   — sempre presentes, nunca buscadas;
//   2. estado   — recalculado do banco a cada pergunta;
//   base. mercado — recortado pela praça e pelo tipo da conta, com validade;
//   3. acervo   — o material entra pelo nome, não pelo conteúdo;
//   4. conferir — roda depois da resposta, procurando termo vetado.
//
// Diferente do original, a montagem acontece no servidor e com o JWT da pessoa:
// tudo que entra no prompt passou pelas mesmas regras (RLS) das telas.
//
// A ORDEM do texto não é estética: o que se repete a cada mensagem vem primeiro,
// para ficar em cache no fornecedor. Nada aqui pode mudar a cada chamada (data de
// hoje, ids aleatórios) antes do bloco da conta — derruba o cache sem erro nenhum.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Banco = SupabaseClient<any, any, any>;

export interface Regra {
  tipo: "veto" | "obrigatorio" | "posicionamento";
  texto: string;
  porque?: string | null;
  termos?: string[] | null;
}

export interface Violacao {
  regra: string;
  termo: string;
}

/** A frase de emergência, quando a camada da CUPOLA não chega do banco. */
const CUPOLA_EM_UMA_FRASE =
  "A CUPOLA é um ecossistema de estratégias para gestão imobiliária. " +
  "Não é agência de publicidade, não é plataforma, não é hub.";

const SEM_CONTA = `## Onde você está

Esta conversa não está dentro de nenhuma conta. Aqui você é o especialista de mercado imobiliário da casa: incorporação, lançamento, corretagem, produto, regiões, concorrência, tendência de consumo e o vocabulário do setor. Pode responder pergunta de mercado, ajudar a pensar, revisar raciocínio e trazer referência.

A Cupola atende imobiliárias e incorporadoras, e o trabalho se organiza em squads que atendem contas. Fale como quem conhece a casa por dentro.`;

/** A linha que o modelo emite para apontar uma conta. Some antes de chegar à tela. */
export const MARCA_CONTA = /\[\[\s*CONTA:\s*([a-z0-9-]+)\s*\]\]/i;

// ------------------------------------------------------------------ camadas

/** A camada da casa (Administração → Contexto). Vazia se ninguém escreveu ainda. */
export async function camadaDaCupola(db: Banco): Promise<{ essencia: string; escrita: string }> {
  const { data } = await db.from("contexto_camadas").select("essencia, escrita").eq("escopo", "cupola").maybeSingle();
  return { essencia: data?.essencia ?? "", escrita: data?.escrita ?? "" };
}

const hoje = () => new Date().toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
const dataCurta = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

/** Camada 2 — gerada do banco agora, nunca escrita à mão. */
async function estadoDaConta(db: Banco, clienteId: string, projeto?: ProjetoDoContexto | null): Promise<string[]> {
  const agora = hoje();
  const [contrato, atrasados, urgentes, okrs] = await Promise.all([
    db.from("contratos").select("renovacao, horas_mes, horas_usadas, status").eq("cliente_id", clienteId).maybeSingle(),
    db.from("entregaveis").select("nome").eq("cliente_id", clienteId).eq("status", "atrasado"),
    db.from("demandas").select("titulo").eq("cliente_id", clienteId).eq("urgente", true).neq("etapa", "publicado"),
    db.from("okrs").select("objetivo, resultados_chave(descricao, atual, meta, unidade)").eq("cliente_id", clienteId),
  ]);

  const linhas: string[] = [];
  const c = contrato.data;
  if (c?.renovacao && c.status !== "encerrado") {
    linhas.push(
      c.renovacao < agora
        ? `Contrato vencido há ${diasEntre(c.renovacao, agora)} dias — renovação em aberto.`
        : `Contrato renova em ${dataCurta(c.renovacao)}.`,
    );
  }
  if (c?.horas_mes && c.horas_usadas && c.horas_usadas > c.horas_mes) {
    linhas.push(`Horas estouradas: ${c.horas_usadas} usadas de ${c.horas_mes} contratadas.`);
  }
  const at = atrasados.data ?? [];
  if (at.length) linhas.push(`${at.length} entregável(is) atrasado(s): ${at.map((e: { nome: string }) => e.nome).join("; ")}.`);
  const ur = urgentes.data ?? [];
  if (ur.length) linhas.push(`Urgente: ${ur.map((d: { titulo: string }) => d.titulo).join("; ")}.`);

  type Kr = { descricao: string; atual: number; meta: number; unidade: string };
  for (const okr of (okrs.data ?? []) as { objetivo: string; resultados_chave: Kr[] | null }[]) {
    const longe = (okr.resultados_chave ?? []).filter((r) => Number(r.meta) > 0 && Number(r.atual) / Number(r.meta) < 0.7);
    if (longe.length) {
      linhas.push(
        `OKR "${okr.objetivo}" com resultado abaixo do ritmo: ${longe
          .map((r) => `${r.descricao} em ${r.atual} de ${r.meta} ${r.unidade}`)
          .join("; ")}.`,
      );
    }
  }
  if (projeto) linhas.push(`Trabalhando dentro do projeto "${projeto.nome}" (${projeto.status}).`);
  return linhas;
}

/**
 * Base — o recorte de mercado da praça e do tipo da conta.
 * Região casa por conter ("SC" alcança "Biguaçu · SC"); "Nacional" alcança todos.
 * Leitura vencida não entra sozinha: continua no Mercado para quem procurar.
 */
async function mercadoDaConta(db: Banco, cidade: string, tipo: string): Promise<string[]> {
  const { data } = await db
    .from("leituras")
    .select("titulo, resumo, publicado_em, validade_dias, regioes, aplica_a")
    .order("publicado_em", { ascending: false })
    .limit(200);
  const praca = (cidade ?? "").toLowerCase();
  const agora = hoje();
  type Leitura = { titulo: string; resumo: string; publicado_em: string; validade_dias: number | null; regioes: string[] | null; aplica_a: string[] | null };
  return ((data ?? []) as Leitura[])
    .filter((l) => (l.regioes ?? []).some((r) => r.toLowerCase() === "nacional" || (r && praca.includes(r.toLowerCase()))))
    .filter((l) => !l.aplica_a?.length || l.aplica_a.includes(tipo))
    .filter((l) => !l.validade_dias || diasEntre(l.publicado_em, agora) <= l.validade_dias)
    .slice(0, 8)
    .map((l) => `- ${l.titulo} (${dataCurta(l.publicado_em)}): ${l.resumo}`);
}

export interface ProjetoDoContexto {
  id: string;
  nome: string;
  status: string;
  contexto: string;
}

export interface ContaMontada {
  nome: string;
  texto: string;
  regras: Regra[];
}

/** A conta virada texto, na ordem do `contextoEmTexto` original. */
export async function montarConta(db: Banco, clienteId: string, projeto?: ProjetoDoContexto | null): Promise<ContaMontada | null> {
  const [cli, identidade, regrasConta, regrasProjeto, material] = await Promise.all([
    db.from("clientes")
      .select("nome, cidade, tipo, resumo, setor_descricao, publico_alvo, produtos_servicos, tom_de_voz, posicionamento, diferenciais, concorrencia, palavras_chave")
      .eq("id", clienteId).maybeSingle(),
    db.from("cliente_identidade").select("cores, tipografia, guia").eq("cliente_id", clienteId).maybeSingle(),
    db.from("regras").select("tipo, texto, porque, termos").eq("cliente_id", clienteId),
    projeto ? db.from("regras").select("tipo, texto, porque, termos").eq("projeto_id", projeto.id) : Promise.resolve({ data: [] }),
    db.from("cliente_conhecimento").select("nome").eq("cliente_id", clienteId).order("enviado_em", { ascending: false }).limit(40),
  ]);
  const c = cli.data;
  if (!c) return null;

  const [estado, mercado] = await Promise.all([
    estadoDaConta(db, clienteId, projeto),
    mercadoDaConta(db, c.cidade, c.tipo),
  ]);

  const blocos: string[] = [`## A conta\n\n**${c.nome}** — ${c.cidade}\n\n${c.resumo ?? ""}`.trim()];

  const perfil = [
    ["Setor", c.setor_descricao],
    ["Vende para", c.publico_alvo],
    ["Oferece", c.produtos_servicos],
    ["Fala assim", c.tom_de_voz],
    ["Se posiciona como", c.posicionamento],
    ["Tem de diferente", c.diferenciais],
    ["Disputa com", c.concorrencia],
    ["Usa estas palavras", c.palavras_chave],
  ].filter(([, v]) => v && String(v).trim());
  if (perfil.length) blocos.push(`## O perfil da conta\n${perfil.map(([r, v]) => `- **${r}:** ${v}`).join("\n")}`);

  const marca = identidade.data;
  type Cor = { nome?: string; hex?: string };
  type Fonte = { nome?: string; papel?: string };
  const cores = (marca?.cores ?? []) as Cor[];
  const fontes = (marca?.tipografia ?? []) as Fonte[];
  if (cores.length || fontes.length || marca?.guia?.trim()) {
    const linhas: string[] = [];
    if (cores.length) linhas.push(`- **Cores:** ${cores.map((cor) => `${cor.nome || "sem nome"} ${cor.hex ?? ""}`.trim()).join(" · ")}`);
    if (fontes.length) linhas.push(`- **Tipografia:** ${fontes.map((f) => (f.papel ? `${f.nome} (${f.papel})` : f.nome)).join(" · ")}`);
    if (marca?.guia?.trim()) linhas.push(`- **Manual de marca:** ${marca.guia.trim()}`);
    blocos.push(`## A identidade visual\nUse estas cores e fontes. Não escolha outras nem aproxime a olho.\n${linhas.join("\n")}`);
  }

  if (projeto) blocos.push(`## O projeto\n\n**${projeto.nome}**\n\n${projeto.contexto ?? ""}`.trim());

  if (estado.length) blocos.push(`## Situação agora\n${estado.map((l) => `- ${l}`).join("\n")}`);
  if (mercado.length) blocos.push(`## Leitura de mercado\n${mercado.join("\n")}`);

  // O material entra pelo nome: o texto inteiro entupiria toda conversa da conta.
  const nomes = (material.data ?? []).map((m: { nome: string }) => m.nome).filter(Boolean);
  if (nomes.length) {
    blocos.push(`## Material da conta\nExiste e pode ser consultado, mas não está escrito aqui. Se precisar do conteúdo, peça para a pessoa colar o trecho.\n${nomes.map((n: string) => `- ${n}`).join("\n")}`);
  }

  const regras = [...((regrasConta.data ?? []) as Regra[]), ...((regrasProjeto.data ?? []) as Regra[])];
  return { nome: c.nome, texto: blocos.join("\n\n"), regras };
}

function listarRegras(regras: Regra[], de: string): string {
  if (!regras.length) return "";
  const linhas = regras.map((r) => {
    const tipo = r.tipo === "veto" ? "NÃO PODE" : r.tipo === "obrigatorio" ? "OBRIGATÓRIO" : "POSICIONAMENTO";
    const termos = r.termos?.length ? `\n  Termos proibidos: ${r.termos.join(", ")}` : "";
    const porque = r.porque ? `\n  Porque: ${r.porque}` : "";
    return `- [${tipo}] ${r.texto}${porque}${termos}`;
  });
  return `\n\n## Regras ${de}\n\nEstas valem para tudo que sair desta conversa. Violar qualquer uma invalida a entrega.\n\n${linhas.join("\n")}`;
}

/**
 * O funil: sem conta, o pedido de trabalho para uma conta vira convite a abri-la.
 * A lista vem pela RLS — oferecer uma conta daqui nunca revela conta que a pessoa não vê.
 */
function montarFunil(contas: { id: string; nome: string }[]): string {
  if (!contas.length) return "";
  const lista = contas.map((c) => `- \`${c.id}\` · ${c.nome}`).join("\n");
  return `## Quando o pedido for trabalho de uma conta

Estas são as contas que esta pessoa alcança:

${lista}

Se o pedido for claramente **trabalho para uma dessas contas** — escrever, revisar, planejar, analisar ou criar algo que vai sair com o nome dela — **não faça o trabalho**. O contrato, os OKRs, os entregáveis e as regras daquela conta não estão nesta conversa, e entregar sem eles é o erro mais caro que existe aqui.

Nesse caso responda curto, em duas ou três linhas: diga que para fazer direito precisa do contexto da conta, e adiante só o que não depende dele. Depois termine com uma linha isolada, exatamente neste formato:

[[CONTA: id-da-conta]]

Essa linha não aparece para ninguém — a interface troca ela por um botão que abre a conversa já com o contexto carregado. Use só quando tiver certeza de qual conta é, e use o id exato da lista.

**Falar sobre uma conta não é trabalhar para ela.** Quem atende, quando renova, em que cidade fica — isso você responde normalmente, sem emitir a linha.`;
}

export interface PedidoDoSistema {
  agente: { nome: string; descricao?: string | null; resumo?: string | null };
  area?: string | null;
  pessoa: { nome: string | null; funcao?: string | null };
  organizacao: { essencia: string; escrita: string };
  conta?: ContaMontada | null;
  projetoNome?: string | null;
  regrasProjeto?: Regra[];
  contas?: { id: string; nome: string }[];
}

/** O prompt de sistema, na ordem do original: o que se repete primeiro, a conta depois. */
export function montarSistema(p: PedidoDoSistema): string {
  const partes: string[] = [];
  partes.push(
    `Você é o agente "${p.agente.nome}" do CupolaOS, o sistema interno da CUPOLA.\n\n${p.agente.descricao || p.agente.resumo || ""}`.trim(),
  );
  partes.push(`## A CUPOLA\n\n${p.organizacao.essencia.trim() || CUPOLA_EM_UMA_FRASE}`);
  if (p.organizacao.escrita.trim()) partes.push(`## Como a CUPOLA escreve\n\n${p.organizacao.escrita.trim()}`);
  if (p.area) partes.push(`Você responde pela área de ${p.area}.`);
  if (p.pessoa.nome) {
    partes.push(
      `Você está falando com ${p.pessoa.nome}${p.pessoa.funcao ? `, ${p.pessoa.funcao}` : ""} da Cupola. É colega, não cliente: seja direto, sem preâmbulo e sem se apresentar.`,
    );
  }

  if (p.conta) {
    partes.push(p.conta.texto);
  } else {
    partes.push(SEM_CONTA);
    const funil = montarFunil(p.contas ?? []);
    if (funil) partes.push(funil);
  }

  const regras = p.conta ? listarRegras(p.conta.regras, `da conta ${p.conta.nome}`) : "";
  partes.push(
    `## Como responder\n\nEscreva em português do Brasil, no tom de quem trabalha na casa. Vá direto ao ponto: nada de "claro!", "com certeza" ou resumo do que foi pedido antes de responder. Use markdown só quando a estrutura ajudar — negrito para o que importa, listas para o que é lista. Se faltar informação para fazer bem o que foi pedido, pergunte em uma linha em vez de inventar. Nunca invente dados da conta.${regras}`,
  );
  return partes.join("\n\n");
}

// ------------------------------------------------------------------ camada 4

/** Tira acento e caixa: "Sonhos" e "sonho" têm que bater no mesmo veto. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapar(termo: string): string {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Procura termo vetado na saída. Casa do começo da palavra em diante (radical),
 * ignorando acento e caixa — largo de propósito. Avisa, não bloqueia.
 */
export function conferir(texto: string, regras: Regra[]): Violacao[] {
  const alvo = normalizar(texto);
  const achados: Violacao[] = [];
  for (const regra of regras) {
    for (const termo of regra.termos ?? []) {
      if (!termo?.trim()) continue;
      const padrao = new RegExp(`(^|[^\\p{L}\\p{N}])${escapar(normalizar(termo.trim()))}`, "u");
      if (padrao.test(alvo)) achados.push({ regra: regra.texto, termo });
    }
  }
  return achados;
}
