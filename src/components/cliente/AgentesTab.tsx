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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuestionarioCliente } from '@/hooks/useQuestionario';
import {
  useClienteDocumentos,
  useGerarDocumento,
  useParseDocumento,
  useAgenteRascunho,
  useSalvarAgenteRascunho,
  type ProjetoDocumento,
} from '@/hooks/useProjetoDocumentos';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  clienteId: string;
}

interface Fonte {
  id: string;
  label: string;
  origem: 'upload' | 'gdrive' | 'texto';
  status: 'pending' | 'parsing' | 'done' | 'error';
  conteudo?: string;
  meta?: string; // nome de arquivo ou url
  errorMsg?: string;
}

interface AgentesDraftState {
  fontes?: Fonte[];
  gdriveUrl?: string;
  textoColado?: string;
  textoLabel?: string;
  anotacoes?: string;
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

export function AgentesTab({ clienteId }: Props) {
  const { data: questionario } = useQuestionarioCliente(clienteId);
  const { data: documentos } = useClienteDocumentos(clienteId);
  const { data: rascunho, isLoading: loadingRascunho } = useAgenteRascunho<AgentesDraftState>(clienteId);
  const { mutate: salvarRascunho } = useSalvarAgenteRascunho();
  const gerar = useGerarDocumento();
  const { mutateAsync: parseDocumento } = useParseDocumento();
  const queryClient = useQueryClient();
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
  const [anotacoes, setAnotacoes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAnotacoes('');
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
      setAnotacoes(estado.anotacoes ?? '');
      setOkrContexto(estado.okrContexto ?? '');
      setOkrTrimestre(estado.okrTrimestre ?? TRIMESTRES[0]);
      setCoCanais(Array.isArray(estado.coCanais) ? estado.coCanais : []);
      setCoPersonas(estado.coPersonas === 2 ? 2 : 1);
      setCoObservacoes(estado.coObservacoes ?? '');
    } else {
      const legacyAnotacoes = typeof window !== 'undefined' ? localStorage.getItem(anotKey) : null;
      if (legacyAnotacoes) setAnotacoes(legacyAnotacoes);
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
      anotacoes,
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
  }, [clienteId, draftKey, fontes, gdriveUrl, textoColado, textoLabel, anotacoes, okrContexto, okrTrimestre, coCanais, coPersonas, coObservacoes, salvarRascunho]);

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

  const lastByTipo = useMemo(() => {
    const map = new Map<string, ProjetoDocumento>();
    for (const d of documentos ?? []) {
      if (!map.has(d.tipo)) map.set(d.tipo, d);
    }
    return map;
  }, [documentos]);

  const diagnosticoDoc = lastByTipo.get('diagnostico');
  const okrsDoc = lastByTipo.get('okrs');

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
  const podeGerarDiagnostico =
    respostasDisponiveis > 0 || transcricoesProntas.length > 0 || anotacoes.trim().length > 0;

  /* ====== Card B helpers ====== */

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
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
          prev.map((f) => (f.id === id ? { ...f, status: 'error', errorMsg: e.message } : f)),
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const removerFonte = (id: string) =>
    setFontes((prev) => prev.filter((f) => f.id !== id));

  const renomearFonte = (id: string, label: string) =>
    setFontes((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));

  /* ====== Gerar ====== */

  const gerarDiagnostico = () => {
    gerar.mutate(
      {
        tipo: 'diagnostico',
        cliente_id: clienteId,
        questionario_data: (questionario?.respostas as Record<string, unknown>) ?? null,
        transcricoes_textos: transcricoesProntas.map((f) => ({
          label: f.label, conteudo: f.conteudo!,
        })),
        anotacoes_consultor: anotacoes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Diagnóstico gerado.');
        },
      },
    );
  };

  const gerarOkrs = () => {
    if (!diagnosticoDoc) return;
    gerar.mutate(
      {
        tipo: 'okrs',
        cliente_id: clienteId,
        contexto_usuario: okrContexto.trim() || undefined,
        trimestre: okrTrimestre,
      },
      { onSuccess: () => toast.success('OKRs gerados.') },
    );
  };

  const gerarClienteOculto = () => {
    gerar.mutate(
      {
        tipo: 'briefing_cliente_oculto',
        cliente_id: clienteId,
        canais_atendimento: coCanais,
        contexto_usuario: coObservacoes.trim() || undefined,
        titulo_doc: `Briefing Cliente Oculto — ${coPersonas} persona(s)`,
      },
      { onSuccess: () => toast.success('Briefing gerado.') },
    );
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
              status={anotacoes.trim() ? 'ok' : 'pending'}
              statusText={anotacoes.trim() ? 'Anotações registradas' : 'Sem anotações'}
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

            {/* Lista de fontes */}
            {fontes.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  Conteúdos a incluir no diagnóstico
                </p>
                {fontes.map((f) => {
                  const Icon = fileIcon(f.meta ?? f.label);
                  return (
                    <div key={f.id} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
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
                      {f.status === 'done' && (
                        <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                          pronto
                        </Badge>
                      )}
                      {f.status === 'error' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="destructive" className="text-[10px]">erro</Badge>
                          </TooltipTrigger>
                          <TooltipContent>{f.errorMsg ?? 'Falha ao processar'}</TooltipContent>
                        </Tooltip>
                      )}
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerFonte(f.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card C — Anotações */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Anotações do consultor</h5>
            <Textarea
              value={anotacoes}
              onChange={(e) => setAnotacoes(e.target.value)}
              rows={4}
              placeholder="Adicione observações da visita presencial, dados levantados in loco, contexto da praça de atuação e qualquer informação relevante não capturada nas gravações."
            />
            <p className="text-[10px] text-muted-foreground">
              Salvo automaticamente no seu navegador para não perder ao navegar.
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
        </PanelAgente>

        {/* OKRs */}
        <PanelAgente
          icon={Target}
          titulo="OKRs"
          existingDoc={okrsDoc}
          versoesAnteriores={documentos?.filter((d) => d.tipo === 'okrs') ?? []}
          onView={(d) => setViewingDoc(d)}
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
        </PanelAgente>

        {/* CLIENTE OCULTO */}
        <PanelAgente
          icon={ClipboardList}
          titulo="Briefing Cliente Oculto"
          existingDoc={lastByTipo.get('briefing_cliente_oculto')}
          versoesAnteriores={documentos?.filter((d) => d.tipo === 'briefing_cliente_oculto') ?? []}
          onView={(d) => setViewingDoc(d)}
          expanded={expandedHistory['briefing_cliente_oculto']}
          onToggleExpand={() =>
            setExpandedHistory((p) => ({ ...p, briefing_cliente_oculto: !p['briefing_cliente_oculto'] }))
          }
          disabled={!okrsDoc}
          disabledTooltip="Gere os OKRs primeiro"
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
                        if (!okrsDoc) return;
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
                    onClick={() => okrsDoc && setCoPersonas(n as 1 | 2)}
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
              disabled={!okrsDoc}
            />
          </div>
          <Button onClick={gerarClienteOculto} disabled={!okrsDoc || isBusy('briefing_cliente_oculto')} className="w-full sm:w-auto">
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

function PanelAgente({
  icon: Icon,
  titulo,
  existingDoc,
  versoesAnteriores,
  onView,
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