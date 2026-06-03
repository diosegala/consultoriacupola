import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useContratos, useContratoAtivo, ContratoComTipo, useDeleteContrato } from '@/hooks/useContratos';
import { format, parseISO } from 'date-fns';
import { ContratoFormDialog, RenovarContratoDialog } from './ClienteDialogs';
import { toast } from 'sonner';

interface ContratoTabProps {
  clienteId: string;
  clienteStatus: string;
  consultorId?: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function ContratoTab({ clienteId, clienteStatus, consultorId }: ContratoTabProps) {
  const { data: contratos, isLoading } = useContratos(clienteId);
  const { data: contratoAtivo } = useContratoAtivo(clienteId);
  const contratoEncerradoComPagamento = contratoAtivo && (contratoAtivo as any).encerrado_em;

  const [showForm, setShowForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState<ContratoComTipo | null>(null);
  const [showRenovar, setShowRenovar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingContrato, setDeletingContrato] = useState<ContratoComTipo | null>(null);
  
  const deleteContrato = useDeleteContrato();

  const handleEdit = (contrato: ContratoComTipo) => {
    setEditingContrato(contrato);
    setShowForm(true);
  };

  const handleNewContrato = () => {
    setEditingContrato(null);
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contrato Ativo */}
      {contratoAtivo ? (
        <Card className="bg-card border-border border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                Contrato Ativo
                {contratoEncerradoComPagamento && (
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    Encerrado — aguardando última parcela
                    {(contratoAtivo as any).data_fim_pagamento && (
                      <> em {format(parseISO((contratoAtivo as any).data_fim_pagamento), 'dd/MM/yyyy')}</>
                    )}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {contratoAtivo.tipo_consultoria?.nome || 'Tipo não definido'}
                {contratoAtivo.momento && ` • ${contratoAtivo.momento}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEdit(contratoAtivo)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRenovar(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Renovar
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setDeletingContrato(contratoAtivo);
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Prazo</p>
                <p className="text-foreground font-medium">{contratoAtivo.prazo_meses} meses</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Início</p>
                <p className="text-foreground font-medium">
                  {format(parseISO(contratoAtivo.data_inicio), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Término</p>
                <p className="text-foreground font-medium">
                  {format(parseISO(contratoAtivo.data_fim), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-primary font-bold text-lg">
                  {formatCurrency(Number(contratoAtivo.remuneracao_mensal))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-foreground font-medium">
                  {formatCurrency(Number(contratoAtivo.remuneracao_total))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Parcelas</p>
                <p className="text-foreground font-medium">{contratoAtivo.parcelas}x</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencimento</p>
                <p className="text-foreground font-medium capitalize">{contratoAtivo.tipo_vencimento}</p>
              </div>
              {contratoAtivo.link_contrato && (
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <a 
                    href={contratoAtivo.link_contrato} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ver contrato
                  </a>
                </div>
              )}
            </div>

            {contratoAtivo.particularidades && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">Particularidades</p>
                <p className="text-foreground">{contratoAtivo.particularidades}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Nenhum contrato ativo</p>
            <Button onClick={handleNewContrato}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Contrato
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Contratos */}
      {contratos && contratos.filter(c => !c.ativo).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Histórico de Contratos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-muted-foreground">Período</TableHead>
                  <TableHead className="text-muted-foreground">Valor Total</TableHead>
                  <TableHead className="text-muted-foreground">MRR</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.filter(c => !c.ativo).map(contrato => (
                  <TableRow key={contrato.id} className="border-border">
                    <TableCell className="text-foreground">
                      {contrato.tipo_consultoria?.nome || '-'}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {format(parseISO(contrato.data_inicio), 'dd/MM/yyyy')} -{' '}
                      {format(parseISO(contrato.data_fim), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {formatCurrency(Number(contrato.remuneracao_total))}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {formatCurrency(Number(contrato.remuneracao_mensal))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Encerrado</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingContrato(contrato);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ContratoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        clienteId={clienteId}
        contrato={editingContrato}
        consultorId={consultorId}
      />

      {contratoAtivo && (
        <RenovarContratoDialog
          open={showRenovar}
          onOpenChange={setShowRenovar}
          clienteId={clienteId}
          contratoAtual={contratoAtivo}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato?
              <br /><br />
              Esta ação irá remover permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>O contrato selecionado</li>
                <li>Pausas associadas ao contrato</li>
                <li>Encerramentos associados</li>
                <li>Onboarding vinculado (se houver)</li>
              </ul>
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingContrato) {
                  deleteContrato.mutate(
                    { contratoId: deletingContrato.id, clienteId },
                    {
                      onSuccess: () => {
                        toast.success('Contrato excluído com sucesso');
                        setDeletingContrato(null);
                      },
                      onError: (error) => {
                        toast.error('Erro ao excluir contrato: ' + error.message);
                      }
                    }
                  );
                }
              }}
              disabled={deleteContrato.isPending}
            >
              {deleteContrato.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
