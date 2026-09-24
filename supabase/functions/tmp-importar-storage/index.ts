// Função temporária para importar os arquivos do CupolaOS. Será removida.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const TOKEN = "81a4482453b903fecb2ecfbf2def2cefbc32255266d1b51e";
Deno.serve(async (req) => {
  if (req.headers.get("x-import-token") !== TOKEN) return new Response("no", { status: 403 });
  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket")!;
  const path = url.searchParams.get("path")!;
  if (!["conhecimento", "retratos"].includes(bucket)) return new Response("bucket", { status: 400 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = new Uint8Array(await req.arrayBuffer());
  const { error } = await admin.storage.from(bucket).upload(path, body, { contentType: req.headers.get("content-type") ?? "application/octet-stream", upsert: true });
  return new Response(error ? error.message : "ok", { status: error ? 500 : 200 });
});
