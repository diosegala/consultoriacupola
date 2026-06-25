import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OraculoMsg {
  role: "user" | "assistant";
  content: string;
}

export interface SendOptions {
  contextoPagina?: string;
  contextoOrigem?: unknown;
  conversaId?: string | null;
}

export function useOraculoChat(initialMessages: OraculoMsg[] = [], initialConversaId: string | null = null) {
  const [messages, setMessages] = useState<OraculoMsg[]>(initialMessages);
  const [conversaId, setConversaId] = useState<string | null>(initialConversaId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback((msgs: OraculoMsg[] = [], convId: string | null = null) => {
    setMessages(msgs);
    setConversaId(convId);
    setError(null);
  }, []);

  const send = useCallback(async (text: string, opts: SendOptions = {}) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setError(null);

    const userMsg: OraculoMsg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(`${supabaseUrl}/functions/v1/oraculo-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: next,
          conversa_id: opts.conversaId ?? conversaId,
          contexto_pagina: opts.contextoPagina,
          contexto_origem: opts.contextoOrigem,
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          if (line.startsWith("event: conversa")) continue;
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              if (json.conversa_id) {
                setConversaId(json.conversa_id);
                continue;
              }
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) {
                assistant += delta;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: assistant };
                  return copy;
                });
              }
            } catch { /* ignora */ }
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Erro ao enviar");
      // remove placeholder assistant vazio
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length && copy[copy.length - 1].role === "assistant" && !copy[copy.length - 1].content) {
          copy.pop();
        }
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

  return { messages, conversaId, isStreaming, error, send, stop, reset, setConversaId };
}