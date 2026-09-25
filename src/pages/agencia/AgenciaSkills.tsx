import { useMemo, useState } from 'react';
import { KeyRound, Sparkles } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input,
} from '@/design-system/design-system-hub-ba3841';
import { useAgenciaSkills, type AgenciaSkill } from '@/hooks/agencia/useAgenciaBase';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';
import { cn } from '@/lib/utils';

export default function AgenciaSkills() {
  const { data: skills = [], isLoading } = useAgenciaSkills();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [aberta, setAberta] = useState<AgenciaSkill | null>(null);

  const categorias = useMemo(
    () => Array.from(new Set(skills.map((s) => s.categoria).filter(Boolean))) as string[],
    [skills],
  );
  const termo = busca.trim().toLowerCase();
  const visiveis = skills.filter(
    (s) =>
      (categoria === 'todas' || s.categoria === categoria) &&
      (!termo || `${s.nome} ${s.descricao ?? ''}`.toLowerCase().includes(termo)),
  );

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        rotulo="Biblioteca"
        titulo="CupoSkills"
        descricao="Habilidades prontas que os agentes usam: instruções, modelos e passos que a equipe repete."
      />
      <div className="flex flex-wrap items-center gap-2">
        {['todas', ...categorias].map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              categoria === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {c === 'todas' ? 'Todas' : c}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-72">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar skill" />
        </div>
      </div>

      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : visiveis.length === 0 ? (
        <Vazio>
          {skills.length === 0
            ? 'Nenhuma skill cadastrada ainda. Elas vieram vazias na exportação do CupolaOS.'
            : 'Nenhuma skill com esse filtro.'}
        </Vazio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((s) => (
            <button
              key={s.id}
              onClick={() => setAberta(s)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{s.nome}</span>
              </div>
              {s.descricao && <p className="line-clamp-2 text-sm text-muted-foreground">{s.descricao}</p>}
              <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                {s.categoria && <span>{s.categoria}</span>}
                <span>{s.usos ?? 0} usos</span>
                {!!s.requer_chaves?.length && (
                  <span className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> requer chave</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{aberta?.nome}</DialogTitle>
            {aberta?.descricao && <DialogDescription>{aberta.descricao}</DialogDescription>}
          </DialogHeader>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm text-foreground">
            {aberta?.corpo || 'Sem conteúdo.'}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
