// Credenciais das integrações da agência (Firecrawl, RunRun.it, Google Drive).
// Ficam na tabela public.integracoes_credenciais, que só o servidor lê.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ChaveIntegracao = "firecrawl" | "runrunit" | "google_drive";

export const CHAVES: ChaveIntegracao[] = ["firecrawl", "runrunit", "google_drive"];

/** Campos de cada integração: o que o admin preenche na tela. */
export const CAMPOS: Record<ChaveIntegracao, { id: string; obrigatorio: boolean; segredo: boolean }[]> = {
  firecrawl: [{ id: "api_key", obrigatorio: true, segredo: true }],
  runrunit: [
    { id: "app_key", obrigatorio: true, segredo: true },
    { id: "user_token", obrigatorio: true, segredo: true },
  ],
  google_drive: [
    { id: "service_account_json", obrigatorio: true, segredo: true },
    { id: "pasta_raiz_id", obrigatorio: false, segredo: false },
  ],
};

export interface Credenciais {
  [campo: string]: string;
}

/** Lê as credenciais ativas de uma integração. Devolve null quando não há ou está desligada. */
export async function lerCredenciais(
  admin: SupabaseClient,
  chave: ChaveIntegracao,
): Promise<Credenciais | null> {
  const { data, error } = await admin
    .from("integracoes_credenciais")
    .select("credenciais, ativo")
    .eq("chave", chave)
    .maybeSingle();
  if (error || !data || !data.ativo) return null;
  const cred = (data.credenciais ?? {}) as Credenciais;
  return Object.keys(cred).length ? cred : null;
}

/** Mensagem padrão quando a integração não foi configurada pelo admin. */
export function faltaIntegracao(chave: ChaveIntegracao): string {
  const nomes: Record<ChaveIntegracao, string> = {
    firecrawl: "Firecrawl",
    runrunit: "RunRun.it",
    google_drive: "Google Drive",
  };
  return `A integração com ${nomes[chave]} ainda não foi configurada. Um administrador precisa preencher os dados em Configurações → Integrações.`;
}

/** Mostra só o final do valor, para a tela confirmar que algo está salvo. */
export function mascarar(valor: string): string {
  const limpo = (valor ?? "").trim();
  if (limpo.length <= 4) return "••••";
  return `••••${limpo.slice(-4)}`;
}

/** Token de acesso do Google a partir da conta de serviço (JWT assinado com RS256). */
export async function tokenGoogleContaServico(
  serviceAccountJson: string,
  escopos: string[],
): Promise<string> {
  const conta = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string };
  if (!conta.client_email || !conta.private_key) {
    throw new Error("O arquivo da conta de serviço precisa ter client_email e private_key.");
  }
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = { alg: "RS256", typ: "JWT" };
  const corpo = {
    iss: conta.client_email,
    scope: escopos.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  };
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const conteudo = `${b64(cabecalho)}.${b64(corpo)}`;

  const pem = conta.private_key.replace(/\\n/g, "\n");
  const corpoPem = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = Uint8Array.from(atob(corpoPem), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(conteudo));
  const assinaturaB64 = btoa(String.fromCharCode(...new Uint8Array(assinatura)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${conteudo}.${assinaturaB64}`,
    }),
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || !dados.access_token) {
    throw new Error(dados.error_description || dados.error || `Google recusou a conta de serviço (${res.status}).`);
  }
  return dados.access_token as string;
}
