import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// === MAPA DO TEMPLATE (2 objetivos × 4 KRs × 6 ações) ===
// Título (contém "[CLIENTE]"): A1
// Score Global: E2 — fórmula, NÃO escrever
// Cabeçalhos: linha 5
// Bloco de KR = 1 linha de KR + 6 linhas de ação = 7 linhas
// Linhas de KR do Objetivo 1: 6, 13, 20, 27
// Linhas de KR do Objetivo 2: 34, 41, 48, 55
// Bloco do Objetivo 1: linhas 6-33 (coluna A mesclada)
// Bloco do Objetivo 2: linhas 34-61 (coluna A mesclada)
// Colunas: A=objetivo (mesclada), B=rótulos fixos (NÃO escrever), C=texto KR/ação,
//          D=status, E=fórmulas (NÃO escrever), F=peso, G=responsável,
//          H=contribuintes, I=prazo, J=observações
const OBJ_KR_ROWS: Record<number, number[]> = {
  1: [6, 13, 20, 27],
  2: [34, 41, 48, 55],
};
const OBJ_BLOCK_RANGES: Record<number, [number, number]> = {
  1: [6, 33],
  2: [34, 61],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getValidGoogleToken(admin: any, consultorId: string) {
  const { data: row } = await admin
    .from("consultor_google_tokens").select("*")
    .eq("consultor_id", consultorId).maybeSingle();
  if (!row) throw new Error("Consultor não conectado ao Google");
  const expired = new Date(row.expires_at).getTime() < Date.now();
  if (!expired) return row;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Refresh falhou: ${JSON.stringify(data)}`);
  const newExpires = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await admin.from("consultor_google_tokens")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("consultor_id", consultorId);
  return { ...row, access_token: data.access_token, expires_at: newExpires };
}

async function googleFetch(accessToken: string, url: string, init: RequestInit = {}) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    if ((res.status === 429 || res.status >= 500) && tentativa < 3) {
      console.warn(`[criar-okr-sheet] ${res.status} — retry em 30s (${tentativa}/3)`);
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    const errText = await res.text();
    throw new Error(`Google API ${res.status}: ${errText}`);
  }
  throw new Error("Google API — falha após retries");
}

function sheetRange(sheetName: string, cell: string) {
  const safe = /[^A-Za-z0-9_]/.test(sheetName) ? `'${sheetName.replace(/'/g, "''")}'` : sheetName;
  return `${safe}!${cell}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);

    const { documento_id, consultor_id: consultor_id_in } = await req.json();
    if (!documento_id) return jsonResponse({ error: "documento_id obrigatório" }, 400);

    // Buscar documento
    const { data: doc, error: docErr } = await admin
      .from("projeto_documentos")
      .select("id, cliente_id, projeto_id, tipo, dados_estruturados, sheet_url")
      .eq("id", documento_id)
      .single();
    if (docErr || !doc) return jsonResponse({ error: "Documento não encontrado" }, 404);
    if (doc.tipo !== "okrs") return jsonResponse({ error: "Documento não é do tipo okrs" }, 400);
    if (!doc.dados_estruturados) return jsonResponse({ error: "Documento sem dados estruturados de OKRs" }, 400);

    // Cliente e consultor
    let clienteId = doc.cliente_id as string | null;
    let consultorId = consultor_id_in as string | null;
    if (!clienteId && doc.projeto_id) {
      const { data: proj } = await admin.from("projetos").select("cliente_id, consultor_id").eq("id", doc.projeto_id).maybeSingle();
      clienteId = proj?.cliente_id ?? null;
      if (!consultorId) consultorId = proj?.consultor_id ?? null;
    }
    if (!clienteId) return jsonResponse({ error: "Cliente não encontrado para este documento" }, 400);

    const { data: cliente } = await admin.from("clientes").select("nome, consultor_id").eq("id", clienteId).single();
    if (!consultorId) consultorId = cliente?.consultor_id ?? null;
    if (!consultorId) return jsonResponse({ error: "Consultor não identificado" }, 400);

    // Prompt (template_sheets_id)
    const { data: promptRow } = await admin
      .from("agente_prompts")
      .select("template_sheets_id")
      .eq("tipo", "okrs")
      .single();
    const templateId = promptRow?.template_sheets_id;
    if (!templateId) return jsonResponse({ error: "Template de OKRs não configurado. Configure o ID em Configurações > Agentes IA > OKRs." }, 400);

    // Token Google
    const tokenRow = await getValidGoogleToken(admin, consultorId);
    const escopo: string = tokenRow.escopo ?? "";
    if (!escopo.includes("spreadsheets") && !escopo.includes("auth/drive")) {
      return jsonResponse({ error: "escopo_insuficiente" }, 403);
    }
    const accessToken: string = tokenRow.access_token;

    const dados: any = doc.dados_estruturados;
    const trimestre: string = dados.trimestre || "";
    const objetivosRaw: any[] = Array.isArray(dados.objetivos) ? dados.objetivos : [];

    // Validar e truncar
    if (objetivosRaw.length > 2) console.warn(`[criar-okr-sheet] truncando ${objetivosRaw.length} objetivos para 2`);
    const objetivos = objetivosRaw.slice(0, 2).map((o: any) => {
      const krsRaw: any[] = Array.isArray(o.key_results) ? o.key_results : [];
      if (krsRaw.length > 4) console.warn(`[criar-okr-sheet] truncando ${krsRaw.length} KRs para 4`);
      const krs = krsRaw.slice(0, 4).map((kr: any) => {
        const acoesRaw: any[] = Array.isArray(kr.acoes) ? kr.acoes : [];
        if (acoesRaw.length > 6) console.warn(`[criar-okr-sheet] truncando ${acoesRaw.length} ações para 6`);
        return { ...kr, acoes: acoesRaw.slice(0, 6) };
      });
      return { ...o, key_results: krs };
    });

    // 1. Copiar template
    const clienteNome = cliente?.nome ?? "Cliente";
    const novoTitulo = `Plano de OKRs - ${clienteNome}${trimestre ? ` - ${trimestre}` : ""}`;
    const copyRes = await googleFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${templateId}/copy?fields=id,webViewLink,name`,
      { method: "POST", body: JSON.stringify({ name: novoTitulo }) },
    );
    const newSheetId = copyRes.id as string;
    const sheetUrl = copyRes.webViewLink as string;

    // Buscar metadados da planilha para obter sheetId numérico e nome
    const meta = await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}?fields=sheets(properties(sheetId,title,index))`,
    );
    const firstSheet = meta.sheets?.sort((a: any, b: any) => (a.properties.index ?? 0) - (b.properties.index ?? 0))[0];
    const sheetTitle: string = firstSheet?.properties?.title ?? "Sheet1";
    const sheetIdNum: number = firstSheet?.properties?.sheetId ?? 0;

    // 2. Montar dados a escrever (values:batchUpdate)
    const valueUpdates: Array<{ range: string; values: string[][] }> = [];

    // Título A1: substituir [CLIENTE]
    const titleRes = await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/${encodeURIComponent(sheetRange(sheetTitle, "A1"))}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const titleAtual: string = titleRes?.values?.[0]?.[0] ?? "";
    const tituloNovo = titleAtual.includes("[CLIENTE]")
      ? titleAtual.replace(/\[CLIENTE\]/g, clienteNome)
      : `Plano de OKRs - ${clienteNome}${trimestre ? ` - ${trimestre}` : ""}`;
    valueUpdates.push({ range: sheetRange(sheetTitle, "A1"), values: [[tituloNovo]] });

    const hideRequests: any[] = [];

    for (let objIdx = 1; objIdx <= 2; objIdx++) {
      const obj = objetivos[objIdx - 1];
      const krRows = OBJ_KR_ROWS[objIdx];
      const [blockStart, blockEnd] = OBJ_BLOCK_RANGES[objIdx];

      if (!obj) {
        // Objetivo 2 não usado (ou 1, defensivo)
        valueUpdates.push({ range: sheetRange(sheetTitle, `A${blockStart}`), values: [[""]] });
        // Limpar C e D de todo o bloco
        const emptyBlock: string[][] = [];
        for (let r = blockStart; r <= blockEnd; r++) emptyBlock.push(["", ""]);
        valueUpdates.push({ range: sheetRange(sheetTitle, `C${blockStart}:D${blockEnd}`), values: emptyBlock });
        // Ocultar bloco inteiro
        hideRequests.push({
          updateDimensionProperties: {
            range: { sheetId: sheetIdNum, dimension: "ROWS", startIndex: blockStart - 1, endIndex: blockEnd },
            properties: { hiddenByUser: true },
            fields: "hiddenByUser",
          },
        });
        continue;
      }

      // Objetivo usado — escrever célula mesclada
      valueUpdates.push({
        range: sheetRange(sheetTitle, `A${blockStart}`),
        values: [[`OBJETIVO ${objIdx}: ${obj.objetivo ?? ""}`]],
      });

      const krs = obj.key_results ?? [];
      for (let krIdx = 0; krIdx < 4; krIdx++) {
        const krRow = krRows[krIdx];
        const kr = krs[krIdx];
        if (!kr) {
          // KR não usado: limpar C e D de todas as 7 linhas
          const empty: string[][] = [];
          for (let i = 0; i < 7; i++) empty.push(["", ""]);
          valueUpdates.push({ range: sheetRange(sheetTitle, `C${krRow}:D${krRow + 6}`), values: empty });
          // Ocultar as 7 linhas
          hideRequests.push({
            updateDimensionProperties: {
              range: { sheetId: sheetIdNum, dimension: "ROWS", startIndex: krRow - 1, endIndex: krRow + 6 },
              properties: { hiddenByUser: true },
              fields: "hiddenByUser",
            },
          });
          continue;
        }

        // KR usado — texto em C, obs em J
        valueUpdates.push({ range: sheetRange(sheetTitle, `C${krRow}`), values: [[kr.kr ?? ""]] });
        if (kr.observacoes) {
          valueUpdates.push({ range: sheetRange(sheetTitle, `J${krRow}`), values: [[kr.observacoes]] });
        }

        const acoes: string[] = kr.acoes ?? [];
        for (let acaoIdx = 0; acaoIdx < 6; acaoIdx++) {
          const acaoRow = krRow + 1 + acaoIdx;
          const acao = acoes[acaoIdx];
          if (acao) {
            valueUpdates.push({ range: sheetRange(sheetTitle, `C${acaoRow}:D${acaoRow}`), values: [[acao, "Não iniciado"]] });
          } else {
            // Ação não usada dentro de KR usado — limpar C e D é OBRIGATÓRIO
            valueUpdates.push({ range: sheetRange(sheetTitle, `C${acaoRow}:D${acaoRow}`), values: [["", ""]] });
            hideRequests.push({
              updateDimensionProperties: {
                range: { sheetId: sheetIdNum, dimension: "ROWS", startIndex: acaoRow - 1, endIndex: acaoRow },
                properties: { hiddenByUser: true },
                fields: "hiddenByUser",
              },
            });
          }
        }
      }
    }

    // 3. Executar values:batchUpdate
    await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: valueUpdates }),
      },
    );

    // 4. Executar batchUpdate para ocultar linhas
    if (hideRequests.length) {
      await googleFetch(
        accessToken,
        `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}:batchUpdate`,
        { method: "POST", body: JSON.stringify({ requests: hideRequests }) },
      );
    }

    // 5. Salvar sheet_url no documento
    await admin.from("projeto_documentos").update({ sheet_url: sheetUrl }).eq("id", documento_id);

    return jsonResponse({ sheet_url: sheetUrl });
  } catch (e: any) {
    console.error("criar-okr-sheet error:", e);
    return jsonResponse({ error: e?.message ?? "Erro desconhecido" }, 500);
  }
});