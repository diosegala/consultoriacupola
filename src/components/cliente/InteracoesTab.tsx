import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, MessageSquare, Phone, Mail, Users, CircleDot } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CANAL_LABEL, CanalInteracao, useDeleteInteracaoCliente, useInteracoesCliente } from '@/hooks/useInteracoesCliente';
import { RegistrarInteracaoDialog } from './RegistrarInteracaoDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  clienteId: string;
  consultorId?: string | null;
}

const CANAL_ICON: Record<CanalInteracao, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageSquare,
  ligacao: Phone,
  email: Mail,
  reuniao_informal: Users,
  outro: CircleDot,
};

const CANAL_COLOR: Record<CanalInteracao, string> = {
  whatsapp: 'bg-green-500/15 text-green-500 border-green-500/30',
  ligacao: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  email: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  reuniao_informal: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  outro: 'bg-muted text-muted-foreground border-border',
};

export function InteracoesTab({ clienteId, consultorId }: Props) {
  const { data: interacoes, isLoading } = useInteracoesCliente(clienteId);
  const del = useDeleteInteracaoCliente();
  const [openForm, setOpenForm] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Interações</h2>
          <p className="text-xs text-muted-foreground">
            Registre contatos informais (WhatsApp, ligação, e-mail). Cada registro atualiza o "último contato" e resolve alertas pendentes.
          </p>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Registrar interação
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !interacoes?.length ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma interação registrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {interacoes.map((i) => {
            const Icon = CANAL_ICON[i.canal];
            return (
              <Card key={i.id} className="bg-card border-border">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`${CANAL_COLOR[i.canal]} flex items-center gap-1`}>
                        <Icon className="h-3 w-3" />
                        {CANAL_LABEL[i.canal]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(i.data_interacao), "dd 'de' MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setToDelete(i.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm font-medium text-foreground">{i.resumo}</p>
                  {i.conteudo && (
                    <div className="rounded-md bg-muted/40 border border-border/40 p-3 text-xs text-foreground whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {i.conteudo}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RegistrarInteracaoDialog
        open={openForm}
        onOpenChange={setOpenForm}
        clienteId={clienteId}
        consultorId={consultorId ?? null}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir interação</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) {
                  del.mutate({ id: toDelete, clienteId });
                  setToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}