import { useCallback, useEffect, useRef, useState } from "react";
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

const STORAGE_KEY = "pesquisa-reunioes:estado";

interface EstadoPersistido {
  messages: PesquisaMsg[];
  conversaId: string | null;
  pendente: string | null;
  pendenteEm: number | null;
}

function lerEstado(): EstadoPersistido {
  if (typeof window === "undefined") return { messages: [], conversaId: null, pendente: null, pendenteEm: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], conversaId: null, pendente: null, pendenteEm: null };
    const parsed = JSON.parse(raw);
    return {
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      conversaId: parsed?.conversaId ?? null,
      pendente: parsed?.pendente ?? null,
      pendenteEm: parsed?.pendenteEm ?? null,
    };
  } catch {
    return { messages: [], conversaId: null, pendente: null, pendenteEm: null };
  }
}

function gravarEstado(estado: EstadoPersistido) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch { /* ignora quota */ }
}

export function usePesquisaReunioes(initialMessages: PesquisaMsg[] = [], initialConversaId: string | null = null) {
  const persistido = useRef<EstadoPersistido>(lerEstado()).current;
  const [messages, setMessages] = useState<PesquisaMsg[]>(
    initialMessages.length ? initialMessages : persistido.messages
  );
  const [conversaId, setConversaId] = useState<string | null>(initialConversaId ?? persistido.conversaId);
  const [pendente, setPendente] = useState<string | null>(persistido.pendente);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Mantém a sessão viva ao trocar de aba, recarregar ou sair da página.
  useEffect(() => {
    gravarEstado({ messages, conversaId, pendente, pendenteEm: pendente ? Date.now() : null });
  }, [messages, conversaId, pendente]);

  const reset = useCallback((msgs: PesquisaMsg[] = [], convId: string | null = null) => {
    setMessages(msgs);
    setConversaId(convId);
    setPendente(null);
    setError(null);
  }, []);

  const limparPendente = useCallback(() => setPendente(null), []);

  const send = useCallback(async (text: string, filtros: PesquisaFiltros = {}) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setError(null);

    const next: PesquisaMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setPendente(trimmed);
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
        keepalive: false,
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
      if (assistant.trim()) setPendente(null);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(
          "A conexão com a análise foi interrompida. A resposta continua sendo gerada no servidor e será recuperada automaticamente."
        );
      }
      // Mantém a mensagem do usuário para permitir recuperação da resposta no histórico.
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, conversaId, isStreaming]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { messages, conversaId, isStreaming, error, pendente, limparPendente, send, stop, reset };
}