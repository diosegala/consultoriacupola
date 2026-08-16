import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useDecidirNotificacao } from '@/hooks/useNotificacoes';

const decisaoLabel: Record<string, string> = {
  aprovado: 'Aprovado',
  editado: 'Editado',
  rejeitado: 'Rejeitado',
};

export interface NotificacaoDecidivel {
  id: string;
  descricao?: string | null;
  decisao?: string | null;
  metadata?: Record<string, any> | null;
}

export function NotificacaoDecisao({
  n,
  className,
}: {
  n: NotificacaoDecidivel;
  className?: string;
}) {
  const decidir = useDecidirNotificacao();
  const [modo, setModo] = useState<'idle' | 'editar' | 'rejeitar'>('idle');
  const sugestao = (n.metadata as any)?.mensagem_sugerida ?? n.descricao ?? '';
  const [texto, setTexto] = useState<string>(sugestao);
  const [motivo, setMotivo] = useState('');

  if (n.decisao) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-2">
        {decisaoLabel[n.decisao] ?? n.decisao}
      </Badge>
    );
  }

  if (modo === 'editar') {
    return (
      <div className={`mt-2 space-y-2 ${className ?? ''}`}>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="text-xs"
          placeholder="Mensagem revisada"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!texto.trim() || decidir.isPending}
            onClick={() =>
              decidir.mutate({ id: n.id, decisao: 'editado', decisao_texto: texto.trim() })
            }
          >
            Salvar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setModo('idle')}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (modo === 'rejeitar') {
    return (
      <div className={`mt-2 space-y-2 ${className ?? ''}`}>
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          className="text-xs"
          placeholder="Motivo (ex: não é prioridade agora)"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!motivo.trim() || decidir.isPending}
            onClick={() =>
              decidir.mutate({ id: n.id, decisao: 'rejeitado', decisao_motivo: motivo.trim() })
            }
          >
            Confirmar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setModo('idle')}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? 'mt-2'}`}>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={decidir.isPending}
        onClick={() => decidir.mutate({ id: n.id, decisao: 'aprovado' })}
      >
        <Check className="h-3.5 w-3.5 mr-1" />
        Aprovar
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModo('editar')}>
        <Pencil className="h-3.5 w-3.5 mr-1" />
        Editar
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setModo('rejeitar')}>
        <X className="h-3.5 w-3.5 mr-1" />
        Rejeitar
      </Button>
    </div>
  );
}
