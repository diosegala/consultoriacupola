import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useClientes';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import cupolaLogo from '@/assets/cupola-logo-branca.png';

interface ClientMeetingCriteria {
  participacao: number;
  abertura: number;
  comprometimento: number;
  clareza: number;
  engajamento: number;
}

interface ClientMeeting {
  consultant: string;
  date: string;
  score: number;
  criteria: ClientMeetingCriteria;
  summary: string;
  strengths: string[];
  improvements: string[];
}

interface ClientReportData {
  clientName: string;
  generatedAt: string;
  meetings: ClientMeeting[];
}

const criteriaLabels: Record<keyof ClientMeetingCriteria, string> = {
  participacao: 'Participação Ativa',
  abertura: 'Abertura a Sugestões',
  comprometimento: 'Comprometimento',
  clareza: 'Clareza nas Demandas',
  engajamento: 'Engajamento Estratégico',
};

const criteriaKeysFromAnalise: Record<string, keyof ClientMeetingCriteria> = {
  participacao_ativa: 'participacao',
  abertura_sugestoes: 'abertura',
  comprometimento_acoes: 'comprometimento',
  clareza_demandas: 'clareza',
  engajamento_estrategico: 'engajamento',
};

function computeStats(meetings: ClientMeeting[]) {
  const allCriteria: (keyof ClientMeetingCriteria)[] = ['participacao', 'abertura', 'comprometimento', 'clareza', 'engajamento'];
  const avgByCriteria = allCriteria.map(key => {
    const avg = meetings.reduce((sum, m) => sum + m.criteria[key], 0) / meetings.length;
    return { key, avg: Math.round(avg * 10) / 10 };
  });
  const sorted = [...avgByCriteria].sort((a, b) => b.avg - a.avg);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const avgScore = Math.round((meetings.reduce((s, m) => s + m.score, 0) / meetings.length) * 10) / 10;
  const bestMeeting = meetings.reduce((best, m) => m.score > best.score ? m : best, meetings[0]);
  return { avgScore, avgByCriteria: sorted, highest, lowest, bestMeeting };
}

function ReportHeader({ data }: { data: ClientReportData }) {
  return (
    <div className="bg-cupola-dark border-b-[3px] border-cupola-green px-8 py-6 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <img src={cupolaLogo} alt="Cupola" className="h-5 opacity-90" />
        </div>
        <h1 className="text-white text-xl font-bold uppercase tracking-wider">
          Relatório de Engajamento
        </h1>
        <p className="text-white/55 text-sm mt-1">{data.clientName}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-[2px] text-cupola-muted mb-1">Gerado em</p>
        <p className="text-white font-bold text-sm">{data.generatedAt}</p>
        <span className="inline-block mt-2 text-[10px] uppercase tracking-[1.5px] text-cupola-green border border-[rgba(176,249,10,0.35)] bg-[rgba(176,249,10,0.12)] rounded-full px-3 py-1">
          {data.meetings.length} reuniões analisadas
        </span>
      </div>
    </div>
  );
}

function ScoreHero({ data }: { data: ClientReportData }) {
  const stats = computeStats(data.meetings);
  return (
    <div className="bg-cupola-mid border border-[rgba(176,249,10,0.15)] rounded-[14px] p-6 flex flex-col md:flex-row items-center gap-0">
      <div className="flex-shrink-0 text-center px-8 py-4">
        <p className="text-[72px] font-bold leading-none text-cupola-green">{stats.avgScore}</p>
        <p className="text-[10px] uppercase tracking-[2.5px] text-cupola-muted mt-2">Score Médio</p>
      </div>
      <div className="hidden md:block w-px self-stretch bg-[rgba(176,249,10,0.2)]" />
      <div className="flex-1 flex flex-col md:flex-row gap-3 px-6 py-4">
        <MetaCard value={stats.highest.avg.toFixed(1)} label={criteriaLabels[stats.highest.key]} />
        <MetaCard value={stats.lowest.avg.toFixed(1)} label={`${criteriaLabels[stats.lowest.key]} (menor)`} />
        <MetaCard value={stats.bestMeeting.score.toFixed(1)} label={`${stats.bestMeeting.consultant} — melhor sessão`} />
      </div>
    </div>
  );
}

function MetaCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[rgba(176,249,10,0.06)] border border-[rgba(176,249,10,0.15)] rounded-[10px] p-3.5 flex-1 text-center">
      <p className="text-[26px] font-bold text-cupola-green">{value}</p>
      <p className="text-[11px] text-cupola-muted mt-1">{label}</p>
    </div>
  );
}

function CriteriaAverages({ data }: { data: ClientReportData }) {
  const stats = computeStats(data.meetings);
  return (
    <div className="bg-cupola-card border border-cupola-border rounded-[14px] p-[26px_32px]">
      <h2 className="text-[10px] font-bold uppercase tracking-[2.5px] text-cupola-muted pb-3 border-b border-cupola-border mb-5">
        Média por Critério
      </h2>
      <div className="space-y-3">
        {stats.avgByCriteria.map(({ key, avg }) => {
          const isLowest = key === stats.lowest.key;
          const barColor = isLowest ? 'bg-[#7a8a2a]' : 'bg-cupola-teal';
          const textColor = isLowest ? 'text-[#7a8a2a]' : 'text-cupola-teal';
          return (
            <div key={key} className="flex items-center gap-4">
              <span className="text-[13px] text-[#4a5a4a] min-w-[210px]">{criteriaLabels[key]}</span>
              <div className="flex-1 bg-[#eaf0e0] rounded h-[7px] overflow-hidden">
                <div className={`h-full rounded ${barColor}`} style={{ width: `${(avg / 10) * 100}%` }} />
              </div>
              <span className={`text-[16px] font-bold ${textColor} min-w-[32px] text-right`}>{avg.toFixed(1)}</span>
              {isLowest && (
                <span className="text-[9px] font-bold uppercase bg-[#f5f5e0] text-[#7a7a1a] rounded-full px-2 py-0.5">A evoluir</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreEvolution({ data }: { data: ClientReportData }) {
  const sorted = [...data.meetings].sort((a, b) => a.date.localeCompare(b.date));
  const maxScore = Math.max(...sorted.map(m => m.score));
  return (
    <div className="bg-cupola-card border border-cupola-border rounded-[14px] p-[26px_32px]">
      <h2 className="text-[10px] font-bold uppercase tracking-[2.5px] text-cupola-muted pb-3 border-b border-cupola-border mb-5">
        Evolução do Engajamento por Sessão
      </h2>
      <div className="flex items-end justify-between gap-4 mt-4" style={{ height: 140 }}>
        {sorted.map((m, i) => {
          const barH = (m.score / 10) * 90;
          const opacity = m.score === maxScore ? 1 : 0.5 + (m.score / maxScore) * 0.5;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end">
              <span className="text-[18px] font-bold text-cupola-teal mb-1">{m.score.toFixed(1)}</span>
              <div className="w-full max-w-[60px] bg-cupola-teal rounded-t-[6px]" style={{ height: barH, opacity }} />
              <p className="text-[11px] font-bold uppercase text-cupola-teal mt-2">
                {m.date.split(' de ')[0]}/{m.date.split(' de ')[1]?.substring(0, 3)}
              </p>
              <p className="text-[12px] text-cupola-muted">{m.consultant}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: ClientMeeting }) {
  const criteriaKeys: (keyof ClientMeetingCriteria)[] = ['participacao', 'abertura', 'comprometimento', 'clareza', 'engajamento'];
  return (
    <div className="rounded-[14px] overflow-hidden border border-cupola-border">
      <div className="bg-cupola-mid border-b-2 border-cupola-green px-7 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-[20px] font-bold uppercase text-white">{meeting.consultant}</h3>
          <p className="text-[12px] text-cupola-muted mt-1">{meeting.date}</p>
        </div>
        <span className="text-[28px] font-bold text-cupola-green bg-[rgba(176,249,10,0.1)] border border-[rgba(176,249,10,0.3)] rounded-[30px] px-5 py-1">
          {meeting.score.toFixed(1)}
        </span>
      </div>
      <div className="bg-cupola-card p-[22px_28px]">
        <p className="text-[13px] text-[#4a5a4a] leading-[1.7] pb-5 border-b border-cupola-border">{meeting.summary}</p>
        <div className="grid grid-cols-5 max-md:grid-cols-3 gap-2 my-5">
          {criteriaKeys.map(key => (
            <div key={key} className="bg-[#f2f8ea] border border-[#dceacc] rounded-[10px] p-2.5 text-center">
              <p className="text-[22px] font-bold text-cupola-teal">{meeting.criteria[key].toFixed(1)}</p>
              <p className="text-[10px] text-cupola-muted leading-[1.3]">{criteriaLabels[key]}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 mt-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#4a9c4a]" />
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#1a5a2a]">Pontos Fortes</span>
            </div>
            {meeting.strengths.map((s, i) => (
              <p key={i} className="text-[12px] text-[#4a5a4a] bg-[#f7faf2] rounded-[7px] px-3 py-2 mb-1.5 leading-[1.55] border-l-2 border-[#4a9c4a]">{s}</p>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#c8a030]" />
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#7a5a1a]">A Evoluir</span>
            </div>
            {meeting.improvements.map((s, i) => (
              <p key={i} className="text-[12px] text-[#4a5a4a] bg-[#f7faf2] rounded-[7px] px-3 py-2 mb-1.5 leading-[1.55] border-l-2 border-[#c8a030]">{s}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function transformReunioes(reunioes: any[]): ClientMeeting[] {
  return reunioes
    .filter((r: any) => r.status_analise === 'concluido' && r.analise_cliente)
    .map((r: any) => {
      const analise = r.analise_cliente as any;
      const criteria: ClientMeetingCriteria = {
        participacao: 0, abertura: 0, comprometimento: 0, clareza: 0, engajamento: 0,
      };
      for (const [dbKey, mappedKey] of Object.entries(criteriaKeysFromAnalise)) {
        criteria[mappedKey] = Number(analise?.[dbKey] ?? 0);
      }
      return {
        consultant: r.consultores?.nome || 'Consultor',
        date: format(parseISO(r.data_reuniao), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
        score: Number(r.score_cliente ?? 0),
        criteria,
        summary: analise?.resumo || 'Sem resumo disponível.',
        strengths: analise?.pontos_fortes || [],
        improvements: analise?.pontos_melhoria || [],
      } as ClientMeeting;
    });
}

export default function RelatorioCliente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cliente, isLoading: loadingCliente } = useCliente(id);
  
  const { data: reunioes, isLoading: loadingReunioes } = useQuery({
    queryKey: ['reunioes-cliente-relatorio', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunioes')
        .select('*, consultores(nome)')
        .eq('cliente_id', id!)
        .eq('status_analise', 'concluido')
        .not('analise_cliente', 'is', null)
        .order('data_reuniao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loadingCliente || loadingReunioes) {
    return (
      <div className="flex items-center justify-center h-screen bg-cupola-surface">
        <Loader2 className="h-8 w-8 animate-spin text-cupola-teal" />
      </div>
    );
  }

  if (!cliente || !reunioes) {
    return <div className="text-center py-24 text-cupola-muted">Cliente não encontrado</div>;
  }

  const meetings = transformReunioes(reunioes);
  if (meetings.length === 0) {
    return <div className="text-center py-24 text-cupola-muted">Nenhuma avaliação de engajamento encontrada.</div>;
  }

  const reportData: ClientReportData = {
    clientName: cliente.nome,
    generatedAt: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    meetings,
  };

  return (
    <div className="min-h-screen bg-cupola-surface" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
      <div className="print:hidden sticky top-0 z-50 bg-cupola-dark border-b border-cupola-green/30 px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clientes/${id}`)} className="text-white hover:text-cupola-green">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="bg-cupola-green text-cupola-dark hover:bg-cupola-green/90 font-bold uppercase tracking-wider text-sm">
          <Printer className="h-4 w-4 mr-2" /> Baixar PDF
        </Button>
      </div>
      <div className="max-w-[900px] mx-auto py-8 px-4 print:py-0 print:px-0 print:max-w-none space-y-6">
        <ReportHeader data={reportData} />
        <ScoreHero data={reportData} />
        <CriteriaAverages data={reportData} />
        <ScoreEvolution data={reportData} />
        {[...meetings].reverse().map((m, i) => (
          <MeetingCard key={i} meeting={m} />
        ))}
      </div>
    </div>
  );
}
