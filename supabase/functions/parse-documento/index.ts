import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getValidGoogleToken(admin: any, userId: string): Promise<string | null> {
  const { data: cu } = await admin
    .from("consultor_user").select("consultor_id").eq("user_id", userId).maybeSingle();
  if (!cu?.consultor_id) return null;
  const { data: row } = await admin
    .from("consultor_google_tokens").select("*")
    .eq("consultor_id", cu.consultor_id).maybeSingle();
  if (!row) return null;
  const expired = new Date(row.expires_at).getTime() < Date.now();
  if (!expired) return row.access_token;
  try {
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
    if (!r.ok) return null;
    const newExpires = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
    await admin.from("consultor_google_tokens")
      .update({ access_token: data.access_token, expires_at: newExpires })
      .eq("consultor_id", cu.consultor_id);
    return data.access_token;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let logUserId: string | null = null;
  let logConsultorId: string | null = null;
  let logNomeArquivo: string | null = null;
  let logTipo: string | null = null;
  let logOrigem: string | null = null;
  let logTamanhoBytes: number | null = null;

  const registrarErro = async (mensagem: string) => {
    try {
      await admin.from("parse_erros_log").insert({
        user_id: logUserId,
        consultor_id: logConsultorId,
        nome_arquivo: logNomeArquivo,
        tipo: logTipo,
        origem: logOrigem,
        tamanho_bytes: logTamanhoBytes,
        erro: (mensagem || "erro desconhecido").slice(0, 1000),
      });
    } catch (err) {
      console.warn("parse_erros_log insert falhou:", err);
    }
  };

  const respondErro = async (mensagem: string, status: number) => {
    await registrarErro(mensagem);
    return new Response(JSON.stringify({ error: mensagem }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    logUserId = userId;
    const { data: cuRow } = await admin
      .from("consultor_user").select("consultor_id").eq("user_id", userId).maybeSingle();
    logConsultorId = cuRow?.consultor_id ?? null;

    const body = await req.json();
    const { tipo, conteudo_base64, nome_arquivo, gdrive_url } = body;
    logNomeArquivo = nome_arquivo ?? gdrive_url ?? null;
    logTipo = tipo ?? null;
    logOrigem = gdrive_url ? "gdrive" : conteudo_base64 ? "upload" : "desconhecido";

    let textoExtraido = "";

    // Google Drive link
    if (gdrive_url) {
      const accessToken = await getValidGoogleToken(admin, userId);
      try {
        textoExtraido = await extractFromGDrive(gdrive_url, accessToken);
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : "Erro ao ler arquivo do Google Drive";
        return await respondErro(mensagem, 422);
      }
    }
    // File upload (base64)
    else if (conteudo_base64) {
      const tipoDetectado = normalizarTipoArquivo(tipo, nome_arquivo);
      const bytes = Uint8Array.from(atob(conteudo_base64), (c) => c.charCodeAt(0));
      logTamanhoBytes = bytes.length;

      if (tipoDetectado === "pdf") {
        try {
          textoExtraido = await extractFromPDF(bytes);
        } catch (err) {
          const mensagem = err instanceof Error ? err.message : "Falha ao ler PDF";
          return await respondErro(`Não foi possível ler o PDF: ${mensagem}`, 422);
        }
      } else if (tipoDetectado === "docx") {
        try {
          textoExtraido = await extractFromDOCX(bytes);
        } catch (err) {
          const mensagem = err instanceof Error ? err.message : "Falha ao ler DOCX";
          return await respondErro(`Não foi possível ler o DOCX: ${mensagem}`, 422);
        }
        if (!textoExtraido || textoExtraido.trim().length === 0) {
          return await respondErro(
            "Não foi possível extrair texto deste .docx. Ele pode estar vazio, conter apenas imagens ou ter formatação incompatível. Exporte para .txt e tente novamente.",
            422,
          );
        }
      } else if (tipoDetectado === "txt") {
        textoExtraido = decodeTextoComFallback(bytes);
      } else {
        return await respondErro(
          `Tipo não suportado: ${tipo || nome_arquivo || "desconhecido"}. Use PDF, DOCX, TXT, VTT ou SRT.`,
          400,
        );
      }
    } else {
      return await respondErro("Envie conteudo_base64+tipo ou gdrive_url", 400);
    }

    if (pareceHtmlLoginGoogle(textoExtraido)) {
      return await respondErro(
        "O conteúdo recebido do Google foi uma tela de login, não o documento. Reconecte o Google Drive e confirme que sua conta Cupola tem permissão no arquivo.",
        403,
      );
    }

    if (!textoExtraido || textoExtraido.trim().length === 0) {
      return await respondErro("Não foi possível extrair texto do documento (arquivo vazio ou sem texto legível).", 422);
    }

    return new Response(
      JSON.stringify({ texto: textoExtraido.trim() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("parse-documento error:", err);
    const mensagem = err instanceof Error ? err.message : "Erro interno";
    return await respondErro(mensagem, 500);
  }
});

function decodeTextoComFallback(bytes: Uint8Array): string {
  // Tenta UTF-8 estrito primeiro (fatal:true dispara erro em bytes inválidos).
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Fallback para windows-1252 (superset de latin1, comum em exports brasileiros).
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      // Última tentativa: UTF-8 não-estrito (silencia bytes inválidos).
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

async function extractFromPDF(bytes: Uint8Array): Promise<string> {
  // Use pdf-parse via esm.sh
  const pdfParse = (await import("https://esm.sh/pdf-parse@1.1.1")).default;
  const result = await pdfParse(bytes);
  return result.text || "";
}

async function extractFromDOCX(bytes: Uint8Array): Promise<string> {
  // Use mammoth via esm.sh
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const result = await mammoth.extractRawText({ buffer: bytes.buffer });
  return result.value || "";
}

function normalizarTipoArquivo(tipo?: string, nomeArquivo?: string): "pdf" | "docx" | "txt" | null {
  const raw = `${tipo || ""} ${nomeArquivo || ""}`.toLowerCase();
  if (raw.includes("pdf") || raw.endsWith(".pdf")) return "pdf";
  if (raw.includes("docx") || raw.includes("wordprocessingml") || raw.endsWith(".docx")) return "docx";
  if (
    raw.includes("text/plain") ||
    raw.includes("txt") ||
    raw.includes("vtt") ||
    raw.includes("srt") ||
    raw.endsWith(".txt") ||
    raw.endsWith(".vtt") ||
    raw.endsWith(".srt")
  ) return "txt";
  return null;
}

function pareceHtmlLoginGoogle(texto: string) {
  const inicio = texto.trim().slice(0, 2_000).toLowerCase();
  return (
    inicio.startsWith("<!doctype html") ||
    inicio.startsWith("<html") ||
    inicio.includes("accounts.google.com") ||
    inicio.includes("service_login") ||
    inicio.includes("google accounts")
  );
}

async function extractFromGDrive(url: string, accessToken: string | null): Promise<string> {
  // Extract file ID from various Google Drive/Docs URL formats
  let fileId: string | null = null;

  // Google Docs: https://docs.google.com/document/d/{ID}/...
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) fileId = docsMatch[1];

  // Google Sheets / Slides native links
  if (!fileId) {
    const nativeMatch = url.match(/docs\.google\.com\/(?:spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (nativeMatch) fileId = nativeMatch[1];
  }

  // Google Drive: https://drive.google.com/file/d/{ID}/...
  if (!fileId) {
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) fileId = driveMatch[1];
  }

  // Google Drive open: https://drive.google.com/open?id={ID}
  if (!fileId) {
    try {
      const parsed = new URL(url);
      const id = parsed.searchParams.get("id");
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) fileId = id;
    } catch {
      const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
      if (openMatch) fileId = openMatch[1];
    }
  }

  if (!fileId) {
    throw new Error(
      "URL do Google Drive não reconhecida. Use um link de Google Docs ou Google Drive."
    );
  }

  if (!accessToken) {
    throw new Error(
      "Você precisa conectar sua conta Google em /minhas-integracoes para ler arquivos do Google Drive."
    );
  }

  // Get file metadata to know mimeType
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaRes.ok) {
    const errTxt = await metaRes.text();
    if (metaRes.status === 404) {
      throw new Error("Arquivo não encontrado ou sem permissão. Confirme que sua conta Google tem acesso a ele.");
    }
    throw new Error(`Falha ao acessar arquivo do Drive (${metaRes.status}): ${errTxt.slice(0, 200)}`);
  }
  const meta = await metaRes.json();
  const mimeType: string = meta.mimeType || "";

  // Google Docs / native Google formats → export
  if (mimeType === "application/vnd.google-apps.document") {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent("text/plain")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!r.ok) throw new Error(await googleApiErrorMessage(r, "Falha ao exportar Google Doc"));
    const texto = await r.text();
    if (pareceHtmlLoginGoogle(texto)) throw new Error("O Google retornou uma tela de login ao exportar o documento. Confirme a permissão do arquivo para a conta conectada.");
    return texto;
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent("text/csv")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!r.ok) throw new Error(await googleApiErrorMessage(r, "Falha ao exportar Sheets"));
    return await r.text();
  }
  if (mimeType === "application/vnd.google-apps.presentation") {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent("text/plain")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!r.ok) throw new Error(await googleApiErrorMessage(r, "Falha ao exportar Slides"));
    return await r.text();
  }

  // Binary files → download via alt=media
  const dl = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!dl.ok) throw new Error(await googleApiErrorMessage(dl, "Falha ao baixar arquivo"));
  const buffer = await dl.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (mimeType === "application/pdf") {
    return await extractFromPDF(bytes);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType.includes("wordprocessingml")
  ) {
    return await extractFromDOCX(bytes);
  }
  if (mimeType.startsWith("text/")) {
    const texto = new TextDecoder().decode(bytes);
    if (pareceHtmlLoginGoogle(texto)) throw new Error("O Google retornou uma tela de login em vez do arquivo. Confirme a permissão do arquivo para a conta conectada.");
    return texto;
  }

  throw new Error(`Tipo de arquivo não suportado: ${mimeType}. Use Google Docs, PDF, DOCX ou TXT.`);
}

async function googleApiErrorMessage(res: Response, prefixo: string) {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message;
    if (typeof message === "string") return `${prefixo}: ${message}`;
  } catch {
    // usa texto cru abaixo
  }
  return `${prefixo} (${res.status}): ${text.slice(0, 300)}`;
}
