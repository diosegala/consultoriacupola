import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sparkles, FileText, Target, ClipboardList, ClipboardCheck, Upload, Link as LinkIcon,
  Trash2, Loader2, ExternalLink, Eye, ChevronDown, ChevronUp, FileType, FileAudio,
  Wand2, CheckCircle2, AlertCircle, RefreshCw, BarChart3,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuestionarioCliente } from '@/hooks/useQuestionario';
import { useCliente } from '@/hooks/useClientes';
import {
  useClienteDocumentos,
  useGerarDocumento,
  useParseDocumento,
  useAgenteRascunho,
  useSalvarAgenteRascunho,
  useCriarGdocRetro,
  type ProjetoDocumento,
} from '@/hooks/useProjetoDocumentos';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { useRegistrarInteracaoTempo, type TipoAgente } from '@/hooks/useInteracoesTempo';
import {
  useTranscricoesSumarios,
  useSumarizarTranscricao,
  useRemoverSumario,
} from '@/hooks/useTranscricoesSumarios';
import {
  useClienteArquivos,
  downloadClienteArquivoBase64,
  type ClienteArquivo,
} from '@/hooks/useClienteArquivos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  clienteId: string;
}

interface Fonte {
  id: string;
  label: string;
  origem: 'upload' | 'gdrive' | 'texto';
  status: 'pending' | 'parsing' | 'done' | 'error';
  sumarioStatus?: 'idle' | 'sumarizando' | 'ok' | 'erro';
  sumarioId?: string;
  sumarioErro?: string;
  numCharsOriginal?: number;
  numCharsSumario?: number;
  conteudo?: string;
  meta?: string; // nome de arquivo ou url
  errorMsg?: string;
  papel?: string;          // ex: "Dono/Sócio", "Gestor"
  dataEntrevista?: string; // YYYY-MM-DD
}

const PAPEIS_SUGERIDOS = [
  'Dono/Sócio',
  'Gestor',
  'Equipe Comercial',
  'Equipe Administrativa',
  'Outro',
];

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB
const EXTENSOES_PERMITIDAS = ['txt', 'pdf', 'docx', 'vtt', 'srt'];

function extensaoArquivo(nome: string) {
  const idx = nome.lastIndexOf('.');
  return idx >= 0 ? nome.slice(idx + 1).toLowerCase() : '';
}

function formatarTamanhoMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SecaoAnotacao {
  key: string;
  titulo: string;
  guia: string;
}

const SECOES_ANOTACOES: SecaoAnotacao[] = [
  { key: 'pessoas',    titulo: 'Pessoas e liderança',     guia: 'Como você percebeu a dinâmica de liderança e equipe? O que ficou nas entrelinhas?' },
  { key: 'operacao',   titulo: 'Operação e processos',    guia: 'Onde estão os maiores gargalos do dia a dia? O que está funcionando mal e ninguém comenta abertamente?' },
  { key: 'tecnologia', titulo: 'Tecnologia e sistemas',   guia: 'Quais ferramentas usam? O que está desconectado, subutilizado ou sendo feito no braço?' },
  { key: 'cultura',    titulo: 'Cultura e comportamento', guia: 'Qual é o clima da empresa? Há resistência a mudança? Como é a relação entre as áreas?' },
  { key: 'contexto',   titulo: 'Contexto externo',        guia: 'Como está o mercado local? Concorrência, sazonalidade, oportunidades da praça que impactam esse cliente?' },
  { key: 'impressao',  titulo: 'Impressão geral do consultor', guia: 'O que mais te chamou atenção? Qual é o maior risco e a maior oportunidade que você viu?' },
];

interface AgentesDraftState {
  fontes?: Fonte[];
  gdriveUrl?: string;
  textoColado?: string;
  textoLabel?: string;
  anotacoes?: string;                          // legacy
  anotacoesSecoes?: Record<string, string>;
  okrContexto?: string;
  okrTrimestre?: string;
  coCanais?: string[];
  coPersonas?: 1 | 2;
  coObservacoes?: string;
  savedAt?: string;
}

function readLocalDraft(key: string): AgentesDraftState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as AgentesDraftState : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(key: string, estado: AgentesDraftState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(estado));
  } catch {
    // O rascunho principal fica no backend; o localStorage é apenas contingência.
  }
}

const TRIMESTRES = (() => {
  const now = new Date();
  const year = now.getFullYear();
  const items: string[] = [];
  for (let y = year; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) items.push(`Q${q} ${y}`);
  }
  return items;
})();

const CANAIS = ['WhatsApp', 'Portal', 'Site', 'Telefone', 'E-mail', 'Presencial'];

function fileIcon(name: string) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'mp3' || ext === 'wav' || ext === 'm4a') return FileAudio;
  return FileType;
}

function conteudoExtraidoInvalido(conteudo?: string) {
  const inicio = (conteudo ?? '').trim().slice(0, 2000).toLowerCase();
  return (
    inicio.startsWith('<!doctype html') ||
    inicio.startsWith('<html') ||
    inicio.includes('accounts.google.com') ||
    inicio.includes('service_login') ||
    inicio.includes('google accounts')
  );
}

function contarPalavras(texto?: string) {
  if (!texto) return 0;
  const limpo = texto.trim();
  if (!limpo) return 0;
  return limpo.split(/\s+/).length;
}

function formatarMinutosFala(palavras: number) {
  // ~150 palavras por minuto de fala
  const min = Math.max(1, Math.round(palavras / 150));
  return `~${min} min de fala`;
}

