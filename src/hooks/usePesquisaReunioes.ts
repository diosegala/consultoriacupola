import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FonteTrecho {
  reuniao_id: string;
  cliente_id: string;
  cliente_nome: string;
  data_reuniao: string | null;
  trecho: string;
  similaridade: number;
}

export interface PesquisaMsg {
  role: "user" | "assistant";
  content: string;
  fontes?: FonteTrecho[];
}

export interface PesquisaFiltros {
  cliente_id?: string | null;
  consultor_id?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export function usePesquisaReunioes(initialMessages: PesquisaMsg[] = [], initialConversaId: string | null = null) {
  const [messages, setMessages] = useState<PesquisaMsg[]>(initialMessages);
  const [conversaId, setConversaId] = useState<string | null>(initialConversaId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback((msgs: PesquisaMsg[] = [], convId: string | null = null) => {
    setMessages(msgs);
    setConversaId(convId);
    setError(null);
  }, []);

  const send = useCallback(async (text: string, filtros: PesquisaFiltros = {}) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setError(null);

    const next: PesquisaMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(`${supabaseUrl}/functions/v1/pesquisa-reunioes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          conversa_id: conversaId,
          filtros,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errBody.error || `Erro ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let fontes: FonteTrecho[] | undefined;
      let evento: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) { evento = null; continue; }
          if (line.startsWith("event:")) { evento = line.slice(6).trim(); continue; }
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") { evento = null; continue; }
          try {
            const json = JSON.parse(payload);
            if (json.conversa_id) { setConversaId(json.conversa_id); evento = null; continue; }
            if (evento === "fontes" && Array.isArray(json.fontes)) {
              fontes = json.fontes as FonteTrecho[];
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], fontes };
                return copy;
              });
              evento = null;
              continue;
            }
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistant, fontes };
                return copy;
              });
            }
          } catch { /* ignora */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Erro ao pesquisar");
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length && copy[copy.length - 1].role === "assistant" && !copy[copy.length - 1].content) copy.pop();
        return copy;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, conversaId, isStreaming]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { messages, conversaId, isStreaming, error, send, stop, reset };
}