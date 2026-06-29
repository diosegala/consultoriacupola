import { authenticate, corsHeaders, getValidGoogleToken, jsonResponse } from "../_shared/google.ts";

function hasDocsScope(escopo: string | null | undefined) {
  if (!escopo) return false;
  return escopo.includes("auth/documents") || escopo.includes("auth/drive.file");
}

/**
 * Converte markdown simples em uma sequência de requests do Google Docs API.
 * Suporta: # / ## / ### / parágrafos. Mantém deliberadamente simples.
 */
function markdownToGdocsRequests(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  type Block = { text: string; style?: "HEADING_1" | "HEADING_2" | "HEADING_3" };
  const blocks: Block[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "").replace(/^[-*]\s+/, "• ");
    if (/^###\s+/.test(line)) blocks.push({ text: line.replace(/^###\s+/, ""), style: "HEADING_3" });
    else if (/^##\s+/.test(line)) blocks.push({ text: line.replace(/^##\s+/, ""), style: "HEADING_2" });
    else if (/^#\s+/.test(line)) blocks.push({ text: line.replace(/^#\s+/, ""), style: "HEADING_1" });
    else blocks.push({ text: line });
  }

  const requests: any[] = [];
  let index = 1; // Documento começa em 1
  for (const b of blocks) {
    const textWithNewline = b.text + "\n";
    requests.push({
      insertText: { location: { index }, text: textWithNewline },
    });
    const startIndex = index;
    const endIndex = index + textWithNewline.length;
    if (b.style) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex: endIndex - 1 },
          paragraphStyle: { namedStyleType: b.style },
          fields: "namedStyleType",
        },
      });
    }
    index = endIndex;
  }
  return requests;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { admin, consultorId } = auth;

    const { titulo, conteudo_markdown } = await req.json();
    if (!titulo || !conteudo_markdown) {
      return jsonResponse({ error: "titulo e conteudo_markdown são obrigatórios" }, 400);
    }

    let tk;
    try {
      tk = await getValidGoogleToken(admin, consultorId);
    } catch (e: any) {
      return jsonResponse({ error: "not_connected", message: e.message }, 400);
    }

    if (!hasDocsScope(tk.escopo)) {
      return jsonResponse({
        error: "missing_scope",
        message: "Reconecte sua conta Google permitindo acesso ao Google Docs para gerar documentos automaticamente.",
      }, 403);
    }

    // 1) Criar o documento
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tk.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: titulo }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      return jsonResponse({ error: "create_failed", details: created }, createRes.status);
    }
    const documentId = created.documentId as string;

    // 2) Popular conteúdo via batchUpdate
    const requests = markdownToGdocsRequests(conteudo_markdown);
    if (requests.length > 0) {
      const upRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tk.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests }),
        },
      );
      if (!upRes.ok) {
        const err = await upRes.json();
        console.error("batchUpdate falhou:", err);
      }
    }

    const url = `https://docs.google.com/document/d/${documentId}/edit`;
    return jsonResponse({ documentId, url });
  } catch (e: any) {
    console.error("criar-gdoc:", e);
    return jsonResponse({ error: e.message ?? "Unknown error" }, 500);
  }
});