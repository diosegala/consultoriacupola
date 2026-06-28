import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface Doc {
  id: string;
  titulo: string;
  categoria: string | null;
  created_at: string;
  source?: string | null;
  notion_page_id?: string | null;
}

interface Settings {
  embedding_model: string;
  embedding_dimensions: number;
  chat_provider: "lovable" | "anthropic";
  chat_model: string;
  ultima_sincronizacao_auto: string | null;
}

const EMBEDDING_OPTIONS: { value: string; label: string; dims: number; desc: string }[] = [
  { value: "openai/text-embedding-3-small", label: "OpenAI 3-small (1536d)", dims: 1536, desc: "Padrão atual. Bom equilíbrio custo/qualidade." },
  { value: "openai/text-embedding-3-large", label: "OpenAI 3-large (1536d)", dims: 1536, desc: "Maior qualidade, mesma dimensão — não exige reindexação." },
];

const CHAT_OPTIONS: { provider: "lovable" | "anthropic"; value: string; label: string; desc: string }[] = [
  { provider: "lovable", value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (padrão)", desc: "Rápido e barato." },
  { provider: "lovable", value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)", desc: "Geração mais recente." },
  { provider: "lovable", value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Mais robusto." },
  { provider: "lovable", value: "openai/gpt-5-mini", label: "OpenAI GPT-5 mini", desc: "OpenAI com custo controlado." },
  { provider: "lovable", value: "openai/gpt-5", label: "OpenAI GPT-5", desc: "Mais poderoso da OpenAI." },
  { provider: "anthropic", value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet (BYOK)", desc: "Requer ANTHROPIC_API_KEY configurado em Secrets." },
  { provider: "anthropic", value: "claude-opus-4-5", label: "Claude Opus 4.5 (BYOK)", desc: "Requer ANTHROPIC_API_KEY configurado em Secrets." },
];

export default function OraculoBase() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("metodo_cupola");

  const docsQuery = useQuery({
    queryKey: ["oraculo-knowledge"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oraculo_knowledge")
        .select("id, titulo, categoria, created_at, source, notion_page_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Doc[];
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["oraculo-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oraculo_settings")
        .select("embedding_model, embedding_dimensions, chat_provider, chat_model, ultima_sincronizacao_auto")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as Settings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (changes: Partial<Settings>) => {
      const { error } = await supabase
        .from("oraculo_settings")
        .update(changes)
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações atualizadas");
      qc.invalidateQueries({ queryKey: ["oraculo-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const indexar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("indexar-conhecimento", {
        body: { titulo, conteudo, categoria },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Documento indexado");
      setOpen(false);
      setTitulo(""); setConteudo(""); setCategoria("metodo_cupola");
      qc.invalidateQueries({ queryKey: ["oraculo-knowledge"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao indexar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oraculo_knowledge").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["oraculo-knowledge"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  const indexarNotion = useMutation({
    mutationFn: async (force: boolean) => {
      const { data, error } = await supabase.functions.invoke("oraculo-indexar-notion", {
        body: { force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { indexed: number; skipped: number; errors: number; chunks: number; total: number };
    },
    onSuccess: (r) => {
      toast.success(`Notion indexado: ${r.indexed} novos/atualizados, ${r.skipped} inalterados, ${r.chunks} trechos${r.errors ? `, ${r.errors} erros` : ""}.`);
      qc.invalidateQueries({ queryKey: ["oraculo-knowledge"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao indexar Notion"),
  });

  const total = docsQuery.data?.length ?? 0;
  const totalNotion = docsQuery.data?.filter((d) => d.source === "notion").length ?? 0;
  const settings = settingsQuery.data;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Base de Conhecimento do Oráculo
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} trecho{total === 1 ? "" : "s"} indexado{total === 1 ? "" : "s"} ({totalNotion} do Notion)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/oraculo")}>Voltar ao chat</Button>
          <Button variant="outline" onClick={() => indexarNotion.mutate(false)} disabled={indexarNotion.isPending}>
            {indexarNotion.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Indexar agora
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar documento
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground space-y-1">
          <p>
            Sincronização <strong>automática diária às 02:00 (BRT)</strong> — busca alterações no Notion e atualiza a base do Oráculo.
            {settings?.ultima_sincronizacao_auto && (
              <> Última execução automática: <strong>{format(new Date(settings.ultima_sincronizacao_auto), "dd/MM/yyyy HH:mm")}</strong>.</>
            )}
          </p>
          <p className="text-xs">Use <strong>Indexar agora</strong> para forçar uma sincronização imediata sob demanda.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelos de IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsQuery.isLoading || !settings ? (
            <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo de embeddings (indexação e busca)</Label>
                  <Select
                    value={settings.embedding_model}
                    onValueChange={(value) => {
                      const opt = EMBEDDING_OPTIONS.find((o) => o.value === value);
                      if (!opt) return;
                      const needsReindex = opt.dims !== settings.embedding_dimensions;
                      if (needsReindex && !confirm("Alterar para um modelo de dimensão diferente exige reindexar toda a base. Continuar?")) return;
                      updateSettings.mutate({ embedding_model: value, embedding_dimensions: opt.dims });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMBEDDING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex flex-col">
                            <span>{o.label}</span>
                            <span className="text-xs text-muted-foreground">{o.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de chat (respostas)</Label>
                  <Select
                    value={settings.chat_model}
                    onValueChange={(value) => {
                      const opt = CHAT_OPTIONS.find((o) => o.value === value);
                      if (!opt) return;
                      updateSettings.mutate({ chat_model: value, chat_provider: opt.provider });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHAT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex flex-col">
                            <span>{o.label}</span>
                            <span className="text-xs text-muted-foreground">{o.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {settings.chat_provider === "anthropic" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Claude é cobrado diretamente pela Anthropic. Garanta que o secret <code>ANTHROPIC_API_KEY</code> esteja configurado.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-xs text-muted-foreground">
                Embeddings e chat passam pelo <strong>Lovable AI Gateway</strong> (sem cota da OpenAI). Apenas Claude usa a API direta da Anthropic.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
        <CardContent>
          {docsQuery.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum documento ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docsQuery.data!.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.titulo}</TableCell>
                    <TableCell>
                      {d.source === "notion" ? (
                        <Badge variant="outline" className="border-primary/40 text-primary">Notion</Badge>
                      ) : (
                        <Badge variant="secondary">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.categoria ? <Badge variant="secondary">{d.categoria}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (confirm(`Excluir "${d.titulo}"?`)) excluir.mutate(d.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Adicionar documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pilar 1 - Diagnóstico" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="metodo_cupola, produto, processo, faq..." />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={12}
                placeholder="Cole o conteúdo do documento aqui..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Para documentos longos, divida em trechos menores (500-1500 caracteres) e indexe um por vez.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => indexar.mutate()} disabled={!titulo.trim() || !conteudo.trim() || indexar.isPending}>
              {indexar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Indexar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}