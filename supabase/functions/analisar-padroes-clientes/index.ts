import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { periodo_meses = 6, tipo_contrato = "todos", consultor_id = null } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!allowed) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const desde = new Date();
    desde.setMonth(desde.getMonth() - Number(periodo_meses || 6));

    let query = admin
      .from("reunioes")
      .select("id, cliente_id, consultor_id, resumo_ia, transcricao, data_reuniao, clientes!inner(id, nome, contratos(id, ativo, tipo_consultoria_id, tipos_consultoria(nome)))")
      .eq("status_analise", "concluido")
      .gte("data_reuniao", desde.toISOString().slice(0, 10));

    if (consultor_id) query = query.eq("consultor_id", consultor_id);
    const { data: reunioes, error } = await query;
    if (error) throw error;

    // Agrupar por cliente
    const porCliente = new Map<string, { nome: string; resumos: string[] }>();
    for (const r of reunioes || []) {
      const cli: any = (r as any).clientes;
      if (!cli) continue;

      if (tipo_contrato !== "todos") {
        const nomes = (cli.contratos || []).map((c: any) => c?.tipos_consultoria?.nome || "").join(" ").toLowerCase();
        if (tipo_contrato === "programa_gestao" && !nomes.includes("gestão") && !nomes.includes("gestao")) continue;
        if (tipo_contrato === "mapeamento" && !nomes.includes("mapeamento")) continue;
      }

      const texto = (r as any).resumo_ia || ((r as any).transcricao ? String((r as any).transcricao).slice(0, 1000) : "");
      if (!texto?.trim()) continue;
      if (!porCliente.has(cli.id)) porCliente.set(cli.id, { nome: cli.nome, resumos: [] });
      porCliente.get(cli.id)!.resumos.push(String(texto).slice(0, 1500));
    }

    if (porCliente.size === 0) {
      return new Response(JSON.stringify({ error: "Sem reuniões analisadas no período/filtros selecionados." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blocos = Array.from(porCliente.entries()).slice(0, 80).map(([id, v], i) => `=== Cliente ${i + 1} (${v.nome}) ===\n${v.resumos.slice(0, 6).join("\n---\n")}`);
    const contexto = blocos.join("\n\n").slice(0, 60000);

    const prompt = `Você recebeu resumos de reuniões de consultoria com diferentes clientes. Analise e identifique:
(1) As 10 dores ou desafios mais recorrentes que os clientes trouxeram, com frequência relativa (em quantos clientes distintos apareceu) e exemplos de como essa dor foi expressa.
(2) As 5 demandas ou pedidos mais frequentes que os clientes fizeram ao consultor.
(3) Os 3 temas que geraram mais resistência ou tensão nas reuniões.

Retorne SOMENTE JSON válido (sem markdown fences), no formato:
{
  "dores": [{"tema": "...", "frequencia_clientes": N, "exemplo": "..."}],
  "demandas": [{"tema": "...", "frequencia_clientes": N}],
  "resistencias": [{"tema": "...", "descricao": "..."}]
}

DADOS (${porCliente.size} clientes distintos):
${contexto}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista sênior de consultoria empresarial. Responda apenas com JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI Gateway ${aiResp.status}: ${t.slice(0, 400)}`);
    }
    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    let conteudo: any;
    try { conteudo = JSON.parse(cleaned); } catch { conteudo = { raw: cleaned }; }

    const { data: inserted, error: insErr } = await admin
      .from("insights_agregados")
      .insert({
        tipo: "dores_recorrentes",
        periodo_analisado: `${periodo_meses}m`,
        filtros: { periodo_meses, tipo_contrato, consultor_id },
        conteudo,
        gerado_por: user.id,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ insight: inserted, clientes_analisados: porCliente.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[analisar-padroes-clientes]", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});