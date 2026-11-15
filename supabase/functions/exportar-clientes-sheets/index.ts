import {
  authenticate,
  corsHeaders,
  getValidGoogleToken,
  jsonResponse,
} from "../_shared/google.ts";

async function googleSheetsFetch(
  accessToken: string,
  url: string,
  init: RequestInit = {},
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    const responseBody = await response.text();
    if (response.ok) return responseBody ? JSON.parse(responseBody) : null;

    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw new Error(`Google Sheets API ${response.status}: ${responseBody}`);
  }

  throw new Error("Google Sheets API indisponível após novas tentativas");
}

const DIMENSOES: [string, string][] = [
  ["participacao_ativa", "Participação ativa"],
  ["abertura_sugestoes", "Abertura a sugestões"],
  ["comprometimento_acoes", "Comprometimento com ações"],
  ["clareza_demandas", "Clareza das demandas"],
  ["engajamento_estrategico", "Engajamento estratégico"],
];

function dataBR(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

function colunaA1(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const media = (v: number[]) => v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;

/** Resumo de engajamento por cliente a partir das análises de reunião. */
function agregarEngajamento(reunioes: any[]) {
  const hoje = Date.now();
  const DIA = 86400000;
  const porCliente = new Map<string, any[]>();
  for (const r of reunioes) {
    const lista = porCliente.get(r.cliente_id) ?? [];
    lista.push(r);
    porCliente.set(r.cliente_id, lista);
  }
  const out = new Map<string, {
    total: number; ultima: string; media: number | null; media90: number | null; tendencia: string; dims: Record<string, number | null>;
  }>();
  for (const [cid, lista] of porCliente) {
    const idade = (r: any) => (hoje - new Date(r.data_reuniao + "T00:00:00").getTime()) / DIA;
    const scores = lista.map((r) => Number(r.score_cliente)).filter(Number.isFinite);
    const recentes = lista.filter((r) => idade(r) <= 90).map((r) => Number(r.score_cliente)).filter(Number.isFinite);
    const anteriores = lista.filter((r) => idade(r) > 90 && idade(r) <= 180).map((r) => Number(r.score_cliente)).filter(Number.isFinite);
    const m90 = media(recentes);
    const mAnt = media(anteriores);
    let tendencia = "—";
    if (m90 != null && mAnt != null) {
      tendencia = m90 - mAnt >= 0.5 ? "Subindo" : m90 - mAnt <= -0.5 ? "Caindo" : "Estável";
    }
    const dims: Record<string, number | null> = {};
    for (const [k] of DIMENSOES) {
      dims[k] = media(lista.map((r) => Number(r.analise_cliente?.[k])).filter(Number.isFinite));
    }
    out.set(cid, {
      total: lista.length,
      ultima: lista.map((r) => r.data_reuniao).sort().at(-1) ?? "",
      media: media(scores),
      media90: m90,
      tendencia,
      dims,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { admin, consultorId } = auth;

    // Contratos ativos (uma linha por contrato) com cliente, consultor e produto
    const { data: contratos, error } = await admin
      .from("contratos")
      .select(
        "id, cliente_id, data_inicio, data_fim, prazo_meses, remuneracao_mensal, remuneracao_total, parcelas, tipo_vencimento, pausado, encerrado_em, tipo_consultoria_personalizado, tipo:tipos_consultoria(nome), cliente:clientes(nome, cidade, uf, consultor:consultores(nome))",
      )
      .eq("ativo", true);

    if (error) throw error;

    // Engajamento: reuniões com análise do cliente concluída (paginado: PostgREST limita 1000 linhas)
    const clienteIds = [...new Set((contratos || []).map((c: any) => c.cliente_id))];
    const reunioes: any[] = [];
    if (clienteIds.length) {
      for (let from = 0; ; from += 1000) {
        const { data, error: reErr } = await admin
          .from("reunioes")
          .select("id, cliente_id, data_reuniao, score_cliente, analise_cliente")
          .eq("status_analise", "concluido")
          .not("score_cliente", "is", null)
          .in("cliente_id", clienteIds)
          .order("id")
          .range(from, from + 999);
        if (reErr) throw reErr;
        reunioes.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
    }
    const engajamento = agregarEngajamento(reunioes);

    const rows = (contratos || [])
      .filter((c: any) => c.cliente?.nome)
      .sort((a: any, b: any) =>
        a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR") || String(a.data_inicio).localeCompare(String(b.data_inicio))
      )
      .map((c: any) => {
        const e = engajamento.get(c.cliente_id);
        const tipoNome: string = c.tipo?.nome || "";
        const produto = tipoNome.toLowerCase() === "personalizado" && c.tipo_consultoria_personalizado?.trim()
          ? c.tipo_consultoria_personalizado.trim()
          : tipoNome;
        const situacao = c.encerrado_em ? "Encerrado (pagto. em curso)" : c.pausado ? "Pausado" : "Ativo";
        return [
          c.cliente.nome,
          [c.cliente.cidade, c.cliente.uf].filter(Boolean).join(" - "),
          c.cliente.consultor?.nome || "",
          produto,
          dataBR(c.data_inicio),
          dataBR(c.data_fim),
          c.prazo_meses ?? "",
          Number(c.remuneracao_mensal ?? 0),
          Number(c.remuneracao_total ?? 0),
          c.parcelas ?? "",
          c.tipo_vencimento ? String(c.tipo_vencimento).charAt(0).toUpperCase() + String(c.tipo_vencimento).slice(1) : "",
          situacao,
          e?.total ?? 0,
          e ? dataBR(e.ultima) : "",
          e?.media ?? "",
          e?.media90 ?? "",
          e?.tendencia ?? "",
          ...DIMENSOES.map(([k]) => e?.dims[k] ?? ""),
        ];
      });

    const tokenRow = await getValidGoogleToken(admin, consultorId);
    const scopes = tokenRow.escopo ?? "";
    if (!scopes.includes("spreadsheets")) {
      return jsonResponse({
        error: "Sua conexão Google não tem permissão para criar planilhas. Reconecte o Google em Minhas Integrações.",
        code: "google_scope_insuficiente",
      }, 403);
    }
    const accessToken = tokenRow.access_token as string;

    const today = new Date().toISOString().slice(0, 10);
    const title = `Relatório de Clientes - ${today}`;

    // 1) Criar planilha
    const created = await googleSheetsFetch(
      accessToken,
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
      method: "POST",
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: "Clientes" } }],
      }),
      },
    );
    const spreadsheetId = created.spreadsheetId;
    const spreadsheetUrl = created.spreadsheetUrl;

    // 2) Escrever valores (cabeçalho + contratos + linha de totais)
    const cabecalho = [
      "Cliente", "Cidade", "Consultor", "Produto", "Início do contrato", "Fim do contrato", "Prazo (meses)",
      "Valor mensal (MRR)", "Valor total", "Parcelas", "Vencimento", "Situação",
      "Reuniões analisadas", "Última reunião", "Engajamento (média)", "Engajamento (últimos 90 dias)", "Tendência",
      ...DIMENSOES.map(([, nome]) => nome),
    ];
    const n = rows.length;
    const totais = new Array(cabecalho.length).fill("");
    totais[0] = "TOTAL";
    totais[7] = n ? `=SUM(H2:H${n + 1})` : 0;
    totais[8] = n ? `=SUM(I2:I${n + 1})` : 0;
    const values = [cabecalho, ...rows, totais];
    const ultimaColuna = colunaA1(cabecalho.length);
    const range = `Clientes!A1:${ultimaColuna}${values.length}`;
    await googleSheetsFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      },
    );

    // 3) Formatação: cabeçalho em negrito, linha congelada, moeda, notas e larguras
    const sheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;
    const formato = (c0: number, c1: number, pattern: string) => ({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: values.length, startColumnIndex: c0, endColumnIndex: c1 },
        cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
    await googleSheetsFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 } } },
                fields: "userEnteredFormat(textFormat,backgroundColor)",
              },
            },
            {
              repeatCell: {
                range: { sheetId, startRowIndex: values.length - 1, endRowIndex: values.length },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat",
              },
            },
            { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } }, fields: "gridProperties(frozenRowCount,frozenColumnCount)" } },
            formato(7, 9, '"R$" #,##0.00'),
            formato(14, 16, "0.0"),
            formato(17, cabecalho.length, "0.0"),
            { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: cabecalho.length } } },
          ],
        }),
      },
    );

    return jsonResponse({ url: spreadsheetUrl, spreadsheetId, total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("não conectado ao Google") ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
});