import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const body = await req.json();
    const { tipo, conteudo_base64, nome_arquivo, gdrive_url } = body;

    let textoExtraido = "";

    // Google Drive link
    if (gdrive_url) {
      textoExtraido = await extractFromGDrive(gdrive_url);
    }
    // File upload (base64)
    else if (conteudo_base64 && tipo) {
      const bytes = Uint8Array.from(atob(conteudo_base64), (c) => c.charCodeAt(0));

      if (tipo === "pdf") {
        textoExtraido = await extractFromPDF(bytes);
      } else if (tipo === "docx") {
        textoExtraido = await extractFromDOCX(bytes);
      } else {
        return new Response(
          JSON.stringify({ error: `Tipo não suportado: ${tipo}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Envie conteudo_base64+tipo ou gdrive_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!textoExtraido || textoExtraido.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair texto do documento." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ texto: textoExtraido.trim() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("parse-documento error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

async function extractFromGDrive(url: string): Promise<string> {
  // Extract file ID from various Google Drive/Docs URL formats
  let fileId: string | null = null;

  // Google Docs: https://docs.google.com/document/d/{ID}/...
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) fileId = docsMatch[1];

  // Google Drive: https://drive.google.com/file/d/{ID}/...
  if (!fileId) {
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) fileId = driveMatch[1];
  }

  // Google Drive open: https://drive.google.com/open?id={ID}
  if (!fileId) {
    const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch) fileId = openMatch[1];
  }

  if (!fileId) {
    throw new Error(
      "URL do Google Drive não reconhecida. Use um link de Google Docs ou Google Drive."
    );
  }

  // Try Google Docs export first
  const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const resp = await fetch(exportUrl, { redirect: "follow" });

  if (resp.ok) {
    return await resp.text();
  }

  // Try Google Drive direct download (for shared files)
  const driveDownload = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const resp2 = await fetch(driveDownload, { redirect: "follow" });

  if (resp2.ok) {
    const contentType = resp2.headers.get("content-type") || "";
    if (contentType.includes("text/")) {
      return await resp2.text();
    }
    // If it's a binary file (PDF/DOCX), extract text
    const buffer = await resp2.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (contentType.includes("pdf")) {
      return await extractFromPDF(bytes);
    }
    if (contentType.includes("wordprocessingml") || contentType.includes("docx")) {
      return await extractFromDOCX(bytes);
    }

    throw new Error("O arquivo do Google Drive não é um formato suportado (PDF, DOCX ou Google Docs).");
  }

  throw new Error(
    "Não foi possível acessar o arquivo. Verifique se o compartilhamento está configurado como 'Qualquer pessoa com o link'."
  );
}
