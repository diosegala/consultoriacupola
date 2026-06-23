import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccess(admin: any, row: any) {
  const expired = new Date(row.expires_at).getTime() < Date.now();
  if (!expired) return row;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: row.refresh_token, grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Refresh falhou: ${JSON.stringify(data)}`);
  const newExpires = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await admin.from("consultor_google_tokens")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("consultor_id", row.consultor_id);
  return { ...row, access_token: data.access_token, expires_at: newExpires };
}

function matchCliente(nome: string, clientes: any[], aliases: any[]): string | null {
  const lower = nome.toLowerCase();
  const candidates: { cliente_id: string; key: string }[] = [];
  clientes.forEach(c => candidates.push({ cliente_id: c.id, key: c.nome.toLowerCase() }));
  aliases.forEach(a => candidates.push({ cliente_id: a.cliente_id, key: a.alias.toLowerCase() }));
  const bracket = nome.match(/\[([^\]]+)\]/);
  if (bracket) {
    const b = bracket[1].toLowerCase().trim();
    const exact = candidates.filter(c => c.key === b);
    if (exact.length === 1) return exact[0].cliente_id;
  }
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = new Set(
    candidates
      .filter(c => {
        const k = c.key.trim();
        if (!k) return false;
        // Whole-word match so short aliases like "INT" don't hit "interview".
        return new RegExp(`(^|[^a-z0-9])${escape(k)}([^a-z0-9]|$)`, "i").test(lower);
      })
      .map(c => c.cliente_id)
  );
  return matches.size === 1 ? Array.from(matches)[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokens } = await admin
      .from("consultor_google_tokens").select("*").eq("ativo", true);

    const { data: clientes } = await admin.from("clientes").select("id, nome");
    const { data: aliases } = await admin.from("cliente_aliases").select("cliente_id, alias");

    const resultados: any[] = [];

    for (const row of (tokens || [])) {
      try {
        if (!row.pasta_meet_id) {
          resultados.push({ consultor_id: row.consultor_id, error: "pasta_meet_id ausente" });
          continue;
        }
        const tk = await refreshAccess(admin, row);

        const q = `'${tk.pasta_meet_id}' in parents and trashed=false and mimeType='application/vnd.google-apps.document'`;
        const filesRes = await fetch(
          "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
          "&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=200",
          { headers: { Authorization: `Bearer ${tk.access_token}` } }
        );
        const filesData = await filesRes.json();
        const docs = filesData.files || [];

        const ids = docs.map((d: any) => d.id);
        const { data: jaImp } = await admin
          .from("reunioes_importadas_log").select("id, google_file_id, status")
          .in("google_file_id", ids.length ? ids : ["__none__"]);
        // Only files actually imported (status='importado') should be skipped.
        // sem_match / erro logs are re-evaluated so newly-created aliases take effect.
        const importedSet = new Set(
          (jaImp || []).filter((j: any) => j.status === "importado").map((j: any) => j.google_file_id)
        );
        const staleLogByFile = new Map(
          (jaImp || []).filter((j: any) => j.status !== "importado").map((j: any) => [j.google_file_id, j.id])
        );

        let importados = 0; let pulados = 0; let erros = 0;

        for (const d of docs) {
          if (importedSet.has(d.id)) continue;
          const clienteId = matchCliente(d.name, clientes || [], aliases || []);
          // Clean up any previous sem_match/erro entry for this file before re-logging.
          const staleId = staleLogByFile.get(d.id);
          if (staleId) {
            await admin.from("reunioes_importadas_log").delete().eq("id", staleId);
          }
          if (!clienteId) {
            await admin.from("reunioes_importadas_log").insert({
              google_file_id: d.id, consultor_id: row.consultor_id,
              nome_arquivo: d.name, status: "sem_match",
            });
            pulados++; continue;
          }
          try {
            const exp = await fetch(
              `https://www.googleapis.com/drive/v3/files/${d.id}/export?mimeType=text/plain`,
              { headers: { Authorization: `Bearer ${tk.access_token}` } }
            );
            if (!exp.ok) throw new Error(await exp.text());
            const transcricao = await exp.text();
            const dataReuniao = (d.createdTime || new Date().toISOString()).slice(0, 10);
            const { data: reuniao, error: rErr } = await admin.from("reunioes").insert({
              consultor_id: row.consultor_id,
              cliente_id: clienteId,
              data_reuniao: dataReuniao,
              transcricao,
              status_analise: "pendente",
            }).select().single();
            if (rErr) throw rErr;
            await admin.from("reunioes_importadas_log").insert({
              google_file_id: d.id, consultor_id: row.consultor_id,
              cliente_id: clienteId, reuniao_id: reuniao.id,
              nome_arquivo: d.name, status: "importado",
            });
            importados++;
          } catch (e: any) {
            await admin.from("reunioes_importadas_log").insert({
              google_file_id: d.id, consultor_id: row.consultor_id,
              nome_arquivo: d.name, status: "erro", erro: e.message,
            });
            erros++;
          }
        }

        await admin.from("consultor_google_tokens")
          .update({ ultima_sincronizacao: new Date().toISOString() })
          .eq("consultor_id", row.consultor_id);

        resultados.push({ consultor_id: row.consultor_id, importados, pulados, erros });
      } catch (e: any) {
        console.error("Sync consultor failed", row.consultor_id, e.message);
        resultados.push({ consultor_id: row.consultor_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});