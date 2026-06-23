import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return json({ error: "invalid_token" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: q, error } = await supabase
      .from("questionarios")
      .select("id, status, progresso_pct, respostas, ultimo_salvamento_em, concluido_em, expira_em, cliente_id, template_id")
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ error: "db_error" }, 500);
    if (!q) return json({ error: "not_found" }, 404);
    if (q.status === "arquivado") return json({ error: "arquivado" }, 410);
    if (q.expira_em && new Date(q.expira_em) < new Date()) return json({ error: "expirado" }, 410);

    const [{ data: cliente }, { data: template }] = await Promise.all([
      supabase.from("clientes").select("nome").eq("id", q.cliente_id).maybeSingle(),
      supabase.from("questionarios_template").select("nome, estrutura").eq("id", q.template_id).maybeSingle(),
    ]);

    return json({
      cliente_nome: cliente?.nome ?? "",
      template_nome: template?.nome ?? "",
      estrutura: template?.estrutura ?? { secoes: [] },
      respostas: q.respostas ?? {},
      status: q.status,
      progresso_pct: q.progresso_pct,
      ultimo_salvamento_em: q.ultimo_salvamento_em,
      concluido_em: q.concluido_em,
    });
  } catch (e) {
    console.error("questionario-get error", e);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}