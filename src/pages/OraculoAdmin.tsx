import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, ArrowLeft, MessageSquare, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function OraculoAdmin() {
  const { isAdmin, isDirector, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [consultorFilter, setConsultorFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canAccess = isAdmin || isDirector;

  const conversasQuery = useQuery({
    queryKey: ["oraculo-admin-conversas"],
    enabled: canAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oraculo_conversas")
        .select("id, titulo, user_id, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const consultoresMapQuery = useQuery({
    queryKey: ["oraculo-admin-consultores-map"],
    enabled: canAccess,
    queryFn: async () => {
      const { data } = await supabase
        .from("consultor_user")
        .select("user_id, consultor:consultores(id, nome)");
      const map = new Map<string, { id: string; nome: string }>();
      (data ?? []).forEach((row: any) => {
        if (row.user_id && row.consultor) {
          map.set(row.user_id, { id: row.consultor.id, nome: row.consultor.nome });
        }
      });
      return map;
    },
  });

  const consultoresList = useMemo(() => {
    const map = consultoresMapQuery.data;
    if (!map) return [] as { user_id: string; nome: string }[];
    return Array.from(map.entries())
      .map(([user_id, c]) => ({ user_id, nome: c.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [consultoresMapQuery.data]);

  const filtered = useMemo(() => {
    const list = conversasQuery.data ?? [];
    const term = busca.trim().toLowerCase();
    return list.filter((c: any) => {
      if (consultorFilter !== "all" && c.user_id !== consultorFilter) return false;
      if (term && !(c.titulo ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [conversasQuery.data, busca, consultorFilter]);

  const mensagensQuery = useQuery({
    queryKey: ["oraculo-admin-mensagens", selectedId],
    enabled: !!selectedId && canAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oraculo_mensagens")
        .select("role, content, created_at")
        .eq("conversa_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (roleLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Esta página é exclusiva para administradores e diretores.
        </p>
      </div>
    );
  }

  const nomeConsultor = (uid: string) =>
    consultoresMapQuery.data?.get(uid)?.nome ?? "—";

  return (
    <div className="h-[calc(100vh-3rem)] -m-6 flex flex-col">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/oraculo")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h1 className="text-base font-semibold">Oráculo · Conversas dos consultores</h1>
          <p className="text-xs text-muted-foreground">
            Acompanhe perguntas feitas ao Oráculo por todos os consultores.
          </p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r flex flex-col bg-muted/20">
          <div className="p-3 border-b space-y-2">
            <Input
              placeholder="Buscar por título…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8"
            />
            <Select value={consultorFilter} onValueChange={setConsultorFilter}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Filtrar consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultoresList.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{filtered.length} conversa(s)</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversasQuery.isLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">Carregando…</p>
              )}
              {filtered.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-2 text-xs hover:bg-muted transition-colors",
                    selectedId === c.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate flex-1">{c.titulo || "Sem título"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <UserIcon className="h-2.5 w-2.5" />
                    <span className="truncate">{nomeConsultor(c.user_id)}</span>
                    <span className="ml-auto">
                      {format(new Date(c.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </button>
              ))}
              {!conversasQuery.isLoading && filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma conversa.</p>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa à esquerda para ler.
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-2 flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <UserIcon className="h-3 w-3" />
                  {nomeConsultor(
                    (conversasQuery.data ?? []).find((c: any) => c.id === selectedId)?.user_id ?? ""
                  )}
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {(conversasQuery.data ?? []).find((c: any) => c.id === selectedId)?.titulo}
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 max-w-3xl mx-auto">
                  {mensagensQuery.isLoading && (
                    <p className="text-sm text-muted-foreground text-center">Carregando mensagens…</p>
                  )}
                  {(mensagensQuery.data ?? []).map((m: any, i: number) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                        <p className="text-[10px] opacity-60 mt-1">
                          {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </main>
      </div>
    </div>
  );
}