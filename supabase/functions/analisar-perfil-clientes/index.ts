import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
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

    const { data: questionarios } = await admin
      .from("questionarios")
      .select("cliente_id, respostas, status")
      .in("status", ["respondido", "finalizado", "concluido"]);

    const { data: reunioes } = await admin
      .from("reunioes")
      .select("cliente_id, score_cliente, analise_cliente")
      .eq("status_analise", "concluido")
      .not("score_cliente", "is", null);

    const { data: docs } = await admin
      .from("projeto_documentos")
      .select("cliente_id")
      .eq("tipo", "diagnostico");

    const { data: clientes } = await admin
      .from("clientes")
      .select("id, nome, contratos(tipos_consultoria(nome))");

    const qMap = new Map<string, any>();
    for (const q of questionarios || []) qMap.set(q.cliente_id, q.respostas);

    const diagSet = new Set((docs || []).map((d: any) => d.cliente_id));
    const clienteInfo = new Map<string, any>();
    for (const c of clientes || []) {
      const tipos = ((c as any).contratos || []).map((x: any) => x?.tipos_consultoria?.nome).filter(Boolean);
      clienteInfo.set(c.id, { nome: c.nome, tipo_contrato: tipos[0] || null });
    }

    const agg = new Map<string, { scores: number[]; dims: Record<string, number[]> }>();
    for (const r of reunioes || []) {
      const cid = (r as any).cliente_id;
      if (!agg.has(cid)) agg.set(cid, { scores: [], dims: {} });
      const bucket = agg.get(cid)!;
      bucket.scores.push(Number((r as any).score_cliente));
      const a = (r as any).analise_cliente || {};
      for (const k of ["participacao_ativa", "abertura_sugestoes", "comprometimento_acoes", "clareza_demandas", "engajamento_estrategico"]) {
        const v = Number(a?.[k]);
        if (!Number.isFinite(v)) continue;
        (bucket.dims[k] = bucket.dims[k] || []).push(v);
      }
    }

    const media = (arr: number[]) => arr.length ? Number((arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(2)) : null;

    const consolidados: any[] = [];
    for (const [cid, v] of agg.entries()) {
      if (v.scores.length < 3) continue;
      if (!qMap.has(cid)) continue;
      const info = clienteInfo.get(cid) || {};
      consolidados.push({
        cliente_id: cid,
        tipo_contrato: info.tipo_contrato,
        score_cliente_medio: media(v.scores),
        dimensoes_engajamento: {
          participacao_ativa_media: media(v.dims.participacao_ativa || []),
          abertura_sugestoes_media: media(v.dims.abertura_sugestoes || []),
          comprometimento_acoes_media: media(v.dims.comprometimento_acoes || []),
          clareza_demandas_media: media(v.dims.clareza_demandas || []),
          engajamento_estrategico_media: media(v.dims.engajamento_estrategico || []),
        },
        respostas_questionario: qMap.get(cid),
        tem_diagnostico: diagSet.has(cid),
      });
    }

    if (consolidados.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum cliente com questionário respondido + 3 reuniões analisadas." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você recebeu dados consolidados de clientes de consultoria imobiliária, incluindo seu perfil declarado no questionário de onboarding e seu engajamento real medido ao longo das reuniões. Analise e responda:
(1) Quais características do questionário estão mais correlacionadas com alto engajamento (score_cliente_medio > 7)? Descreva o perfil que mais aproveita a consultoria.
(2) Quais características estão correlacionadas com baixo engajamento (< 5)? O que esses clientes têm em comum?
(3) Com base nas demandas/dores que aparecem no questionário e nos dados de engajamento, quais necessidades ainda não são atendidas pelos produtos atuais? Há padrões que sugerem oportunidade de um novo produto ou formato?

Retorne SOMENTE JSON válido (sem markdown fences):
{
  "perfil_ideal": {"caracteristicas": ["..."], "justificativa": "..."},
  "perfil_risco": {"caracteristicas": ["..."], "alertas": "..."},
  "oportunidades_produto": [{"descricao": "...", "evidencia": "...", "potencial_demanda": "..."}]
}

DADOS (${consolidados.length} clientes):
${JSON.stringify(consolidados).slice(0, 60000)}`;

    const claude = await callClaude({
      system: "Você é um analista sênior de produto e consultoria. Responda apenas com JSON válido, sem markdown fences.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8000,
    });
    if (!claude.ok) {
      return new Response(JSON.stringify({ error: claude.errorMessage || `Erro Claude (${claude.status})` }), {
        status: claude.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const raw = claude.text ?? "";
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    let conteudo: any;
    try { conteudo = JSON.parse(cleaned); } catch { conteudo = { raw: cleaned }; }

    const { data: inserted, error: insErr } = await admin
      .from("insights_agregados")
      .insert({
        tipo: "perfil_clientes",
        periodo_analisado: "all",
        filtros: {},
        conteudo,
        gerado_por: user.id,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ insight: inserted, clientes_analisados: consolidados.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[analisar-perfil-clientes]", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});