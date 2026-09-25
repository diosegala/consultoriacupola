// Base comum das edge functions da Agência.
//
// No CupolaOS original, o servidor falava com o banco como a própria pessoa
// (chave publicável + JWT), e as regras (RLS) do schema eram a única trava.
// Aqui fazemos o mesmo: `db` carrega o JWT de quem chamou, então tudo que a
// função lê ou grava no schema `agencia` passa pelas mesmas regras das telas.
// `admin` (service role) fica só para o registro de uso de IA em public.ai_usage_logs.
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Erro com status HTTP, para recusar a chamada de qualquer ponto da função. */
export class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// deno-lint-ignore no-explicit-any
type Banco = SupabaseClient<any, any, any>;

export interface ContextoAgencia {
  user: User;
  pessoa: { id: string; nome: string | null };
  /** Schema `agencia` como a pessoa (RLS vale). */
  db: Banco;
  /** Service role, só para ai_usage_logs. */
  admin: SupabaseClient;
}

/** Autentica, confere a ficha ativa na Agência e devolve os clientes de banco. */
export async function contextoAgencia(req: Request): Promise<ContextoAgencia> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new ErroHttp(401, "Não autenticado.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const comoPessoa = { global: { headers: { Authorization: authHeader } } };

  const { data: u } = await createClient(url, anonKey, comoPessoa).auth.getUser();
  const user = u?.user;
  if (!user) throw new ErroHttp(401, "Não autenticado.");

  const db = createClient(url, anonKey, { ...comoPessoa, db: { schema: "agencia" } });
  const { data: pessoa } = await db
    .from("pessoas").select("id, nome, ativa").eq("auth_id", user.id).maybeSingle();
  if (!pessoa || pessoa.ativa === false) throw new ErroHttp(403, "Você não tem acesso à Agência.");

  return { user, pessoa: { id: pessoa.id, nome: pessoa.nome ?? null }, db, admin: createClient(url, serviceKey) };
}

/**
 * Lê a conta pela RLS (`pode_ver_cliente`). Se a pessoa não enxerga a conta,
 * a linha não volta e a chamada é recusada — mesmo que as tabelas filhas
 * (blog, redes, news) só exijam a funcionalidade.
 */
export async function exigirCliente<T = Record<string, unknown>>(
  db: Banco,
  clienteId: string | null | undefined,
  campos = "id, nome",
): Promise<T> {
  if (!clienteId) throw new ErroHttp(400, "Informe a conta.");
  const { data, error } = await db.from("clientes").select(campos).eq("id", clienteId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ErroHttp(403, "Você não tem acesso a esta conta.");
  return data as T;
}

/** Resposta padrão para erros capturados no `catch` da função. */
export function respostaDeErro(nome: string, e: unknown): Response {
  if (e instanceof ErroHttp) return json({ error: e.message }, e.status);
  console.error(`${nome} error:`, e);
  const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
  return json({ error: msg || "Erro inesperado." }, 500);
}
