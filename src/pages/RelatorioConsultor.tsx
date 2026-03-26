import { useParams, useNavigate } from 'react-router-dom';
import { useConsultoresComStats } from '@/hooks/useConsultores';
import { useReunioesByConsultor } from '@/hooks/useReunioes';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import cupolaLogo from '@/assets/cupola-logo-branca.png';

// Types
interface MeetingCriteria {
  empathy: number;
  clarity: number;
  proactivity: number;
  technical: number;
  results: number;
}

interface Meeting {
  client: string;
  date: string;
  score: number;
  criteria: MeetingCriteria;
  summary: string;
  strengths: string[];
  improvements: string[];
}

interface ReportData {
  consultant: string;
  generatedAt: string;
  meetings: Meeting[];
}

const criteriaLabels: Record<keyof MeetingCriteria, string> = {
  empathy: 'Empatia e Escuta',
  clarity: 'Clareza na Comunicação',
  proactivity: 'Proatividade',
  technical: 'Domínio Técnico',
  results: 'Orient. p/ Resultados',
};

const criteriaKeysFromAnalise: Record<string, keyof MeetingCriteria> = {
  empatia: 'empathy',
  clareza: 'clarity',
  proatividade: 'proactivity',
  dominio_tecnico: 'technical',
  orientacao_resultados: 'results',
};

