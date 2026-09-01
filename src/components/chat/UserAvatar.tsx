import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// cache de URLs assinadas (bucket privado) por caminho
const cache = new Map<string, { url: string; exp: number }>();

export async function signedAvatarUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from('avatares').createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function invalidateAvatarCache(path: string) {
  cache.delete(path);
}

export function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

interface Props {
  nome: string;
  avatarPath?: string | null;
  online?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };

export function UserAvatar({ nome, avatarPath, online, size = 'md', className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (avatarPath) {
      signedAvatarUrl(avatarPath).then((u) => ativo && setUrl(u));
    } else {
      setUrl(null);
    }
    return () => {
      ativo = false;
    };
  }, [avatarPath]);

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <Avatar className={sizes[size]}>
        {url && <AvatarImage src={url} alt={`Foto de ${nome}`} />}
        <AvatarFallback className="bg-muted text-muted-foreground">{iniciais(nome || '?')}</AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background',
            size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
            online ? 'bg-primary' : 'bg-muted-foreground/40'
          )}
          title={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
