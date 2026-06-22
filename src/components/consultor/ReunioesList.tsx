import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, RotateCw, Trash2, ExternalLink } from 'lucide-react';
import { ReuniaoComDetalhes, useAnalisarReuniao, useDeleteReuniao } from '@/hooks/useReunioes';
import { ReuniaoAnalise } from './ReuniaoAnalise';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUserRole } from '@/hooks/useUserRoles';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReunioesListProps {
  reunioes: ReuniaoComDetalhes[] | undefined;
  isLoading: boolean;
  /** Hide "Cliente" column (when already scoped to a cliente). */
  hideClienteColumn?: boolean;
  /** Show "Consultor" column instead. */
  showConsultorColumn?: boolean;
  /** Make cliente name a link to /clientes/:id. */
  linkCliente?: boolean;
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

export function ReunioesList({
  reunioes,
  isLoading,
  hideClienteColumn = false,
  showConsultorColumn = false,
  linkCliente = false,
}: ReunioesListProps) {
  const { toast } = useToast();
  const [selectedReuniao, setSelectedReuniao] = useState<ReuniaoComDetalhes | null>(null);
  const analisarReuniao = useAnalisarReuniao();
  const deleteReuniao = useDeleteReuniao();
  const { data: role } = useCurrentUserRole();
  const isAdmin = role === 'admin' || role === 'diretor';

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
            {!hideClienteColumn && (
              <TableHead className="text-muted-foreground">Cliente</TableHead>
            )}
            {showConsultorColumn && (
              <TableHead className="text-muted-foreground">Consultor</TableHead>
            )}
            <TableHead className="text-muted-foreground text-center">Duração</TableHead>
            <TableHead className="text-muted-foreground text-center">Score</TableHead>
            <TableHead className="text-muted-foreground">Origem</TableHead>
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
              {!hideClienteColumn && (
                <TableCell className="text-foreground font-medium">
                  {linkCliente && reuniao.cliente_id ? (
                    <Link
                      to={`/clientes/${reuniao.cliente_id}`}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {reuniao.clientes?.nome || '-'}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    reuniao.clientes?.nome || '-'
                  )}
                </TableCell>
              )}
              {showConsultorColumn && (
                <TableCell className="text-foreground">
                  {reuniao.consultores?.nome || '-'}
                </TableCell>
              )}
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
              <TableCell>
                {(reuniao as any).origem === 'drive' ? (
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    Google Drive
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    Manual
                  </Badge>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(reuniao.status_analise)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  {reuniao.status_analise === 'concluido' && (
                    <Button variant="ghost" size="icon" onClick={() => setSelectedReuniao(reuniao)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (reuniao.status_analise === 'erro' || reuniao.status_analise === 'pendente' || reuniao.status_analise === 'concluido') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReanalizar(reuniao.id)}
                      disabled={analisarReuniao.isPending}
                      title="Re-analisar (admin)"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(reuniao.id)}
                      disabled={deleteReuniao.isPending}
                      title="Excluir (admin)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
