import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Bot, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useAgenciaAgentes, useAgenciaClientes, useAgenciaPessoas, useTemAcessoAgencia } from '@/hooks/agencia/useAgencia';
import { useAcoesDaSessao, useAgenciaSessoes, quandoFoi, type AgenciaSessao } from '@/hooks/agencia/useAgenciaBase';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';
import { cn } from '@/lib/utils';

export default function AgenciaSessoes() {
  const { pessoa } = useTemAcessoAgencia();
  const [arquivadas, setArquivadas] = useState(false);
  const { data: sessoes = [], isLoading } = useAgenciaSessoes(arquivadas);
  const { data: agentes = [] } = useAgenciaAgentes(true);
  const { data: pessoas = [] } = useAgenciaPessoas();
  const { data: clientes = [] } = useAgenciaClientes();
  const acoes = useAcoesDaSessao();
  const [renomeando, setRenomeando] = useState<AgenciaSessao | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [excluindo, setExcluindo] = useState<AgenciaSessao | null>(null);

  const lista = [...sessoes].sort((a, b) => Number(!!b.fixada) - Number(!!a.fixada));

  const executar = async (acao: () => Promise<void>, ok: string) => {
    try {
      await acao();
      toast.success(ok);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível concluir.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CabecalhoPagina rotulo="Histórico" titulo="Sessões" descricao="As suas e as da equipe, nos espaços que você acompanha." />
      <div className="flex gap-2">
        {[
          { valor: false, rotulo: 'Em uso' },
          { valor: true, rotulo: 'Arquivadas' },
        ].map((f) => (
          <button
            key={String(f.valor)}
            onClick={() => setArquivadas(f.valor)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              arquivadas === f.valor ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : lista.length === 0 ? (
        <Vazio>{arquivadas ? 'Nenhuma sessão arquivada.' : 'Nenhuma sessão ainda. Escolha um agente para começar.'}</Vazio>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {lista.map((s) => {
            const agente = agentes.find((a) => a.id === s.agente_id);
            const autor = pessoas.find((p) => p.id === s.pessoa_id);
            const conta = clientes.find((c) => c.id === s.cliente_id);
            const minha = !!pessoa && s.pessoa_id === pessoa.id;
            return (
              <div key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted">
                <Link to={`/agencia/sessoes/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {s.titulo}
                      {s.subtitulo && <span className="font-normal text-muted-foreground"> · {s.subtitulo}</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {minha ? 'Você' : (autor?.nome ?? 'Alguém')}
                      {agente && ` · ${agente.nome}`}
                      {conta && ` · ${conta.nome}`}
                    </span>
                  </span>
                  {s.fixada && <Pin className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                  <span className={cn(!s.fixada && 'ml-auto', 'shrink-0 font-mono text-xs text-muted-foreground')}>
                    {quandoFoi(s.atualizada_em)}
                  </span>
                </Link>
                {minha && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Ações da sessão">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => executar(() => acoes.fixar(s.id, !s.fixada), s.fixada ? 'Sessão desafixada.' : 'Sessão fixada.')}>
                        {s.fixada ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                        {s.fixada ? 'Desafixar' : 'Fixar no topo'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setNovoTitulo(s.titulo); setRenomeando(s); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => executar(() => acoes.arquivar(s.id, !s.arquivada), s.arquivada ? 'Sessão de volta ao histórico.' : 'Sessão arquivada.')}>
                        {s.arquivada ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                        {s.arquivada ? 'Desarquivar' : 'Arquivar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setExcluindo(s)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!renomeando} onOpenChange={(aberto) => !aberto && setRenomeando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear sessão</DialogTitle>
          </DialogHeader>
          <Input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} maxLength={120} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomeando(null)}>Cancelar</Button>
            <Button
              disabled={!novoTitulo.trim()}
              onClick={async () => {
                const s = renomeando!;
                setRenomeando(null);
                await executar(() => acoes.renomear(s.id, novoTitulo), 'Sessão renomeada.');
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa “{excluindo?.titulo}” e todas as mensagens dela serão apagadas. Não dá para desfazer — se quiser só tirar da lista, arquive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => executar(() => acoes.excluir(excluindo!.id), 'Sessão excluída.')}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
