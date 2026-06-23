import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SaveBody {
  token: string;
  respostas: Record<string, unknown>;
  finalizar?: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function computeProgress(estrutura: any, respostas: Record<string, unknown>) {
  const perguntas: any[] = [];
  for (const sec of estrutura?.secoes ?? []) {
    for (const p of sec.perguntas ?? []) perguntas.push(p);
  }
  if (!perguntas.length) return { pct: 0, faltamObrigatorias: [] as string[] };
  let preenchidas = 0;
  const faltamObrigatorias: string[] = [];
  for (const p of perguntas) {
    const v = respostas[p.id];
    const ok = Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "";
    if (ok) preenchidas++;
    else if (p.obrigatorio) faltamObrigatorias.push(p.id);
  }
  return { pct: Math.round((preenchidas / perguntas.length) * 100), faltamObrigatorias };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = (await req.json()) as SaveBody;
    if (!body?.token || !/^[0-9a-f-]{36}$/i.test(body.token)) return json({ error: "invalid_token" }, 400);
    if (!isPlainObject(body.respostas)) return json({ error: "invalid_respostas" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: q, error } = await supabase
      .from("questionarios")
      .select("id, status, template_id, cliente_id, expira_em")
      .eq("token", body.token)
      .maybeSingle();

    if (error) return json({ error: "db_error" }, 500);
    if (!q) return json({ error: "not_found" }, 404);
    if (q.status === "concluido") return json({ error: "ja_concluido" }, 409);
    if (q.status === "arquivado") return json({ error: "arquivado" }, 410);
    if (q.expira_em && new Date(q.expira_em) < new Date()) return json({ error: "expirado" }, 410);

    const { data: template } = await supabase
      .from("questionarios_template")
      .select("estrutura")
      .eq("id", q.template_id)
      .maybeSingle();

    // Whitelist responses to known question ids and basic size guard.
    const validIds = new Set<string>();
    for (const sec of (template?.estrutura as any)?.secoes ?? []) {
      for (const p of sec.perguntas ?? []) validIds.add(p.id);
    }
    const respostasLimpas: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.respostas)) {
      if (!validIds.has(k)) continue;
      if (typeof v === "string" && v.length > 10000) {
        respostasLimpas[k] = v.slice(0, 10000);
      } else {
        respostasLimpas[k] = v;
      }
    }

    const { pct, faltamObrigatorias } = computeProgress(template?.estrutura, respostasLimpas);

    const finalizar = body.finalizar === true;
    if (finalizar && faltamObrigatorias.length) {
      return json({ error: "obrigatorias_faltando", faltamObrigatorias }, 422);
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      respostas: respostasLimpas,
      progresso_pct: pct,
      ultimo_salvamento_em: now,
      status: finalizar ? "concluido" : "em_andamento",
    };
    if (q.status === "nao_iniciado") update.iniciado_em = now;
    if (finalizar) update.concluido_em = now;

    const { error: upErr } = await supabase
      .from("questionarios")
      .update(update)
      .eq("id", q.id);
    if (upErr) return json({ error: "save_failed" }, 500);

    if (finalizar) {
      // Hook de notificação ao consultor (e-mail fica em stand-by até dom_inio CUPOLA estar pronto).
      console.log(`[questionario-save] Cliente ${q.cliente_id} concluiu o question_ario ${q.id}.`);
    }

    return json({ ok: true, status: update.status, progresso_pct: pct, ultimo_salvamento_em: now });
  } catch (e) {
    console.error("questionario-save error", e);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}