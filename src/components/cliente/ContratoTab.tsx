import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, RefreshCw } from 'lucide-react';
import { useContratos, useContratoAtivo, ContratoComTipo } from '@/hooks/useContratos';
import { format, parseISO } from 'date-fns';
import { ContratoFormDialog, RenovarContratoDialog } from './ClienteDialogs';

interface ContratoTabProps {
  clienteId: string;
  clienteStatus: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function ContratoTab({ clienteId, clienteStatus }: ContratoTabProps) {
  const { data: contratos, isLoading } = useContratos(clienteId);
  const { data: contratoAtivo } = useContratoAtivo(clienteId);

  const [showForm, setShowForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState<ContratoComTipo | null>(null);
  const [showRenovar, setShowRenovar] = useState(false);

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
              <CardTitle className="text-foreground">Contrato Ativo</CardTitle>
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
      />

      {contratoAtivo && (
        <RenovarContratoDialog
          open={showRenovar}
          onOpenChange={setShowRenovar}
          clienteId={clienteId}
          contratoAtual={contratoAtivo}
        />
      )}
    </div>
  );
}
