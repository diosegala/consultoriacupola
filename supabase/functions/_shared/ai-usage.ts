// Helper compartilhado para registrar uso de IA (Claude/Anthropic) na tabela ai_usage_logs.
// Preço Claude Sonnet 4.5: $3/MTok in, $15/MTok out.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CLAUDE_MODEL } from "./anthropic.ts";

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
}

export function claudeCostUsd(inTok: number, outTok: number): number {
  return (inTok / 1_000_000) * 3 + (outTok / 1_000_000) * 15;
}

export async function logAiUsage(p: LogAiUsageParams): Promise<void> {
  try {
    const inTok = Number(p.usage?.input_tokens ?? 0);
    const outTok = Number(p.usage?.output_tokens ?? 0);
    await p.admin.from("ai_usage_logs").insert({
      provider: p.provider ?? "anthropic",
      model: p.model ?? CLAUDE_MODEL,
      agente_tipo: p.agente_tipo,
      input_tokens: inTok,
      output_tokens: outTok,
      cost_usd: claudeCostUsd(inTok, outTok),
      cliente_id: p.cliente_id ?? null,
      consultor_id: p.consultor_id ?? null,
      user_id: p.user_id ?? null,
      status: p.status ?? "success",
      error_message: p.error_message ?? null,
    });
  } catch (err) {
    console.warn("[ai-usage] insert falhou:", err);
  }
}