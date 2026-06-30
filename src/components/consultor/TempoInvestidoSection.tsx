import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useInteracoesTempoConsultor } from '@/hooks/useInteracoesTempo';
import { format } from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const TIPO_LABEL: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  okrs: 'OKRs',
  briefing_cliente_oculto: 'Cliente Oculto',
};

function fmtMin(seg: number | null | undefined) {
  if (seg == null) return '—';
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m}min ${s}s` : `${m}min`;
}

export function TempoInvestidoSection({ consultorId, from, to }: { consultorId?: string; from: Date; to: Date }) {
  const { data, isLoading } = useInteracoesTempoConsultor(consultorId, from, to);

  const stats = useMemo(() => {
    const rows = data ?? [];
    const total = rows.length;
    const abandonadas = rows.filter((r) => (r.metadata as any)?.interrompido === true).length;
    const taxaAbandono = total > 0 ? Math.round((abandonadas / total) * 100) : 0;
    const prep = rows.map((r) => r.duracao_preparacao_segundos).filter((n): n is number => n != null);
    const ia = rows.map((r) => r.duracao_geracao_ia_segundos).filter((n): n is number => n != null);
    const mediaPrep = prep.length ? Math.round(prep.reduce((s, n) => s + n, 0) / prep.length) : null;
    const mediaIa = ia.length ? Math.round(ia.reduce((s, n) => s + n, 0) / ia.length) : null;

    // por tipo
    const tipos: Record<string, { prep: number[]; ia: number[]; total: number; abandonadas: number }> = {};
    rows.forEach((r) => {
      const t = r.tipo;
      if (!tipos[t]) tipos[t] = { prep: [], ia: [], total: 0, abandonadas: 0 };
      tipos[t].total += 1;
      if ((r.metadata as any)?.interrompido === true) tipos[t].abandonadas += 1;
      if (r.duracao_preparacao_segundos != null) tipos[t].prep.push(r.duracao_preparacao_segundos);
      if (r.duracao_geracao_ia_segundos != null) tipos[t].ia.push(r.duracao_geracao_ia_segundos);
    });
    const porTipo = Object.entries(tipos).map(([tipo, v]) => ({
      tipo,
      label: TIPO_LABEL[tipo] ?? tipo,
      preparacao_min: v.prep.length ? Math.round((v.prep.reduce((s, n) => s + n, 0) / v.prep.length) / 60 * 10) / 10 : 0,
      ia_min: v.ia.length ? Math.round((v.ia.reduce((s, n) => s + n, 0) / v.ia.length) / 60 * 100) / 100 : 0,
      total: v.total,
      abandono: v.total > 0 ? Math.round((v.abandonadas / v.total) * 100) : 0,
    }));

    const primeiraData = rows.length
      ? rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0].created_at)
      : null;

    return { total, abandonadas, taxaAbandono, mediaPrep, mediaIa, porTipo, primeiraData };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tempo investido por agente</CardTitle>
        <p className="text-xs text-muted-foreground">
          {stats.primeiraData
            ? `Dados coletados a partir de ${format(new Date(stats.primeiraData), 'dd/MM/yyyy')} — `
            : 'Coleta de dados iniciada recentemente — '}
          mede o tempo de preparação do consultor, não apenas o processamento da IA.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma sessão registrada no período.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Mini label="Preparação média" value={fmtMin(stats.mediaPrep)} hint="tempo ativo do consultor" />
              <Mini label="Geração da IA média" value={fmtMin(stats.mediaIa)} hint="processamento puro do LLM" />
              <Mini label="Sessões totais" value={String(stats.total)} hint="no período selecionado" />
              <Mini label="Taxa de abandono" value={`${stats.taxaAbandono}%`} hint={`${stats.abandonadas} sessão(ões) interrompidas`} />
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.porTipo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: 'minutos', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="preparacao_min" name="Preparação (min)" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="ia_min" name="IA (min)" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {stats.porTipo.map((t) => (
                <p key={t.tipo}>
                  <strong className="text-foreground">{t.label}:</strong>{' '}
                  {t.total} sessão(ões) • abandono {t.abandono}%
                </p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}