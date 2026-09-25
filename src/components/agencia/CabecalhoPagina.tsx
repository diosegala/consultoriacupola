import type { ReactNode } from 'react';

/** Cabeçalho padrão das páginas da Agência: rótulo, título e frase, como no CupolaOS. */
export function CabecalhoPagina({
  rotulo,
  titulo,
  descricao,
  acoes,
}: {
  rotulo: string;
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <h1 className="text-3xl font-bold text-foreground">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </header>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{children}</p>
  );
}
