import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserAvatar, invalidateAvatarCache } from './UserAvatar';
import { Loader2, Trash2, Upload } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAtualizado?: () => void;
}

export function AvatarUploadDialog({ open, onOpenChange, onAtualizado }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [consultor, setConsultor] = useState<{ id: string; nome: string; avatar_url: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: vinculo } = await supabase
        .from('consultor_user')
        .select('consultor_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!vinculo) return setConsultor(null);
      const { data } = await supabase
        .from('consultores')
        .select('id, nome, avatar_url')
        .eq('id', vinculo.consultor_id)
        .maybeSingle();
      setConsultor(data ? { id: data.id, nome: data.nome, avatar_url: data.avatar_url } : null);
    })();
  }, [open, user]);

  const enviar = async (file: File) => {
    if (!user || !consultor) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione uma imagem', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'O limite é 2 MB.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatares').upload(path, file, { upsert: true });
    if (upErr) {
      setSalvando(false);
      toast({ title: 'Falha ao enviar a foto', description: upErr.message, variant: 'destructive' });
      return;
    }
    const anterior = consultor.avatar_url;
    const { error } = await supabase.from('consultores').update({ avatar_url: path }).eq('id', consultor.id);
    setSalvando(false);
    if (error) {
      toast({ title: 'Não foi possível salvar a foto', description: error.message, variant: 'destructive' });
      return;
    }
    if (anterior) {
      invalidateAvatarCache(anterior);
      await supabase.storage.from('avatares').remove([anterior]);
    }
    setConsultor({ ...consultor, avatar_url: path });
    toast({ title: 'Foto atualizada' });
    onAtualizado?.();
  };

  const remover = async () => {
    if (!consultor?.avatar_url) return;
    setSalvando(true);
    const path = consultor.avatar_url;
    await supabase.from('consultores').update({ avatar_url: null }).eq('id', consultor.id);
    await supabase.storage.from('avatares').remove([path]);
    invalidateAvatarCache(path);
    setConsultor({ ...consultor, avatar_url: null });
    setSalvando(false);
    toast({ title: 'Foto removida' });
    onAtualizado?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Minha foto</DialogTitle>
          <DialogDescription>Escolha uma imagem de até 2 MB para aparecer nas conversas.</DialogDescription>
        </DialogHeader>
        {!consultor ? (
          <p className="text-sm text-muted-foreground">
            Seu usuário ainda não está vinculado a um consultor. Peça a um administrador para fazer o vínculo.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2">
            <UserAvatar nome={consultor.nome} avatarPath={consultor.avatar_url} size="lg" className="scale-150 my-3" />
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviar(f);
                e.target.value = '';
              }}
            />
            <div className="flex gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Enviar foto
              </Button>
              {consultor.avatar_url && (
                <Button variant="outline" onClick={remover} disabled={salvando}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