function computeStats(meetings: Meeting[]) {
  const allCriteria: (keyof MeetingCriteria)[] = ['empathy', 'clarity', 'proactivity', 'technical', 'results'];
  
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

// -- COMPONENTS --

function ReportHeader({ data }: { data: ReportData }) {
  return (
    <div className="bg-cupola-dark border-b-[3px] border-cupola-green px-8 py-6 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <img src={cupolaLogo} alt="Cupola" className="h-5 opacity-90" />
        </div>
        <h1 className="text-white text-xl font-bold uppercase tracking-wider">
          Relatório de Desempenho
        </h1>
        <p className="text-white/55 text-sm mt-1">{data.consultant}</p>
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

function ScoreHero({ data }: { data: ReportData }) {
  const stats = computeStats(data.meetings);
  return (
    <div className="bg-cupola-mid border border-[rgba(176,249,10,0.15)] rounded-[14px] p-6 flex flex-col md:flex-row items-center gap-0">
      {/* Score Médio */}
      <div className="flex-shrink-0 text-center px-8 py-4">
        <p className="text-[72px] font-bold leading-none text-cupola-green">{stats.avgScore}</p>
        <p className="text-[10px] uppercase tracking-[2.5px] text-cupola-muted mt-2">Score Médio</p>
      </div>

      <div className="hidden md:block w-px self-stretch bg-[rgba(176,249,10,0.2)]" />

      {/* Meta Cards */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 px-6 py-4">
        <MetaCard value={stats.highest.avg.toFixed(1)} label={criteriaLabels[stats.highest.key]} />
        <MetaCard value={stats.lowest.avg.toFixed(1)} label={`${criteriaLabels[stats.lowest.key]} (menor)`} />
        <MetaCard value={stats.bestMeeting.score.toFixed(1)} label={`${stats.bestMeeting.client} — melhor reunião`} />
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

function CriteriaAverages({ data }: { data: ReportData }) {
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
                <span className="text-[9px] font-bold uppercase bg-[#f5f5e0] text-[#7a7a1a] rounded-full px-2 py-0.5">
                  A evoluir
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreEvolution({ data }: { data: ReportData }) {
  const sorted = [...data.meetings].sort((a, b) => a.date.localeCompare(b.date));
  const maxScore = Math.max(...sorted.map(m => m.score));
  return (
    <div className="bg-cupola-card border border-cupola-border rounded-[14px] p-[26px_32px]">
      <h2 className="text-[10px] font-bold uppercase tracking-[2.5px] text-cupola-muted pb-3 border-b border-cupola-border mb-5">
        Evolução do Score por Sessão
      </h2>
      <div className="flex items-end justify-between gap-4 mt-4" style={{ height: 140 }}>
        {sorted.map((m, i) => {
          const barH = (m.score / 10) * 90;
          const opacity = m.score === maxScore ? 1 : 0.5 + (m.score / maxScore) * 0.5;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end">
              <span className="text-[18px] font-bold text-cupola-teal mb-1">{m.score.toFixed(1)}</span>
              <div
                className="w-full max-w-[60px] bg-cupola-teal rounded-t-[6px]"
                style={{ height: barH, opacity }}
              />
              <p className="text-[11px] font-bold uppercase text-cupola-teal mt-2">{m.date.split(' de ')[0]}/{m.date.split(' de ')[1]?.substring(0, 3)}</p>
              <p className="text-[12px] text-cupola-muted">{m.client}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const criteriaKeys: (keyof MeetingCriteria)[] = ['empathy', 'clarity', 'proactivity', 'technical', 'results'];
  return (
    <div className="rounded-[14px] overflow-hidden border border-cupola-border">
      {/* Header */}
      <div className="bg-cupola-mid border-b-2 border-cupola-green px-7 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-[20px] font-bold uppercase text-white">{meeting.client}</h3>
          <p className="text-[12px] text-cupola-muted mt-1">{meeting.date}</p>
        </div>
        <span className="text-[28px] font-bold text-cupola-green bg-[rgba(176,249,10,0.1)] border border-[rgba(176,249,10,0.3)] rounded-[30px] px-5 py-1">
          {meeting.score.toFixed(1)}
        </span>
      </div>

      {/* Body */}
      <div className="bg-cupola-card p-[22px_28px]">
        {/* Resumo */}
        <p className="text-[13px] text-[#4a5a4a] leading-[1.7] pb-5 border-b border-cupola-border">
          {meeting.summary}
        </p>

        {/* Sub-critérios grid */}
        <div className="grid grid-cols-5 max-md:grid-cols-3 gap-2 my-5">
          {criteriaKeys.map(key => (
            <div key={key} className="bg-[#f2f8ea] border border-[#dceacc] rounded-[10px] p-2.5 text-center">
              <p className="text-[22px] font-bold text-cupola-teal">{meeting.criteria[key].toFixed(1)}</p>
              <p className="text-[10px] text-cupola-muted leading-[1.3]">{criteriaLabels[key]}</p>
            </div>
          ))}
        </div>

        {/* Pontos fortes e melhorias */}
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 mt-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#4a9c4a]" />
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#1a5a2a]">Pontos Fortes</span>
            </div>
            {meeting.strengths.map((s, i) => (
              <p key={i} className="text-[12px] text-[#4a5a4a] bg-[#f7faf2] rounded-[7px] px-3 py-2 mb-1.5 leading-[1.55] border-l-2 border-[#4a9c4a]">
                {s}
              </p>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#c8a030]" />
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#7a5a1a]">A Evoluir</span>
            </div>
            {meeting.improvements.map((s, i) => (
              <p key={i} className="text-[12px] text-[#4a5a4a] bg-[#f7faf2] rounded-[7px] px-3 py-2 mb-1.5 leading-[1.55] border-l-2 border-[#c8a030]">
                {s}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- MAIN PAGE --

function transformReunioes(reunioes: any[]): Meeting[] {
  return reunioes
    .filter((r: any) => r.status_analise === 'concluido' && r.analise_ia)
    .map((r: any) => {
      const analise = r.analise_ia as any;
      const criterios = analise || {};

      const criteria: MeetingCriteria = {
        empathy: 0, clarity: 0, proactivity: 0, technical: 0, results: 0,
      };
      for (const [dbKey, mappedKey] of Object.entries(criteriaKeysFromAnalise)) {
        criteria[mappedKey] = Number(criterios[dbKey]?.nota ?? criterios[dbKey] ?? 0);
      }

      return {
        client: r.clientes?.nome || 'Cliente',
        date: format(parseISO(r.data_reuniao), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
        score: Number(r.score_ia ?? 0),
        criteria,
        summary: r.resumo_ia || analise?.resumo || 'Sem resumo disponível.',
        strengths: analise?.pontos_fortes || [],
        improvements: analise?.pontos_melhoria || [],
      } as Meeting;
    });
}

export default function RelatorioConsultor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: consultores, isLoading: loadingConsultor } = useConsultoresComStats();
  const { data: reunioes, isLoading: loadingReunioes } = useReunioesByConsultor(id);

  const consultor = consultores?.find(c => c.id === id);

  if (loadingConsultor || loadingReunioes) {
    return (
      <div className="flex items-center justify-center h-screen bg-cupola-surface">
        <Loader2 className="h-8 w-8 animate-spin text-cupola-teal" />
      </div>
    );
  }

  if (!consultor || !reunioes) {
    return (
      <div className="text-center py-24 text-cupola-muted">Consultor não encontrado</div>
    );
  }

  const meetings = transformReunioes(reunioes);
  if (meetings.length === 0) {
    return (
      <div className="text-center py-24 text-cupola-muted">Nenhuma reunião analisada encontrada.</div>
    );
  }

  const reportData: ReportData = {
    consultant: consultor.nome,
    generatedAt: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    meetings,
  };

  return (
    <div className="min-h-screen bg-cupola-surface" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
      {/* Toolbar - hidden on print */}
      <div className="print:hidden sticky top-0 z-50 bg-cupola-dark border-b border-cupola-green/30 px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/consultores/${id}`)} className="text-white hover:text-cupola-green">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="bg-cupola-green text-cupola-dark hover:bg-cupola-green/90 font-bold uppercase tracking-wider text-sm">
          <Printer className="h-4 w-4 mr-2" /> Baixar PDF
        </Button>
      </div>

      {/* Report Content */}
      <div className="max-w-[900px] mx-auto py-8 px-4 print:py-0 print:px-0 print:max-w-none space-y-6">
        <ReportHeader data={reportData} />
        <ScoreHero data={reportData} />
        <CriteriaAverages data={reportData} />
        <ScoreEvolution data={reportData} />

        {/* Meeting Cards - reverse chronological */}
        {[...meetings].reverse().map((m, i) => (
          <MeetingCard key={i} meeting={m} />
        ))}
      </div>
    </div>
  );
}
