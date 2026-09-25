import { iniciaisDe } from '@/hooks/agencia/useAgenciaCarteira';

export function PessoaLinha({
  nome,
  iniciais,
  imagem,
  detalhe,
}: {
  nome: string;
  iniciais?: string | null;
  imagem?: string | null;
  detalhe?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {imagem ? (
        <img src={imagem} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {iniciaisDe(nome, iniciais)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{nome}</p>
        {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
      </div>
    </div>
  );
}
