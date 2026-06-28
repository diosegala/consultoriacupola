import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Apenas service_role pode disparar (pg_cron)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);

    const auth = { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
    const start = new Date().toISOString();

    const syncRes = await fetch(`${supabaseUrl}/functions/v1/oraculo-sync-notion`, {
      method: "POST", headers: auth, body: JSON.stringify({}),
    });
    const syncJson = await syncRes.json().catch(() => ({}));

    const indexRes = await fetch(`${supabaseUrl}/functions/v1/oraculo-indexar-notion`, {
      method: "POST", headers: auth, body: JSON.stringify({}),
    });
    const indexJson = await indexRes.json().catch(() => ({}));

    await service.from("oraculo_settings")
      .update({ ultima_sincronizacao_auto: new Date().toISOString() })
      .eq("id", true);

    return new Response(JSON.stringify({ ok: true, started_at: start, sync: syncJson, index: indexJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oraculo-cron-daily error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});