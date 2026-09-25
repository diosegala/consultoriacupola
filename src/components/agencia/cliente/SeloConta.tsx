import { cn } from '@/lib/utils';
import { siglaDe } from '@/hooks/agencia/useAgenciaCarteira';
import type { AgenciaCliente } from '@/hooks/agencia/useAgencia';

const TAMANHOS = {
  sm: 'h-10 w-10 text-xs rounded-xl',
  md: 'h-14 w-14 text-sm rounded-2xl',
  lg: 'h-14 w-14 text-sm rounded-2xl',
};

/** Selo da conta: logotipo quando houver, senão a sigla na cor da marca do cliente. */
export function SeloConta({
  cliente,
  logoUrl,
  tamanho = 'md',
}: {
  cliente: Pick<AgenciaCliente, 'nome' | 'sigla' | 'cor'>;
  logoUrl?: string | null;
  tamanho?: keyof typeof TAMANHOS;
}) {
  if (logoUrl) {
    return (
      <div className={cn('flex shrink-0 items-center justify-center overflow-hidden border border-border bg-card p-2', TAMANHOS[tamanho])}>
        <img src={logoUrl} alt={`Logotipo da ${cliente.nome}`} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold',
        cliente.cor ? 'text-background' : 'bg-primary text-primary-foreground',
        TAMANHOS[tamanho],
      )}
      style={cliente.cor ? { backgroundColor: cliente.cor } : undefined}
    >
      {siglaDe(cliente)}
    </div>
  );
}
