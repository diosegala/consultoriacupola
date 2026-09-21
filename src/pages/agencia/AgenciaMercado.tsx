import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, Newspaper, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFontesMercado, useLeituras, useLerFontes } from '@/hooks/agencia/useAgenciaMercado';

export default function AgenciaMercado() {
  const { data: fontes } = useFontesMercado();
  const { data: leituras, isLoading } = useLeituras();
  const { ler, lendo } = useLerFontes();

  const [busca, setBusca] = useState('');
  const [tema, setTema] = useState<string | null>(null);
  const [fonteId, setFonteId] = useState<string | null>(null);

  const nomeDaFonte = (id: string | null) => fontes?.find((f) => f.id === id)?.nome ?? id ?? '';

  const temas = useMemo(() => {
    const todos = new Set<string>();
    (leituras ?? []).forEach((l) => (l.temas ?? []).forEach((t) => todos.add(t)));
    return [...todos].sort();
  }, [leituras]);

  const lista = (leituras ?? []).filter((l) => {
    if (tema && !(l.temas ?? []).includes(tema)) return false;
    if (fonteId && l.fonte_id !== fonteId) return false;
    if (busca.trim()) {
      const t = `${l.titulo} ${l.resumo ?? ''}`.toLowerCase();
      if (!t.includes(busca.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inteligência de mercado</h1>
          <p className="text-sm text-muted-foreground">
            O que saiu no mercado imobiliário, reunido das fontes que a agência acompanha.
          </p>
        </div>
        <Button onClick={() => ler()} disabled={lendo}>
          {lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Buscar notícias novas
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Buscar no texto" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={tema === null ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setTema(null)}
                >
                  Todos os assuntos
                </Badge>
                {temas.map((t) => (
                  <Badge
                    key={t}
                    variant={tema === t ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setTema(tema === t ? null : t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Fontes</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(fontes ?? []).map((f) => (
                <div key={f.id} className={`rounded-md border p-3 ${fonteId === f.id ? 'border-primary' : 'border-border'}`}>
                  <button className="text-left font-medium" onClick={() => setFonteId(fonteId === f.id ? null : f.id)}>
                    {f.nome}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {f.cadencia ?? 'eventual'}
                    {f.feed ? '' : ' · sem feed automático'}
                  </p>
                  {f.ultimo_erro && <p className="mt-1 text-xs text-destructive">{f.ultimo_erro}</p>}
                  {f.feed && (
                    <Button variant="ghost" size="sm" className="mt-1 h-7 px-2" disabled={lendo} onClick={() => ler(f.id)}>
                      Buscar só desta fonte
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && lista.length === 0 && (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <Newspaper className="mx-auto mb-3 h-8 w-8 opacity-50" />
                Nenhuma notícia por aqui ainda. Clique em "Buscar notícias novas".
              </CardContent>
            </Card>
          )}
          {lista.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{l.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {nomeDaFonte(l.fonte_id)}
                      {l.publicado_em ? ` · ${new Date(l.publicado_em).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  {l.link && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={l.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
                {l.resumo && <p className="text-sm text-muted-foreground">{l.resumo}</p>}
                {l.porque && <p className="text-xs text-muted-foreground">Por que entrou: {l.porque}</p>}
                <div className="flex flex-wrap gap-1">
                  {(l.regioes ?? []).map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                  {(l.temas ?? []).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
