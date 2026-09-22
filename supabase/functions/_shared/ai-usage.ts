// Helper compartilhado para registrar uso de IA na tabela ai_usage_logs.
// Cada linha guarda a unidade de negócio (consultoria | agencia), o agente,
// o cliente e a pessoa — é o que alimenta o painel de custos.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CLAUDE_MODEL } from "./anthropic.ts";

export type Unidade = "consultoria" | "agencia";

export interface LogAiUsageParams {
  admin: SupabaseClient;
  provider?: string;
  model?: string;
  agente_tipo: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  cliente_id?: string | null;
  consultor_id?: string | null;
  user_id?: string | null;
  status?: "success" | "error";
  error_message?: string | null;
  /** Unidade de negócio. Sem informar, é consultoria. */
  unidade?: Unidade;
  /** Slug do agente (agência), quando houver. */
  agente_slug?: string | null;
  /** Ids no schema agencia (texto, não uuid). */
  agencia_cliente_id?: string | null;
  agencia_pessoa_id?: string | null;
  sessao_id?: string | null;
}

/** Dólares por milhão de tokens, por modelo. Conferir ao alterar. */
const PRECOS: Record<string, { entrada: number; saida: number }> = {
  "claude-sonnet-4-5": { entrada: 3, saida: 15 },
  "claude-opus-4-5": { entrada: 5, saida: 25 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
  "openai/gpt-6-astra": { entrada: 1.25, saida: 10 },
  "openai/gpt-image-2.5-sunburst": { entrada: 5, saida: 30 },
};

export function claudeCostUsd(inTok: number, outTok: number): number {
  return (inTok / 1_000_000) * 3 + (outTok / 1_000_000) * 15;
}

/** Custo estimado pelo modelo. Modelo desconhecido custa 0 (mas a linha é guardada). */
export function custoUsd(model: string, inTok: number, outTok: number): number {
  const limpo = model.trim().toLowerCase().replace(/-\d{8}$/, "");
  const preco = PRECOS[limpo];
  if (!preco) return 0;
  return (inTok / 1_000_000) * preco.entrada + (outTok / 1_000_000) * preco.saida;
}

export async function logAiUsage(p: LogAiUsageParams): Promise<void> {
  try {
    const inTok = Number(p.usage?.input_tokens ?? 0);
    const outTok = Number(p.usage?.output_tokens ?? 0);
    const model = p.model ?? CLAUDE_MODEL;
    await p.admin.from("ai_usage_logs").insert({
      provider: p.provider ?? "anthropic",
      model,
      agente_tipo: p.agente_tipo,
      input_tokens: inTok,
      output_tokens: outTok,
      cost_usd: custoUsd(model, inTok, outTok),
      cliente_id: p.cliente_id ?? null,
      consultor_id: p.consultor_id ?? null,
      user_id: p.user_id ?? null,
      status: p.status ?? "success",
      error_message: p.error_message ?? null,
      unidade: p.unidade ?? "consultoria",
      agente_slug: p.agente_slug ?? null,
      agencia_cliente_id: p.agencia_cliente_id ?? null,
      agencia_pessoa_id: p.agencia_pessoa_id ?? null,
      sessao_id: p.sessao_id ?? null,
    });
  } catch (err) {
    console.warn("[ai-usage] insert falhou:", err);
  }
}
