import { useMemo, useState } from 'react';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, ExternalLink, Loader2, CheckCircle2, XCircle, Clock, Sparkles, User } from 'lucide-react';
import {
  useCompromissos,
  useCriarCompromisso,
  useAtualizarStatusCompromisso,
  useRemoverCompromisso,
  type Compromisso,
  type CompromissoStatus,
  type CompromissoResponsavel,
} from '@/hooks/useCompromissos';

const STATUS_LABEL: Record<CompromissoStatus, string> = {
  pendente: 'Pendentes',
  concluido: 'Concluídos',
  cancelado: 'Cancelados',
  adiado: 'Adiados',
};

const STATUS_ORDER: CompromissoStatus[] = ['pendente', 'adiado', 'concluido', 'cancelado'];

function StatusIcon({ status }: { status: CompromissoStatus }) {
  if (status === 'concluido') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === 'cancelado') return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === 'adiado') return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  return <Clock className="h-3.5 w-3.5 text-primary" />;
}

export function CompromissosTab({ clienteId }: { clienteId: string }) {
  const { data: compromissos, isLoading } = useCompromissos(clienteId);
  const criar = useCriarCompromisso();
  const atualizar = useAtualizarStatusCompromisso();
  const remover = useRemoverCompromisso();

  const [filtroResp, setFiltroResp] = useState<'todos' | CompromissoResponsavel>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoResp, setNovoResp] = useState<CompromissoResponsavel>('cliente');
  const [novoPrazo, setNovoPrazo] = useState('');

  const filtrados = useMemo(() => {
    const lista = compromissos ?? [];
    if (filtroResp === 'todos') return lista;
    return lista.filter((c) => c.responsavel === filtroResp);
  }, [compromissos, filtroResp]);

  const porStatus = useMemo(() => {
    const map = new Map<CompromissoStatus, Compromisso[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const c of filtrados) map.get(c.status)?.push(c);
    return map;
  }, [filtrados]);

  const salvarNovo = () => {
    if (!novaDescricao.trim()) return;
    criar.mutate(
      {
        cliente_id: clienteId,
        descricao: novaDescricao,
        responsavel: novoResp,
        prazo: novoPrazo || null,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNovaDescricao('');
          setNovoPrazo('');
          setNovoResp('cliente');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Compromissos</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtroResp} onValueChange={(v) => setFiltroResp(v as any)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="consultor">Consultor</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar compromisso
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (compromissos?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum compromisso registrado ainda. Ao analisar uma reunião, a IA extrai automaticamente os compromissos assumidos.
            </p>
          ) : (
            STATUS_ORDER.map((status) => {
              const items = porStatus.get(status) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <h3 className="text-sm font-medium text-foreground">
                      {STATUS_LABEL[status]} <span className="text-muted-foreground font-normal">({items.length})</span>
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {items.map((c) => (
                      <CompromissoRow
                        key={c.id}
                        c={c}
                        onStatus={(novo) => atualizar.mutate({ id: c.id, status: novo, cliente_id: clienteId })}
                        onRemove={() => remover.mutate({ id: c.id, cliente_id: clienteId })}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo compromisso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Ex.: Enviar planilha de fluxo de caixa até sexta"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={novoResp} onValueChange={(v) => setNovoResp(v as CompromissoResponsavel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prazo">Prazo (opcional)</Label>
                <Input id="prazo" type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={!novaDescricao.trim() || criar.isPending}>
              {criar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompromissoRow({
  c,
  onStatus,
  onRemove,
}: {
  c: Compromisso;
  onStatus: (s: CompromissoStatus) => void;
  onRemove: () => void;
}) {
  const prazo = c.prazo ? parseISO(c.prazo) : null;
  const vencido = prazo && c.status === 'pendente' && isPast(prazo) && prazo.toDateString() !== new Date().toDateString();
  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground leading-snug flex-1">{c.descricao}</p>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onRemove} title="Remover">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <User className="h-3 w-3" />
          {c.responsavel === 'cliente' ? 'Cliente' : 'Consultor'}
        </Badge>
        {prazo && (
          <Badge
            variant="outline"
            className={vencido ? 'text-destructive border-destructive/40' : 'text-muted-foreground'}
          >
            {vencido ? 'Vencido em ' : 'Prazo: '}
            {format(prazo, "dd/MM/yyyy", { locale: ptBR })}
          </Badge>
        )}
        {c.origem === 'ia' && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Sparkles className="h-3 w-3" /> IA
          </Badge>
        )}
        {c.reunioes?.id && (
          <Link
            to={`/reunioes?reuniao=${c.reunioes.id}`}
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Reunião de {format(parseISO(c.reunioes.data_reuniao), 'dd/MM/yyyy')}
          </Link>
        )}
        <div className="ml-auto">
          <Select value={c.status} onValueChange={(v) => onStatus(v as CompromissoStatus)}>
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="adiado">Adiado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}