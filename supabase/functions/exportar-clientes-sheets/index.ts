import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar contratos ativos com cliente e consultor
    const { data: contratos, error } = await admin
      .from("contratos")
      .select("id, cliente:clientes(nome, cidade, uf, consultor:consultores(nome))")
      .eq("ativo", true);

    if (error) throw error;

    const rows = (contratos || [])
      .map((c: any) => ({
        nome: c.cliente?.nome || "",
        cidade: [c.cliente?.cidade, c.cliente?.uf].filter(Boolean).join(" - "),
        consultor: c.cliente?.consultor?.nome || "",
      }))
      .filter((r) => r.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SHEETS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!LOVABLE_API_KEY || !SHEETS_KEY) {
      return new Response(JSON.stringify({ error: "Google Sheets connector não configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gatewayHeaders = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SHEETS_KEY,
      "Content-Type": "application/json",
    };

    const today = new Date().toISOString().slice(0, 10);
    const title = `Clientes Ativos - ${today}`;

    // 1) Criar planilha
    const createRes = await fetch(`${GATEWAY}/spreadsheets`, {
      method: "POST",
      headers: gatewayHeaders,
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: "Clientes" } }],
      }),
    });
    const createBody = await createRes.text();
    if (!createRes.ok) {
      return new Response(JSON.stringify({ error: "Falha ao criar planilha", detail: createBody }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const created = JSON.parse(createBody);
    const spreadsheetId = created.spreadsheetId;
    const spreadsheetUrl = created.spreadsheetUrl;

    // 2) Escrever valores
    const values = [
      ["Cliente", "Cidade", "Consultor"],
      ...rows.map((r) => [r.nome, r.cidade, r.consultor]),
    ];
    const range = "Clientes!A1:C" + values.length;
    const putRes = await fetch(
      `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: gatewayHeaders,
        body: JSON.stringify({ values }),
      },
    );
    if (!putRes.ok) {
      const putBody = await putRes.text();
      return new Response(JSON.stringify({ error: "Falha ao escrever valores", detail: putBody, url: spreadsheetUrl }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ url: spreadsheetUrl, spreadsheetId, total: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});