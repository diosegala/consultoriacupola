import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, RotateCw, Trash2 } from 'lucide-react';
import { ReuniaoComDetalhes, useAnalisarReuniao, useDeleteReuniao } from '@/hooks/useReunioes';
import { ReuniaoAnalise } from './ReuniaoAnalise';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReunioesListProps {
  reunioes: ReuniaoComDetalhes[] | undefined;
  isLoading: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'bg-success text-success-foreground';
  if (score >= 6) return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'concluido':
      return <Badge className="bg-success text-success-foreground">Concluído</Badge>;
    case 'analisando':
      return <Badge className="bg-warning text-warning-foreground">Analisando...</Badge>;
    case 'erro':
      return <Badge className="bg-destructive text-destructive-foreground">Erro</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground">Pendente</Badge>;
  }
}

export function ReunioesList({ reunioes, isLoading }: ReunioesListProps) {
  const { toast } = useToast();
  const [selectedReuniao, setSelectedReuniao] = useState<ReuniaoComDetalhes | null>(null);
  const analisarReuniao = useAnalisarReuniao();
  const deleteReuniao = useDeleteReuniao();

  const handleReanalizar = async (reuniaoId: string) => {
    try {
      await analisarReuniao.mutateAsync(reuniaoId);
      toast({ title: 'Análise concluída' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (reuniaoId: string) => {
    try {
      await deleteReuniao.mutateAsync(reuniaoId);
      toast({ title: 'Reunião excluída' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!reunioes?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma reunião registrada
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Data</TableHead>
            <TableHead className="text-muted-foreground">Cliente</TableHead>
            <TableHead className="text-muted-foreground text-center">Duração</TableHead>
            <TableHead className="text-muted-foreground text-center">Score</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reunioes.map(reuniao => (
            <TableRow key={reuniao.id} className="border-border">
              <TableCell className="text-foreground">
                {format(parseISO(reuniao.data_reuniao), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
              <TableCell className="text-foreground font-medium">
                {reuniao.clientes?.nome || '-'}
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {reuniao.duracao_minutos ? `${reuniao.duracao_minutos}min` : '-'}
              </TableCell>
              <TableCell className="text-center">
                {reuniao.score_ia != null ? (
                  <Badge className={getScoreColor(reuniao.score_ia)}>
                    {reuniao.score_ia.toFixed(1)}
                  </Badge>
                ) : '-'}
              </TableCell>
              <TableCell>{getStatusBadge(reuniao.status_analise)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  {reuniao.status_analise === 'concluido' && (
                    <Button variant="ghost" size="icon" onClick={() => setSelectedReuniao(reuniao)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {(reuniao.status_analise === 'erro' || reuniao.status_analise === 'pendente') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReanalizar(reuniao.id)}
                      disabled={analisarReuniao.isPending}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(reuniao.id)}
                    disabled={deleteReuniao.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ReuniaoAnalise
        reuniao={selectedReuniao}
        open={!!selectedReuniao}
        onOpenChange={(open) => !open && setSelectedReuniao(null)}
      />
    </>
  );
}
