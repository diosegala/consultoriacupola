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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { admin, consultorId } = auth;

    // Buscar contratos ativos com cliente e consultor
    const { data: contratos, error } = await admin
      .from("contratos")
      .select("id, cliente:clientes(nome, cidade, uf, consultor:consultores(nome))")
      .eq("ativo", true);

    if (error) throw error;

    const rows = (contratos || [])
      .map((c: any) => ({
        nome: c.cliente?.nome || "",
        cidade: [c.cliente?.cidade, c.cliente?.uf].filter(Boolean).join(" - "),
        consultor: c.cliente?.consultor?.nome || "",
      }))
      .filter((r) => r.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

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
    const title = `Clientes Ativos - ${today}`;

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

    // 2) Escrever valores
    const values = [
      ["Cliente", "Cidade", "Consultor"],
      ...rows.map((r) => [r.nome, r.cidade, r.consultor]),
    ];
    const range = "Clientes!A1:C" + values.length;
    await googleSheetsFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      },
    );

    return jsonResponse({ url: spreadsheetUrl, spreadsheetId, total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("não conectado ao Google") ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
});