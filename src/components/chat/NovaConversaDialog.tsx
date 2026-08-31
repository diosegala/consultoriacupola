import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { criarConversaDireta, criarGrupo, useChatDiretorio } from '@/hooks/useChat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Users, User } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriada: (conversaId: string) => void;
}

export function NovaConversaDialog({ open, onOpenChange, onCriada }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const diretorio = useChatDiretorio();
  const [modo, setModo] = useState<'direta' | 'grupo'>('direta');
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const outros = useMemo(() => diretorio.filter((u) => u.user_id !== user?.id), [diretorio, user]);

  const toggle = (uid: string) => {
    setSelecionados((cur) => {
      const next = new Set(cur);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const iniciarDireta = async (uid: string) => {
    if (!user || salvando) return;
    setSalvando(true);
    const { id, error } = await criarConversaDireta(user.id, uid);
    setSalvando(false);
    if (error || !id) {
      toast({ title: 'Erro ao criar conversa', description: error, variant: 'destructive' });
      return;
    }
    onCriada(id);
    onOpenChange(false);
  };

  const iniciarGrupo = async () => {
    if (!user || salvando) return;
    setSalvando(true);
    const { id, error } = await criarGrupo(user.id, nomeGrupo, [...selecionados]);
    setSalvando(false);
    if (error || !id) {
      toast({ title: 'Erro ao criar grupo', description: error, variant: 'destructive' });
      return;
    }
    setNomeGrupo('');
    setSelecionados(new Set());
    onCriada(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button variant={modo === 'direta' ? 'default' : 'outline'} size="sm" onClick={() => setModo('direta')}>
            <User className="h-4 w-4 mr-1" /> Direta
          </Button>
          <Button variant={modo === 'grupo' ? 'default' : 'outline'} size="sm" onClick={() => setModo('grupo')}>
            <Users className="h-4 w-4 mr-1" /> Grupo
          </Button>
        </div>

        {modo === 'grupo' && (
          <Input
            placeholder="Nome do grupo"
            value={nomeGrupo}
            onChange={(e) => setNomeGrupo(e.target.value)}
            className="mb-3"
          />
        )}

        <div className="max-h-72 overflow-y-auto space-y-1">
          {outros.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum usuário disponível.</p>}
          {outros.map((u) =>
            modo === 'direta' ? (
              <button
                key={u.user_id}
                onClick={() => iniciarDireta(u.user_id)}
                disabled={salvando}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm text-foreground"
              >
                {u.nome}
              </button>
            ) : (
              <label key={u.user_id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent cursor-pointer text-sm text-foreground">
                <Checkbox checked={selecionados.has(u.user_id)} onCheckedChange={() => toggle(u.user_id)} />
                {u.nome}
              </label>
            )
          )}
        </div>

        {modo === 'grupo' && (
          <Button onClick={iniciarGrupo} disabled={salvando || !nomeGrupo.trim() || selecionados.size === 0} className="mt-3 w-full">
            Criar grupo ({selecionados.size} {selecionados.size === 1 ? 'membro' : 'membros'})
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
