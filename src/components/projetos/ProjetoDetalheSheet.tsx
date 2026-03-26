import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { CalendarIcon, Plus, Trash2, MessageSquare, CheckSquare, Video, Send, Tag, X } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type { Projeto } from '@/hooks/useProjetos';
import { useProjetoComentarios, useCreateComentario, useDeleteComentario } from '@/hooks/useProjetoComentarios';
import { useProjetoChecklist, useCreateChecklistItem, useToggleChecklistItem, useDeleteChecklistItem, useUpdateChecklistItem } from '@/hooks/useProjetoChecklist';
import { useConsultores } from '@/hooks/useConsultores';
import { useReunioesByConsultor } from '@/hooks/useReunioes';
import { useProjetoTags, useProjetoTagVinculos, useAddTagToProjeto, useRemoveTagFromProjeto, useCreateTag, TAG_COLORS } from '@/hooks/useProjetoTags';
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
  const queryClient = useQueryClient();
  const [novoComentario, setNovoComentario] = useState('');
  const [novoCheckItem, setNovoCheckItem] = useState('');
  const [editingObs, setEditingObs] = useState(false);
  const [obsText, setObsText] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const { data: comentarios } = useProjetoComentarios(projeto?.id);
  const { data: checklist } = useProjetoChecklist(projeto?.id);
  const { data: reunioes } = useReunioesByConsultor(projeto?.consultor_id);
  const { data: allTags } = useProjetoTags();
  const { data: tagVinculos } = useProjetoTagVinculos(projeto?.id);

  const createComentario = useCreateComentario();
  const deleteComentario = useDeleteComentario();
  const createCheckItem = useCreateChecklistItem();
  const toggleCheckItem = useToggleChecklistItem();
  const deleteCheckItem = useDeleteChecklistItem();
  const updateCheckItem = useUpdateChecklistItem();
  const { data: consultoresList } = useConsultores();
  const addTag = useAddTagToProjeto();
  const removeTag = useRemoveTagFromProjeto();
  const createTag = useCreateTag();

  const reunioesDoProjeto = reunioes?.filter(r => r.cliente_id === projeto?.cliente_id) ?? [];
  const linkedTagIds = new Set(tagVinculos?.map(v => v.tag_id) ?? []);

  const handleSaveDueDate = async (date: Date | undefined) => {
    if (!projeto) return;
    const { error } = await supabase
      .from('projetos')
      .update({
        due_date: date ? format(date, 'yyyy-MM-dd') : null,
        due_date_start: null,
      })
      .eq('id', projeto.id);
    if (error) toast.error('Erro ao salvar data');
    else {
      toast.success('Data limite atualizada');
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
    }
  };

  const handleSaveObs = async () => {
    if (!projeto) return;
    const { error } = await supabase
      .from('projetos')
      .update({ observacoes: obsText || null })
      .eq('id', projeto.id);
    if (error) toast.error('Erro ao salvar observações');
    else { toast.success('Observações salvas'); setEditingObs(false); }
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

  const handleCreateAndAddTag = () => {
    if (!projeto || !newTagName.trim()) return;
    createTag.mutate({ nome: newTagName.trim(), cor: newTagColor }, {
      onSuccess: (tag) => {
        addTag.mutate({ projeto_id: projeto.id, tag_id: tag.id });
        setNewTagName('');
      }
    });
  };

  const checklistDone = checklist?.filter(c => c.concluido).length ?? 0;
  const checklistTotal = checklist?.length ?? 0;
  const checkPercent = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;

  if (!projeto) return null;

  const dueDate = projeto.due_date ? new Date(projeto.due_date + 'T00:00:00') : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl">{projeto.clientes?.nome ?? 'Projeto'}</DialogTitle>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {etapaNome && <Badge variant="outline">{etapaNome}</Badge>}
            {projeto.consultores?.nome && <Badge variant="secondary">{projeto.consultores.nome}</Badge>}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main content - 2/3 */}
            <div className="md:col-span-2 space-y-6">
              {/* Tags */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Tag className="h-4 w-4" /> Tags
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tagVinculos?.map(v => (
                    <Badge
                      key={v.id}
                      className="text-xs gap-1 text-white cursor-pointer"
                      style={{ backgroundColor: v.projeto_tags.cor }}
                      onClick={() => removeTag.mutate({ projeto_id: projeto.id, tag_id: v.tag_id })}
                    >
                      {v.projeto_tags.nome}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setShowTagPicker(!showTagPicker)}>
                    <Plus className="h-3 w-3 mr-1" /> Tag
                  </Button>
                </div>
                {showTagPicker && (
                  <div className="p-3 rounded-md border bg-popover space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {allTags?.filter(t => !linkedTagIds.has(t.id)).map(tag => (
                        <Badge
                          key={tag.id}
                          className="text-xs cursor-pointer text-white hover:opacity-80"
                          style={{ backgroundColor: tag.cor }}
                          onClick={() => { addTag.mutate({ projeto_id: projeto.id, tag_id: tag.id }); }}
                        >
                          {tag.nome}
                        </Badge>
                      ))}
                    </div>
                    <Separator />
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Nova tag..."
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.slice(0, 6).map(c => (
                          <button
                            key={c}
                            className={cn("h-5 w-5 rounded-full border-2", newTagColor === c ? 'border-foreground' : 'border-transparent')}
                            style={{ backgroundColor: c }}
                            onClick={() => setNewTagColor(c)}
                          />
                        ))}
                      </div>
                      <Button size="sm" className="h-7 text-xs" onClick={handleCreateAndAddTag}>Criar</Button>
                    </div>
                  </div>
                )}
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

              {/* Checklist with progress bar */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <CheckSquare className="h-4 w-4" />
                  Checklist {checklistTotal > 0 && `(${checklistDone}/${checklistTotal})`}
                </h4>
                {checklistTotal > 0 && (
                  <Progress value={checkPercent} className="h-2 mb-3" />
                )}
                <div className="space-y-2">
                  {checklist?.map(item => (
                    <div key={item.id} className="rounded-md border border-border/50 p-2 group space-y-1">
                      <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-2 pl-6 flex-wrap">
                        {/* Assigned to */}
                        <select
                          className="text-[10px] bg-transparent border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground"
                          value={item.assigned_to ?? ''}
                          onChange={e => updateCheckItem.mutate({
                            id: item.id, projeto_id: projeto.id,
                            assigned_to: e.target.value || null,
                          })}
                        >
                          <option value="">Sem responsável</option>
                          {consultoresList?.filter(c => c.ativo).map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                        {/* Due date */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-[10px] bg-transparent border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {item.due_date ? format(new Date(item.due_date + 'T00:00:00'), 'dd/MM/yy') : 'Prazo'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                            <Calendar
                              mode="single"
                              selected={item.due_date ? new Date(item.due_date + 'T00:00:00') : undefined}
                              onSelect={(date) => updateCheckItem.mutate({
                                id: item.id, projeto_id: projeto.id,
                                due_date: date ? format(date, 'yyyy-MM-dd') : null,
                              })}
                              className="p-3 pointer-events-auto"
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
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

            {/* Sidebar - 1/3 */}
            <div className="space-y-6">
              {/* Due Date */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" /> Data limite
                </h4>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(
                      "w-full justify-start text-left font-normal",
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
                          {Number(r.score_ia).toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
