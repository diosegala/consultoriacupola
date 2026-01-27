import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StatusCliente, ClassificacaoEncerramento } from '@/types/database';

interface StatusBadgeProps {
  status: StatusCliente | ClassificacaoEncerramento;
  className?: string;
}

const statusConfig: Record<StatusCliente | ClassificacaoEncerramento, { label: string; className: string }> = {
  novo: {
    label: 'Novo',
    className: 'bg-info text-info-foreground hover:bg-info/80',
  },
  ativo: {
    label: 'Ativo',
    className: 'bg-success text-success-foreground hover:bg-success/80',
  },
  aguardando_renovacao: {
    label: 'Aguardando Renovação',
    className: 'bg-warning text-warning-foreground hover:bg-warning/80',
  },
  encerrado: {
    label: 'Encerrado',
    className: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
  churn: {
    label: 'Churn',
    className: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
  },
  fim_contrato: {
    label: 'Fim de Contrato',
    className: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
