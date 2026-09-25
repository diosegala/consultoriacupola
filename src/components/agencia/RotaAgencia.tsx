import { Outlet } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemAcessoAgencia } from '@/hooks/agencia/useAgencia';
import { Vazio } from './CabecalhoPagina';

/**
 * Guarda das rotas /agencia/*: só quem tem ficha ativa em agencia.pessoas entra.
 * É cosmética como no CupolaOS original — quem recusa de verdade é o banco (RLS) —,
 * mas evita que alguém da consultoria caia em telas vazias ou com erro.
 */
export function RotaAgencia() {
  const { temAcesso, isLoading } = useTemAcessoAgencia();
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!temAcesso) {
    return <Vazio>Você não tem ficha ativa na Agência. Fale com a administração da agência para liberar o acesso.</Vazio>;
  }
  return <Outlet />;
}
