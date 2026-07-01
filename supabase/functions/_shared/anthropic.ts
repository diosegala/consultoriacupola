// Modelo Claude padrão para toda a aplicação.
// Quando a Anthropic lançar o Sonnet 4.6, basta atualizar esta constante.
export const CLAUDE_MODEL = "claude-sonnet-4-5";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export interface ClaudeCallOptions {
  system?: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: Array<{ name: string; description?: string; input_schema: Record<string, unknown> }>;
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
}

export interface ClaudeResponse {
  ok: boolean;
  status: number;
  text?: string;
  toolInput?: Record<string, unknown> | null;
  usage?: { input_tokens?: number; output_tokens?: number };
  errorMessage?: string;
  raw?: any;
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { ok: false, status: 500, errorMessage: "ANTHROPIC_API_KEY não configurada." };
  }
  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: opts.max_tokens ?? 8000,
    messages: opts.messages,
  };
  if (opts.system) body.system = opts.system;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;

  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("[claude] error", res.status, txt.slice(0, 500));
    let msg = `Erro Claude (${res.status})`;
    try {
      const parsed = JSON.parse(txt);
      if (parsed?.error?.message) msg = `Erro Claude (${res.status}): ${parsed.error.message}`;
    } catch (_) { /* ignore */ }
    if (res.status === 429) msg = "Limite de requisições da Anthropic atingido. Tente novamente em alguns minutos.";
    return { ok: false, status: res.status, errorMessage: msg };
  }

  const json = await res.json();
  const blocks: any[] = json?.content ?? [];
  const textBlock = blocks.find((b) => b.type === "text");
  const toolBlock = blocks.find((b) => b.type === "tool_use");
  return {
    ok: true,
    status: 200,
    text: textBlock?.text ?? "",
    toolInput: toolBlock?.input ?? null,
    usage: json?.usage,
    raw: json,
  };
}