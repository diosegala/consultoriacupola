import { useState } from 'react';
import { AlertTriangle, Loader2, Star, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ProjetoDocumento } from '@/hooks/useProjetoDocumentos';
import { useGerarDocumento } from '@/hooks/useProjetoDocumentos';
import {
  MARCADORES_FEEDBACK,
  useFeedbacksDocumento,
  useSalvarFeedback,
  useMarcarComoExemplo,
} from '@/hooks/useAgenteFeedback';

export function DocumentoFeedback({ doc }: { doc: ProjetoDocumento }) {
  const { isAdmin } = useAuth();
  const { data: feedbacks } = useFeedbacksDocumento(doc.id);
  const salvar = useSalvarFeedback();
  const marcarExemplo = useMarcarComoExemplo();
  const gerar = useGerarDocumento();

  const [nota, setNota] = useState<number>(0);
  const [marcadores, setMarcadores] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [aberto, setAberto] = useState(false);

  const jaAvaliado = (feedbacks?.length ?? 0) > 0;

  const toggleMarcador = (m: string) =>
    setMarcadores((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const enviar = () => {
    if (!nota) return;
    salvar.mutate(
      {
        documento_id: doc.id,
        tipo_agente: doc.tipo,
        cliente_id: doc.cliente_id,
        nota,
        marcadores,
        comentario,
      },
      {
        onSuccess: () => {
          setAberto(false);
          setNota(0);
          setMarcadores([]);
          setComentario('');
        },
      },
    );
  };

  const continuar = () => {
    gerar.mutate({
      tipo: doc.tipo,
      ...(doc.projeto_id ? { projeto_id: doc.projeto_id } : { cliente_id: doc.cliente_id ?? undefined }),
      continuar_documento_id: doc.id,
    });
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
      {doc.truncado && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Este documento pode ter sido interrompido antes de concluir todas as seções.
          </p>
          <Button size="sm" variant="outline" onClick={continuar} disabled={gerar.isPending}>
            {gerar.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Continuando…</>
            ) : (
              'Continuar geração'
            )}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {jaAvaliado ? 'Documento já avaliado' : 'Como ficou este documento?'}
          </span>
          {doc.aprovado_como_exemplo && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Award className="h-3 w-3" /> Referência aprovada
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAberto((v) => !v)}>
            {aberto ? 'Fechar' : jaAvaliado ? 'Avaliar novamente' : 'Avaliar'}
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={marcarExemplo.isPending}
              onClick={() => marcarExemplo.mutate({ documento_id: doc.id, aprovado: !doc.aprovado_como_exemplo })}
            >
              {doc.aprovado_como_exemplo ? 'Remover referência' : 'Marcar como referência'}
            </Button>
          )}
        </div>
      </div>

      {aberto && (
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setNota(n)} aria-label={`Nota ${n}`}>
                <Star
                  className={`h-5 w-5 ${n <= nota ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MARCADORES_FEEDBACK.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMarcador(m)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  marcadores.includes(m)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="O que faltou ou o que ficou bom? (opcional, mas ajuda muito o agente a evoluir)"
            className="text-sm"
            rows={3}
          />
          <Button size="sm" onClick={enviar} disabled={!nota || salvar.isPending}>
            {salvar.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Enviando…</> : 'Enviar feedback'}
          </Button>
        </div>
      )}
    </div>
  );
}
