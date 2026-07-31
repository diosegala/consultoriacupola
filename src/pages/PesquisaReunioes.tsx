import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Search, Send, StopCircle, Plus, RefreshCw, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/hooks/useClientes";
import { useConsultores } from "@/hooks/useConsultores";
import { usePesquisaReunioes, PesquisaFiltros } from "@/hooks/usePesquisaReunioes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PERIODOS = [
  { value: "todos", label: "Todo o histórico" },
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
  { value: "custom", label: "Intervalo personalizado" },
];

const SUGESTOES = [
  "Quais clientes estão insatisfeitos com o ritmo da consultoria?",
  "O que os clientes falam sobre precificação e margem?",
  "Quais objeções aparecem com mais frequência nas reuniões?",
  "Quais clientes citaram dificuldade com a equipe de vendas?",
];

export default function PesquisaReunioes() {
  const { isAdmin, isDirector } = useAuth();
  const navigate = useNavigate();
  const podeIndexar = isAdmin || isDirector;

  const { data: clientes } = useClientes({ incluir_arquivados: true });
  const { data: consultores } = useConsultores(true);

  const [clienteId, setClienteId] = useState<string>("todos");
  const [consultorId, setConsultorId] = useState<string>("todos");
  const [periodo, setPeriodo] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<{ total_com_transcricao: number; indexadas: number; pendentes: number } | null>(null);
  const [indexando, setIndexando] = useState(false);

  const { messages, isStreaming, error, send, stop, reset } = usePesquisaReunioes();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => { textareaRef.current?.focus(); }, [isStreaming]);

  const carregarStatus = async () => {
    if (!podeIndexar) return;
    const { data, error: err } = await supabase.functions.invoke("indexar-reunioes", { body: { action: "status" } });
    if (!err && data) setStatus(data as any);
  };

  useEffect(() => { carregarStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [podeIndexar]);

  const indexarLote = async () => {
    setIndexando(true);
    try {
      let restante = true;
      let loops = 0;
      while (restante && loops < 40) {
        const { data, error: err } = await supabase.functions.invoke("indexar-reunioes", { body: { action: "index", limit: 10 } });
        if (err) throw err;
        const proc = (data as any)?.processadas ?? 0;
        await carregarStatus();
        loops++;
        restante = proc > 0;
      }
      toast.success("Indexação concluída");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao indexar transcrições");
    } finally {
      setIndexando(false);
      carregarStatus();
    }
  };

  const montarFiltros = (): PesquisaFiltros => {
    const f: PesquisaFiltros = {};
    if (clienteId !== "todos") f.cliente_id = clienteId;
    if (consultorId !== "todos") f.consultor_id = consultorId;
    if (periodo === "custom") {
      if (dataInicio) f.data_inicio = dataInicio;
      if (dataFim) f.data_fim = dataFim;
    } else if (periodo !== "todos") {
      const d = new Date();
      d.setMonth(d.getMonth() - Number(periodo));
      f.data_inicio = d.toISOString().slice(0, 10);
    }
    return f;
  };

  const handleSend = async (texto?: string) => {
    const q = (texto ?? input).trim();
    if (!q || isStreaming) return;
    setInput("");
    await send(q, montarFiltros());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" /> Pesquisa de Reuniões
          </h1>
          <p className="text-sm text-muted-foreground">
            Pergunte em linguagem natural e receba respostas fundamentadas no que os clientes disseram nas reuniões.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reset([], null)}>
          <Plus className="h-4 w-4 mr-1" /> Nova pesquisa
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Filtros */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-sm font-semibold">Filtros (opcionais)</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os clientes</SelectItem>
                    {(clientes ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {podeIndexar && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Consultor</Label>
                  <Select value={consultorId} onValueChange={setConsultorId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {(consultores ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Período</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {periodo === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">De</Label>
                    <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até</Label>
                    <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {podeIndexar && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Indexação das transcrições</p>
                {status ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {status.indexadas} de {status.total_com_transcricao} reuniões indexadas
                      {status.pendentes > 0 && ` · ${status.pendentes} pendentes`}
                    </p>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${status.total_com_transcricao ? (status.indexadas / status.total_com_transcricao) * 100 : 0}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Carregando status...</p>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={indexarLote} disabled={indexando}>
                  {indexando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {indexando ? "Indexando..." : "Indexar transcrições"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat */}
        <Card className="flex flex-col h-[calc(100vh-13rem)]">
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="p-4 space-y-4">
              {messages.length === 0 && (
                <div className="py-10 text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Faça uma pergunta sobre o conteúdo das reuniões. Exemplos:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGESTOES.map((s) => (
                      <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => handleSend(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className="max-w-[90%] space-y-2">
                    <div className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                          <ReactMarkdown>{m.content || "Analisando as transcrições..."}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>

                    {m.role === "assistant" && !!m.fontes?.length && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Fontes ({m.fontes.length})
                        </p>
                        <div className="grid gap-1.5">
                          {m.fontes.map((f, idx) => (
                            <button
                              key={idx}
                              onClick={() => navigate(`/clientes/${f.cliente_id}`)}
                              className="text-left rounded-md border bg-card p-2 hover:border-primary/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-[10px]">{f.cliente_nome}</Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {f.data_reuniao ? new Date(f.data_reuniao + "T00:00:00").toLocaleDateString("pt-BR") : "sem data"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-3">{f.trecho}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {error && <p className="text-xs text-destructive text-center">{error}</p>}
            </div>
          </ScrollArea>

          <div className="border-t p-3 flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ex.: o que os clientes dizem sobre o time comercial?"
              rows={2}
              className="resize-none min-h-[44px]"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" onClick={stop}><StopCircle className="h-4 w-4" /></Button>
            ) : (
              <Button size="icon" onClick={() => handleSend()} disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}