export function AgentesTab({ clienteId }: Props) {
  const { data: questionario } = useQuestionarioCliente(clienteId);
  const { data: documentos } = useClienteDocumentos(clienteId);
  const { data: cliente } = useCliente(clienteId);
  const { data: rascunho, isLoading: loadingRascunho } = useAgenteRascunho<AgentesDraftState>(clienteId);
  const { mutate: salvarRascunho } = useSalvarAgenteRascunho();
  const gerar = useGerarDocumento();
  const { mutateAsync: parseDocumento } = useParseDocumento();
  const criarGdocRetro = useCriarGdocRetro();
  const { data: sumariosSalvos } = useTranscricoesSumarios(clienteId);
  const { data: baseArquivos } = useClienteArquivos(clienteId);
  const sumarizar = useSumarizarTranscricao();
  const removerSumario = useRemoverSumario();
  const queryClient = useQueryClient();
  const { mutate: registrarTempo } = useRegistrarInteracaoTempo();
  const activeTimer = useActiveTimer(true);

  // Controle de tempo por agente. Tudo silencioso — sem UI.
  const tipoStateRef = useRef<Record<TipoAgente, { startedAt: Date; activeBaseline: number } | null>>({
    diagnostico: null,
    okrs: null,
    briefing_cliente_oculto: null,
  });
  const tipoFinalizadoRef = useRef<Record<TipoAgente, boolean>>({
    diagnostico: false,
    okrs: false,
    briefing_cliente_oculto: false,
  });
  const registrarTempoRef = useRef(registrarTempo);
  registrarTempoRef.current = registrarTempo;
  const snapshotRef = useRef(activeTimer.snapshot);
  snapshotRef.current = activeTimer.snapshot;

  // metadata "última conhecida" para o caso de salvar como interrompido no unmount
  const metadataRef = useRef({
    num_transcricoes: 0,
    num_caracteres_anotacoes: 0,
    respostas_questionario_usadas: 0,
  });

  // Inicia/relê baselines ao trocar de cliente
  useEffect(() => {
    activeTimer.reset();
    const snap = snapshotRef.current() ?? { activeSeconds: 0, startedAt: new Date(), endedAt: new Date(), totalSeconds: 0 };
    const baseline = snap.activeSeconds;
    const now = new Date();
    tipoStateRef.current = {
      diagnostico: { startedAt: now, activeBaseline: baseline },
      okrs: { startedAt: now, activeBaseline: baseline },
      briefing_cliente_oculto: { startedAt: now, activeBaseline: baseline },
    };
    tipoFinalizadoRef.current = { diagnostico: false, okrs: false, briefing_cliente_oculto: false };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // Ao sair da aba/navegar: registra como interrompido tudo o que não foi gerado
  useEffect(() => {
    return () => {
      const snap = snapshotRef.current();
      if (!snap) return;
      (Object.keys(tipoStateRef.current) as TipoAgente[]).forEach((tipo) => {
        const st = tipoStateRef.current[tipo];
        if (!st || tipoFinalizadoRef.current[tipo]) return;
        const activeSeconds = Math.max(0, snap.activeSeconds - st.activeBaseline);
        // ignora ruído: só registra se houve preparação relevante
        if (activeSeconds < 10) return;
        const totalSeconds = Math.max(0, Math.round((snap.endedAt.getTime() - st.startedAt.getTime()) / 1000));
        registrarTempoRef.current({
          cliente_id: clienteId,
          tipo,
          inicio_preparacao: st.startedAt.toISOString(),
          fim_preparacao: snap.endedAt.toISOString(),
          duracao_preparacao_segundos: activeSeconds,
          tempo_total_decorrido_segundos: totalSeconds,
          duracao_geracao_ia_segundos: null,
          metadata: { ...metadataRef.current, interrompido: true, motivo: 'saiu_aba' },
        });
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const draftHydratedRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reparsingDraftIdsRef = useRef<Set<string>>(new Set());

  // Estado das fontes do Diagnóstico
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [textoColado, setTextoColado] = useState('');
  const [textoLabel, setTextoLabel] = useState('');
  const [baseSelectId, setBaseSelectId] = useState<string>('');
  const [anotacoesSecoes, setAnotacoesSecoes] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pré-análise (Mapa das fontes)
  const [mapaFontes, setMapaFontes] = useState<string>('');
  const [mapeando, setMapeando] = useState(false);
  const [mapaExpanded, setMapaExpanded] = useState(true);

  // Persistência local das anotações
  const anotKey = `anotacoes_diagnostico_${clienteId}`;
  const draftKey = `agentes_ia_draft_${clienteId}`;

  // OKRs
  const [okrContexto, setOkrContexto] = useState('');
  const [okrTrimestre, setOkrTrimestre] = useState(TRIMESTRES[0]);

  // Cliente Oculto
  const [coCanais, setCoCanais] = useState<string[]>([]);
  const [coPersonas, setCoPersonas] = useState<1 | 2>(1);
  const [coObservacoes, setCoObservacoes] = useState('');

  // Visualização
  const [viewingDoc, setViewingDoc] = useState<ProjetoDocumento | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    draftHydratedRef.current = false;
    reparsingDraftIdsRef.current = new Set();
    setFontes([]);
    setGdriveUrl('');
    setTextoColado('');
    setTextoLabel('');
    setAnotacoesSecoes({});
    setMapaFontes('');
    setOkrContexto('');
    setOkrTrimestre(TRIMESTRES[0]);
    setCoCanais([]);
    setCoPersonas(1);
    setCoObservacoes('');
  }, [clienteId]);

  useEffect(() => {
    if (loadingRascunho || draftHydratedRef.current) return;

    const localEstado = readLocalDraft(draftKey);
    const backendEstado = rascunho?.estado;
    const localTime = localEstado?.savedAt ? Date.parse(localEstado.savedAt) : 0;
    const backendTime = rascunho?.updated_at ? Date.parse(rascunho.updated_at) : 0;
    const estado = localTime >= backendTime ? localEstado : backendEstado;
    if (estado) {
      setFontes(Array.isArray(estado.fontes) ? estado.fontes : []);
      setGdriveUrl(estado.gdriveUrl ?? '');
      setTextoColado(estado.textoColado ?? '');
      setTextoLabel(estado.textoLabel ?? '');
      if (estado.anotacoesSecoes && typeof estado.anotacoesSecoes === 'object') {
        setAnotacoesSecoes(estado.anotacoesSecoes);
      } else if (estado.anotacoes) {
        // migra legacy → impressão geral
        setAnotacoesSecoes({ impressao: estado.anotacoes });
      }
      setOkrContexto(estado.okrContexto ?? '');
      setOkrTrimestre(estado.okrTrimestre ?? TRIMESTRES[0]);
      setCoCanais(Array.isArray(estado.coCanais) ? estado.coCanais : []);
      setCoPersonas(estado.coPersonas === 2 ? 2 : 1);
      setCoObservacoes(estado.coObservacoes ?? '');
    } else {
      const legacyAnotacoes = typeof window !== 'undefined' ? localStorage.getItem(anotKey) : null;
      if (legacyAnotacoes) setAnotacoesSecoes({ impressao: legacyAnotacoes });
    }

    draftHydratedRef.current = true;
  }, [anotKey, draftKey, loadingRascunho, rascunho]);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);

    const estado: AgentesDraftState = {
      fontes,
      gdriveUrl,
      textoColado,
      textoLabel,
      anotacoesSecoes,
      okrContexto,
      okrTrimestre,
      coCanais,
      coPersonas,
      coObservacoes,
      savedAt: new Date().toISOString(),
    };

    writeLocalDraft(draftKey, estado);

    draftSaveTimerRef.current = setTimeout(() => {
      salvarRascunho({ cliente_id: clienteId, estado: estado as Record<string, unknown> });
    }, 700);

    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [clienteId, draftKey, fontes, gdriveUrl, textoColado, textoLabel, anotacoesSecoes, okrContexto, okrTrimestre, coCanais, coPersonas, coObservacoes, salvarRascunho]);

  useEffect(() => {
    if (!draftHydratedRef.current) return;

    const pendentesDrive = fontes.filter(
      (f) => f.origem === 'gdrive'
        && (f.status === 'parsing' || (f.status === 'done' && conteudoExtraidoInvalido(f.conteudo)))
        && f.meta
        && !reparsingDraftIdsRef.current.has(f.id),
    );

    pendentesDrive.forEach((fonte) => {
      reparsingDraftIdsRef.current.add(fonte.id);
      setFontes((prev) =>
        prev.map((f) => (f.id === fonte.id ? { ...f, status: 'parsing', errorMsg: undefined } : f)),
      );
      parseDocumento({ gdrive_url: fonte.meta })
        .then((texto) => {
          setFontes((prev) =>
            prev.map((f) => (f.id === fonte.id ? { ...f, status: 'done', conteudo: texto } : f)),
          );
        })
        .catch((e: Error) => {
          setFontes((prev) =>
            prev.map((f) => (f.id === fonte.id ? { ...f, status: 'error', errorMsg: e.message } : f)),
          );
        });
    });
  }, [fontes, parseDocumento]);

  // Auto-sumarização: dispara em background para cada fonte que já foi parseada
  // com sucesso mas ainda não tem sumário. Evita reentrância com um Set.
  const sumarizandoIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!draftHydratedRef.current) return;
    const alvos = fontes.filter(
      (f) =>
        f.status === 'done' &&
        !!f.conteudo &&
        !conteudoExtraidoInvalido(f.conteudo) &&
        !f.sumarioId &&
        f.sumarioStatus !== 'sumarizando' &&
        f.sumarioStatus !== 'ok' &&
        !sumarizandoIdsRef.current.has(f.id) &&
        (f.conteudo?.length ?? 0) >= 200,
    );
    if (alvos.length === 0) return;
    alvos.forEach((f) => {
      sumarizandoIdsRef.current.add(f.id);
      setFontes((prev) => prev.map((x) => (x.id === f.id ? { ...x, sumarioStatus: 'sumarizando', sumarioErro: undefined } : x)));
      sumarizar.mutateAsync({
        cliente_id: clienteId,
        label: rotuloTranscricao(f),
        papel: f.papel,
        data_entrevista: f.dataEntrevista || null,
        conteudo: f.conteudo!,
      })
        .then((res) => {
          setFontes((prev) => prev.map((x) => x.id === f.id ? {
            ...x,
            sumarioStatus: 'ok',
            sumarioId: res.sumario_id,
            numCharsOriginal: f.conteudo?.length ?? 0,
            numCharsSumario: res.sumario?.length ?? 0,
          } : x));
        })
        .catch((e: Error) => {
          setFontes((prev) => prev.map((x) => x.id === f.id ? {
            ...x,
            sumarioStatus: 'erro',
            sumarioErro: e.message,
          } : x));
        })
        .finally(() => {
          sumarizandoIdsRef.current.delete(f.id);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontes, clienteId]);

  // Hidratação: se o consultor voltar ao cliente e não houver fontes carregadas
  // do rascunho, monta os sumários persistidos no banco como fontes "prontas"
  // (somente leitura — sem conteúdo original, apenas o sumário serve para gerar).
  const sumariosHidratadosRef = useRef(false);
  useEffect(() => {
    if (!draftHydratedRef.current || sumariosHidratadosRef.current) return;
    if (!sumariosSalvos || sumariosSalvos.length === 0) return;
    sumariosHidratadosRef.current = true;
    setFontes((prev) => {
      const jaTem = new Set(prev.map((p) => p.sumarioId).filter(Boolean));
      const novos: Fonte[] = sumariosSalvos
        .filter((s) => !jaTem.has(s.id))
        .map((s) => ({
          id: `sum-${s.id}`,
          label: s.label,
          origem: 'texto',
          status: 'done',
          sumarioStatus: 'ok',
          sumarioId: s.id,
          papel: s.papel ?? undefined,
          dataEntrevista: s.data_entrevista ?? undefined,
          numCharsOriginal: s.num_chars_original ?? undefined,
          numCharsSumario: s.sumario?.length ?? undefined,
          meta: 'Sumário persistido',
        }));
      return novos.length ? [...prev, ...novos] : prev;
    });
  }, [sumariosSalvos]);

  const lastByTipo = useMemo(() => {
    const map = new Map<string, ProjetoDocumento>();
    for (const d of documentos ?? []) {
      if (!map.has(d.tipo)) map.set(d.tipo, d);
    }
    return map;
  }, [documentos]);

  const diagnosticoDoc = lastByTipo.get('diagnostico');
  const okrsDoc = lastByTipo.get('okrs');

  // Criação de planilha de OKRs a partir de dados_estruturados
  const [criandoSheet, setCriandoSheet] = useState(false);
  const [sheetProgresso, setSheetProgresso] = useState<string>('');
  const [escopoInsuficienteOpen, setEscopoInsuficienteOpen] = useState(false);

  const okrsDados: any = okrsDoc?.dados_estruturados ?? null;

  const handleCriarPlanilhaOKR = async () => {
    if (!okrsDoc) return;
    setCriandoSheet(true);
    setSheetProgresso('Copiando template…');
    try {
      setSheetProgresso('Preenchendo OKRs…');
      const { data, error } = await supabase.functions.invoke('criar-okr-sheet', {
        body: { documento_id: okrsDoc.id },
      });
      if (error) {
        let msg = error.message || 'Erro ao criar planilha';
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (typeof body?.error === 'string') msg = body.error;
          }
        } catch { /* keep msg */ }
        if (msg === 'escopo_insuficiente') {
          setEscopoInsuficienteOpen(true);
          return;
        }
        throw new Error(msg);
      }
      if (data?.error === 'escopo_insuficiente') {
        setEscopoInsuficienteOpen(true);
        return;
      }
      if (data?.error) throw new Error(data.error);
      setSheetProgresso('Pronto');
      toast.success('Planilha de OKRs criada.');
      await queryClient.invalidateQueries({ queryKey: ['cliente_documentos', clienteId] });
      if (data?.sheet_url) window.open(data.sheet_url, '_blank', 'noopener');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao criar planilha de OKRs');
    } finally {
      setCriandoSheet(false);
      setTimeout(() => setSheetProgresso(''), 2000);
    }
  };

  const handleCopiarTSV = () => {
    if (!okrsDados) {
      toast.error('OKRs sem dados estruturados para exportar');
      return;
    }
    const linhas: string[] = ['Objetivo\tKey Result\tAção\tObservações'];
    for (const obj of (okrsDados.objetivos ?? [])) {
      const objTxt = obj.objetivo ?? '';
      const krs = obj.key_results ?? [];
      if (!krs.length) linhas.push(`${objTxt}\t\t\t`);
      for (const kr of krs) {
        const krTxt = kr.kr ?? '';
        const obs = kr.observacoes ?? '';
        const acoes: string[] = kr.acoes ?? [];
        if (!acoes.length) linhas.push(`${objTxt}\t${krTxt}\t\t${obs}`);
        acoes.forEach((a, i) => linhas.push(`${objTxt}\t${krTxt}\t${a}\t${i === 0 ? obs : ''}`));
      }
    }
    navigator.clipboard.writeText(linhas.join('\n'));
    toast.success('Copiado. Cole em qualquer planilha.');
  };

  const TITULO_TIPO: Record<string, string> = {
    diagnostico: 'Diagnóstico',
    okrs: 'OKRs',
    briefing_cliente_oculto: 'Briefing Cliente Oculto',
  };

  const handleCriarGdocRetro = (doc: ProjetoDocumento) => {
    const nomeCliente = cliente?.nome ?? '';
    const dataFmt = format(new Date(doc.created_at), 'dd/MM/yyyy');
    const titulo = `${TITULO_TIPO[doc.tipo] ?? doc.tipo}${nomeCliente ? ` — ${nomeCliente}` : ''} — ${dataFmt}`;
    criarGdocRetro.mutate({ documento_id: doc.id, titulo, conteudo: doc.conteudo });
  };
  const criandoGdocDocId = criarGdocRetro.isPending
    ? (criarGdocRetro.variables?.documento_id ?? null)
    : null;

  const respostasDisponiveis = useMemo(() => {
    if (!questionario?.respostas) return 0;
    return Object.values(questionario.respostas).filter((v) => {
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim().length > 0;
    }).length;
  }, [questionario]);

  const transcricoesProntas = fontes.filter((f) =>
    f.status === 'done' && f.conteudo && !conteudoExtraidoInvalido(f.conteudo),
  );

  const sumariosIds = useMemo(
    () => fontes.map((f) => f.sumarioId).filter((x): x is string => !!x),
    [fontes],
  );

  const totalPalavrasTranscricoes = useMemo(
    () => transcricoesProntas.reduce((acc, f) => acc + contarPalavras(f.conteudo), 0),
    [transcricoesProntas],
  );

  const secoesPreenchidas = useMemo(
    () => SECOES_ANOTACOES.filter((s) => (anotacoesSecoes[s.key] ?? '').trim().length > 0),
    [anotacoesSecoes],
  );

  const anotacoesConcatenadas = useMemo(() => {
    if (secoesPreenchidas.length === 0) return '';
    const blocos = secoesPreenchidas
      .map((s) => `[${s.titulo}]: ${(anotacoesSecoes[s.key] ?? '').trim()}`)
      .join('\n\n');
    return `=== ANOTAÇÕES DO CONSULTOR ===\n${blocos}\n=== FIM DAS ANOTAÇÕES ===`;
  }, [secoesPreenchidas, anotacoesSecoes]);

  const podeGerarDiagnostico =
    respostasDisponiveis > 0 || transcricoesProntas.length > 0 || secoesPreenchidas.length > 0;

  // mantém metadata "ao vivo" para fallback de unmount
  metadataRef.current = {
    num_transcricoes: transcricoesProntas.length,
    num_caracteres_anotacoes: anotacoesConcatenadas.length,
    respostas_questionario_usadas: respostasDisponiveis,
  };

  function rotuloTranscricao(f: Fonte) {
    const papel = (f.papel ?? '').trim();
    const data = (f.dataEntrevista ?? '').trim();
    if (!papel && !data) return f.label;
    const dataFmt = data ? (() => {
      try { return format(new Date(data + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return data; }
    })() : '';
    const partes = [papel || f.label, dataFmt].filter(Boolean).join(' — ');
    return `ENTREVISTA: ${partes}`;
  }

  /* ====== Card B helpers ====== */

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      const ext = extensaoArquivo(file.name);

      if (!EXTENSOES_PERMITIDAS.includes(ext)) {
        setFontes((prev) => [...prev, {
          id,
          label: file.name,
          origem: 'upload',
          status: 'error',
          meta: file.name,
          errorMsg: `Tipo de arquivo não suportado (.${ext || '?'}). Use .txt, .pdf, .docx, .vtt ou .srt.`,
        }]);
        continue;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setFontes((prev) => [...prev, {
          id,
          label: file.name,
          origem: 'upload',
          status: 'error',
          meta: file.name,
          errorMsg: `Arquivo de ${formatarTamanhoMB(file.size)} excede o limite de 6 MB. Exporte como .txt ou divida o arquivo.`,
        }]);
        continue;
      }

      setFontes((prev) => [...prev, {
        id, label: file.name, origem: 'upload', status: 'parsing', meta: file.name,
      }]);
      try {
        const buffer = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const texto = await parseDocumento({
          conteudo_base64: b64,
          nome_arquivo: file.name,
        });
        setFontes((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'done', conteudo: texto } : f)),
        );
      } catch (e: any) {
        setFontes((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'error', errorMsg: e?.message ?? 'Falha desconhecida ao processar arquivo.' } : f)),
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const tentarReprocessar = async (id: string) => {
    const fonte = fontes.find((f) => f.id === id);
    if (!fonte) return;

    if (fonte.origem === 'gdrive' && fonte.meta) {
      setFontes((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'parsing', errorMsg: undefined } : f)),
      );
      try {
        const texto = await parseDocumento({ gdrive_url: fonte.meta });
        setFontes((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'done', conteudo: texto } : f)),
        );
      } catch (e: any) {
        setFontes((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'error', errorMsg: e?.message ?? 'Falha desconhecida.' } : f)),
        );
      }
      return;
    }

    if (fonte.origem === 'upload') {
      toast.info('Selecione o arquivo novamente para reenviar.');
      fileInputRef.current?.click();
    }
  };

  const adicionarGdrive = async () => {
    if (!gdriveUrl.trim()) return;
    const id = crypto.randomUUID();
    const url = gdriveUrl.trim();
    setFontes((prev) => [...prev, {
      id, label: `Drive — ${url.slice(0, 40)}…`, origem: 'gdrive', status: 'parsing', meta: url,
    }]);
    setGdriveUrl('');
    try {
      const texto = await parseDocumento({ gdrive_url: url });
      setFontes((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'done', conteudo: texto } : f)),
      );
    } catch (e: any) {
      setFontes((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'error', errorMsg: e.message } : f)),
      );
    }
  };

  const adicionarTextoColado = () => {
    if (!textoColado.trim()) return;
    setFontes((prev) => [...prev, {
      id: crypto.randomUUID(),
      label: textoLabel.trim() || `Texto colado ${prev.filter(p => p.origem === 'texto').length + 1}`,
      origem: 'texto',
      status: 'done',
      conteudo: textoColado,
    }]);
    setTextoColado('');
    setTextoLabel('');
  };

  const isGDriveLink = (url: string) =>
    /drive\.google\.com|docs\.google\.com/i.test(url);

  const baseElegiveis = useMemo(
    () => (baseArquivos ?? []).filter(a => a.tipo === 'arquivo' || isGDriveLink(a.url)),
    [baseArquivos],
  );

  const adicionarDaBase = async (arquivoId: string) => {
    const arq = baseElegiveis.find(a => a.id === arquivoId);
    if (!arq) return;
    const id = crypto.randomUUID();
    // já existe? evita duplicar
    if (fontes.some((f) => f.meta === (arq.tipo === 'link' ? arq.url : `base:${arq.id}`))) {
      toast.info('Este item já está na lista de fontes.');
      setBaseSelectId('');
      return;
    }

    if (arq.tipo === 'link') {
      setFontes((prev) => [...prev, {
        id, label: arq.titulo, origem: 'gdrive', status: 'parsing', meta: arq.url,
      }]);
      try {
        const texto = await parseDocumento({ gdrive_url: arq.url });
        setFontes((prev) => prev.map((f) => f.id === id ? { ...f, status: 'done', conteudo: texto } : f));
      } catch (e: any) {
        setFontes((prev) => prev.map((f) => f.id === id ? { ...f, status: 'error', errorMsg: e?.message ?? 'Falha' } : f));
      }
    } else {
      setFontes((prev) => [...prev, {
        id, label: arq.titulo, origem: 'upload', status: 'parsing', meta: `base:${arq.id}`,
      }]);
      try {
        const { base64, name } = await downloadClienteArquivoBase64(arq.url);
        const texto = await parseDocumento({ conteudo_base64: base64, nome_arquivo: name });
        setFontes((prev) => prev.map((f) => f.id === id ? { ...f, status: 'done', conteudo: texto } : f));
      } catch (e: any) {
        setFontes((prev) => prev.map((f) => f.id === id ? { ...f, status: 'error', errorMsg: e?.message ?? 'Falha ao processar arquivo da base.' } : f));
      }
    }
    setBaseSelectId('');
  };

  const removerFonte = (id: string) => {
    const fonte = fontes.find((f) => f.id === id);
    if (fonte?.sumarioId) {
      removerSumario.mutate({ id: fonte.sumarioId, cliente_id: clienteId });
    }
    setFontes((prev) => prev.filter((f) => f.id !== id));
  };

  const tentarSumarizar = async (id: string) => {
    const f = fontes.find((x) => x.id === id);
    if (!f?.conteudo) {
      toast.info('Sem conteúdo original salvo nesta sessão. Reenvie o arquivo/link para sumarizar novamente.');
      return;
    }
    setFontes((prev) => prev.map((x) => x.id === id ? { ...x, sumarioStatus: 'sumarizando', sumarioErro: undefined } : x));
    try {
      const res = await sumarizar.mutateAsync({
        cliente_id: clienteId,
        label: rotuloTranscricao(f),
        papel: f.papel,
        data_entrevista: f.dataEntrevista || null,
        conteudo: f.conteudo,
      });
      setFontes((prev) => prev.map((x) => x.id === id ? {
        ...x,
        sumarioStatus: 'ok',
        sumarioId: res.sumario_id,
        numCharsSumario: res.sumario?.length ?? 0,
      } : x));
    } catch (e: any) {
      setFontes((prev) => prev.map((x) => x.id === id ? { ...x, sumarioStatus: 'erro', sumarioErro: e?.message ?? 'Falha ao sumarizar' } : x));
    }
  };

  const renomearFonte = (id: string, label: string) =>
    setFontes((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));

  const atualizarFonte = (id: string, patch: Partial<Fonte>) =>
    setFontes((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  /* ====== Mapear fontes (pré-análise) ====== */

  const mapearFontes = async () => {
    if (transcricoesProntas.length === 0 && respostasDisponiveis === 0) {
      toast.error('Adicione ao menos uma transcrição ou tenha respostas do questionário.');
      return;
    }
    setMapeando(true);
    try {
      const { data, error } = await supabase.functions.invoke('agente-projeto', {
        body: {
          tipo: 'pre_analise',
          cliente_id: clienteId,
          questionario_data: (questionario?.respostas as Record<string, unknown>) ?? null,
          transcricoes_textos: transcricoesProntas.map((f) => ({
            label: rotuloTranscricao(f),
            conteudo: f.conteudo!,
          })),
        },
      });
      if (error) throw new Error((data as any)?.error ?? error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setMapaFontes((data as any)?.conteudo ?? '');
      setMapaExpanded(true);
      toast.success('Mapa das fontes pronto.');
    } catch (e: any) {
      toast.error(`Falha ao mapear: ${e.message}`);
    } finally {
      setMapeando(false);
    }
  };

  /* ====== Gerar ====== */

  const finalizarTempo = (tipo: TipoAgente, opts: { iaSegundos: number | null; interrompido: boolean; metaExtra?: Record<string, unknown> }) => {
    const st = tipoStateRef.current[tipo];
    if (!st) return;
    const snap = activeTimer.snapshot();
    if (!snap) return;
    const activeSeconds = Math.max(0, snap.activeSeconds - st.activeBaseline);
    const totalSeconds = Math.max(0, Math.round((snap.endedAt.getTime() - st.startedAt.getTime()) / 1000));
    registrarTempo({
      cliente_id: clienteId,
      tipo,
      inicio_preparacao: st.startedAt.toISOString(),
      fim_preparacao: snap.endedAt.toISOString(),
      duracao_preparacao_segundos: activeSeconds,
      tempo_total_decorrido_segundos: totalSeconds,
      duracao_geracao_ia_segundos: opts.iaSegundos,
      metadata: { ...metadataRef.current, ...(opts.metaExtra ?? {}), interrompido: opts.interrompido },
    });
    tipoFinalizadoRef.current[tipo] = true;
    // Reabre baseline para uma eventual nova geração do mesmo tipo na mesma sessão
    const snap2 = activeTimer.snapshot();
    tipoStateRef.current[tipo] = snap2
      ? { startedAt: new Date(), activeBaseline: snap2.activeSeconds }
      : null;
    tipoFinalizadoRef.current[tipo] = false;
  };

  const gerarComTempo = async (
    tipo: TipoAgente,
    payload: Parameters<typeof gerar.mutateAsync>[0],
    metaExtra?: Record<string, unknown>,
  ) => {
    const iaStart = Date.now();
    try {
      await gerar.mutateAsync(payload);
      const iaSegundos = Math.round((Date.now() - iaStart) / 1000);
      finalizarTempo(tipo, { iaSegundos, interrompido: false, metaExtra });
      toast.success('Documento gerado.');
    } catch {
      const iaSegundos = Math.round((Date.now() - iaStart) / 1000);
      finalizarTempo(tipo, { iaSegundos, interrompido: true, metaExtra: { ...(metaExtra ?? {}), motivo: 'erro_ia' } });
    }
  };

  const gerarDiagnostico = () => {
    gerarComTempo('diagnostico', {
      tipo: 'diagnostico',
      cliente_id: clienteId,
      questionario_data: (questionario?.respostas as Record<string, unknown>) ?? null,
      // Fluxo novo: envia sumarios_ids (map-reduce). Só envia transcrições brutas
      // como fallback para as fontes que ainda não têm sumário.
      sumarios_ids: sumariosIds,
      transcricoes_textos: transcricoesProntas
        .filter((f) => !f.sumarioId)
        .map((f) => ({
          label: rotuloTranscricao(f),
          conteudo: f.conteudo!,
        })),
      anotacoes_consultor: anotacoesConcatenadas || undefined,
    });
  };

  const gerarOkrs = () => {
    if (!diagnosticoDoc) return;
    gerarComTempo('okrs', {
      tipo: 'okrs',
      cliente_id: clienteId,
      contexto_usuario: okrContexto.trim() || undefined,
      trimestre: okrTrimestre,
    });
  };

  const gerarClienteOculto = () => {
    gerarComTempo('briefing_cliente_oculto', {
      tipo: 'briefing_cliente_oculto',
      cliente_id: clienteId,
      canais_atendimento: coCanais,
      contexto_usuario: coObservacoes.trim() || undefined,
      titulo_doc: `Briefing Cliente Oculto — ${coPersonas} persona(s)`,
    });
  };

  const importarDiagnostico = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('importar-documento-agente', {
        body: { tipo: 'diagnostico', cliente_id: clienteId, gdrive_url: url },
      });
      if (error) throw new Error((data as any)?.error ?? error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Diagnóstico importado.');
      setImportUrl('');
      queryClient.invalidateQueries({ queryKey: ['cliente_documentos', clienteId] });
    } catch (e: any) {
      toast.error(`Falha ao importar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const isBusy = (tipo: string) => gerar.isPending && gerar.variables?.tipo === tipo;

  /* ====== UI ====== */

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* DIAGNÓSTICO */}
        <PanelAgente
          icon={FileText}
          titulo="Diagnóstico"
          existingDoc={diagnosticoDoc}
          versoesAnteriores={documentos?.filter((d) => d.tipo === 'diagnostico') ?? []}
          onView={(d) => setViewingDoc(d)}
          onCriarGdoc={handleCriarGdocRetro}
          criandoGdocDocId={criandoGdocDocId}
          expanded={expandedHistory['diagnostico']}
          onToggleExpand={() =>
            setExpandedHistory((p) => ({ ...p, diagnostico: !p['diagnostico'] }))
          }
        >
          {/* Card A — Questionário */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SourceCard
              titulo="Questionário Pré-Onboarding"
              icon={ClipboardCheck}
              status={respostasDisponiveis > 0 ? 'ok' : 'pending'}
              statusText={
                respostasDisponiveis > 0
                  ? `${respostasDisponiveis} resposta(s) disponíveis`
                  : 'Aguardando resposta do cliente'
              }
            />
            <SourceCard
              titulo="Transcrições da Imersão"
              icon={Upload}
              status={fontes.length > 0 ? 'ok' : 'pending'}
              statusText={
                fontes.length > 0
                  ? `${fontes.length} item(ns) adicionado(s)`
                  : 'Nenhuma transcrição adicionada'
              }
            />
            <SourceCard
              titulo="Anotações do Consultor"
              icon={FileText}
              status={secoesPreenchidas.length > 0 ? 'ok' : 'pending'}
              statusText={
                secoesPreenchidas.length > 0
                  ? `${secoesPreenchidas.length} de ${SECOES_ANOTACOES.length} seções preenchidas`
                  : 'Sem anotações'
              }
            />
          </div>

          {/* Card B — Upload / Drive / Texto */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h5 className="text-sm font-medium flex items-center gap-1">
                <Upload className="h-4 w-4" /> Transcrições das entrevistas
              </h5>
              <p className="text-xs text-muted-foreground">
                Combine arquivos, links do Drive e texto colado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Upload */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx,.vtt,.srt"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Subir arquivos (.txt, .pdf, .docx, .vtt, .srt)
                </Button>
              </div>

              {/* Drive */}
              <div className="flex gap-2">
                <Input
                  value={gdriveUrl}
                  onChange={(e) => setGdriveUrl(e.target.value)}
                  placeholder="Cole um link do Google Drive"
                  className="text-xs"
                />
                <Button size="sm" variant="outline" onClick={adicionarGdrive} disabled={!gdriveUrl.trim()}>
                  <LinkIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Texto colado */}
            <div className="space-y-2">
              <Input
                value={textoLabel}
                onChange={(e) => setTextoLabel(e.target.value)}
                placeholder="Rótulo (ex: Entrevista — Diretor)"
                className="text-xs"
              />
              <Textarea
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                rows={4}
                placeholder="Cole aqui a transcrição diretamente — texto exportado de Otter.ai, Fireflies, Zoom, ou qualquer ferramenta de transcrição."
              />
              <Button size="sm" variant="outline" onClick={adicionarTextoColado} disabled={!textoColado.trim()}>
                Adicionar texto colado
              </Button>
            </div>

            {/* Da base do cliente */}
            {baseElegiveis.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h6 className="text-xs font-medium">Da base do cliente</h6>
                    <p className="text-[11px] text-muted-foreground">
                      Reaproveite arquivos e links do Drive já cadastrados na aba Documentos.
                    </p>
                  </div>
                </div>
                <Select value={baseSelectId} onValueChange={(v) => { setBaseSelectId(v); adicionarDaBase(v); }}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecionar item da base..." />
                  </SelectTrigger>
                  <SelectContent>
                    {baseElegiveis.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.titulo} · {a.tipo === 'link' ? 'link Drive' : 'arquivo'}
                        {a.categoria ? ` · ${a.categoria}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lista de fontes */}
            {fontes.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  Conteúdos a incluir no diagnóstico
                </p>
                {fontes.map((f) => {
                  const Icon = fileIcon(f.meta ?? f.label);
                  const palavras = contarPalavras(f.conteudo);
                  return (
                    <div key={f.id} className="rounded-md border border-border bg-background p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          value={f.label}
                          onChange={(e) => renomearFonte(f.id, e.target.value)}
                          className="h-7 text-xs flex-1"
                        />
                        {f.status === 'parsing' && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> processando
                          </Badge>
                        )}
                        {f.status === 'done' && f.sumarioStatus === 'sumarizando' && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> sumarizando
                          </Badge>
                        )}
                        {f.status === 'done' && f.sumarioStatus === 'ok' && (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                            {f.numCharsOriginal && f.numCharsSumario
                              ? `sumário ${Math.max(1, Math.round((f.numCharsSumario / f.numCharsOriginal) * 100))}% do original`
                              : 'sumário pronto'}
                          </Badge>
                        )}
                        {f.status === 'done' && f.sumarioStatus === 'erro' && (
                          <Badge variant="destructive" className="text-[10px]">falha sumário</Badge>
                        )}
                        {f.status === 'done' && !f.sumarioStatus && (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                            pronto
                          </Badge>
                        )}
                        {f.status === 'error' && (
                          <Badge variant="destructive" className="text-[10px]">erro</Badge>
                        )}
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerFonte(f.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {f.sumarioStatus === 'erro' && (
                        <div className="pl-6 space-y-1.5">
                          <p className="text-[11px] text-destructive leading-snug">
                            {f.sumarioErro ?? 'Falha ao sumarizar.'}
                          </p>
                          <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => tentarSumarizar(f.id)}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                          </Button>
                        </div>
                      )}
                      {f.status === 'error' && (
                        <div className="pl-6 space-y-1.5">
                          <p className="text-[11px] text-destructive leading-snug">
                            {f.errorMsg ?? 'Falha ao processar arquivo.'}
                          </p>
                          {(f.origem === 'gdrive' || f.origem === 'upload') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              onClick={() => tentarReprocessar(f.id)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center pl-6">
                        <Input
                          value={f.papel ?? ''}
                          onChange={(e) => atualizarFonte(f.id, { papel: e.target.value })}
                          placeholder="Papel do entrevistado (ex: Dono/Sócio)"
                          className="h-7 text-xs"
                        />
                        <Input
                          type="date"
                          value={f.dataEntrevista ?? ''}
                          onChange={(e) => atualizarFonte(f.id, { dataEntrevista: e.target.value })}
                          className="h-7 text-xs w-[140px]"
                        />
                        {f.status === 'done' && palavras > 0 && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            ~{palavras.toLocaleString('pt-BR')} palavras · {formatarMinutosFala(palavras)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 pl-6">
                        {PAPEIS_SUGERIDOS.map((p) => (
                          <Badge
                            key={p}
                            variant={f.papel === p ? 'default' : 'outline'}
                            className="cursor-pointer text-[10px]"
                            onClick={() => atualizarFonte(f.id, { papel: p })}
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card B' — Mapa das fontes (pré-análise) */}
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h5 className="text-sm font-medium flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4" /> Mapa das fontes
                </h5>
                <p className="text-[11px] text-muted-foreground">
                  Antes de gerar o diagnóstico, peça à IA um resumo rápido dos temas, tensões e pontos cegos das fontes.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={mapearFontes} disabled={mapeando}>
                {mapeando
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Mapeando…</>
                  : <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> Mapear fontes</>}
              </Button>
            </div>
            {mapaFontes && (
              <div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => setMapaExpanded((v) => !v)}
                >
                  {mapaExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {mapaExpanded ? 'Recolher' : 'Expandir'} mapa
                </button>
                {mapaExpanded && (
                  <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{mapaFontes}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card C — Anotações estruturadas por dimensão */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Anotações do consultor</h5>
            <p className="text-[11px] text-muted-foreground">
              Preencha apenas as seções relevantes. Campos vazios são ignorados ao gerar.
            </p>
            <div className="space-y-2">
              {SECOES_ANOTACOES.map((s) => {
                const valor = anotacoesSecoes[s.key] ?? '';
                const preenchida = valor.trim().length > 0;
                return (
                  <details
                    key={s.key}
                    className="rounded-md border border-border bg-background"
                    open={preenchida}
                  >
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {preenchida
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <span className="h-3.5 w-3.5 rounded-full border border-border inline-block" />}
                        {s.titulo}
                      </span>
                      {preenchida && (
                        <span className="text-[10px] text-muted-foreground">
                          {contarPalavras(valor)} palavra(s)
                        </span>
                      )}
                    </summary>
                    <div className="px-3 pb-3 space-y-1">
                      <p className="text-[11px] text-muted-foreground italic">{s.guia}</p>
                      <Textarea
                        value={valor}
                        onChange={(e) =>
                          setAnotacoesSecoes((prev) => ({ ...prev, [s.key]: e.target.value }))
                        }
                        rows={3}
                        placeholder="Escreva o que for relevante…"
                      />
                    </div>
                  </details>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Salvo automaticamente no seu navegador para não perder ao navegar.
            </p>
          </div>

          {/* Checklist de prontidão */}
          <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-1.5 text-xs">
            <ProntidaoLinha
              ok={respostasDisponiveis > 0}
              label={`Questionário de pré-onboarding: ${respostasDisponiveis} resposta(s) recebida(s)`}
            />
            <ProntidaoLinha
              ok={transcricoesProntas.length > 0}
              label={`Transcrições: ${transcricoesProntas.length} entrevista(s) (${totalPalavrasTranscricoes.toLocaleString('pt-BR')} palavras no total)`}
              warnIfEmpty
            />
            <ProntidaoLinha
              ok={secoesPreenchidas.length > 0}
              label={`Anotações: ${secoesPreenchidas.length} de ${SECOES_ANOTACOES.length} seções preenchidas`}
            />
            <p className="text-[11px] text-muted-foreground pt-1">
              Quanto mais fontes, mais rico o diagnóstico. Você pode gerar agora ou complementar antes.
            </p>
          </div>

          <Button
            onClick={gerarDiagnostico}
            disabled={!podeGerarDiagnostico || isBusy('diagnostico')}
            className="w-full sm:w-auto"
          >
            {isBusy('diagnostico')
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
              : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Diagnóstico</>}
          </Button>

          <Separator />
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 space-y-2">
            <h5 className="text-sm font-medium flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4" /> Já tem um diagnóstico pronto?
            </h5>
            <p className="text-xs text-muted-foreground">
              Importe um diagnóstico já feito (Google Docs). O conteúdo será extraído
              e usado como contexto pelos próximos agentes (OKRs, Cliente Oculto).
            </p>
            <div className="flex gap-2">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/…"
                className="text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={importarDiagnostico}
                disabled={!importUrl.trim() || importing}
              >
                {importing
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importando…</>
                  : <>Importar</>}
              </Button>
            </div>
          </div>
        </PanelAgente>

        {/* OKRs */}
        <PanelAgente
          icon={Target}
          titulo="OKRs"
          existingDoc={okrsDoc}
          versoesAnteriores={documentos?.filter((d) => d.tipo === 'okrs') ?? []}
          onView={(d) => setViewingDoc(d)}
          onCriarGdoc={handleCriarGdocRetro}
          criandoGdocDocId={criandoGdocDocId}
          expanded={expandedHistory['okrs']}
          onToggleExpand={() =>
            setExpandedHistory((p) => ({ ...p, okrs: !p['okrs'] }))
          }
          disabled={!diagnosticoDoc}
          disabledTooltip="Gere o diagnóstico primeiro"
        >
          {diagnosticoDoc && (
            <p className="text-xs text-muted-foreground">
              Baseado em: Diagnóstico gerado em{' '}
              {format(new Date(diagnosticoDoc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <Textarea
              value={okrContexto}
              onChange={(e) => setOkrContexto(e.target.value)}
              rows={4}
              placeholder="Descreva o que foi alinhado com o cliente na devolutiva do diagnóstico: prioridades validadas, metas discutidas, contexto do trimestre."
              disabled={!diagnosticoDoc}
            />
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-xs h-9 self-start"
              value={okrTrimestre}
              onChange={(e) => setOkrTrimestre(e.target.value)}
              disabled={!diagnosticoDoc}
            >
              {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Button onClick={gerarOkrs} disabled={!diagnosticoDoc || isBusy('okrs')} className="w-full sm:w-auto">
            {isBusy('okrs')
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
              : <><Sparkles className="h-4 w-4 mr-2" /> Gerar OKRs {okrTrimestre}</>}
          </Button>
          {okrsDoc && okrsDados && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {okrsDoc.sheet_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(okrsDoc.sheet_url!, '_blank', 'noopener')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir planilha de OKRs
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCriarPlanilhaOKR}
                  disabled={criandoSheet}
                >
                  {criandoSheet
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {sheetProgresso || 'Criando…'}</>
                    : <><FileText className="h-4 w-4 mr-2" /> Criar planilha de OKRs</>}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleCopiarTSV}>
                <ClipboardCheck className="h-4 w-4 mr-2" /> Copiar para planilha (TSV)
              </Button>
            </div>
          )}
        </PanelAgente>

        {/* CLIENTE OCULTO */}
        <PanelAgente
          icon={ClipboardList}
          titulo="Briefing Cliente Oculto"
          existingDoc={lastByTipo.get('briefing_cliente_oculto')}
          versoesAnteriores={documentos?.filter((d) => d.tipo === 'briefing_cliente_oculto') ?? []}
          onView={(d) => setViewingDoc(d)}
          onCriarGdoc={handleCriarGdocRetro}
          criandoGdocDocId={criandoGdocDocId}
          expanded={expandedHistory['briefing_cliente_oculto']}
          onToggleExpand={() =>
            setExpandedHistory((p) => ({ ...p, briefing_cliente_oculto: !p['briefing_cliente_oculto'] }))
          }
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium mb-1">Canais a avaliar</p>
              <div className="flex flex-wrap gap-2">
                {CANAIS.map((c) => {
                  const selected = coCanais.includes(c);
                  return (
                    <Badge
                      key={c}
                      variant={selected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setCoCanais((prev) =>
                          prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                        );
                      }}
                    >
                      {c}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Número de personas</p>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <Badge
                    key={n}
                    variant={coPersonas === n ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setCoPersonas(n as 1 | 2)}
                  >
                    {n} persona{n > 1 ? 's' : ''}
                  </Badge>
                ))}
              </div>
            </div>
            <Textarea
              value={coObservacoes}
              onChange={(e) => setCoObservacoes(e.target.value)}
              rows={3}
              placeholder="Observações específicas sobre o que deve ser avaliado, contexto da operação, pontos críticos."
            />
          </div>
          <Button onClick={gerarClienteOculto} disabled={isBusy('briefing_cliente_oculto')} className="w-full sm:w-auto">
            {isBusy('briefing_cliente_oculto')
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
              : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Briefing</>}
          </Button>
        </PanelAgente>

        {/* Modal de visualização */}
        <Dialog open={!!viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {viewingDoc?.tipo} —{' '}
                {viewingDoc && format(new Date(viewingDoc.created_at), 'dd/MM/yyyy HH:mm')}
              </DialogTitle>
            </DialogHeader>
            {viewingDoc && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{viewingDoc.conteudo}</ReactMarkdown>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={escopoInsuficienteOpen} onOpenChange={setEscopoInsuficienteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reconecte sua conta Google</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                Sua conexão Google precisa ser renovada para criar planilhas de OKRs. O escopo de acesso ao Google Sheets ainda não foi concedido.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEscopoInsuficienteOpen(false)}>Fechar</Button>
                <Button onClick={() => { window.location.href = '/minhas-integracoes'; }}>
                  Ir para Minhas Integrações
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/* ====================== Sub-componentes ====================== */

function SourceCard({
  titulo, icon: Icon, status, statusText,
}: {
  titulo: string;
  icon: typeof FileText;
  status: 'ok' | 'pending';
  statusText: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {titulo}
      </div>
      <Badge
        variant="outline"
        className={
          status === 'ok'
            ? 'text-emerald-500 border-emerald-500/40'
            : 'text-muted-foreground'
        }
      >
        {statusText}
      </Badge>
    </div>
  );
}

function ProntidaoLinha({ ok, label, warnIfEmpty }: { ok: boolean; label: string; warnIfEmpty?: boolean }) {
  const Icon = ok ? CheckCircle2 : warnIfEmpty ? AlertCircle : AlertCircle;
  const color = ok
    ? 'text-emerald-500'
    : warnIfEmpty
      ? 'text-amber-500'
      : 'text-muted-foreground';
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 mt-0.5 ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function PanelAgente({
  icon: Icon,
  titulo,
  existingDoc,
  versoesAnteriores,
  onView,
  onCriarGdoc,
  criandoGdocDocId,
  expanded,
  onToggleExpand,
  disabled,
  disabledTooltip,
  children,
}: {
  icon: typeof FileText;
  titulo: string;
  existingDoc?: ProjetoDocumento;
  versoesAnteriores: ProjetoDocumento[];
  onView: (d: ProjetoDocumento) => void;
  onCriarGdoc?: (d: ProjetoDocumento) => void;
  criandoGdocDocId?: string | null;
  expanded?: boolean;
  onToggleExpand: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  children: React.ReactNode;
}) {
  const numAnteriores = Math.max(0, versoesAnteriores.length - 1);
  return (
    <Card className={`bg-card border-border ${disabled ? 'opacity-60' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-5 w-5" /> {titulo}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {existingDoc ? (
              <Badge variant="outline" className="text-xs">
                Gerado em {format(new Date(existingDoc.created_at), 'dd/MM/yyyy')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Pendente</Badge>
            )}
            {existingDoc && (
              <>
                <Button size="sm" variant="outline" onClick={() => onView(existingDoc)}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver no sistema
                </Button>
                {existingDoc.gdoc_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={existingDoc.gdoc_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no Google Docs
                    </a>
                  </Button>
                )}
                {!existingDoc.gdoc_url && onCriarGdoc && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCriarGdoc(existingDoc)}
                    disabled={criandoGdocDocId === existingDoc.id}
                  >
                    {criandoGdocDocId === existingDoc.id ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Criando…</>
                    ) : (
                      <><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Criar no Google Docs</>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled && disabledTooltip ? (
          <p className="text-xs text-muted-foreground italic">{disabledTooltip}</p>
        ) : null}
        <div className={disabled ? 'pointer-events-none' : ''}>{children}</div>

        {numAnteriores > 0 && (
          <div className="border-t border-border pt-3">
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={onToggleExpand}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {numAnteriores} versão(ões) anterior(es)
            </button>
            {expanded && (
              <div className="mt-2 space-y-1">
                {versoesAnteriores.slice(1).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onView(d)}>
                      Ver
                    </Button>
                    {d.gdoc_url && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" asChild>
                        <a href={d.gdoc_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> Docs
                        </a>
                      </Button>
                    )}
                    {!d.gdoc_url && onCriarGdoc && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => onCriarGdoc(d)}
                        disabled={criandoGdocDocId === d.id}
                      >
                        {criandoGdocDocId === d.id ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Criando…</>
                        ) : (
                          <><ExternalLink className="h-3 w-3 mr-1" /> Criar Docs</>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}