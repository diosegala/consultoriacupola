import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Sparkles, MessageSquare } from "lucide-react";
import { OraculoChatPanel } from "@/components/oraculo/OraculoChatPanel";
import { OraculoMsg } from "@/hooks/useOraculoChat";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Oraculo() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const conversaId = params.get("c");

  const conversasQuery = useQuery({
    queryKey: ["oraculo-conversas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("oraculo_conversas")
        .select("id, titulo, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["oraculo-mensagens", conversaId],
    enabled: !!conversaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("oraculo_mensagens")
        .select("role, content")
        .eq("conversa_id", conversaId!)
        .order("created_at", { ascending: true });
      return (data ?? []) as OraculoMsg[];
    },
  });

  const [panelKey, setPanelKey] = useState(0);
  useEffect(() => { setPanelKey((k) => k + 1); }, [conversaId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conversa?")) return;
    const { error } = await supabase.from("oraculo_conversas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    if (conversaId === id) setParams({});
    queryClient.invalidateQueries({ queryKey: ["oraculo-conversas"] });
  };

  return (
    <div className="h-[calc(100vh-3rem)] -m-6 flex">
      {/* Lista de conversas */}
      <aside className="w-64 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Oráculo
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setParams({})} title="Nova conversa">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversasQuery.data?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 px-2">Nenhuma conversa ainda.</p>
            )}
            {conversasQuery.data?.map((c: any) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-muted",
                  conversaId === c.id && "bg-muted font-medium"
                )}
                onClick={() => setParams({ c: c.id })}
              >
                <MessageSquare className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{c.titulo || "Sem título"}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col">
        <OraculoChatPanel
          key={panelKey}
          conversaId={conversaId}
          initialMessages={messagesQuery.data ?? []}
          onConversaCriada={(id) => {
            setParams({ c: id });
            queryClient.invalidateQueries({ queryKey: ["oraculo-conversas"] });
          }}
        />
      </main>
    </div>
  );
}