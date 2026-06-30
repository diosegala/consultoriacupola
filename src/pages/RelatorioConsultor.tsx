import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useConsultoresComStats } from "@/hooks/useConsultores";
import { useRelatorioConsultor, type RelatorioPeriodo } from "@/hooks/useRelatorioConsultor";
import { Loader2, ArrowLeft, FileDown, AlertTriangle, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import jsPDF from "jspdf";
import { TempoInvestidoSection } from "@/components/consultor/TempoInvestidoSection";

type PresetKey = "30d" | "90d" | "ano" | "custom";

function buildPeriodo(preset: PresetKey, custom: { from?: Date; to?: Date }): RelatorioPeriodo {
  const hoje = new Date();
  if (preset === "30d") return { from: subDays(hoje, 30), to: hoje };
  if (preset === "90d") return { from: subDays(hoje, 90), to: hoje };
  if (preset === "ano") return { from: startOfYear(hoje), to: hoje };
  return { from: custom.from ?? subDays(hoje, 30), to: custom.to ?? hoje };
}

function fmtData(d: string | null): string {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
}

export default function RelatorioConsultor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: consultores, isLoading: loadingConsultores } = useConsultoresComStats();

  const [preset, setPreset] = useState<PresetKey>("90d");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const periodo = useMemo(() => buildPeriodo(preset, customRange), [preset, customRange]);

  const { data, isLoading } = useRelatorioConsultor(id, periodo);
  const consultor = consultores?.find((c) => c.id === id);

  const exportarPdf = () => {
    if (!consultor || !data) return;
    const doc = new jsPDF();
    const periodoLabel = `${format(periodo.from, "dd/MM/yyyy")} a ${format(periodo.to, "dd/MM/yyyy")}`;

    doc.setFontSize(16);
    doc.text(`Relatório de Performance — ${consultor.nome}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${periodoLabel}`, 14, 26);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 32);

    doc.setFontSize(12);
    doc.text("Visão geral", 14, 44);
    doc.setFontSize(10);
    const linhas = [
      `• Reuniões realizadas: ${data.reunioes_total}`,
      `• Score médio (IA): ${data.score_medio != null ? data.score_medio.toFixed(1) : "—"}`,
      `• Documentos gerados: ${data.documentos_total}`,
      `• Taxa de conclusão do checklist: ${data.checklist_taxa}% (${data.checklist_concluidos}/${data.checklist_total})`,
      `• Clientes ativos: ${data.clientes_ativos}`,
      `• Clientes encerrados no período: ${data.clientes_encerrados_no_periodo}`,
    ];
    linhas.forEach((l, i) => doc.text(l, 14, 52 + i * 6));

    let y = 52 + linhas.length * 6 + 8;
    doc.setFontSize(12);
    doc.text("Portfólio ativo", 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text("Cliente", 14, y);
    doc.text("Etapa", 70, y);
    doc.text("Última reunião", 115, y);
    doc.text("Próxima", 150, y);
    doc.text("Score", 180, y);
    y += 4;
    doc.line(14, y, 200, y);
    y += 4;

    data.portfolio.forEach((p) => {
      if (y > 280) { doc.addPage(); y = 20; }
      const alerta = p.em_alerta ? "! " : "  ";
      doc.text(alerta + (p.cliente_nome || "").slice(0, 28), 14, y);
      doc.text((p.etapa || "—").slice(0, 22), 70, y);
      doc.text(fmtData(p.ultima_reuniao), 115, y);
      doc.text(fmtData(p.proxima_reuniao), 150, y);
      doc.text(p.score_cliente_medio != null ? p.score_cliente_medio.toFixed(1) : "—", 180, y);
      y += 5;
    });

    doc.save(`relatorio-${consultor.nome.replace(/\s+/g, "_").toLowerCase()}-${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  if (loadingConsultores) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!consultor) {
    return <div className="text-center py-24 text-muted-foreground">Consultor não encontrado</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/consultores/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{consultor.nome}</h1>
            <p className="text-sm text-muted-foreground">Relatório de performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="ano">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange.from
                    ? `${format(customRange.from, "dd/MM/yy")} → ${customRange.to ? format(customRange.to, "dd/MM/yy") : "?"}`
                    : "Selecionar período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(r) => setCustomRange({ from: r?.from, to: r?.to })}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
          <Button onClick={exportarPdf} disabled={!data}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <>
          {/* SEÇÃO 1 — Visão geral */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Reuniões realizadas" value={String(data.reunioes_total)} hint={`no período (${data.clientes_ativos} clientes ativos)`} />
            <KpiCard label="Score médio (IA)" value={data.score_medio != null ? data.score_medio.toFixed(1) : "—"} hint="média ponderada das reuniões" />
            <KpiCard label="Documentos gerados" value={String(data.documentos_total)} hint="diagnósticos, OKRs, briefings" />
            <KpiCard label="Checklist concluído" value={`${data.checklist_taxa}%`} hint={`${data.checklist_concluidos}/${data.checklist_total} itens`} />
          </div>

          {/* SEÇÃO 2 — Evolução mensal */}
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.evolucao_mensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 10]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="reunioes" name="Reuniões" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="score_medio" name="Score médio" stroke="#7c3aed" strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SEÇÃO 3 — Documentos por tipo */}
          <Card>
            <CardHeader><CardTitle className="text-base">Documentos por tipo</CardTitle></CardHeader>
            <CardContent style={{ height: 280 }}>
              {data.documentos_por_tipo.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum documento gerado no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.documentos_por_tipo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="total" name="Quantidade" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* SEÇÃO 4 — Portfólio atual */}
          <Card>
            <CardHeader><CardTitle className="text-base">Portfólio atual ({data.portfolio.length} clientes ativos)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Última reunião</TableHead>
                    <TableHead>Próxima reunião</TableHead>
                    <TableHead className="text-center">Score cliente</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.portfolio.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem clientes ativos</TableCell></TableRow>
                  ) : (
                    data.portfolio.map((p) => (
                      <TableRow key={p.cliente_id} className={cn(p.em_alerta && "bg-destructive/10 hover:bg-destructive/15")}>
                        <TableCell>
                          <button className="font-medium hover:underline" onClick={() => navigate(`/clientes/${p.cliente_id}`)}>
                            {p.cliente_nome}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.etapa || "—"}</TableCell>
                        <TableCell>{fmtData(p.ultima_reuniao)}</TableCell>
                        <TableCell>{fmtData(p.proxima_reuniao)}</TableCell>
                        <TableCell className="text-center">{p.score_cliente_medio != null ? p.score_cliente_medio.toFixed(1) : "—"}</TableCell>
                        <TableCell>
                          {p.em_alerta ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Atenção</Badge>
                          ) : (
                            <Badge variant="secondary">Em dia</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* SEÇÃO 5 — Tempo investido */}
          <TempoInvestidoSection consultorId={id} from={periodo.from} to={periodo.to} />
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
