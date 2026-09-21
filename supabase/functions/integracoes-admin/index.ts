// Integrações da agência configuradas pelos administradores na tela de Configurações.
// A tela nunca recebe as chaves: só o estado (ligada/desligada), o final do valor e o teste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CAMPOS,
  CHAVES,
  type ChaveIntegracao,
  type Credenciais,
  lerCredenciais,
  mascarar,
  tokenGoogleContaServico,
} from "../_shared/integracoes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function testar(chave: ChaveIntegracao, cred: Credenciais): Promise<{ ok: boolean; detalhe: string }> {
  try {
    if (chave === "firecrawl") {
      const res = await fetch("https://api.firecrawl.dev/v2/team/credit-usage", {
        headers: { Authorization: `Bearer ${cred.api_key}` },
      });
      const txt = await res.text();
      if (!res.ok) return { ok: false, detalhe: `Firecrawl respondeu ${res.status}: ${txt.slice(0, 200)}` };
      return { ok: true, detalhe: "Chave aceita pelo Firecrawl." };
    }
    if (chave === "runrunit") {
      const res = await fetch("https://runrun.it/api/v1/users", {
        headers: { "App-Key": cred.app_key, "User-Token": cred.user_token },
      });
      const txt = await res.text();
      if (!res.ok) return { ok: false, detalhe: `RunRun.it respondeu ${res.status}: ${txt.slice(0, 200)}` };
      return { ok: true, detalhe: "Acesso ao RunRun.it confirmado." };
    }
    const token = await tokenGoogleContaServico(cred.service_account_json, [
      "https://www.googleapis.com/auth/drive.readonly",
    ]);
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const txt = await res.text();
    if (!res.ok) return { ok: false, detalhe: `Google Drive respondeu ${res.status}: ${txt.slice(0, 200)}` };
    return { ok: true, detalhe: "Conta de serviço do Google Drive validada." };
  } catch (e) {
    return { ok: false, detalhe: e instanceof Error ? e.message : "Erro inesperado no teste." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const comUsuario = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await comUsuario.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(url, service);
    const { data: papel } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!papel) return json({ error: "Apenas administradores podem mexer nas integrações." }, 403);

    const body = await req.json().catch(() => ({}));
    const acao = String(body.acao ?? "listar");

    if (acao === "listar") {
      const { data, error } = await admin
        .from("integracoes_credenciais")
        .select("chave, credenciais, ativo, observacao, atualizado_em, atualizado_por");
      if (error) throw error;
      const linhas = data ?? [];
      const itens = CHAVES.map((chave) => {
        const linha = linhas.find((l) => l.chave === chave);
        const cred = (linha?.credenciais ?? {}) as Credenciais;
        return {
          chave,
          configurada: Object.values(cred).some((v) => String(v ?? "").trim()),
          ativo: linha?.ativo ?? false,
          observacao: linha?.observacao ?? null,
          atualizado_em: linha?.atualizado_em ?? null,
          campos: CAMPOS[chave].map((c) => ({
            id: c.id,
            segredo: c.segredo,
            preenchido: !!String(cred[c.id] ?? "").trim(),
            resumo: c.segredo ? (cred[c.id] ? mascarar(cred[c.id]) : null) : (cred[c.id] ?? null),
          })),
        };
      });
      return json({ itens });
    }

    const chave = String(body.chave ?? "") as ChaveIntegracao;
    if (!CHAVES.includes(chave)) return json({ error: "Integração desconhecida." }, 400);

    if (acao === "salvar") {
      const recebidos = (body.credenciais ?? {}) as Credenciais;
      const atuais = (await lerCredenciais(admin, chave)) ?? {};
      const { data: linhaAtual } = await admin
        .from("integracoes_credenciais")
        .select("credenciais")
        .eq("chave", chave)
        .maybeSingle();
      const base = ((linhaAtual?.credenciais ?? atuais) ?? {}) as Credenciais;

      const finais: Credenciais = { ...base };
      for (const campo of CAMPOS[chave]) {
        const novo = String(recebidos[campo.id] ?? "").trim();
        if (novo) finais[campo.id] = novo;
      }
      for (const campo of CAMPOS[chave]) {
        if (campo.obrigatorio && !String(finais[campo.id] ?? "").trim()) {
          return json({ error: `Faltou preencher: ${campo.id}` }, 400);
        }
      }
      if (chave === "google_drive") {
        try {
          JSON.parse(finais.service_account_json);
        } catch {
          return json({ error: "O conteúdo da conta de serviço não é um JSON válido." }, 400);
        }
      }

      const { error } = await admin.from("integracoes_credenciais").upsert(
        {
          chave,
          credenciais: finais,
          ativo: body.ativo ?? true,
          observacao: body.observacao ?? null,
          atualizado_em: new Date().toISOString(),
          atualizado_por: user.id,
        },
        { onConflict: "chave" },
      );
      if (error) throw error;
      const teste = await testar(chave, finais);
      return json({ ok: true, teste });
    }

    if (acao === "testar") {
      const cred = await lerCredenciais(admin, chave);
      if (!cred) return json({ ok: false, teste: { ok: false, detalhe: "Integração sem dados ou desligada." } });
      return json({ ok: true, teste: await testar(chave, cred) });
    }

    if (acao === "alternar") {
      const { error } = await admin
        .from("integracoes_credenciais")
        .update({ ativo: !!body.ativo, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
        .eq("chave", chave);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "remover") {
      const { error } = await admin.from("integracoes_credenciais").delete().eq("chave", chave);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("[integracoes-admin]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});
