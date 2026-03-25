import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Plus, Trash2, MessageSquare, CheckSquare, Video, Send } from 'lucide-react';
import { format, isPast, addDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Projeto } from '@/hooks/useProjetos';
import { useMoverProjeto } from '@/hooks/useProjetos';
import { useProjetoComentarios, useCreateComentario, useDeleteComentario } from '@/hooks/useProjetoComentarios';
import { useProjetoChecklist, useCreateChecklistItem, useToggleChecklistItem, useDeleteChecklistItem } from '@/hooks/useProjetoChecklist';
import { useReunioes } from '@/hooks/useReunioes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProjetoDetalheSheetProps {
  projeto: Projeto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapaNome?: string;
  onRegistrarReuniao: (projeto: Projeto) => void;
}

export function ProjetoDetalheSheet({ projeto, open, onOpenChange, etapaNome, onRegistrarReuniao }: ProjetoDetalheSheetProps) {
  const { user } = useAuth();
  const [novoComentario, setNovoComentario] = useState('');
  const [novoCheckItem, setNovoCheckItem] = useState('');
  const [editingObs, setEditingObs] = useState(false);
  const [obsText, setObsText] = useState('');

  const { data: comentarios } = useProjetoComentarios(projeto?.id);
  const { data: checklist } = useProjetoChecklist(projeto?.id);
  const { data: reunioes } = useReunioes(projeto?.consultor_id);

  const createComentario = useCreateComentario();
  const deleteComentario = useDeleteComentario();
  const createCheckItem = useCreateChecklistItem();
  const toggleCheckItem = useToggleChecklistItem();
  const deleteCheckItem = useDeleteChecklistItem();

  const reunioesDoProjeto = reunioes?.filter(r => r.cliente_id === projeto?.cliente_id) ?? [];

  const handleSaveDueDate = async (date: Date | undefined) => {
    if (!projeto) return;
    const { error } = await supabase
      .from('projetos')
      .update({ due_date: date ? format(date, 'yyyy-MM-dd') : null })
      .eq('id', projeto.id);
    if (error) toast.error('Erro ao salvar data');
    else toast.success('Data limite atualizada');
  };

  const handleSaveObs = async () => {
    if (!projeto) return;
    const { error } = await supabase
      .from('projetos')
      .update({ observacoes: obsText || null })
      .eq('id', projeto.id);
    if (error) toast.error('Erro ao salvar observações');
    else {
      toast.success('Observações salvas');
      setEditingObs(false);
    }
  };

  const handleAddComentario = () => {
    if (!projeto || !user || !novoComentario.trim()) return;
    createComentario.mutate({ projeto_id: projeto.id, user_id: user.id, texto: novoComentario.trim() });
    setNovoComentario('');
  };

  const handleAddCheckItem = () => {
    if (!projeto || !novoCheckItem.trim()) return;
    createCheckItem.mutate({ projeto_id: projeto.id, titulo: novoCheckItem.trim(), ordem: (checklist?.length ?? 0) });
    setNovoCheckItem('');
  };

  const checklistDone = checklist?.filter(c => c.concluido).length ?? 0;
  const checklistTotal = checklist?.length ?? 0;

  if (!projeto) return null;

  const dueDate = (projeto as any).due_date ? new Date((projeto as any).due_date + 'T00:00:00') : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg">{projeto.clientes?.nome ?? 'Projeto'}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {etapaNome && <Badge variant="outline">{etapaNome}</Badge>}
            {projeto.consultores?.nome && <Badge variant="secondary">{projeto.consultores.nome}</Badge>}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Due Date */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" /> Data Limite
              </h4>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(
                    "justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground",
                    dueDate && isPast(dueDate) && "text-destructive border-destructive"
                  )}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Definir data limite"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleSaveDueDate}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Separator />

            {/* Observações */}
            <div>
              <h4 className="text-sm font-medium mb-2">Observações</h4>
              {editingObs ? (
                <div className="space-y-2">
                  <Textarea value={obsText} onChange={e => setObsText(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveObs}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingObs(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground min-h-[2rem]"
                  onClick={() => { setObsText(projeto.observacoes ?? ''); setEditingObs(true); }}
                >
                  {projeto.observacoes || 'Clique para adicionar observações...'}
                </p>
              )}
            </div>

            <Separator />

            {/* Checklist */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <CheckSquare className="h-4 w-4" />
                Checklist {checklistTotal > 0 && `(${checklistDone}/${checklistTotal})`}
              </h4>
              <div className="space-y-1.5">
                {checklist?.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.concluido}
                      onCheckedChange={(checked) =>
                        toggleCheckItem.mutate({ id: item.id, concluido: !!checked, projeto_id: projeto.id })
                      }
                    />
                    <span className={cn("text-sm flex-1", item.concluido && "line-through text-muted-foreground")}>
                      {item.titulo}
                    </span>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteCheckItem.mutate({ id: item.id, projeto_id: projeto.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Novo item..."
                  value={novoCheckItem}
                  onChange={e => setNovoCheckItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCheckItem()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="ghost" onClick={handleAddCheckItem} className="h-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Reuniões */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <Video className="h-4 w-4" /> Reuniões ({reunioesDoProjeto.length})
                </h4>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRegistrarReuniao(projeto)}>
                  <Plus className="h-3 w-3 mr-1" /> Nova
                </Button>
              </div>
              <div className="space-y-2">
                {reunioesDoProjeto.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma reunião registrada.</p>
                )}
                {reunioesDoProjeto.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                    <span>{format(new Date(r.data_reuniao), 'dd/MM/yyyy')}</span>
                    {r.score_ia != null && (
                      <Badge variant={r.score_ia >= 7 ? 'default' : r.score_ia >= 5 ? 'secondary' : 'destructive'} className="text-xs">
                        Score: {Number(r.score_ia).toFixed(1)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {r.status_analise === 'concluida' ? 'Analisada' : r.status_analise === 'pendente' ? 'Pendente' : r.status_analise}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Comentários */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> Comentários ({comentarios?.length ?? 0})
              </h4>
              <div className="space-y-2">
                {comentarios?.map(c => (
                  <div key={c.id} className="p-2 rounded-md bg-muted/50 group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                      <Button
                        variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteComentario.mutate({ id: c.id, projeto_id: projeto.id })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm mt-1">{c.texto}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Adicionar comentário..."
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComentario()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="ghost" onClick={handleAddComentario} className="h-8">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
