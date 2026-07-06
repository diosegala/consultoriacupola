// Edge Function: processar-disc
// Recebe { consultor_id, pdf_base64, nome_arquivo, data_avaliacao }
// - Guarda o PDF no bucket "perfis-disc"
// - Extrai texto do PDF
// - Chama Claude para produzir o perfil_resumo estruturado
// - Faz upsert em public.perfis_comportamentais
// - Enfileira regeração de cruzamentos DISC (não bloqueia)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from "../_shared/anthropic.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*;base64,/, "");
  return Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfParse = (await import("https://esm.sh/pdf-parse@1.1.1")).default;
  const result = await pdfParse(bytes);
  return (result.text || "").trim();
}

function safeJsonParse(raw: string): any {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const s = cleaned.search(/[\{\[]/);
  const e = cleaned.lastIndexOf(cleaned[s] === "[" ? "]" : "}");
  if (s !== -1 && e !== -1) cleaned = cleaned.slice(s, e + 1);
  try { return JSON.parse(cleaned); } catch {
    return JSON.parse(cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Só admin/director pode enviar
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isDir } = await admin.rpc("has_role", { _user_id: user.id, _role: "director" });
    if (!isAdmin && !isDir) {
      return new Response(JSON.stringify({ error: "Apenas admin/diretor" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { consultor_id, pdf_base64, nome_arquivo, data_avaliacao } = body ?? {};
    if (!consultor_id || !pdf_base64) {
      return new Response(JSON.stringify({ error: "consultor_id e pdf_base64 são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Upload PDF
    const bytes = base64ToBytes(pdf_base64);
    const path = `${consultor_id}/${Date.now()}-${(nome_arquivo || "disc.pdf").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await admin.storage.from("perfis-disc").upload(path, bytes, {
      contentType: "application/pdf", upsert: false,
    });
    if (up.error) throw new Error(`Upload falhou: ${up.error.message}`);

    // 2) Extrair texto
    let raw_text = "";
    try { raw_text = await extractPdfText(bytes); }
    catch (e: any) {
      console.error("[processar-disc] pdf-parse falhou", e);
      throw new Error("Não foi possível ler o PDF. Envie um PDF com texto pesquisável.");
    }
    if (!raw_text || raw_text.length < 50) {
      throw new Error("PDF vazio ou sem texto extraível.");
    }
    const texto = raw_text.length > 25000 ? raw_text.slice(0, 25000) + "\n\n[truncado]" : raw_text;

    // 3) Estruturar via Claude (tool use)
    const claude = await callClaude({
      system: "Você é um analista comportamental especialista em avaliações DISC. Extraia o resultado do PDF com objetividade — sem invenções.",
      messages: [{
        role: "user",
        content: `Você recebeu o resultado de uma avaliação DISC. Retorne o perfil estruturado. Se os scores numéricos não estiverem explícitos, estime (0-100) com base nas descrições qualitativas.\n\nTEXTO:\n${texto}`,
      }],
      max_tokens: 2500,
      tools: [{
        name: "registrar_perfil_disc",
        description: "Registra o perfil DISC estruturado",
        input_schema: {
          type: "object",
          properties: {
            perfil_primario: { type: "string", enum: ["D","I","S","C"] },
            perfil_secundario: { type: "string", enum: ["D","I","S","C"] },
            scores: {
              type: "object",
              properties: {
                D: { type: "number" }, I: { type: "number" },
                S: { type: "number" }, C: { type: "number" },
              },
              required: ["D","I","S","C"],
            },
            pontos_fortes: { type: "array", items: { type: "string" } },
            pontos_de_atencao: { type: "array", items: { type: "string" } },
            sob_pressao: { type: "string" },
            estilo_comunicacao: { type: "string" },
            necessidades_do_ambiente: { type: "array", items: { type: "string" } },
            como_motivar: { type: "string" },
            como_gerar_estresse: { type: "string" },
            resumo_livre: { type: "string" },
          },
          required: [
            "perfil_primario","perfil_secundario","scores","pontos_fortes","pontos_de_atencao",
            "sob_pressao","estilo_comunicacao","necessidades_do_ambiente","como_motivar",
            "como_gerar_estresse","resumo_livre",
          ],
        },
      }],
      tool_choice: { type: "tool", name: "registrar_perfil_disc" },
    });

    if (!claude.ok || !claude.toolInput) {
      await logAiUsage({
        admin, agente_tipo: "processar_disc", user_id: user.id,
        consultor_id, status: "error", error_message: claude.errorMessage,
      });
      throw new Error(claude.errorMessage ?? "Falha ao estruturar perfil");
    }
    await logAiUsage({
      admin, agente_tipo: "processar_disc", user_id: user.id,
      consultor_id, usage: claude.usage,
    });

    const perfil_resumo = claude.toolInput as any;

    // 4) Upsert (remove PDF antigo, se houver)
    const { data: existente } = await admin
      .from("perfis_comportamentais").select("id, pdf_url").eq("consultor_id", consultor_id).maybeSingle();
    if (existente?.pdf_url) {
      const oldPath = existente.pdf_url.split("/perfis-disc/")[1];
      if (oldPath) await admin.storage.from("perfis-disc").remove([oldPath]).catch(() => {});
    }

    const pdf_url = up.data?.path ? `perfis-disc/${up.data.path}` : path;

    const { error: upsErr } = await admin
      .from("perfis_comportamentais")
      .upsert({
        consultor_id,
        tipo_avaliacao: "disc",
        data_avaliacao: data_avaliacao || new Date().toISOString().slice(0, 10),
        perfil_resumo,
        pdf_url,
        raw_text,
      }, { onConflict: "consultor_id" });
    if (upsErr) throw new Error(`Falha ao salvar perfil: ${upsErr.message}`);

    // 5) Regerar cruzamentos (fire-and-forget)
    try {
      const { data: rolesDir } = await admin
        .from("user_roles").select("user_id").in("role", ["admin","director"]);
      const { data: cuMap } = await admin.from("consultor_user").select("consultor_id, user_id");
      const diretorIds = new Set(
        (cuMap ?? [])
          .filter((r: any) => (rolesDir ?? []).some((x: any) => x.user_id === r.user_id))
          .map((r: any) => r.consultor_id),
      );

      const invokeUrl = `${supabaseUrl}/functions/v1/gerar-analise-cruzamento-disc`;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      if (diretorIds.has(consultor_id)) {
        // é diretor → regera contra toda a equipe com perfil
        const { data: outros } = await admin
          .from("perfis_comportamentais").select("consultor_id");
        for (const o of outros ?? []) {
          if (o.consultor_id === consultor_id) continue;
          fetch(invokeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
            body: JSON.stringify({ diretor_id: consultor_id, consultor_id: o.consultor_id }),
          }).catch(() => {});
        }
      } else {
        // é consultora → regera contra cada diretor com perfil
        const { data: perfisDir } = await admin
          .from("perfis_comportamentais")
          .select("consultor_id")
          .in("consultor_id", Array.from(diretorIds));
        for (const p of perfisDir ?? []) {
          fetch(invokeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
            body: JSON.stringify({ diretor_id: p.consultor_id, consultor_id }),
          }).catch(() => {});
        }
      }
    } catch (cruzErr) {
      console.error("[processar-disc] regeração cruzamentos falhou:", cruzErr);
    }

    return new Response(JSON.stringify({ ok: true, perfil_resumo, pdf_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[processar-disc]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});