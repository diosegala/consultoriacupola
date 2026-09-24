// TEMPORÁRIA: importação única dos dados do CupolaOS. Remover após uso.
import postgres from "npm:postgres@3.4.4";
const TOKEN = "9f73d26b484ad015d9e16d150e8f20727571024ce24ecc48";
Deno.serve(async (req) => {
  if (req.headers.get("x-token") !== TOKEN) return new Response("no", { status: 401 });
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false });
  try {
    const body = await req.text();
    const r = await sql.begin(async (tx) => {
      await tx.unsafe("set local session_replication_role = replica");
      return await tx.unsafe(body);
    });
    return Response.json({ ok: true, r: Array.isArray(r) ? r.slice(0, 50) : r });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  } finally { await sql.end(); }
});
