import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConsultores } from '@/hooks/useConsultores';
import { useAuthUsers } from '@/hooks/useUserRoles';
import { useAuth } from '@/contexts/AuthContext';
import {
  useConsultorUsers, useCreateConsultorUser, useDeleteConsultorUser,
} from '@/hooks/useConsultorUser';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VincularConsultorDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { data: consultores } = useConsultores();
  const { data: authUsers } = useAuthUsers({ enabled: open && isAdmin });
  const { data: vinculos, isLoading } = useConsultorUsers();
  const createLink = useCreateConsultorUser();
  const deleteLink = useDeleteConsultorUser();

  const [userId, setUserId] = useState('');
  const [consultorId, setConsultorId] = useState('');

  // Users already linked
  const linkedUserIds = new Set((vinculos ?? []).map((v) => v.user_id));
  const availableUsers = (authUsers ?? []).filter((u) => !linkedUserIds.has(u.id));

  const handleAdd = async () => {
    if (!userId || !consultorId) {
      toast({ title: 'Erro', description: 'Selecione usuário e consultor', variant: 'destructive' });
      return;
    }
    try {
      await createLink.mutateAsync({ userId, consultorId });
      toast({ title: 'Sucesso', description: 'Consultor vinculado com sucesso' });
      setUserId('');
      setConsultorId('');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLink.mutateAsync(id);
      toast({ title: 'Sucesso', description: 'Vínculo removido' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular Consultores a Usuários</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {consultores?.filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={createLink.isPending} size="sm">
            {createLink.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular
          </Button>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : vinculos && vinculos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Usuário</TableHead>
                  <TableHead className="text-muted-foreground">Consultor</TableHead>
                  <TableHead className="text-muted-foreground w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vinculos.map((v) => (
                  <TableRow key={v.id} className="border-border">
                    <TableCell className="text-foreground text-sm">
                      {authUsers?.find((u) => u.id === v.user_id)?.email ?? v.user_id}
                    </TableCell>
                    <TableCell className="text-foreground text-sm">{v.consultores?.nome}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                        onClick={() => handleDelete(v.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum vínculo configurado</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
